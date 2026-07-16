import { expect, test } from "vitest";
import { resolveConfig } from "../src/config.js";

test("reads the key from PATU_KEY and applies defaults", () => {
  const c = resolveConfig({ env: { PATU_KEY: "k_123" } });
  expect(c.apiKey).toBe("k_123");
  expect(c.endpoint).toBe("https://patu.dev");
  expect(c.cdnBase).toBe("https://cdn.patu.dev");
  expect(c.mode).toBe("optimize");
  expect(c.concurrency).toBe(6);
  expect(c.strict).toBe(false);
});

test("explicit input overrides env and defaults", () => {
  const c = resolveConfig({ apiKey: "k_x", endpoint: "http://localhost:8080", mode: "cdn", concurrency: 2, env: {} });
  expect(c.apiKey).toBe("k_x");
  expect(c.endpoint).toBe("http://localhost:8080");
  expect(c.mode).toBe("cdn");
  expect(c.concurrency).toBe(2);
});

test("throws a clear error when no key is available", () => {
  expect(() => resolveConfig({ env: {} })).toThrow(/PATU_KEY/);
});
