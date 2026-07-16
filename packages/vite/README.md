# 🕷️ @patu.dev/vite

A Vite plugin that optimises your build output through [Patu](https://patu.dev):
the same engine as the CLI, wired straight into `vite build`. Set it once, forget
it, ship lighter pages. Never bigger, never breaks your build.

Part of [**Patu for JavaScript**](https://github.com/Gheop/patu-js): see the root
README for the full story, the two modes, and the CLI.

## Quick start

Grab a free key at [patu.dev](https://patu.dev), set it as `PATU_KEY`, then:

```ts
// vite.config.ts
import patu from "@patu.dev/vite";

export default {
  plugins: [patu()], // reads PATU_KEY
};
```

Run `vite build`. Your images come out as AVIF/WebP inside a `<picture>`, your
SVG minified, your fonts lean. The plugin only runs for production builds
(`apply: "build"`), never during `vite dev`, and it processes what Vite actually
emitted, hashed filenames and all.

## Options

```ts
interface PatuPluginOptions {
  mode?: "optimize" | "cdn"; // default "optimize"
  endpoint?: string;         // default "https://patu.dev"
  strict?: boolean;          // default false
  apiKey?: string;           // falls back to PATU_KEY
}
```

- **`mode: "cdn"`** stores your assets (JS and CSS included) on `cdn.patu.dev`
  and rewrites references to point there, with SRI and a local fallback. The
  default `optimize` mode touches images, SVG and fonts only, writing smaller
  bytes back to disk with no remote storage.
- **`strict: true`** fails the Vite build if any asset failed to optimise.
  Default: keep the original, log a warning via Vite's logger, let the build
  succeed.
- **`endpoint`** points at a different Patu endpoint (self-hosted or staging).
- **`apiKey`** passes a key directly instead of relying on `PATU_KEY`.

```ts
export default {
  plugins: [patu({ mode: "cdn", strict: true })],
};
```

## License

[MIT](./LICENSE).
