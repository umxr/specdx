import { defineCommand } from "citty";
import { join } from "node:path";
import { loadConfig } from "@specdx/core";
import { diffBetweenRefs, DEFAULT_DIFF_CONFIG, DiffError } from "@specdx/diff";

export interface RunChangelogOptions {
  from?: string;
  to?: string;
}

export async function runChangelog(options: RunChangelogOptions): Promise<string> {
  const configDir = process.cwd();
  const config = await loadConfig(undefined, configDir);

  const fromRef = options.from ?? config.diff?.baseline_ref ?? DEFAULT_DIFF_CONFIG.baseline_ref;
  const toRef = options.to ?? "HEAD";

  const configPath = join(configDir, "spec.config.yaml");

  const result = await diffBetweenRefs(configPath, fromRef, toRef);

  const lines: string[] = [];
  lines.push(`## Spec Changes (${fromRef}..${toRef})\n`);

  if (result.diffs.length > 0) {
    lines.push("### Modified");
    for (const diff of result.diffs) {
      const sections = diff.sections.map((s) => s.heading).join(", ");
      const versionChange = diff.frontmatter.find((f) => f.field === "version");
      const versionStr = versionChange
        ? ` (${String(versionChange.before)} \u2192 ${String(versionChange.after)})`
        : "";
      lines.push(`- **${diff.specId}**${versionStr} \u2014 ${sections || "frontmatter only"}`);
    }
    lines.push("");
  }

  if (result.added.length > 0) {
    lines.push("### Added");
    for (const id of result.added) {
      lines.push(`- **${id}**`);
    }
    lines.push("");
  }

  if (result.removed.length > 0) {
    lines.push("### Removed");
    for (const id of result.removed) {
      lines.push(`- **${id}**`);
    }
    lines.push("");
  }

  const allDownstream = result.impact.flatMap((i) => i.downstream);
  if (allDownstream.length > 0) {
    lines.push("### Downstream Impact");
    for (const d of allDownstream) {
      lines.push(`- ${d.specId} may be stale (${d.reason})`);
    }
    lines.push("");
  }

  if (result.diffs.length === 0 && result.added.length === 0 && result.removed.length === 0) {
    lines.push("No spec changes detected.\n");
  }

  return lines.join("\n");
}

export default defineCommand({
  meta: { name: "changelog", description: "Generate changelog of spec changes between git refs" },
  args: {
    from: { type: "string", description: "Start git ref (default: from config or 'main')" },
    to: { type: "string", description: "End git ref (default: HEAD)" },
  },
  async run({ args }) {
    try {
      const output = await runChangelog(args);
      console.log(output);
    } catch (err) {
      if (err instanceof DiffError) {
        console.error(`\n  \u2717 ${err.message}\n`);
        process.exit(1);
      }
      throw err;
    }
  },
});
