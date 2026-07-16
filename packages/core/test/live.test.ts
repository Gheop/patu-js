import { expect, test } from "vitest";
import { resolveConfig } from "../src/config.js";
import { PatuClient } from "../src/client.js";

const live = process.env.PATU_KEY ? test : test.skip;

// A real round trip against patu.dev, run only when PATU_KEY is present (CI
// secret / local dev). Proves the header contract still matches production.
live("compresses a real png against the live API", async () => {
  const cfg = resolveConfig({}); // reads PATU_KEY + default endpoint
  const client = new PatuClient(cfg);
  // 1x1 transparent PNG
  const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC"), (c) => c.charCodeAt(0));
  const out = await client.compress(png, { contentType: "image/png", formats: ["webp"] });
  expect(out.ok).toBe(true);
});
