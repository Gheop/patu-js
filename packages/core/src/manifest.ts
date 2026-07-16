export interface ManifestVariant { url: string; format: string; width: number; bytes: number; integrity: string }
export interface Manifest { schema: number; id: string; kind?: string; variants: ManifestVariant[] }

// parseManifest validates the JSON Patu returns from mode=stored, keeping only
// the fields the client consumes. A shape mismatch throws so the caller treats
// the asset as a failure (keep original) rather than emitting a broken URL.
export function parseManifest(json: unknown): Manifest {
  if (!json || typeof json !== "object") throw new Error("invalid manifest: not an object");
  const o = json as Record<string, unknown>;
  if (typeof o.id !== "string" || !Array.isArray(o.variants)) throw new Error("invalid manifest: missing id/variants");
  const variants: ManifestVariant[] = o.variants.map((v, i) => {
    const r = v as Record<string, unknown>;
    if (typeof r.url !== "string" || typeof r.format !== "string") throw new Error(`invalid manifest variant ${i}`);
    return {
      url: r.url, format: r.format,
      width: Number(r.width ?? 0), bytes: Number(r.bytes ?? 0),
      integrity: typeof r.integrity === "string" ? r.integrity : "",
    };
  });
  return { schema: Number(o.schema ?? 0), id: o.id, kind: typeof o.kind === "string" ? o.kind : undefined, variants };
}
