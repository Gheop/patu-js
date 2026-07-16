import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { parseArgs, run } from "../src/index.js";
import { startFakeServer, type FakeServer } from "../../core/test/helpers/fake-server.js";

let srv: FakeServer;
afterEach(() => srv?.close());

test("parseArgs reads the dir and flags", () => {
  const a = parseArgs(["dist", "--cdn", "--endpoint", "http://x"]);
  expect(a).toMatchObject({ dir: "dist", mode: "cdn", endpoint: "http://x" });
});

test("run optimizes a dist dir and reports (exit 0)", async () => {
  srv = await startFakeServer();
  const dir = await mkdtemp(join(tmpdir(), "patu-cli-"));
  await writeFile(join(dir, "photo.jpg"), Buffer.alloc(2000, 3));
  await writeFile(join(dir, "index.html"), `<img src="photo.jpg">`);
  const code = await run([dir, "--endpoint", srv.url]);
  expect(code).toBe(0);
  expect(await readFile(join(dir, "index.html"), "utf8")).toContain("<picture>");
});
