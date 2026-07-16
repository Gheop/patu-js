import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, dirname, basename, extname } from "node:path";
import type { PatuConfig } from "./config.js";
import { PatuClient } from "./client.js";
import { classify, type Lane } from "./classify.js";
import { rewriteHtml, type RewriteEntry, type RewriteMap } from "./rewrite-html.js";
import { rewriteCss } from "./rewrite-css.js";
import { AssetCache, contentHash } from "./cache.js";
import { parseManifest, type Manifest } from "./manifest.js";

export interface EngineReport {
  assets: number; optimized: number; failed: number;
  bytesBefore: number; bytesAfter: number;
  failures: Array<{ file: string; error: string }>;
}

// A reference target is an absolute CDN url or a local file (absolute path).
// Keeping the target abstract lets mapForFile emit it as a relative or a
// root-absolute reference to match how each document wrote the original.
type Ref = { url: string } | { file: string };

// Produced is what one optimized asset yields, before it is resolved against a
// specific referencing file. `null` (from optimizeOne) means the reference does
// not change: original kept, or optimized in place at the same path.
interface Produced {
  picture?: { avif?: Ref; webp?: Ref; fallback: Ref };
  plain?: { target: Ref; integrity: string };
}

interface OneResult { produced: Produced | null; diskBytes: number }

// optimizeDir is the whole pipeline over a build-output directory. It optimizes
// every classified asset via its lane, writes results to disk, then rewrites
// html/css references. It never throws on a per-asset failure — the original is
// kept and recorded — so a partial API outage still yields a working build.
export async function optimizeDir(
  root: string,
  cfg: PatuConfig,
  opts: { client?: PatuClient; log?: (m: string) => void } = {},
): Promise<EngineReport> {
  const client = opts.client ?? new PatuClient(cfg);
  const log = opts.log ?? (() => {});
  const cache = await AssetCache.load(join(root, ".patu", "cache.json"));
  const files = await walk(root);
  const report: EngineReport = { assets: 0, optimized: 0, failed: 0, bytesBefore: 0, bytesAfter: 0, failures: [] };
  const produced = new Map<string, Produced>(); // absolute asset path -> produced refs

  await Promise.all(files
    .filter((f) => classify(basename(f)).lane !== "skip")
    .map(async (abs) => {
      report.assets++;
      const cls = classify(basename(abs));
      const bytes = new Uint8Array(await readFile(abs));
      report.bytesBefore += bytes.length;
      try {
        const res = await optimizeOne(abs, bytes, cls.lane, cls.contentType, cls.formats, cfg, client, cache);
        if (res.produced) produced.set(abs, res.produced);
        report.bytesAfter += res.diskBytes;
        if (res.diskBytes < bytes.length || res.produced) report.optimized++;
      } catch (e) {
        report.failed++;
        report.bytesAfter += bytes.length;
        report.failures.push({ file: relative(root, abs), error: e instanceof Error ? e.message : String(e) });
        log(`patu: kept original for ${relative(root, abs)} (${e instanceof Error ? e.message : e})`);
      }
    }));

  for (const abs of files) {
    const ext = extname(abs).toLowerCase();
    if (ext !== ".html" && ext !== ".css") continue;
    const localMap = mapForFile(abs, root, produced);
    if (localMap.size === 0) continue;
    const text = await readFile(abs, "utf8");
    const out = ext === ".html" ? rewriteHtml(text, localMap) : rewriteCss(text, localMap);
    if (out !== text) await writeFile(abs, out);
  }

  await cache.save();
  if (cfg.strict && report.failed > 0) throw new Error(`patu: ${report.failed} asset(s) failed and strict mode is on`);
  return report;
}

