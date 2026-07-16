import { pathToFileURL } from "node:url";
import { resolveConfig, optimizeDir } from "@patu.dev/core";
import { looksLikeSource } from "./source-guard.js";

interface Args { dir: string; mode: "optimize" | "cdn"; strict: boolean; force: boolean; endpoint?: string }

// parseArgs is a minimal flag parser; the first non-flag argument is the target
// directory. Kept dependency-free.
export function parseArgs(argv: string[]): Args {
  const a: Args = { dir: "", mode: "optimize", strict: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--cdn") a.mode = "cdn";
    else if (t === "--strict") a.strict = true;
    else if (t === "--force") a.force = true;
    else if (t === "--endpoint") a.endpoint = argv[++i];
    else if (!t.startsWith("-") && !a.dir) a.dir = t;
  }
  return a;
}

export async function run(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  if (!args.dir) { console.error("usage: patu <dir> [--cdn] [--strict] [--endpoint URL] [--force]"); return 2; }
  if (!args.force && await looksLikeSource(args.dir)) {
    console.error(`patu: ${args.dir} looks like source (package.json + src/). Point at your build output, or pass --force.`);
    return 2;
  }
  let cfg;
  try {
    cfg = resolveConfig({ mode: args.mode, strict: args.strict, endpoint: args.endpoint });
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 2;
  }
  // optimizeDir never throws for per-asset/strict failures, but an unexpected
  // rejection (e.g. the target directory does not exist) must still exit
  // cleanly instead of crashing with a raw stack trace.
  let report;
  try {
    report = await optimizeDir(args.dir, cfg, { log: (m) => console.warn(m) });
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 1;
  }
  if (cfg.mode === "cdn") {
    // On disk every asset keeps its original bytes in cdn mode (the win is at
    // delivery, from the CDN edge), so a "KB saved" figure here would always
    // read as ~0 despite a real gain. Report what actually happened instead.
    console.log(`patu: ${report.optimized}/${report.assets} assets served from ${new URL(cfg.cdnBase).host}, ${report.failed} failed`);
  } else {
    const saved = report.bytesBefore - report.bytesAfter;
    const pct = report.bytesBefore ? Math.round((saved / report.bytesBefore) * 100) : 0;
    console.log(`patu: ${report.optimized}/${report.assets} assets optimized, ${(saved / 1024).toFixed(1)} KB saved (${pct}%), ${report.failed} failed`);
  }
  return args.strict && report.failed > 0 ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => { console.error(err instanceof Error ? err.message : String(err)); process.exit(1); });
}
