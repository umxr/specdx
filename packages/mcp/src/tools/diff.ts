import { join } from "node:path";
import { loadConfig } from "@specdx/core";
import { diffBetweenRefs, DEFAULT_DIFF_CONFIG, DiffError } from "@specdx/diff";

export async function handleDiff(params: { base?: string; head?: string }): Promise<string> {
  const configDir = process.cwd();
  const config = await loadConfig(undefined, configDir);
  const baseRef = params.base ?? config.diff?.baseline_ref ?? DEFAULT_DIFF_CONFIG.baseline_ref;
  const headRef = params.head ?? "HEAD";
  const configPath = join(configDir, "spec.config.yaml");

  try {
    const result = await diffBetweenRefs(configPath, baseRef, headRef);
    return JSON.stringify(result);
  } catch (err) {
    if (err instanceof DiffError) {
      return JSON.stringify({ error: err.message });
    }
    throw err;
  }
}
