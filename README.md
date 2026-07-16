# 🕷️ Patu for JavaScript

**Weave a lighter web.** One command, or one Vite plugin, and Patu shrinks the
images, SVG and fonts your site ships, then (if you like) serves them from the
edge. No local image toolchain, no native binaries to compile, no config
spelunking. You point Patu at your build; smaller files come out the other side.

[![@patu.dev/cli](https://img.shields.io/npm/v/@patu.dev/cli?label=%40patu.dev%2Fcli&color=d98a45)](https://www.npmjs.com/package/@patu.dev/cli)
[![@patu.dev/vite](https://img.shields.io/npm/v/@patu.dev/vite?label=%40patu.dev%2Fvite&color=d98a45)](https://www.npmjs.com/package/@patu.dev/vite)
[![node](https://img.shields.io/node/v/@patu.dev/cli?color=3c873a)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/@patu.dev/cli?color=555)](./LICENSE)

```text
       your build output                                     what ships to users
   ┌─────────────────────┐                             ┌─────────────────────┐
   │ hero.jpg     2.1 MB │                             │ hero.avif    384 KB │
   │ chart.png    540 KB │   ───▶  patu weaves  ───▶   │ chart.webp    92 KB │
   │ logo.svg      14 KB │                             │ logo.svg       5 KB │
   │ Inter.ttf    310 KB │                             │ Inter.woff2   61 KB │
   └─────────────────────┘                             └─────────────────────┘
        ~3 MB, "meh"           npx @patu.dev/cli ./dist        ~540 KB, "oh."
```

<sub>Numbers are illustrative. Patu's one iron rule: it **never** makes a file bigger, and never touches one it can't beat.</sub>

---

## Why Patu?

You already have a bundler. It minifies your JS and CSS beautifully, then happily
ships a 2 MB hero JPEG, a PNG chart that should have been WebP, and a full-fat
TTF. The last mile of web weight is images, SVG and fonts, and doing it well
means AVIF encoders, quality tuning, SVG sanitising, font subsetting… a toolchain
nobody wants to babysit in CI.

Patu is that toolchain, hosted. You send bytes, you get back the smallest correct
version, measured rather than guessed. This package is the friendly front door: a
CLI for any build, a plugin for Vite.

## 30-second start

Grab a free API key at **[patu.dev](https://patu.dev)**, set it as `PATU_KEY`, then:

### CLI, for any build output

```bash
PATU_KEY=your_key  npx @patu.dev/cli ./dist
```

```text
patu: 7/9 assets optimized, 1.9 MB saved (63%), 0 failed
```

### Vite, set it and forget it

```ts
// vite.config.ts
import patu from "@patu.dev/vite";

export default {
  plugins: [patu()], // reads PATU_KEY; runs after `vite build`
};
```

Run your build. Images come out as AVIF/WebP wrapped in a `<picture>` (with the
original as a fallback), SVG comes out minified, fonts come out lean, all
"never bigger, never broken."

## Two ways to weave

Patu has two modes. The default keeps everything on your own host; the opt-in
mode moves delivery to the edge.

### 🧵 `optimize`: smaller files, still yours _(default)_

Optimises **images, SVG and fonts** and writes the smaller bytes right back into
your build directory. Nothing leaves your infrastructure, nothing is stored
remotely. You just ship lighter files from wherever you ship today.

```bash
npx @patu.dev/cli ./dist
```

### 🕸️ `cdn`: serve it from the edge _(opt-in)_

Stores your assets on `cdn.patu.dev` and rewrites the references in your HTML and
CSS to point there: Brotli-compressed, immutable-cached, and pinned with
[Subresource Integrity](https://developer.mozilla.org/docs/Web/Security/Subresource_Integrity).
This lane also covers your JS and CSS (delivery, not re-minifying). The local
originals stay on disk as a fallback.

```bash
npx @patu.dev/cli ./dist --cdn
# or in Vite:  patu({ mode: "cdn" })
```

## The guarantees (a spider keeps its promises)

- 🪶 **Never bigger.** If Patu can't beat a file, it leaves the original exactly
  as it was. Your build never gains weight.
- 🧶 **Never breaks your build.** If an asset can't be optimised (a network blip,
  an odd format, whatever), Patu keeps the original, prints a warning, and moves
  on. Pass `--strict` (CLI) or `strict: true` (Vite) if you'd rather the build
  fail loudly instead.
- 🔒 **Integrity by default.** Everything served from the CDN carries an SRI hash,
  so the browser verifies each file it fetches.

## Packages

| Package | What it's for |
|---|---|
| [`@patu.dev/cli`](packages/cli) | The `patu` command, to optimise any build output directory. |
| [`@patu.dev/vite`](packages/vite) | A Vite plugin: the same engine, wired into `vite build`. |
| [`@patu.dev/core`](packages/core) | The engine (API client, cache, rewriters). Use it directly to build your own integration. |

## CLI reference

```text
patu <dir> [--cdn] [--strict] [--endpoint <url>] [--force]
```

| Flag | Meaning |
|---|---|
| `--cdn` | Switch to `cdn` mode: store assets on the edge and rewrite references. |
| `--strict` | Exit non-zero if any asset fails (default: keep going, warn). |
| `--endpoint <url>` | Point at a different Patu endpoint (self-hosted / staging). |
| `--force` | Run even if the target looks like a source directory. |

Patu guards you from a classic footgun: point it at a folder that looks like
**source** (has both `package.json` and `src/`) and it refuses. Pass `--force`
if you really mean it. Aim it at your build output (`dist/`, `build/`, `out/`).

```bash
# typical CI step
PATU_KEY=$PATU_KEY  npx @patu.dev/cli ./dist --cdn --strict
```

## Vite plugin options

```ts
patu({
  mode: "optimize" | "cdn",     // default: "optimize"
  strict: false,                // true → a failed asset fails the build
  endpoint: "https://patu.dev",
  apiKey: process.env.PATU_KEY, // falls back to PATU_KEY automatically
});
```

The plugin only runs on `vite build` (never during `vite dev`), and it processes
what Vite actually emitted, hashed filenames and all.

## Good to know (the honest bits)

We'd rather tell you the edges up front than have you find them at 2 a.m.

- **In `cdn` mode, `<script>` and `<link>` have no local fallback.** Images
  degrade gracefully (the `<picture>` keeps a local `<img>`), but JS and CSS
  referenced via CDN URLs will fail to load if `cdn.patu.dev` is ever
  unreachable. If that risk isn't for you, keep scripts and styles in
  `optimize` mode.
- **Only static references are rewritten.** Patu rewrites `<img src>`,
  `<script src>`, `<link href>` and CSS `url()`/`@font-face` as written in your
  build output. URLs your app builds at runtime in JavaScript are left untouched.
- **Requires Node 20+, and it's ESM-only** (same neighbourhood as modern Vite).

## How it works

```text
   walk your build dir
           │
           ▼
   ┌──────────────────┐   image / svg / font ?   ┌────────────────────────────┐
   │  classify each   │ ───────────────────────▶ │  POST /v1/compress          │
   │      asset       │                          │  → smaller bytes (or same)  │
   └──────────────────┘                          └────────────────────────────┘
           │                                                   │
           │  cdn mode                                         ▼
           ▼                                         write to disk / edge,
   store on cdn.patu.dev  ──────────────────▶   then rewrite <img>→<picture>,
   (SRI + immutable cache)                      <link>/<script>, and css url()
```

The whole thing is content-addressed, so re-running on an unchanged build is
cheap, and a failing asset only ever affects itself.

## About the name

*Patu digua* is one of the smallest spiders known, about **0.37 mm**, small
enough to live on the webs of *larger* spiders. It weaves the lightest thread
there is. That's the whole idea: let something tiny do the weaving, so your pages
stay light. 🕸️

## License

[MIT](./LICENSE). Do what you like with it.
