import { glob } from "tinyglobby";
import { join, isAbsolute } from "node:path";

export async function resolveGlob(pattern: string, baseDir: string): Promise<string[]> {
  const absolutePattern = isAbsolute(pattern) ? pattern : join(baseDir, pattern);
  return glob([absolutePattern], { absolute: true });
}
