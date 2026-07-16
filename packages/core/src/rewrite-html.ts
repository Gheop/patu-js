import { parse } from "node-html-parser";

export interface PictureRef { avif?: string; webp?: string; fallback: string }
export type RewriteEntry =
  | { type: "picture"; ref: PictureRef }
  | { type: "plain"; url: string; integrity?: string };
export type RewriteMap = Map<string, RewriteEntry>;

// rewriteHtml swaps asset references for their optimized ones. <img> whose src
// is a picture entry becomes a <picture> with avif/webp <source>s and the
// original <img> kept as the fallback (format upgrade, no srcset). <script src>
// and <link rel=stylesheet href> get the new url plus SRI + crossorigin.
// References absent from the map are left exactly as written.
export function rewriteHtml(html: string, map: RewriteMap): string {
  const root = parse(html, { comment: true });

  for (const img of root.querySelectorAll("img")) {
    const src = img.getAttribute("src");
    const entry = src ? map.get(src) : undefined;
    if (!entry || entry.type !== "picture") continue;
    const sources: string[] = [];
    if (entry.ref.avif) sources.push(`<source srcset="${entry.ref.avif}" type="image/avif">`);
    if (entry.ref.webp) sources.push(`<source srcset="${entry.ref.webp}" type="image/webp">`);
    img.setAttribute("src", entry.ref.fallback);
    img.replaceWith(parse(`<picture>${sources.join("")}${img.toString()}</picture>`));
  }

  for (const el of root.querySelectorAll("script[src]")) applyPlain(el, "src", map);
  for (const el of root.querySelectorAll('link[rel="stylesheet"]')) applyPlain(el, "href", map);

  return root.toString();
}

function applyPlain(el: import("node-html-parser").HTMLElement, attr: string, map: RewriteMap): void {
  const ref = el.getAttribute(attr);
  const entry = ref ? map.get(ref) : undefined;
  if (!entry || entry.type !== "plain") return;
  el.setAttribute(attr, entry.url);
  if (entry.integrity) {
    el.setAttribute("integrity", entry.integrity);
    el.setAttribute("crossorigin", "anonymous");
  }
}
