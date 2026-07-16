import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { looksLikeSource } from "../src/source-guard.js";

test("flags a directory that has package.json and src/", async () => {
  const dir = await mkdtemp(join(tmpdir(), "patu-src-"));
  await writeFile(join(dir, "package.json"), "{}");
  await mkdir(join(dir, "src"));
  expect(await looksLikeSource(dir)).toBe(true);
});

test("a plain dist directory is not source", async () => {
  const dir = await mkdtemp(join(tmpdir(), "patu-dist-"));
  await writeFile(join(dir, "index.html"), "<html></html>");
  expect(await looksLikeSource(dir)).toBe(false);
});
