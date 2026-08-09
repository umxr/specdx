import { defineCommand } from "citty";
import { join } from "node:path";
import { diffBetweenRefs, DEFAULT_DIFF_CONFIG, DiffError } from "@specdx/diff";
import { loadConfig } from "@specdx/core";
import { formatChangelog } from "../../formatters/changelog.js";
import type { DiffResult } from "@specdx/diff";

export interface RunDiffOptions {
  base?: string;
  head?: string;
  spec?: string;
  format?: string;
  /** Compare the base ref against the working tree instead of a head ref. */
  working?: boolean;
}

export async function runDiff(options: RunDiffOptions): Promise<DiffResult> {
  const configDir = process.cwd();
  const config = await loadConfig(undefined, configDir);

  const baseRef = options.base ?? config.diff?.baseline_ref ?? DEFAULT_DIFF_CONFIG.baseline_ref;
  const headRef = options.head ?? "HEAD";

  const configPath = join(configDir, "spec.config.yaml");

  const result = await diffBetweenRefs(configPath, baseRef, headRef, {
    working: options.working ?? false,
  });

  if (options.spec) {
    result.diffs = result.diffs.filter((d) => d.specId === options.spec);
    result.impact = result.impact.filter((i) => i.changedSpec === options.spec);
  }

  return result;
}

export default defineCommand({
  meta: { name: "diff", description: "Show spec changes and downstream impact" },
  args: {
    base: { type: "string", description: "Base git ref (default: from config or 'main')" },
    head: { type: "string", description: "Head git ref (default: HEAD)" },
    working: {
      type: "boolean",
      description: "Compare the base ref against the working tree (includes uncommitted specs)",
      default: false,
    },
    spec: { type: "string", description: "Scope to a single spec ID" },
    format: {
      type: "string",
      description: "Output format: pretty, json, changelog",
      default: "pretty",
    },
  },
  async run({ args }) {
    try {
      try {
        const result = await runDiff({
          base: args.base,
          head: args.head,
          spec: args.spec,
          format: args.format,
          working: args.working,
        });

        if (args.format === "json") {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        if (args.format === "changelog") {
          const baseRef =
            args.base ?? (await loadConfig(undefined, process.cwd())).diff?.baseline_ref ?? "main";
          console.log(
            formatChangelog(result, baseRef, args.working ? "working tree" : (args.head ?? "HEAD")),
          );
          return;
        }

        // A ref-to-ref comparison cannot see the working tree, so an unqualified
        // "no changes" would be a false all-clear for anyone about to commit.
        const printUncommittedWarning = (): void => {
          if (result.uncommittedSpecFiles.length === 0) return;
          const count = result.uncommittedSpecFiles.length;
          console.log(
            `\n  \u26a0 ${count} spec file(s) changed in the working tree are not covered by this comparison:`,
          );
          for (const file of result.uncommittedSpecFiles) {
            console.log(`      ${file}`);
          }
          console.log("    Run with --working to include them.");
        };

        // Pretty format
        if (result.diffs.length === 0 && result.added.length === 0 && result.removed.length === 0) {
          console.log("  \u2713 No spec changes detected.");
          printUncommittedWarning();
          return;
        }

        console.log(result.summary);
        console.log();

        for (const diff of result.diffs) {
          console.log(`  ${diff.specId}:`);
          for (const fc of diff.frontmatter) {
            const detail =
              fc.before !== undefined || fc.after !== undefined
                ? ` (${String(fc.before)} \u2192 ${String(fc.after)})`
                : "";
            console.log(`    ${fc.type}: ${fc.field}${detail}`);
          }
          for (const sc of diff.sections) {
            console.log(`    ${sc.type}: ${sc.heading}`);
          }
        }

        if (result.added.length > 0) {
          console.log(`\n  Added: ${result.added.join(", ")}`);
        }
        if (result.removed.length > 0) {
          console.log(`\n  Removed: ${result.removed.join(", ")}`);
        }

        if (result.impact.length > 0) {
          console.log("\n  Downstream Impact:");
          for (const impact of result.impact) {
            for (const d of impact.downstream) {
              console.log(
                `    ${d.specId} \u2014 staleness: ${d.staleness.toFixed(2)} \u2014 ${d.reason}`,
              );
            }
          }
        }

        printUncommittedWarning();
      } catch (err) {
        if (err instanceof DiffError) {
          console.error(`\n  \u2717 ${err.message}\n`);
          process.exit(1);
        }
        throw err;
      }
    } catch (err) {
      console.error(`\n  ✗ ${(err as Error).message}\n`);
      process.exit(1);
    }
  },
});
