import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { resolveConfig } from "../src/config.js";
import { PatuClient } from "../src/client.js";
import { optimizeDir } from "../src/engine.js";
import { startFakeServer, type FakeServer } from "./helpers/fake-server.js";

let srv: FakeServer;
afterEach(() => srv?.close());

async function fixture(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "patu-dist-"));
  await mkdir(join(dir, "img"), { recursive: true });
  await writeFile(join(dir, "img", "photo.jpg"), Buffer.alloc(2000, 7)); // compressible
  await writeFile(join(dir, "index.html"), `<img src="img/photo.jpg" alt="A">`);
  return dir;
}

test("optimize mode writes avif/webp and rewrites to <picture> keeping the directory", async () => {
  srv = await startFakeServer();
  const dir = await fixture();
  const cfg = resolveConfig({ apiKey: "k", endpoint: srv.url, mode: "optimize", concurrency: 4, env: {} });
  const report = await optimizeDir(dir, cfg, { client: new PatuClient(cfg) });

  expect(report.failed).toBe(0);
  expect(report.bytesAfter).toBeLessThan(report.bytesBefore);
  const html = await readFile(join(dir, "index.html"), "utf8");
  expect(html).toContain("<picture>");
  // The directory prefix must survive the rewrite (the bug this guards against).
  expect(html).toContain('<source srcset="img/photo.avif" type="image/avif">');
  expect(html).toContain('<source srcset="img/photo.webp" type="image/webp">');
  expect(html).toContain('<img src="img/photo.jpg"');
  await readFile(join(dir, "img", "photo.avif"));
  await readFile(join(dir, "img", "photo.webp"));
});

test("a root-absolute reference is rewritten root-absolute (the Vite case)", async () => {
  srv = await startFakeServer();
  const dir = await mkdtemp(join(tmpdir(), "patu-dist-"));
  await writeFile(join(dir, "photo.jpg"), Buffer.alloc(2000, 7));
  await writeFile(join(dir, "index.html"), `<img src="/photo.jpg" alt="A">`);
  const cfg = resolveConfig({ apiKey: "k", endpoint: srv.url, mode: "optimize", env: {} });
  await optimizeDir(dir, cfg, { client: new PatuClient(cfg) });
  const html = await readFile(join(dir, "index.html"), "utf8");
  expect(html).toContain('<source srcset="/photo.avif" type="image/avif">');
  expect(html).toContain('<img src="/photo.jpg"');
});

test("an asset failure keeps the original and is reported, build not broken", async () => {
  srv = await startFakeServer(() => "500");
  const dir = await fixture();
  const before = await readFile(join(dir, "index.html"), "utf8");
  const cfg = resolveConfig({ apiKey: "k", endpoint: srv.url, mode: "optimize", env: {} });
  const report = await optimizeDir(dir, cfg, { client: new PatuClient(cfg) });

  expect(report.failed).toBeGreaterThan(0);
  expect(await readFile(join(dir, "index.html"), "utf8")).toBe(before); // untouched
});

test("cdn mode rewrites to cdn urls with SRI, and a second run is served from cache", async () => {
  srv = await startFakeServer();
  const dir = await mkdtemp(join(tmpdir(), "patu-dist-"));
  await writeFile(join(dir, "app.js"), "console.log(1)\n".repeat(50));
  await writeFile(join(dir, "index.html"), `<script src="app.js"></script>`);
  const cfg = resolveConfig({ apiKey: "k", endpoint: srv.url, cdnBase: "https://cdn.patu.dev", mode: "cdn", env: {} });

  await optimizeDir(dir, cfg, { client: new PatuClient(cfg) });
  const html = await readFile(join(dir, "index.html"), "utf8");
  expect(html).toContain('src="https://cdn.patu.dev/');
  expect(html).toContain('integrity="');
  const afterFirst = srv.hits();

  // Restore the html and re-run: the manifest comes from the local cache, so
  // the store endpoint is not hit again.
  await writeFile(join(dir, "index.html"), `<script src="app.js"></script>`);
  await optimizeDir(dir, cfg, { client: new PatuClient(cfg) });
  expect(srv.hits()).toBe(afterFirst);
});
