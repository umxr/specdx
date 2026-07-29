import { defineCommand } from "citty";
import { loadConfig, buildGraph, ConfigError, GraphError } from "@specdx/core";
import { sharedArgs } from "../shared-args.js";

export interface ValidateResult {
  valid: boolean;
  specCount?: number;
  error?: string;
  details?: unknown[];
}

/**
 * Validate spec.config.yaml: schema-valid config AND a buildable dependency
 * graph — missing requires targets and circular dependencies fail validation
 * (issue #13).
 */
export async function runValidate(configDir: string): Promise<ValidateResult> {
  try {
    const config = await loadConfig(undefined, configDir);
    buildGraph(config);
    return { valid: true, specCount: Object.keys(config.specs).length };
  } catch (err) {
    if (err instanceof ConfigError) {
      return { valid: false, error: err.message, details: err.errors ?? undefined };
    }
    if (err instanceof GraphError) {
      return { valid: false, error: err.message };
    }
    throw err;
  }
}

export default defineCommand({
  meta: { name: "validate", description: "Validate spec.config.yaml" },
  args: { ...sharedArgs },
  async run() {
    const result = await runValidate(process.cwd());
    if (result.valid) {
      console.log(`  ✓ Config valid. ${result.specCount} specs defined.`);
      return;
    }
    console.error(`  ✗ Config invalid: ${result.error}`);
    if (result.details) {
      for (const e of result.details) console.error(`    - ${JSON.stringify(e)}`);
    }
    process.exit(1);
  },
});
