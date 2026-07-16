import { expect, test } from "vitest";
import { rewriteHtml, type RewriteMap } from "../src/rewrite-html.js";

test("img becomes a picture with avif/webp sources and original fallback", () => {
  const map: RewriteMap = new Map([
    ["photo.jpg", { type: "picture", ref: { avif: "photo.avif", webp: "photo.webp", fallback: "photo.jpg" } }],
  ]);
  const out = rewriteHtml(`<img src="photo.jpg" alt="A">`, map);
  expect(out).toContain(`<picture>`);
  expect(out).toContain(`<source srcset="photo.avif" type="image/avif">`);
  expect(out).toContain(`<source srcset="photo.webp" type="image/webp">`);
  expect(out).toContain(`<img src="photo.jpg" alt="A">`);
});

test("script and link references gain the cdn url plus SRI", () => {
  const map: RewriteMap = new Map([
    ["app.js", { type: "plain", url: "https://cdn.patu.dev/app.js", integrity: "sha384-a" }],
    ["main.css", { type: "plain", url: "https://cdn.patu.dev/main.css", integrity: "sha384-b" }],
  ]);
  const out = rewriteHtml(`<link rel="stylesheet" href="main.css"><script src="app.js"></script>`, map);
  expect(out).toContain(`href="https://cdn.patu.dev/main.css"`);
  expect(out).toContain(`integrity="sha384-b"`);
  expect(out).toContain(`crossorigin="anonymous"`);
  expect(out).toContain(`src="https://cdn.patu.dev/app.js"`);
  expect(out).toContain(`integrity="sha384-a"`);
});

test("references not in the map are left untouched", () => {
  const out = rewriteHtml(`<img src="untouched.png">`, new Map());
  expect(out).toBe(`<img src="untouched.png">`);
});
