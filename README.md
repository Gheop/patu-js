# Patu for JavaScript

Optimize your site's images, SVG, fonts, JS and CSS through [Patu](https://patu.dev)
— with one command or one Vite plugin.

This is a pnpm monorepo with three packages:

- [`@patu.dev/core`](packages/core/README.md) — the engine (config, HTTP client, cache, rewriters). Used directly if you're building your own integration.
- [`@patu.dev/cli`](packages/cli/README.md) — the `patu` command, for any build output.
- [`@patu.dev/vite`](packages/vite/README.md) — a Vite plugin that runs the same engine after `vite build`.

All packages require a Patu API key. Get one at [patu.dev](https://patu.dev)
and set it as `PATU_KEY` in your environment.

## Install

```bash
npm install --save-dev @patu.dev/cli
# or
npm install --save-dev @patu.dev/vite
```

## CLI quick start

```bash
PATU_KEY=your_key npx @patu.dev/cli ./dist
```

Optimizes images/SVG/fonts in `./dist` in place: smaller bytes written to
disk, never larger, never broken. Add `--cdn` to also store assets on
`cdn.patu.dev` (JS and CSS included) and rewrite references to them.

```
patu <dir> [--cdn] [--strict] [--endpoint URL] [--force]
```

## Vite quick start

```ts
// vite.config.ts
import patu from "@patu.dev/vite";

export default {
  plugins: [patu()], // reads PATU_KEY; runs after `vite build`
};
// or: patu({ mode: "cdn" })
```

## The two modes

- **`optimize`** (default): images, SVG and fonts only. Smaller bytes are
  written to disk in place. No account storage is used, and JS/CSS are left
  untouched — bundlers already minify and content-hash them, so this mode's
  scope stops at binary/markup assets.
- **`cdn`**: all supported types, including JS and CSS. Assets are stored on
  `cdn.patu.dev` and references in HTML/CSS are rewritten to point there, with
  Subresource Integrity (SRI) attributes added. A local original is always
  kept on disk alongside the rewrite.

## Guarantees

- **Never bigger:** an asset that can't be shrunk is left untouched — the
  original stays.
- **Never breaks your build:** an API or network failure keeps the original
  file and logs a warning instead of failing. Pass `--strict` (CLI) or
  `{ strict: true }` (Vite) to make that failure exit non-zero / fail the
  build instead.

## Known limitations

- **`cdn` mode has no on-disk fallback for `<script>` and `<link>` tags.**
  Only `<img>` degrades gracefully: it becomes a `<picture>` whose `<source>`s
  point at the CDN but whose fallback `<img>` still points at the local
  original, so a CDN outage just loses the format upgrade. Rewritten
  `<script src>` and `<link rel="stylesheet" href>` point at `cdn.patu.dev`
  with no fallback — if the CDN is unreachable, that JS or CSS will fail to
  load. If that risk is unacceptable for your JS/CSS delivery, keep those
  assets on `optimize` mode's default scope (which doesn't touch them) or
  serve them yourself.
- **Only static HTML/CSS references are rewritten.** The rewriters look at
  `<img src>`, `<script src>`, `<link href>`, and CSS `url()`/`@font-face` as
  written in the build output. URLs constructed at runtime in JavaScript
  (e.g. `new Image().src = base + name + ".png"`) are not seen and are left
  untouched.
