import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { parseArgs, run } from "../src/index.js";
import { startFakeServer, type FakeServer } from "../../core/test/helpers/fake-server.js";

let srv: FakeServer;
afterEach(() => srv?.close());

// withPatuKey runs `fn` with process.env.PATU_KEY set to a test value and
// restores whatever was there before, so tests never depend on (or leak
// changes to) the ambient shell environment.
async function withPatuKey<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const saved = process.env.PATU_KEY;
  if (value === undefined) delete process.env.PATU_KEY; else process.env.PATU_KEY = value;
  try {
    return await fn();
  } finally {
    if (saved === undefined) delete process.env.PATU_KEY; else process.env.PATU_KEY = saved;
  }
}

test("parseArgs reads the dir and flags", () => {
  const a = parseArgs(["dist", "--cdn", "--endpoint", "http://x"]);
  expect(a).toMatchObject({ dir: "dist", mode: "cdn", endpoint: "http://x" });
});

test("run optimizes a dist dir and reports (exit 0)", async () => {
  srv = await startFakeServer();
  const dir = await mkdtemp(join(tmpdir(), "patu-cli-"));
  await writeFile(join(dir, "photo.jpg"), Buffer.alloc(2000, 3));
  await writeFile(join(dir, "index.html"), `<img src="photo.jpg">`);
  const code = await withPatuKey("test-key", () => run([dir, "--endpoint", srv.url]));
  expect(code).toBe(0);
  expect(await readFile(join(dir, "index.html"), "utf8")).toContain("<picture>");
});

test("run returns 2 (usage) when no directory argument is given", async () => {
  expect(await run([])).toBe(2);
});

test("run returns 2 for a dir that looks like source (package.json + src/) without --force", async () => {
  const dir = await mkdtemp(join(tmpdir(), "patu-cli-src-"));
  await writeFile(join(dir, "package.json"), "{}");
  await mkdir(join(dir, "src"));
  expect(await run([dir])).toBe(2);
});

test("run returns 2 when PATU_KEY is missing (resolveConfig throws)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "patu-cli-nokey-"));
  const code = await withPatuKey(undefined, () => run([dir]));
  expect(code).toBe(2);
});

test("run with --strict against a failing asset returns 1, does not throw, and still prints the summary", async () => {
  srv = await startFakeServer(() => "500");
  const dir = await mkdtemp(join(tmpdir(), "patu-cli-strict-"));
  await writeFile(join(dir, "photo.jpg"), Buffer.alloc(2000, 3));
  await writeFile(join(dir, "index.html"), `<img src="photo.jpg">`);
  const logs: string[] = [];
  const logSpy = vi.spyOn(console, "log").mockImplementation((m: string) => { logs.push(m); });
  let code: number;
  try {
    code = await withPatuKey("test-key", () => run([dir, "--strict", "--endpoint", srv.url]));
  } finally {
    logSpy.mockRestore();
  }
  expect(code).toBe(1); // the bug: this used to throw a raw stack trace instead of returning
  expect(logs.some((l) => /assets optimized/.test(l))).toBe(true);
});

test("run against a nonexistent target directory returns 1 and does not throw", async () => {
  const dir = join(tmpdir(), "patu-cli-does-not-exist-" + Date.now());
  const code = await withPatuKey("test-key", () => run([dir])); // walk() rejects ENOENT
  expect(code).toBe(1);
});
