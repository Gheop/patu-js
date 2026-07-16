# 🕷️ @patu.dev/core

The engine under [Patu for JavaScript](https://github.com/Gheop/patu-js): the API
client, the content cache, the HTML/CSS rewriters, and the directory optimiser
that power [`@patu.dev/cli`](https://www.npmjs.com/package/@patu.dev/cli) and
[`@patu.dev/vite`](https://www.npmjs.com/package/@patu.dev/vite).

Reach for this package when you want to build your own integration (a webpack
loader, a custom CI script, a framework plugin). If you just want to optimise a
build, the CLI or the Vite plugin are the easier front doors. See the
[root README](https://github.com/Gheop/patu-js) for the two modes and the
guarantees.

Requires a Patu API key, via `PATU_KEY` in the environment or `{ apiKey }` passed
to `resolveConfig`.

## `resolveConfig(input?)`

```ts
import { resolveConfig } from "@patu.dev/core";

const cfg = resolveConfig({ mode: "cdn", strict: true });
```

Layers explicit input over `PATU_KEY` over built-in defaults into a `PatuConfig`.
Throws if no API key is found anywhere (missing input and missing `env.PATU_KEY`).
A missing key is a configuration error, never a silent no-op run.

```ts
interface PatuConfig {
  apiKey: string;
  endpoint: string;         // default "https://patu.dev"
  cdnBase: string;          // default "https://cdn.patu.dev"
  mode: "optimize" | "cdn"; // default "optimize"
  concurrency: number;      // default 6
  strict: boolean;          // default false
  target?: number;
}
```

## `PatuClient`

```ts
import { PatuClient } from "@patu.dev/core";

const client = new PatuClient(cfg);
const out = await client.compress(bytes, { contentType: "image/png", formats: ["avif", "webp"] });
const stored = await client.store(bytes, { contentType: "image/png" });
```

A thin wrapper over the Patu HTTP API. Every method resolves to a discriminated
`{ ok }` result and never throws, so a caller iterating over many assets never
has one failure abort the batch. Requests are gated by a shared concurrency
limiter (`cfg.concurrency`), and 429/5xx responses are retried with exponential
backoff honouring `Retry-After`.

- **`compress(bytes, { contentType, formats? })`**: one-shot optimisation. On
  success returns `{ ok: true, bytes, format, outputBytes, integrity, score, latencyMs }`.
- **`store(bytes, { contentType })`**: stores the asset on Patu's CDN. On success
  returns `{ ok: true, manifest }` (a `Manifest` with per-format `variants`).

## `optimizeDir(root, cfg, opts?)`

```ts
import { optimizeDir } from "@patu.dev/core";

const report = await optimizeDir("./dist", cfg, { log: (m) => console.warn(m) });
// report: { assets, optimized, failed, bytesBefore, bytesAfter, failures }
```

Walks a build-output directory, optimises every classified asset (images, SVG,
fonts, plus JS/CSS in `cdn` mode), writes results to disk, then rewrites the
HTML/CSS references that point at them. Never throws for a per-asset failure: the
original is kept and the failure recorded in `report.failures`. `opts.client`
injects a `PatuClient` (e.g. a fake for tests); `opts.cacheDir` overrides where
the `cdn`-mode content-hash cache lives (default `.patu/cache.json` under
`process.cwd()`).

Strictness is a caller policy, not an engine one: `optimizeDir` always returns
its report, and the caller (the CLI, the Vite plugin, or your own code) checks
`report.failed` to decide whether to fail.

## Other exports

Lower-level building blocks, available if you need them: `classify` (filename to
lane and content-type), `AssetCache` / `contentHash` (the cdn-mode dedup cache),
`rewriteHtml` / `rewriteCss` (the reference rewriters), `parseManifest`,
`sriIntegrity`, `createLimiter`.

## License

[MIT](./LICENSE).
