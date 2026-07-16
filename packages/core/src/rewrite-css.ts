import postcss from "postcss";
import type { RewriteMap } from "./rewrite-html.js";

const URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

// rewriteCss replaces url(...) references (backgrounds, @font-face src, etc.)
// with their optimized targets. A picture entry has no CSS analogue for format
// negotiation, so its fallback url is used. The original quote style is kept.
// postcss walks every declaration, so nested at-rules are covered.
export function rewriteCss(css: string, map: RewriteMap): string {
  const root = postcss.parse(css);
  root.walkDecls((decl) => {
    if (!decl.value.includes("url(")) return;
    decl.value = decl.value.replace(URL_RE, (whole, quote: string, ref: string) => {
      const entry = map.get(ref);
      if (!entry) return whole;
      const url = entry.type === "plain" ? entry.url : entry.ref.fallback;
      return `url(${quote}${url}${quote})`;
    });
  });
  return root.toString();
}
