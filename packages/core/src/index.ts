export const version = "0.0.0";

export { resolveConfig } from "./config.js";
export type { PatuConfig, Mode, ConfigInput } from "./config.js";
export { sriIntegrity } from "./sri.js";
export { classify } from "./classify.js";
export type { Lane, AssetClass } from "./classify.js";
export { createLimiter } from "./limit.js";
export { PatuClient } from "./client.js";
export type { CompressOutcome } from "./client.js";