// optimizeOne routes one asset by mode and lane. optimize mode uses inline
// compress (no server storage): images request avif+webp written next to the
// original for a <picture>; svg/font/code are overwritten in place (no
// reference change → produced null). cdn mode stores the asset (its manifest is
// cached by content hash to skip re-uploading unchanged bytes) and references
// the manifest's cdn urls, keeping the local original as the <picture> fallback
// for graceful degradation.
async function optimizeOne(
  abs: string, bytes: Uint8Array, lane: Lane, contentType: string,
  formats: string[] | undefined, cfg: PatuConfig, client: PatuClient, cache: AssetCache,
): Promise<OneResult> {
  if (cfg.mode === "cdn") {
    const key = `cdn:${contentHash(bytes)}`;
    const hit = cache.get(key);
    let manifest: Manifest;
    if (hit && Array.isArray((hit as { variants?: unknown }).variants)) {
      manifest = parseManifest(hit);
    } else {
      const stored = await client.store(bytes, { contentType });
      if (!stored.ok) throw new Error(stored.error);
      manifest = stored.manifest;
      cache.set(key, manifest as unknown as Record<string, unknown>);
    }
    const cdnUrl = (v: { url: string }) => cfg.cdnBase + urlPath(v.url);
    if (lane === "image") {
      const avif = manifest.variants.find((v) => v.format === "avif");
      const webp = manifest.variants.find((v) => v.format === "webp");
      return {
        produced: { picture: {
          avif: avif ? { url: cdnUrl(avif) } : undefined,
          webp: webp ? { url: cdnUrl(webp) } : undefined,
          fallback: { file: abs }, // local original: still works if the CDN is down
        } },
        diskBytes: bytes.length, // original stays on disk unchanged
      };
    }
    const best = [...manifest.variants].sort((a, b) => a.bytes - b.bytes)[0];
    return { produced: { plain: { target: { url: cdnUrl(best) }, integrity: best.integrity } }, diskBytes: bytes.length };
  }

  // optimize mode (inline; no server storage; uncached — server-side content
  // dedup keeps re-uploads of unchanged bytes cheap).
  if (lane === "image") {
    const written: { avif?: Ref; webp?: Ref } = {};
    let smallest = bytes.length;
    for (const fmt of formats ?? []) {
      const out = await client.compress(bytes, { contentType, formats: [fmt] });
      if (!out.ok) throw new Error(out.error);
      if (out.outputBytes >= bytes.length) continue; // never bigger
      const p = withExt(abs, fmt);
      await writeFile(p, out.bytes);
      if (fmt === "avif") written.avif = { file: p };
      else if (fmt === "webp") written.webp = { file: p };
      smallest = Math.min(smallest, out.outputBytes);
    }
    if (!written.avif && !written.webp) return { produced: null, diskBytes: bytes.length }; // nothing helped
    return { produced: { picture: { avif: written.avif, webp: written.webp, fallback: { file: abs } } }, diskBytes: smallest };
  }

  // svg / font / code: single inline optimization, overwrite in place if smaller.
  const out = await client.compress(bytes, { contentType });
  if (!out.ok) throw new Error(out.error);
  if (out.outputBytes >= bytes.length) return { produced: null, diskBytes: bytes.length }; // never bigger
  await writeFile(abs, out.bytes); // overwrite in place; the reference is unchanged
  return { produced: null, diskBytes: out.outputBytes };
}

// mapForFile turns absolute-path Produced entries into a RewriteMap keyed the
// two ways a document references an asset: relative to the file's directory
// ("img/a.jpg") and root-absolute ("/img/a.jpg"). Local file targets are
// resolved into the matching form; cdn url targets are absolute already.
function mapForFile(file: string, root: string, produced: Map<string, Produced>): RewriteMap {
  const dir = dirname(file);
  const m: RewriteMap = new Map();
  for (const [abs, p] of produced) {
    const relKey = relative(dir, abs).split("\\").join("/");
    const absKey = "/" + relative(root, abs).split("\\").join("/");
    m.set(relKey, toEntry(p, (r) => resolveRel(r, dir)));
    m.set(absKey, toEntry(p, (r) => resolveAbs(r, root)));
  }
  return m;
}

function toEntry(p: Produced, resolve: (r: Ref) => string): RewriteEntry {
  if (p.picture) {
    return { type: "picture", ref: {
      avif: p.picture.avif ? resolve(p.picture.avif) : undefined,
      webp: p.picture.webp ? resolve(p.picture.webp) : undefined,
      fallback: resolve(p.picture.fallback),
    } };
  }
  return { type: "plain", url: resolve(p.plain!.target), integrity: p.plain!.integrity };
}

function resolveRel(r: Ref, dir: string): string { return "url" in r ? r.url : relative(dir, r.file).split("\\").join("/"); }
function resolveAbs(r: Ref, root: string): string { return "url" in r ? r.url : "/" + relative(root, r.file).split("\\").join("/"); }
function urlPath(u: string): string { return u.startsWith("http") ? new URL(u).pathname : u; }
function withExt(abs: string, ext: string): string { return join(dirname(abs), basename(abs, extname(abs)) + "." + ext); }

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}
