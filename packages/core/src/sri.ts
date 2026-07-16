import { createHash } from "node:crypto";

// sriIntegrity matches Patu's X-Patu-Integrity: base64 sha384 with the sri
// prefix, suitable for a Subresource Integrity attribute.
export function sriIntegrity(bytes: Uint8Array): string {
  return "sha384-" + createHash("sha384").update(Buffer.from(bytes)).digest("base64");
}
