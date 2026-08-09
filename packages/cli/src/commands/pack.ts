import { defineCommand } from "citty";
import { loadConfig, parseSpec, resolveGlob, buildGraph, createLogger } from "@specdx/core";
import { pack, type PackResult } from "@specdx/pack";
import type { ParsedSpec } from "@specdx/core";
import { sharedArgs } from "../shared-args.js";
import { writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";

function copyToClipboard(text: string): void {
  const platform = process.platform;
  let cmd: string;
  if (platform === "darwin") {
    cmd = "pbcopy";
  } else if (platform === "linux") {
    cmd = "xclip -selection clipboard";
  } else if (platform === "win32") {
    cmd = "clip";
  } else {
    throw new Error(`Clipboard not supported on platform: ${platform}`);
  }
  execSync(cmd, { input: text, stdio: ["pipe", "ignore", "ignore"] });
}

/**
 * Why a pack produced no context, if it produced none.
 *
 * An empty `<context>` on stdout with exit 0 reads as "here is your context"
 * to whatever consumes it. `lint` and `check` already use exit 3 for
 * "nothing was assessed"; packing nothing is the same claim.
 */
export function emptyPackReason(
  stats: { specsIncluded: number; specsExcluded: number },
  specsResolved: number,
): string | undefined {
  if (stats.specsIncluded > 0) return undefined;
  if (specsResolved === 0) {
    return "no specs resolved from spec.config.yaml — check the paths in your config";
  }
  // The relevance resolver drops sub-threshold specs before allocation, so
  // stats.specsExcluded counts only allocator-level exclusions. Reporting the
  // resolved total instead keeps the message from blaming the config.
  if (stats.specsExcluded === 0) {
    return `none of the ${specsResolved} resolved spec(s) scored above the relevance threshold for this task — try different --task wording, name specs with --specs, or use --full`;
  }
  return `all ${stats.specsExcluded} candidate spec(s) were excluded — widen --specs or raise --budget`;
}

export interface RunPackOptions {
  configDir: string;
  task?: string;
  specs?: string[];
  budget?: number;
  format?: "xml" | "markdown" | "json";
  full?: boolean;
  dryRun?: boolean;
}

export async function runPack(
  options: RunPackOptions,
): Promise<PackResult & { specsResolved: number }> {
  const config = await loadConfig(undefined, options.configDir);

  const allSpecs: ParsedSpec[] = [];
  for (const [, entry] of Object.entries(config.specs)) {
    const files = await resolveGlob(entry.path, options.configDir);
    for (const file of files) {
      allSpecs.push(await parseSpec(file));
    }
  }

  let graph;
  try {
    graph = buildGraph(config);
  } catch {
    // non-fatal: proceed without graph
  }

  const result = pack(
    allSpecs,
    {
      task: options.task,
      specs: options.specs,
      budget: options.budget,
      format: options.format,
      full: options.full,
      dryRun: options.dryRun,
    },
    config.pack,
    graph,
  );

  return { ...result, specsResolved: allSpecs.length };
}

export default defineCommand({
  meta: { name: "pack", description: "Pack specs into AI-ready context" },
  args: {
    quiet: sharedArgs.quiet,
    verbose: sharedArgs.verbose,
    task: { type: "string", description: "Task or context to optimise relevance for" },
    specs: { type: "string", description: "Comma-separated spec IDs or glob patterns to include" },
    budget: { type: "string", description: "Maximum token budget for the output" },
    format: {
      type: "string",
      description: "Output format (xml, markdown, json)",
      default: "xml",
    },
    out: { type: "string", description: "Write output to file instead of stdout" },
    copy: { type: "boolean", description: "Copy output to system clipboard" },
    full: { type: "boolean", description: "Include all specs without budget trimming" },
    "dry-run": {
      type: "boolean",
      description: "Preview what would be packed without writing output",
    },
  },
  async run({ args }) {
    const logger = createLogger({ quiet: args.quiet, verbose: args.verbose });

    // Validate: --task and --specs are mutually exclusive
    if (args.task && args.specs) {
      console.error("\n  \u2717 --task and --specs are mutually exclusive\n");
      process.exit(1);
    }

    // Validate: --copy and --dry-run are mutually exclusive
    if (args.copy && args["dry-run"]) {
      console.error("\n  \u2717 --copy and --dry-run are mutually exclusive\n");
      process.exit(1);
    }

    // Validate: --budget is a valid number
    let budget: number | undefined;
    if (args.budget) {
      budget = Number(args.budget);
      if (Number.isNaN(budget)) {
        console.error("\n  \u2717 --budget must be a valid number\n");
        process.exit(1);
      }
    }

    // Validate: --format is valid
    const format = args.format as string;
    if (format && !["xml", "markdown", "json"].includes(format)) {
      console.error(`\n  \u2717 --format must be one of: xml, markdown, json\n`);
      process.exit(1);
    }

    try {
      const specsList = args.specs ? args.specs.split(",").map((s: string) => s.trim()) : undefined;

      const result = await runPack({
        configDir: process.cwd(),
        task: args.task,
        specs: specsList,
        budget,
        format: format as "xml" | "markdown" | "json" | undefined,
        full: args.full,
        dryRun: args["dry-run"],
      });

      const { stats } = result;

      // Dry-run: print plan to stdout
      if (args["dry-run"]) {
        console.log("\n  Dry Run Summary:\n");
        for (const alloc of stats.allocations) {
          const status = alloc.included ? "\u2713" : "\u2717";
          const compressed = alloc.compressed ? " (compressed)" : "";
          console.log(
            `  ${status} ${alloc.specId}  relevance=${alloc.relevance.toFixed(2)}  tokens=${alloc.tokens}${compressed}`,
          );
        }
        console.log(`\n  Budget: ${stats.used} / ${stats.budget} tokens`);
        console.log(`  Included: ${stats.specsIncluded} / ${result.specsResolved} specs`);
        console.log(`  Sections compressed: ${stats.sectionsCompressed}`);
        console.log(`  Sections omitted: ${stats.sectionsOmitted}\n`);
        // A dry run that plans nothing is as misleading as an empty payload.
        const dryReason = emptyPackReason(stats, result.specsResolved);
        if (dryReason) {
          console.log(`  ⚠ Nothing would be packed: ${dryReason}\n`);
          process.exit(3);
        }
        return;
      }

      // Write output
      if (args.out) {
        await writeFile(args.out, result.output, "utf-8");
        logger.info(`Output written to ${args.out}`);
      }
      if (args.copy) {
        copyToClipboard(result.output);
        logger.info("Output copied to clipboard");
      }
      if (!args.out && !args.copy) {
        process.stdout.write(result.output);
      }

      // Token report to stderr
      const total = stats.specsIncluded + stats.specsExcluded;
      process.stderr.write(
        `Packed ${stats.specsIncluded}/${total} specs \u2022 ${stats.used} / ${stats.budget} tokens \u2022 ${stats.sectionsCompressed} sections compressed \u2022 ${stats.sectionsOmitted} sections omitted\n`,
      );

      // Never let an empty payload leave looking like a successful pack.
      const emptyReason = emptyPackReason(stats, result.specsResolved);
      if (emptyReason) {
        process.stderr.write(`\n  \u26a0 No context packed: ${emptyReason}\n\n`);
        process.exit(3);
      }
    } catch (err) {
      console.error(`\n  \u2717 ${(err as Error).message}\n`);
      process.exit(1);
    }
  },
});
