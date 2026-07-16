import { resolve } from "node:path";
import { resolveConfig as resolvePatuConfig, optimizeDir, type Mode } from "@patu/core";
import type { Plugin, ResolvedConfig } from "vite";

export interface PatuPluginOptions {
  mode?: Mode; // "optimize" (default) | "cdn"
  endpoint?: string;
  strict?: boolean;
  apiKey?: string; // falls back to PATU_KEY
}

// patu() optimizes the build output after Vite finishes writing it: a
// closeBundle hook points optimizeDir at Vite's build.outDir, reusing the
// exact same engine as the CLI (so plugin and CLI behave identically). It
// runs only for production builds (apply: "build").
//
// optimizeDir never throws on its own for a failed asset or for strict — that
// policy now lives with the caller (see @patu/core's engine.ts). This plugin
// is the caller: after optimizeDir returns, if strict is set and at least one
// asset failed, it throws from closeBundle, which fails the Vite build. In
// every other case it just logs the summary and lets the build succeed.
export default function patu(options: PatuPluginOptions = {}): Plugin {
  let viteConfig: ResolvedConfig;
  return {
    name: "patu",
    apply: "build",
    configResolved(c) {
      viteConfig = c;
    },
    async closeBundle() {
      const outDir = resolve(viteConfig.root, viteConfig.build.outDir);
      const cfg = resolvePatuConfig({
        mode: options.mode ?? "optimize",
        endpoint: options.endpoint,
        strict: options.strict,
        apiKey: options.apiKey,
      });
      const report = await optimizeDir(outDir, cfg, { log: (m) => viteConfig.logger.warn(m) });
      const saved = ((report.bytesBefore - report.bytesAfter) / 1024).toFixed(1);
      viteConfig.logger.info(`patu: ${report.optimized}/${report.assets} assets optimized, ${saved} KB saved`);
      if (options.strict && report.failed > 0) {
        throw new Error(`patu: ${report.failed} asset(s) failed to optimize (strict mode)`);
      }
    },
  };
}
