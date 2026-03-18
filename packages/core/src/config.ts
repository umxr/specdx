import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { parse as parseYaml } from "yaml";
import { validateConfig, type SdxConfig } from "@sdx/schema";

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
    throw new ConfigError(`No ${CONFIG_FILENAME} found. Run 'sdx init' to create one.`);
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

async function findConfig(from: string): Promise<string | undefined> {
  let dir = from;
  while (true) {
    const candidate = join(dir, CONFIG_FILENAME);
    try {
      await readFile(candidate, "utf-8");
      return candidate;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) return undefined;
      dir = parent;
    }
  }
}
