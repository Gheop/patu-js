export type Lane = "image" | "svg" | "font" | "code" | "skip";

export interface AssetClass {
  lane: Lane;
  contentType: string;
  formats?: string[];
}

const IMAGE_TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  gif: "image/gif", webp: "image/webp", avif: "image/avif",
};
const FONT_TYPES: Record<string, string> = {
  woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
  ttc: "font/collection", eot: "application/vnd.ms-fontobject",
};
const CODE_TYPES: Record<string, string> = {
  js: "text/javascript", mjs: "text/javascript", cjs: "text/javascript",
  css: "text/css",
};

// classify maps a filename to its lane and the Content-Type to send /v1/compress.
// Images request avif+webp so the rewriter can build a <picture>; everything
// else is a single-format optimization. Unknown types and HTML are skipped.
export function classify(filename: string): AssetClass {
  const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  if (ext in IMAGE_TYPES) return { lane: "image", contentType: IMAGE_TYPES[ext], formats: ["avif", "webp"] };
  if (ext === "svg") return { lane: "svg", contentType: "image/svg+xml" };
  if (ext in FONT_TYPES) return { lane: "font", contentType: FONT_TYPES[ext] };
  if (ext in CODE_TYPES) return { lane: "code", contentType: CODE_TYPES[ext] };
  return { lane: "skip", contentType: "" };
}
