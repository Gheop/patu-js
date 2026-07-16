import { expect, test } from "vitest";
import { classify } from "../src/classify.js";

test("routes images to the image lane with avif+webp targets", () => {
  const c = classify("photo.JPG");
  expect(c.lane).toBe("image");
  expect(c.formats).toEqual(["avif", "webp"]);
  expect(c.contentType).toBe("image/jpeg");
});

test("svg, fonts and code get their own lanes", () => {
  expect(classify("icon.svg").lane).toBe("svg");
  expect(classify("Inter.woff2").lane).toBe("font");
  expect(classify("app.js").lane).toBe("code");
  expect(classify("main.css").lane).toBe("code");
});

test("unknown and html extensions are skipped", () => {
  expect(classify("index.html").lane).toBe("skip");
  expect(classify("data.json").lane).toBe("skip");
});
