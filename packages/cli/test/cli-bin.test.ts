import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, expect, test } from "vitest";

// Drives the real compiled bin the way `npx` / an installed CLI does: through a
// symlink. A unit test that imports run() cannot catch the main-module guard
// bug (running via the .bin symlink silently no-op'd because import.meta.url is
// the resolved real path while process.argv[1] was the symlink path).
const dist = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

beforeAll(() => {
  // CI builds before testing; build on demand when running vitest alone.
  if (!existsSync(dist)) {
    execFileSync("pnpm", ["--filter", "@patu.dev/cli", "build"], { cwd: repoRoot, stdio: "ignore" });
  }
});

test("the bin runs when invoked through a symlink (npx / node_modules/.bin)", () => {
  const dir = mkdtempSync(join(tmpdir(), "patu-bin-"));
  const link = join(dir, "patu");
  symlinkSync(dist, link);

  let stdout = "";
  let code = 0;
  try {
    // No args: run() must print usage and exit 2. Reaching that proves the
    // auto-run guard fired through the symlink.
    stdout = execFileSync(process.execPath, [link], { encoding: "utf8" });
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    code = err.status ?? 1;
    stdout = (err.stdout ?? "") + (err.stderr ?? "");
  }
  expect(code).toBe(2);
  expect(stdout).toContain("usage: patu");
});
