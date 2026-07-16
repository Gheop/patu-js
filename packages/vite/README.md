# @patu.dev/vite

A Vite plugin that runs [`@patu.dev/core`](../core/README.md)'s optimizer over
Vite's build output — the same engine as [`@patu.dev/cli`](../cli/README.md), so
both behave identically. See the [root README](../../README.md) for the two
modes and the never-bigger/never-break guarantees.

Requires a Patu API key, via `PATU_KEY` in the environment or the `apiKey`
option.

## Usage

```ts
// vite.config.ts
import patu from "@patu.dev/vite";

export default {
  plugins: [patu()],
};
```

The plugin only runs for production builds (`apply: "build"`). It hooks
`closeBundle`, so it runs once Vite has finished writing `build.outDir`, and
optimizes that directory in place.

## `patu(options?)`

```ts
interface PatuPluginOptions {
  mode?: "optimize" | "cdn"; // default "optimize"
  endpoint?: string;          // default "https://patu.dev"
  strict?: boolean;           // default false
  apiKey?: string;            // falls back to PATU_KEY
}
```

- `mode: "cdn"` — store JS/CSS/images/SVG/fonts on `cdn.patu.dev` and rewrite
  references, instead of the default `optimize` (images/SVG/fonts only,
  smaller bytes written to disk, no account storage).
- `strict: true` — throw from `closeBundle` (failing the Vite build) if any
  asset failed to optimize. Default: keep the original, log a warning via
  Vite's logger, and let the build succeed.
- `endpoint` — override the Patu API endpoint.
- `apiKey` — pass a key directly instead of relying on `PATU_KEY`.

```ts
export default {
  plugins: [patu({ mode: "cdn", strict: true })],
};
```
