import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type CacheEntry = Record<string, unknown>;

// contentHash keys the cache by asset content: unchanged bytes reuse the stored
// result and skip the API round trip entirely.
export function contentHash(bytes: Uint8Array): string {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

// AssetCache is a tiny JSON map from content hash to a previously computed
// result. It is committable so a CI run touches the API only for changed
// assets. A missing or corrupt file loads as empty — the cache is an
// optimization, never a source of truth (the server dedup is the real net).
export class AssetCache {
  private constructor(private readonly path: string, private entries: Record<string, CacheEntry>) {}

  static async load(path: string): Promise<AssetCache> {
    try {
      const parsed = JSON.parse(await readFile(path, "utf8"));
      const entries = parsed && typeof parsed === "object" ? (parsed.entries ?? {}) : {};
      return new AssetCache(path, entries);
    } catch {
      return new AssetCache(path, {});
    }
  }

  get(hash: string): CacheEntry | undefined { return this.entries[hash]; }
  set(hash: string, e: CacheEntry): void { this.entries[hash] = e; }

  async save(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify({ version: 1, entries: this.entries }, null, 2));
  }
}
