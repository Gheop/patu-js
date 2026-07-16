import { expect, test } from "vitest";
import { parseManifest } from "../src/manifest.js";

test("parses a stored manifest and its variants", () => {
  const m = parseManifest({
    schema: 1, id: "abc",
    variants: [
      { url: "/v1/asset/abc/200.avif", format: "avif", width: 200, bytes: 1234, integrity: "sha384-a" },
      { url: "/v1/asset/abc/200.webp", format: "webp", width: 200, bytes: 2000, integrity: "sha384-b" },
    ],
  });
  expect(m.id).toBe("abc");
  expect(m.variants).toHaveLength(2);
  expect(m.variants[0].format).toBe("avif");
});

test("throws on a malformed manifest", () => {
  expect(() => parseManifest({ id: 1 })).toThrow(/manifest/i);
});
