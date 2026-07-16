import type { PatuConfig } from "./config.js";
import { createLimiter } from "./limit.js";

export type CompressOutcome =
  | { ok: true; bytes: Uint8Array; format: string; outputBytes: number; integrity: string; score: number | null; latencyMs: number }
  | { ok: false; error: string };

const MAX_ATTEMPTS = 4;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// PatuClient wraps the Patu HTTP API. Every method resolves to a discriminated
// { ok } result and never throws, so a caller iterating over many assets never
// has one failure abort the batch. A shared limiter caps concurrency; 429/5xx
// are retried with exponential backoff honoring Retry-After.
export class PatuClient {
  private readonly cfg: PatuConfig;
  private readonly gate: <T>(fn: () => Promise<T>) => Promise<T>;

  constructor(cfg: PatuConfig) {
    this.cfg = cfg;
    this.gate = createLimiter(cfg.concurrency);
  }

  async compress(bytes: Uint8Array, opts: { contentType: string; formats?: string[] }): Promise<CompressOutcome> {
    const qs = opts.formats?.length ? `?formats=${opts.formats.join(",")}` : "";
    const url = `${this.cfg.endpoint}/v1/compress${qs}${qs ? "&" : "?"}${this.cfg.target ? `target=${this.cfg.target}` : ""}`.replace(/[?&]$/, "");
    return this.gate(() => this.send(url, bytes, opts.contentType));
  }

  private async send(url: string, bytes: Uint8Array, contentType: string): Promise<CompressOutcome> {
    let lastErr = "unknown error";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "X-Api-Key": this.cfg.apiKey, "Content-Type": contentType },
          body: bytes,
        });
        if (res.status === 429 || res.status >= 500) {
          lastErr = `HTTP ${res.status}`;
          if (attempt < MAX_ATTEMPTS) { await sleep(backoffMs(attempt, res.headers.get("Retry-After"))); continue; }
          return { ok: false, error: lastErr };
        }
        if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
        const out = new Uint8Array(await res.arrayBuffer());
        const scoreRaw = res.headers.get("X-Patu-Score");
        return {
          ok: true,
          bytes: out,
          outputBytes: Number(res.headers.get("X-Patu-Output-Bytes") ?? out.length),
          format: res.headers.get("X-Patu-Format") ?? "",
          integrity: res.headers.get("X-Patu-Integrity") ?? "",
          score: scoreRaw && scoreRaw !== "n/a" ? Number(scoreRaw) : null,
          latencyMs: Number(res.headers.get("X-Patu-Latency-Ms") ?? 0),
        };
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        if (attempt < MAX_ATTEMPTS) { await sleep(backoffMs(attempt, null)); continue; }
        return { ok: false, error: lastErr };
      }
    }
    return { ok: false, error: lastErr };
  }
}

// backoffMs is exponential (200ms, 400ms, 800ms) unless the server sent a
// Retry-After (seconds), which takes precedence.
function backoffMs(attempt: number, retryAfter: string | null): number {
  if (retryAfter != null) {
    const s = Number(retryAfter);
    if (Number.isFinite(s)) return s * 1000;
  }
  return 200 * 2 ** (attempt - 1);
}
