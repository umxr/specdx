import { readFile } from "node:fs/promises";
import { join } from "node:path";

type DetectedFramework = "express" | "hono" | "nextjs";

const FRAMEWORK_PACKAGES: [string, DetectedFramework][] = [
  ["express", "express"],
  ["hono", "hono"],
  ["next", "nextjs"],
];

export async function detectFramework(projectDir: string): Promise<DetectedFramework | null> {
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    const content = await readFile(join(projectDir, "package.json"), "utf-8");
    pkg = JSON.parse(content);
  } catch {
    return null;
  }

  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  for (const [pkgName, framework] of FRAMEWORK_PACKAGES) {
    if (pkgName in allDeps) {
      return framework;
    }
  }

  return null;
}
