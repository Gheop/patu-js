import { expect, test } from "vitest";
import { version } from "../src/index.js";

test("core exports a version", () => {
  expect(version).toBe("0.0.0");
});
