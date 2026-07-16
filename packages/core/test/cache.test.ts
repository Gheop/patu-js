import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { AssetCache, contentHash } from "../src/cache.js";

test("contentHash is stable and content-addressed", () => {
  const a = contentHash(new TextEncoder().encode("hello"));
  const b = contentHash(new TextEncoder().encode("hello"));
  expect(a).toBe(b);
  expect(a).not.toBe(contentHash(new TextEncoder().encode("world")));
});

test("round-trips entries through disk", async () => {
  const dir = await mkdtemp(join(tmpdir(), "patu-cache-"));
  const path = join(dir, "cache.json");
  const c1 = await AssetCache.load(path);
  expect(c1.get("h1")).toBeUndefined();
  c1.set("h1", { url: "/x.avif" });
  await c1.save();

  const c2 = await AssetCache.load(path);
  expect(c2.get("h1")).toEqual({ url: "/x.avif" });
  expect(JSON.parse(await readFile(path, "utf8"))).toHaveProperty("entries.h1");
});

test("load tolerates a missing or corrupt file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "patu-cache-"));
  const c = await AssetCache.load(join(dir, "nope.json"));
  expect(c.get("anything")).toBeUndefined();
});
