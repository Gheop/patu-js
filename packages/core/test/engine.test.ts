import { mkdtemp, mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { resolveConfig } from "../src/config.js";
import { PatuClient } from "../src/client.js";
import { optimizeDir } from "../src/engine.js";
import { startFakeServer, type FakeServer } from "./helpers/fake-server.js";

let srv: FakeServer;
afterEach(() => srv?.close());

async function fixture(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "patu-dist-"));
  await mkdir(join(dir, "img"), { recursive: true });
  await writeFile(join(dir, "img", "photo.jpg"), Buffer.alloc(2000, 7)); // compressible
  await writeFile(join(dir, "index.html"), `<img src="img/photo.jpg" alt="A">`);
  return dir;
}

test("optimize mode writes avif/webp and rewrites to <picture> keeping the directory", async () => {
  srv = await startFakeServer();
  const dir = await fixture();
  const cfg = resolveConfig({ apiKey: "k", endpoint: srv.url, mode: "optimize", concurrency: 4, env: {} });
  const report = await optimizeDir(dir, cfg, { client: new PatuClient(cfg) });

  expect(report.failed).toBe(0);
  expect(report.bytesAfter).toBeLessThan(report.bytesBefore);
  const html = await readFile(join(dir, "index.html"), "utf8");
  expect(html).toContain("<picture>");
  // The directory prefix must survive the rewrite (the bug this guards against).
  expect(html).toContain('<source srcset="img/photo.avif" type="image/avif">');
  expect(html).toContain('<source srcset="img/photo.webp" type="image/webp">');
  expect(html).toContain('<img src="img/photo.jpg"');
  await readFile(join(dir, "img", "photo.avif"));
  await readFile(join(dir, "img", "photo.webp"));
});

test("a root-absolute reference is rewritten root-absolute (the Vite case)", async () => {
  srv = await startFakeServer();
  const dir = await mkdtemp(join(tmpdir(), "patu-dist-"));
  await writeFile(join(dir, "photo.jpg"), Buffer.alloc(2000, 7));
  await writeFile(join(dir, "index.html"), `<img src="/photo.jpg" alt="A">`);
  const cfg = resolveConfig({ apiKey: "k", endpoint: srv.url, mode: "optimize", env: {} });
  await optimizeDir(dir, cfg, { client: new PatuClient(cfg) });
  const html = await readFile(join(dir, "index.html"), "utf8");
  expect(html).toContain('<source srcset="/photo.avif" type="image/avif">');
  expect(html).toContain('<img src="/photo.jpg"');
});

test("an asset failure keeps the original and is reported, build not broken", async () => {
  srv = await startFakeServer(() => "500");
  const dir = await fixture();
  const before = await readFile(join(dir, "index.html"), "utf8");
  const cfg = resolveConfig({ apiKey: "k", endpoint: srv.url, mode: "optimize", env: {} });
  const report = await optimizeDir(dir, cfg, { client: new PatuClient(cfg) });

  expect(report.failed).toBeGreaterThan(0);
  expect(await readFile(join(dir, "index.html"), "utf8")).toBe(before); // untouched
});

test("cdn mode rewrites to cdn urls with SRI, and a second run is served from cache", async () => {
  srv = await startFakeServer();
  const dir = await mkdtemp(join(tmpdir(), "patu-dist-"));
  await writeFile(join(dir, "app.js"), "console.log(1)\n".repeat(50));
  await writeFile(join(dir, "index.html"), `<script src="app.js"></script>`);
  const cfg = resolveConfig({ apiKey: "k", endpoint: srv.url, cdnBase: "https://cdn.patu.dev", mode: "cdn", env: {} });

  await optimizeDir(dir, cfg, { client: new PatuClient(cfg) });
  const html = await readFile(join(dir, "index.html"), "utf8");
  expect(html).toContain('src="https://cdn.patu.dev/');
  expect(html).toContain('integrity="');
  const afterFirst = srv.hits();

  // Restore the html and re-run: the manifest comes from the local cache, so
  // the store endpoint is not hit again.
  await writeFile(join(dir, "index.html"), `<script src="app.js"></script>`);
  await optimizeDir(dir, cfg, { client: new PatuClient(cfg) });
  expect(srv.hits()).toBe(afterFirst);
});

