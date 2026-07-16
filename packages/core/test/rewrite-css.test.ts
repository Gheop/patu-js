import { expect, test } from "vitest";
import { rewriteCss } from "../src/rewrite-css.js";
import type { RewriteMap } from "../src/rewrite-html.js";

test("rewrites url() references, including @font-face", () => {
  const map: RewriteMap = new Map([
    ["hero.png", { type: "plain", url: "https://cdn.patu.dev/hero.png" }],
    ["Inter.woff2", { type: "plain", url: "https://cdn.patu.dev/Inter.woff2" }],
  ]);
  const css = `.h{background:url(hero.png)}@font-face{font-family:X;src:url("Inter.woff2") format("woff2")}`;
  const out = rewriteCss(css, map);
  expect(out).toContain("url(https://cdn.patu.dev/hero.png)");
  expect(out).toContain('url("https://cdn.patu.dev/Inter.woff2")');
});

test("a picture entry rewrites url() to its fallback (css cannot negotiate)", () => {
  const map: RewriteMap = new Map([
    ["bg.jpg", { type: "picture", ref: { avif: "bg.avif", webp: "bg.webp", fallback: "bg.webp" } }],
  ]);
  expect(rewriteCss(`.a{background:url(bg.jpg)}`, map)).toContain("url(bg.webp)");
});

test("leaves unmapped and absolute urls untouched", () => {
  const css = `.a{background:url(https://ex.com/x.png)}.b{background:url(local.png)}`;
  expect(rewriteCss(css, new Map())).toBe(css);
});
