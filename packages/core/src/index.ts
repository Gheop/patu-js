export const version = "0.0.0";

export { resolveConfig } from "./config.js";
export type { PatuConfig, Mode, ConfigInput } from "./config.js";
export { sriIntegrity } from "./sri.js";
export { classify } from "./classify.js";
export type { Lane, AssetClass } from "./classify.js";
export { createLimiter } from "./limit.js";
export { PatuClient } from "./client.js";
export type { CompressOutcome, StoreOutcome } from "./client.js";
export { parseManifest } from "./manifest.js";
export type { Manifest, ManifestVariant } from "./manifest.js";
export { AssetCache, contentHash } from "./cache.js";
export type { CacheEntry } from "./cache.js";
export { rewriteHtml } from "./rewrite-html.js";
export type { RewriteMap, RewriteEntry, PictureRef } from "./rewrite-html.js";
export { rewriteCss } from "./rewrite-css.js";
