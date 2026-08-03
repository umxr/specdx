import { defineCommand } from "citty";
import { loadConfig, buildGraph, resolveGlob, ConfigError, GraphError } from "@specdx/core";
import { sharedArgs } from "../shared-args.js";

export interface ValidateResult {
  valid: boolean;
  /** Number of spec entries declared in the config. */
  specCount?: number;
  /** Number of spec files those entries actually resolve to. */
  specFileCount?: number;
  /** Non-fatal honesty notes: entries resolving to nothing, empty suite. */
  warnings: string[];
  error?: string;
  details?: unknown[];
}

/**
 * Validate spec.config.yaml: a schema-valid config, a buildable dependency
 * graph (issue #13), and declared spec paths that actually resolve. An entry
 * that matches no files makes every downstream verdict vacuous, so it is
 * reported here rather than silently flowing into lint/status/ready.
 */
export async function runValidate(configDir: string): Promise<ValidateResult> {
  const warnings: string[] = [];
  try {
    const config = await loadConfig(undefined, configDir);
    buildGraph(config);

    let specFileCount = 0;
    const missingRequired: string[] = [];
    for (const [key, entry] of Object.entries(config.specs)) {
      const files = await resolveGlob(entry.path, configDir);
      specFileCount += files.length;
      if (files.length > 0) continue;

      if ((entry as { required?: boolean }).required) {
        missingRequired.push(`"${key}" (${entry.path})`);
      } else {
        warnings.push(`spec entry "${key}" resolves to no files: ${entry.path}`);
      }
    }

    if (missingRequired.length > 0) {
      return {
        valid: false,
        specCount: Object.keys(config.specs).length,
        specFileCount,
        warnings,
        error: `required spec entry resolves to no files: ${missingRequired.join(", ")}`,
      };
    }

    if (specFileCount === 0) {
      warnings.push(
        "no spec files found — every downstream check (lint, status, ready) would pass vacuously",
      );
    }

    return {
      valid: true,
      specCount: Object.keys(config.specs).length,
      specFileCount,
      warnings,
    };
  } catch (err) {
    if (err instanceof ConfigError) {
      return { valid: false, warnings, error: err.message, details: err.errors ?? undefined };
    }
    if (err instanceof GraphError) {
      return { valid: false, warnings, error: err.message };
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
      console.log(
        `  ✓ Config valid. ${result.specCount} spec entries, ${result.specFileCount} spec files.`,
      );
      for (const w of result.warnings) console.log(`  ⚠ ${w}`);
      return;
    }

    console.error(`  ✗ Config invalid: ${result.error}`);
    for (const w of result.warnings) console.error(`  ⚠ ${w}`);
    if (result.details) {
      for (const e of result.details) console.error(`    - ${JSON.stringify(e)}`);
    }
    process.exit(1);
  },
});
