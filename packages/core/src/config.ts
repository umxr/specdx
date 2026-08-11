import { readFile, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { parse as parseYaml } from "yaml";
import { validateConfig, type SdxConfig } from "@specdx/schema";

export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly errors?: unknown[],
  ) {
    super(message);
    this.name = "ConfigError";
  }
}

const CONFIG_FILENAME = "spec.config.yaml";

export async function loadConfig(filePath?: string, searchFrom?: string): Promise<SdxConfig> {
  const resolvedPath = filePath ?? (await findConfig(searchFrom ?? process.cwd()));
  if (!resolvedPath) {
    throw new ConfigError(`No ${CONFIG_FILENAME} found. Run 'specdx init' to create one.`);
  }

  let raw: string;
  try {
    raw = await readFile(resolvedPath, "utf-8");
  } catch {
    throw new ConfigError(`Cannot read config file: ${resolvedPath}`);
  }

  let data: Record<string, unknown>;
  try {
    data = parseYaml(raw) as Record<string, unknown>;
  } catch (err) {
    throw new ConfigError(`Invalid YAML in ${resolvedPath}: ${(err as Error).message}`);
  }

  const result = validateConfig(data);
  if (!result.valid) {
    throw new ConfigError(`Invalid config in ${resolvedPath}`, result.errors ?? undefined);
  }

  return data as unknown as SdxConfig;
}

/**
 * The nearest `spec.config.yaml` at or above `from`, or undefined.
 *
 * Exported so a caller can distinguish "no spec suite here" from "the spec
 * suite is broken" *before* loading. Both surface as a `ConfigError`, and a
 * caller that degrades gracefully on the first must not degrade on the second:
 * silently treating a YAML typo as "no config" would turn a spec lint into a
 * narrower check and report it as a pass.
 *
 * Only `ENOENT`/`ENOTDIR` mean absence. Every other errno — `EACCES` on a
 * root-owned checkout, `ELOOP`, `EMFILE` under a parallel run — means a config
 * may well be sitting there and we cannot tell, so it throws rather than
 * reporting the same `undefined` as an empty directory. A caller degrading on
 * that `undefined` would lint a narrower set and call it a pass, while telling
 * the user "no spec.config.yaml here" about a file they can see.
 *
 * A `spec.config.yaml` that is not a regular file is the same story: present,
 * unusable, never absent. A file that stats but cannot be read — mode `000` —
 * takes the other route: the path comes back, and `loadConfig` reports
 * "Cannot read config file". Neither ends in a degrade.
 */
export async function findConfig(from: string): Promise<string | undefined> {
  let dir = from;
  while (true) {
    const candidate = join(dir, CONFIG_FILENAME);
    let stats;
    try {
      stats = await stat(candidate);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "ENOTDIR") {
        throw new ConfigError(`Cannot read config file: ${candidate} (${code}).`);
      }
      const parent = dirname(dir);
      if (parent === dir) return undefined;
      dir = parent;
      continue;
    }
    if (!stats.isFile()) {
      throw new ConfigError(`Cannot read config file: ${candidate} is not a regular file.`);
    }
    return candidate;
  }
}
