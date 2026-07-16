# 🕷️ @patu.dev/cli

Optimise a whole build directory's images, SVG and fonts through
[Patu](https://patu.dev) with one command. Point it at your `dist/`, get back
smaller files. Never bigger, never breaks your build.

Part of [**Patu for JavaScript**](https://github.com/Gheop/patu-js): see the root
README for the full story, the two modes, and the Vite plugin.

## Quick start

Grab a free key at [patu.dev](https://patu.dev), set it as `PATU_KEY`, then:

```bash
PATU_KEY=your_key  npx @patu.dev/cli ./dist
```

```text
patu: 7/9 assets optimized, 1.9 MB saved (63%), 0 failed
```

Add `--cdn` to also serve everything (JS and CSS included) from `cdn.patu.dev`,
with references rewritten and pinned with SRI, and the local originals kept as a
fallback.

## Usage

```text
patu <dir> [--cdn] [--strict] [--endpoint <url>] [--force]
```

| Flag | What it does |
|---|---|
| `--cdn` | Switch to `cdn` mode: store assets on the edge and rewrite references. Default is `optimize` (smaller bytes written back to disk). |
| `--strict` | Exit `1` if any asset failed. Default: keep the original, warn, exit `0`. |
| `--endpoint <url>` | Point at a different Patu endpoint (self-hosted or staging). |
| `--force` | Run even if the target looks like a source directory. |

`<dir>` is your build output (`dist/`, `build/`, `out/`). Patu refuses a folder
that looks like source (has both `package.json` and `src/`) unless you pass
`--force`, so you never accidentally rewrite your working tree.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Done (some assets may have been kept as-is; that's fine). |
| `1` | `--strict` was set and at least one asset failed. |
| `2` | Usage error: no `<dir>`, a source folder without `--force`, or a missing `PATU_KEY`. |

```bash
# typical CI step
PATU_KEY=$PATU_KEY  npx @patu.dev/cli ./dist --cdn --strict
```

## License

[MIT](./LICENSE).
