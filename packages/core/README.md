# @patu/core

The Patu engine: config resolution, the HTTP client, the rewriters and the
directory optimizer that power [`@patu/cli`](../cli/README.md) and
[`@patu/vite`](../vite/README.md). Use it directly to build your own
integration; otherwise see the [root README](../../README.md) for the two
CLI/Vite façades, the two modes, and the guarantees.

Requires a Patu API key, via `PATU_KEY` in the environment or `{ apiKey }`
passed to `resolveConfig`.

## `resolveConfig(input?)`

```ts
import { resolveConfig } from "@patu/core";

const cfg = resolveConfig({ mode: "cdn", strict: true });
```

Layers explicit input over `PATU_KEY` over built-in defaults into a
`PatuConfig`. Throws if no API key is found anywhere (missing input, missing
`env.PATU_KEY`) — a missing key is a configuration error, never a silent
no-op run.

```ts
interface PatuConfig {
  apiKey: string;
  endpoint: string;   // default "https://patu.dev"
  cdnBase: string;     // default "https://cdn.patu.dev"
  mode: "optimize" | "cdn"; // default "optimize"
  concurrency: number; // default 6
  strict: boolean;      // default false
  target?: number;
}

interface ConfigInput extends Partial<PatuConfig> {
  env?: NodeJS.ProcessEnv; // for testing; defaults to process.env
}
```

## `PatuClient`

```ts
import { PatuClient } from "@patu/core";

const client = new PatuClient(cfg);
const out = await client.compress(bytes, { contentType: "image/png", formats: ["avif", "webp"] });
const stored = await client.store(bytes, { contentType: "image/png" });
```

Thin wrapper over the Patu HTTP API. Every method resolves to a discriminated
`{ ok }` result and never throws — a caller iterating over many assets never
has one failure abort the batch. Requests are gated by a shared concurrency
limiter (`cfg.concurrency`), and 429/5xx responses are retried with
exponential backoff honoring `Retry-After`.

- `compress(bytes, { contentType, formats? })` — one-shot optimization; on
  success returns `{ ok: true, bytes, format, outputBytes, integrity, score, latencyMs }`.
- `store(bytes, { contentType })` — stores the asset on Patu's CDN; on
  success returns `{ ok: true, manifest }` (a `Manifest` with per-format
  `variants`).

## `optimizeDir(root, cfg, opts?)`

```ts
import { optimizeDir } from "@patu/core";

const report = await optimizeDir("./dist", cfg, { log: (m) => console.warn(m) });
// report: { assets, optimized, failed, bytesBefore, bytesAfter, failures }
```

Walks a build-output directory, optimizes every classified asset (images,
SVG, fonts, and — in `cdn` mode — JS/CSS), writes results to disk, then
rewrites the HTML/CSS references that point at them. Never throws for a
per-asset failure: the original is kept and the failure recorded in
`report.failures`. `opts.client` lets a caller inject a `PatuClient` (e.g. a
fake for tests); `opts.cacheDir` overrides where the `cdn`-mode content-hash
cache is stored (default `.patu/cache.json` under `process.cwd()`).

Strictness is a caller policy, not an engine one: `optimizeDir` always
returns its report; the caller (CLI, Vite plugin, or your own code) checks
`cfg.strict` and `report.failed` to decide whether to fail.

## Other exports

Lower-level building blocks used internally and available if you need them:
`classify` (filename → lane/content-type), `AssetCache`/`contentHash` (the
cdn-mode dedup cache), `rewriteHtml`/`rewriteCss` (reference rewriters),
`parseManifest`, `sriIntegrity`, `createLimiter`.
