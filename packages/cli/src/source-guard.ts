import { access } from "node:fs/promises";
import { join } from "node:path";

const exists = (p: string) => access(p).then(() => true, () => false);

// looksLikeSource guards against running the optimizer over versioned source
// instead of build output: a folder with BOTH package.json and src/ is almost
// certainly a project root, not a dist/. The user can override with --force.
export async function looksLikeSource(dir: string): Promise<boolean> {
  const [pkg, src] = await Promise.all([exists(join(dir, "package.json")), exists(join(dir, "src"))]);
  return pkg && src;
}
