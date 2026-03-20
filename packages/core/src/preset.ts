import { readFile } from "node:fs/promises";
import { resolve, isAbsolute } from "node:path";
import { ConfigError } from "./config.js";

const BUILTINS = ["minimal", "recommended", "strict"];

/**
 * Resolve a preset name to its config content.
 * Returns null for built-in presets (handled by @specdx/lint).
 * Resolves local file paths and npm package names.
 */
export async function resolvePreset(
  name: string,
  cwd = process.cwd(),
): Promise<Record<string, unknown> | null> {
  if (BUILTINS.includes(name)) {
    return null;
  }

  // Try local file path
  const localPath = isAbsolute(name) ? name : resolve(cwd, name);
  try {
    const content = await readFile(localPath, "utf-8");
    const { default: yaml } = await import("yaml");
    return yaml.parse(content) as Record<string, unknown>;
  } catch {
    // Not a local file, try npm
  }

  // Try npm package
  try {
    const mod = (await import(name)) as { default?: Record<string, unknown> };
    return (mod.default ?? mod) as Record<string, unknown>;
  } catch {
    throw new ConfigError(
      `Could not resolve preset "${name}" as a local file or npm package`,
    );
  }
}
