import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import { sriIntegrity } from "../src/sri.js";

test("produces sha384 base64 with the sri prefix", () => {
  const bytes = new TextEncoder().encode("hello");
  const expected = "sha384-" + createHash("sha384").update(Buffer.from(bytes)).digest("base64");
  expect(sriIntegrity(bytes)).toBe(expected);
});
