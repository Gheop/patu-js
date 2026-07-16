# @patu/cli

The `patu` command: runs [`@patu/core`](../core/README.md)'s optimizer over a
build-output directory. See the [root README](../../README.md) for the two
modes and the never-bigger/never-break guarantees.

Requires a Patu API key in `PATU_KEY`.

## Usage

```bash
PATU_KEY=your_key npx @patu/cli <dir> [--cdn] [--strict] [--endpoint URL] [--force]
```

- `<dir>` — the build output to optimize (required). Refused if it looks like
  a source directory (has both `package.json` and `src/`) unless `--force` is
  passed — point `patu` at your build output, not your project root.
- `--cdn` — switch from the default `optimize` mode to `cdn` mode: also
  stores JS/CSS/images/SVG/fonts on `cdn.patu.dev` and rewrites references to
  point there (with SRI), keeping a local original as fallback.
- `--strict` — exit with code 1 if any asset failed to optimize (default:
  keep the original, warn, exit 0).
- `--endpoint URL` — override the Patu API endpoint (default
  `https://patu.dev`). Mainly for testing against a non-production instance.
- `--force` — skip the source-directory guard.

On success it prints a one-line summary (assets optimized / bytes saved in
`optimize` mode, assets served from the CDN host in `cdn` mode) and exits 0
(or 1 under `--strict` with failures). Exits 2 for usage errors: missing
`<dir>`, a source-looking directory without `--force`, or a missing/invalid
`PATU_KEY`.
