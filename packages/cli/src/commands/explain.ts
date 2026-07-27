import { defineCommand } from "citty";
import { loadConfig, parseSpec, buildGraph, resolveGlob } from "@specdx/core";
import type { ParsedSpec } from "@specdx/core";

interface ExplainResult {
  project: string;
  description?: string;
  specCount: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  specs: { id: string; type: string; title: string; status: string; firstLine: string }[];
  graph: string[];
}

export async function runExplain(_options: { format?: string } = {}): Promise<ExplainResult> {
  const configDir = process.cwd();
  const config = await loadConfig(undefined, configDir);

  // Parse all specs
  const specs: ParsedSpec[] = [];
  for (const [, entry] of Object.entries(config.specs)) {
    const paths = await resolveGlob(entry.path, configDir);
    for (const p of paths) {
      specs.push(await parseSpec(p));
    }
  }

  // Count by type and status
  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const spec of specs) {
    const type = (spec.frontmatter.type as string) || "unknown";
    const status = (spec.frontmatter.status as string) || "unknown";
    byType[type] = (byType[type] ?? 0) + 1;
    byStatus[status] = (byStatus[status] ?? 0) + 1;
  }

  // Build spec summaries — first sentence of first section content
  const specSummaries = specs.map((spec) => {
    const firstSection = spec.parsedSections[0];
    const firstLine =
      firstSection?.content
        ?.split("\n")
        .find((l) => l.trim().length > 0)
        ?.trim() ?? "";
    const truncated = firstLine.slice(0, 120) + (firstLine.length > 120 ? "..." : "");
    return {
      id: spec.frontmatter.id as string,
      type: spec.frontmatter.type as string,
      title: spec.frontmatter.title as string,
      status: spec.frontmatter.status as string,
      firstLine: truncated,
    };
  });

  // Build dependency graph lines
  const graph = buildGraph(config);
  const graphLines: string[] = [];
  for (const node of graph.nodes) {
    const downstream = graph.edges.filter((e) => e.from === node).map((e) => e.to);
    if (downstream.length > 0) {
      graphLines.push(`${node} → ${downstream.join(", ")}`);
    } else {
      graphLines.push(node);
    }
  }

  return {
    project: config.project?.name ?? "unknown",
    description: config.project?.description,
    specCount: specs.length,
    byType,
    byStatus,
    specs: specSummaries,
    graph: graphLines,
  };
}

export default defineCommand({
  meta: { name: "explain", description: "Explain the spec suite for onboarding" },
  args: {
    format: { type: "string", description: "Output format: pretty, json", default: "pretty" },
  },
  async run({ args }) {
    try {
      const result = await runExplain({ format: args.format });

      if (args.format === "json") {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      // Pretty format
      console.log(`\n  ${result.project}`);
      if (result.description) {
        console.log(`  ${result.description}`);
      }
      console.log(
        `\n  ${result.specCount} specs: ${Object.entries(result.byType)
          .map(([k, v]) => `${v} ${k}`)
          .join(", ")}`,
      );
      console.log(
        `  Status: ${Object.entries(result.byStatus)
          .map(([k, v]) => `${v} ${k}`)
          .join(", ")}`,
      );

      console.log("\n  Specs:");
      for (const spec of result.specs) {
        console.log(`    ${spec.id} (${spec.type}, ${spec.status}) — ${spec.title}`);
        if (spec.firstLine) {
          console.log(`      ${spec.firstLine}`);
        }
      }

      console.log("\n  Dependencies:");
      for (const line of result.graph) {
        console.log(`    ${line}`);
      }
      console.log();
    } catch (err) {
      console.error(`\n  ✗ ${(err as Error).message}\n`);
      process.exit(1);
    }
  },
});
