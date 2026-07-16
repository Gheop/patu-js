import { expect, test } from "vitest";
import { createLimiter } from "../src/limit.js";

test("never runs more than n tasks at once", async () => {
  const limit = createLimiter(2);
  let active = 0, peak = 0;
  const task = () => limit(async () => {
    active++; peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 10));
    active--; return true;
  });
  await Promise.all(Array.from({ length: 6 }, task));
  expect(peak).toBeLessThanOrEqual(2);
});
