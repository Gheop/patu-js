export type Mode = "optimize" | "cdn";

export interface PatuConfig {
  apiKey: string;
  endpoint: string;
  cdnBase: string;
  mode: Mode;
  concurrency: number;
  strict: boolean;
  target?: number;
}

export interface ConfigInput extends Partial<PatuConfig> {
  env?: NodeJS.ProcessEnv;
}

// resolveConfig layers explicit input over PATU_KEY over built-in defaults.
// The key is the only value that can be missing; a missing key is a
// configuration error (thrown), never a silent no-op run.
export function resolveConfig(input: ConfigInput = {}): PatuConfig {
  const env = input.env ?? process.env;
  const apiKey = input.apiKey ?? env.PATU_KEY ?? "";
  if (!apiKey) {
    throw new Error("Patu API key missing: set PATU_KEY or pass { apiKey }.");
  }
  return {
    apiKey,
    endpoint: (input.endpoint ?? "https://patu.dev").replace(/\/+$/, ""),
    cdnBase: (input.cdnBase ?? "https://cdn.patu.dev").replace(/\/+$/, ""),
    mode: input.mode ?? "optimize",
    concurrency: input.concurrency ?? 6,
    strict: input.strict ?? false,
    target: input.target,
  };
}