test("an unreadable asset is recorded as a failure and the run still completes", async () => {
  srv = await startFakeServer();
  const dir = await fixture();
  const brokenPath = join(dir, "broken.png");
  await writeFile(brokenPath, Buffer.alloc(100, 1));
  await chmod(brokenPath, 0o000); // simulate EACCES / a file gone missing mid-run

  const cfg = resolveConfig({ apiKey: "k", endpoint: srv.url, mode: "optimize", env: {} });
  const report = await optimizeDir(dir, cfg, { client: new PatuClient(cfg) });

  expect(report.failed).toBeGreaterThan(0);
  expect(report.failures.some((f) => f.file === "broken.png")).toBe(true);
  // the sibling asset in the same directory was still optimized
  const html = await readFile(join(dir, "index.html"), "utf8");
  expect(html).toContain("<picture>");
  await readFile(join(dir, "img", "photo.avif"));

  await chmod(brokenPath, 0o644); // restore so the temp dir can be cleaned up normally
});

test("a malformed CSS file is recorded as a failure and does not abort sibling rewrites", async () => {
  // Force the CSS request to come back "toobig" so the first-pass compress
  // step keeps it untouched on disk (never-bigger), letting the second pass's
  // rewriteCss(...) see the original malformed text and throw CssSyntaxError.
  srv = await startFakeServer((_n, info) => (info.contentType === "text/css" ? "toobig" : "ok"));
  const dir = await fixture();
  const malformedCss = ".a{"; // unclosed block
  await writeFile(join(dir, "style.css"), malformedCss);
  await writeFile(join(dir, "index.html"), `<img src="img/photo.jpg" alt="A"><link rel="stylesheet" href="style.css">`);

  const cfg = resolveConfig({ apiKey: "k", endpoint: srv.url, mode: "optimize", env: {} });
  const report = await optimizeDir(dir, cfg, { client: new PatuClient(cfg) });

  expect(report.failures.some((f) => f.file === "style.css")).toBe(true);
  expect(await readFile(join(dir, "style.css"), "utf8")).toBe(malformedCss); // left untouched
  // the sibling optimizable asset in the same dir was still optimized and rewritten
  const html = await readFile(join(dir, "index.html"), "utf8");
  expect(html).toContain("<picture>");
  await readFile(join(dir, "img", "photo.avif"));
});

test("optimize mode: one failing format is not fatal to the asset and leaves no orphan", async () => {
  // First request (avif) succeeds, every request after (webp, plus its
  // retries) fails permanently.
  srv = await startFakeServer((n) => (n === 1 ? "ok" : "500"));
  const dir = await fixture();
  const cfg = resolveConfig({ apiKey: "k", endpoint: srv.url, mode: "optimize", env: {} });
  const report = await optimizeDir(dir, cfg, { client: new PatuClient(cfg) });

  expect(report.failed).toBe(0);
  expect(report.optimized).toBeGreaterThan(0);
  const html = await readFile(join(dir, "index.html"), "utf8");
  expect(html).toContain("<picture>");
  expect(html).toContain('<source srcset="img/photo.avif" type="image/avif">');
  expect(html).not.toContain("photo.webp");
  await readFile(join(dir, "img", "photo.avif")); // written and referenced, not orphaned
  await expect(readFile(join(dir, "img", "photo.webp"))).rejects.toThrow(); // never written
}, 10000);

test("cdn mode keeps the original when no variant is smaller (never-bigger guard)", async () => {
  srv = await startFakeServer(); // fixed manifest: avif=100 bytes, webp=200 bytes
  const dir = await mkdtemp(join(tmpdir(), "patu-dist-"));
  await writeFile(join(dir, "app.js"), "x"); // 1 byte: smaller than any manifest variant
  const before = `<script src="app.js"></script>`;
  await writeFile(join(dir, "index.html"), before);
  const cfg = resolveConfig({ apiKey: "k", endpoint: srv.url, cdnBase: "https://cdn.patu.dev", mode: "cdn", env: {} });

  const report = await optimizeDir(dir, cfg, { client: new PatuClient(cfg) });
  expect(report.failed).toBe(0);
  const html = await readFile(join(dir, "index.html"), "utf8");
  expect(html).toBe(before); // untouched: no rewrite to a cdn url
});
