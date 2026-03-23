import { loadConfig, ConfigError } from "@specdx/core";

export async function handleValidate(params: { configPath?: string }): Promise<string> {
  try {
    const configDir = params.configPath ?? process.cwd();
    const config = await loadConfig(undefined, configDir);
    return JSON.stringify({
      valid: true,
      specCount: Object.keys(config.specs).length,
      project: config.project?.name ?? "unknown",
    });
  } catch (err) {
    if (err instanceof ConfigError) {
      return JSON.stringify({ valid: false, error: err.message, details: err.errors });
    }
    throw err;
  }
}
