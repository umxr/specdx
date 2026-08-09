import { loadConfig, buildGraph, resolveGlob, ConfigError, GraphError } from "@specdx/core";

export async function handleValidate(params: { configPath?: string }): Promise<string> {
  try {
    const configDir = params.configPath ?? process.cwd();
    const config = await loadConfig(undefined, configDir);
    // A cyclic or dangling requires chain is an invalid config (issue #13).
    buildGraph(config);
    // `specEntries` and `specFiles` are distinct: one glob entry can resolve to
    // many files. Reporting either as a bare `specCount` put this tool and
    // sdx_status in direct contradiction for the same project.
    let specFiles = 0;
    for (const entry of Object.values(config.specs)) {
      specFiles += (await resolveGlob(entry.path, configDir)).length;
    }

    return JSON.stringify({
      valid: true,
      specEntries: Object.keys(config.specs).length,
      specFiles,
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
