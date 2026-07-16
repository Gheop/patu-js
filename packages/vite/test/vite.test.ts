import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { build } from "vite";
import patu from "../src/index.js";
import { startFakeServer, type FakeServer } from "../../core/test/helpers/fake-server.js";

let srv: FakeServer;
afterEach(() => srv?.close());

test("vite build runs patu and upgrades the image to <picture>", async () => {
  srv = await startFakeServer();
  const root = await mkdtemp(join(tmpdir(), "patu-vite-"));
  await writeFile(join(root, "index.html"), `<!doctype html><html><body><img src="/photo.jpg" alt="A"></body></html>`);
  await writeFile(join(root, "photo.jpg"), Buffer.alloc(3000, 9));

  await build({
    root,
    logLevel: "silent",
    // A 3000-byte fixture is under Vite's default 4096-byte assetsInlineLimit,
    // which would base64-inline it into the HTML instead of emitting a file on
    // disk for the engine to optimize. Force every asset to be emitted.
    build: { outDir: join(root, "dist"), assetsInlineLimit: 0 },
    plugins: [patu({ apiKey: "k", endpoint: srv.url })],
  });

  const html = await readFile(join(root, "dist", "index.html"), "utf8");
  expect(html).toContain("<picture>");
  expect(html).toContain('type="image/avif"');
}, 30000);

test("vite build resolves a relative outDir against a non-cwd root", async () => {
  srv = await startFakeServer();
  const root = await mkdtemp(join(tmpdir(), "patu-vite-relout-"));
  await writeFile(join(root, "index.html"), `<!doctype html><html><body><img src="/photo.jpg" alt="A"></body></html>`);
  await writeFile(join(root, "photo.jpg"), Buffer.alloc(5000, 9));

  await build({
    root,
    logLevel: "silent",
    // outDir is deliberately RELATIVE (Vite's own default-style value), and
    // root is NOT process.cwd(). Vite resolves this internally to
    // <root>/dist but never writes the resolved path back onto
    // viteConfig.build.outDir, so a plugin that reads it raw would pass
    // "dist" to optimizeDir and resolve it against process.cwd() instead.
    build: { outDir: "dist", assetsInlineLimit: 0 },
    plugins: [patu({ apiKey: "k", endpoint: srv.url })],
  });

  const html = await readFile(join(root, "dist", "index.html"), "utf8");
  expect(html).toContain("<picture>");
  expect(html).toContain('type="image/avif"');
}, 30000);

test("vite build with strict:true rejects when an asset fails to optimize", async () => {
  srv = await startFakeServer(() => "500");
  const root = await mkdtemp(join(tmpdir(), "patu-vite-strict-"));
  await writeFile(join(root, "index.html"), `<!doctype html><html><body><img src="/photo.jpg" alt="A"></body></html>`);
  await writeFile(join(root, "photo.jpg"), Buffer.alloc(3000, 9));

  await expect(
    build({
      root,
      logLevel: "silent",
      build: { outDir: join(root, "dist"), assetsInlineLimit: 0 },
      plugins: [patu({ apiKey: "k", endpoint: srv.url, strict: true })],
    }),
  ).rejects.toThrow();
}, 30000);
