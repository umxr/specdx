import { loadConfig, buildGraph, ConfigError, GraphError } from "@specdx/core";

export async function handleValidate(params: { configPath?: string }): Promise<string> {
  try {
    const configDir = params.configPath ?? process.cwd();
    const config = await loadConfig(undefined, configDir);
    // A cyclic or dangling requires chain is an invalid config (issue #13).
    buildGraph(config);
    return JSON.stringify({
      valid: true,
      specCount: Object.keys(config.specs).length,
      project: config.project?.name ?? "unknown",
    });
  } catch (err) {
    if (err instanceof ConfigError) {
      return JSON.stringify({ valid: false, error: err.message, details: err.errors });
    }
    if (err instanceof GraphError) {
      return JSON.stringify({ valid: false, error: err.message });
    }
    throw err;
  }
}
