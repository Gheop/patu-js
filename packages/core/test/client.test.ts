import { afterEach, expect, test } from "vitest";
import { resolveConfig } from "../src/config.js";
import { PatuClient } from "../src/client.js";
import { startFakeServer, type FakeServer } from "./helpers/fake-server.js";

let srv: FakeServer;
afterEach(() => srv?.close());

const bytes = () => new TextEncoder().encode("x".repeat(1000));

test("compress returns smaller bytes and the parsed headers", async () => {
  srv = await startFakeServer();
  const client = new PatuClient(resolveConfig({ apiKey: "k", endpoint: srv.url, env: {} }));
  const out = await client.compress(bytes(), { contentType: "image/jpeg", formats: ["webp"] });
  expect(out.ok).toBe(true);
  if (out.ok) {
    expect(out.outputBytes).toBe(500);
    expect(out.format).toBe("webp");
    expect(out.integrity).toMatch(/^sha384-/);
    expect(out.score).toBe(92.5);
  }
});

test("retries retryable 500s then succeeds", async () => {
  srv = await startFakeServer((n) => (n < 3 ? "500" : "ok"));
  const client = new PatuClient(resolveConfig({ apiKey: "k", endpoint: srv.url, env: {} }));
  const out = await client.compress(bytes(), { contentType: "image/jpeg" });
  expect(out.ok).toBe(true);
  expect(srv.hits()).toBe(3);
});

test("gives up after max retries and returns an error, never throws", async () => {
  srv = await startFakeServer(() => "500");
  const client = new PatuClient(resolveConfig({ apiKey: "k", endpoint: srv.url, env: {} }));
  const out = await client.compress(bytes(), { contentType: "image/jpeg" });
  expect(out.ok).toBe(false);
  if (!out.ok) expect(out.error).toMatch(/500/);
});
