import { defineCommand } from "citty";
import { loadConfig, buildGraph, resolveGlob, ConfigError, GraphError } from "@specdx/core";
import { sharedArgs, resolveFormat } from "../../shared-args.js";
import { createOutput } from "../../output.js";

const FORMATS = ["pretty", "json"] as const;

export interface ValidateResult {
  valid: boolean;
  /** Number of spec entries declared in the config. */
  specEntries?: number;
  /** Number of spec files those entries actually resolve to. */
  specFiles?: number;
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

    let specFiles = 0;
    const missingRequired: string[] = [];
    for (const [key, entry] of Object.entries(config.specs)) {
      const files = await resolveGlob(entry.path, configDir);
      specFiles += files.length;
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
        specEntries: Object.keys(config.specs).length,
        specFiles,
        warnings,
        error: `required spec entry resolves to no files: ${missingRequired.join(", ")}`,
      };
    }

    if (specFiles === 0) {
      warnings.push(
        "no spec files found — every downstream check (lint, status, ready) would pass vacuously",
      );
    }

    return {
      valid: true,
      specEntries: Object.keys(config.specs).length,
      specFiles,
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
  args: { ...sharedArgs(FORMATS) },
  async run({ args }) {
    const format = resolveFormat(args.format, FORMATS);
    if (!format.ok) {
      console.error(`\n  ✗ ${format.message}\n`);
      process.exit(1);
    }
    const output = createOutput({ quiet: args.quiet });

    const result = await runValidate(process.cwd());

    if (format.format === "json") {
      console.log(JSON.stringify(result, null, 2));
      if (!result.valid) process.exit(1);
      return;
    }

    if (result.valid) {
      output.info(
        `  ✓ Config valid. ${result.specEntries} spec entries, ${result.specFiles} spec files.`,
      );
      for (const w of result.warnings) output.out(`  ⚠ ${w}`);
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
