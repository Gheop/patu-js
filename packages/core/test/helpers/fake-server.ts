import { createServer, type Server } from "node:http";
import { createHash } from "node:crypto";

export interface FakeServer { url: string; close: () => Promise<void>; hits: () => number }

// RequestInfo lets `behavior` discriminate by request instead of only by hit
// count, which matters when several assets fire concurrently and the arrival
// order at the server is not deterministic (e.g. an image's two format
// requests interleaved with an unrelated CSS file's single request).
export interface RequestInfo { contentType: string; url: URL }

// startFakeServer stands in for Patu's /v1/compress. It echoes a shrunk body
// and the X-Patu-* headers the client reads. `behavior` lets a test force
// errors, retryable statuses or a slow response.
export async function startFakeServer(
  behavior: (n: number, info: RequestInfo) => "ok" | "500" | "429" | "toobig" = () => "ok",
): Promise<FakeServer> {
  let hits = 0;
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      hits++;
      const reqUrl = new URL(req.url ?? "/", "http://x");
      const contentType = req.headers["content-type"] ?? "";
      const mode = behavior(hits, { contentType, url: reqUrl });
      if (mode === "500") { res.writeHead(500).end("boom"); return; }
      if (mode === "429") { res.writeHead(429, { "Retry-After": "0" }).end("slow down"); return; }
      if (reqUrl.searchParams.get("mode") === "stored") {
        const id = createHash("sha1").update(Buffer.concat(chunks)).digest("hex").slice(0, 8);
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({
          schema: 1, id,
          variants: [
            { url: `/v1/asset/${id}/0.avif`, format: "avif", width: 0, bytes: 100, integrity: "sha384-a" },
            { url: `/v1/asset/${id}/0.webp`, format: "webp", width: 0, bytes: 200, integrity: "sha384-b" },
          ],
        }));
        return;
      }
      const input = Buffer.concat(chunks);
      // "toobig" returns bytes larger than the input to exercise never-bigger.
      const out = mode === "toobig" ? Buffer.concat([input, input]) : input.subarray(0, Math.max(1, input.length >> 1));
      const fmt = (reqUrl.searchParams.get("formats") ?? "webp").split(",")[0];
      res.writeHead(200, {
        "X-Patu-Original-Bytes": String(input.length),
        "X-Patu-Output-Bytes": String(out.length),
        "X-Patu-Format": fmt,
        "X-Patu-Integrity": "sha384-" + createHash("sha384").update(out).digest("base64"),
        "X-Patu-Score": "92.50",
        "X-Patu-Latency-Ms": "5",
      }).end(out);
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as import("node:net").AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    hits: () => hits,
    close: () => new Promise((r) => server.close(() => r())),
  };
}
