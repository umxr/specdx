import { buildRelationResolver } from "@specdx/core";
import type { ParsedSpec } from "@specdx/core";
import type { SdxConfig } from "@specdx/schema";
import type { LintRule } from "../types.js";

/**
 * Group specs by the config entry whose glob they came from, so config
 * `requires` edges can be mapped into spec id space. Matching is by the entry
 * path's directory prefix, which is enough for the resolver: an id that maps
 * to no entry simply contributes no `requires` edges.
 */
function groupByEntry(config: SdxConfig, specs: ParsedSpec[]): Map<string, ParsedSpec[]> {
  const byEntry = new Map<string, ParsedSpec[]>();
  for (const key of Object.keys(config.specs)) byEntry.set(key, []);

  for (const spec of specs) {
    let bestKey: string | undefined;
    let bestLen = -1;
    for (const [key, entry] of Object.entries(config.specs)) {
      const prefix = entry.path.split("*")[0] ?? "";
      const normalized = spec.filePath.replace(/\\/g, "/");
      if (normalized.includes(prefix) && prefix.length > bestLen) {
        bestKey = key;
        bestLen = prefix.length;
      }
    }
    if (bestKey) byEntry.get(bestKey)!.push(spec);
  }
  return byEntry;
}

function lastUpdated(spec: ParsedSpec): string {
  return (
    (spec.frontmatter.updated as string | undefined) ?? (spec.frontmatter.created as string) ?? ""
  );
}

export const stalenessCheckRule: LintRule = {
  id: "freshness/staleness-check",
  description: "Warns if a spec hasn't been updated since its upstream dependency changed",
  severity: "warn",
  run(context) {
    const specId = context.spec.frontmatter.id;
    if (typeof specId !== "string") return [];

    const specUpdated = lastUpdated(context.spec);
    if (!specUpdated) return [];
    const specDate = new Date(specUpdated);

    // Upstream comes from config `requires` and frontmatter `references`
    // unioned, so a suite declaring dependencies either way gets the same
    // answer (ADR: references/requires unification).
    const byEntry = context.config
      ? groupByEntry(context.config, context.allSpecs)
      : new Map([["", context.allSpecs]]);
    const relations = buildRelationResolver(context.config, byEntry);
    const upstreamIds = relations.getUpstream(specId);

    const diagnostics = [];
    for (const upstreamId of upstreamIds) {
      const upstream = context.allSpecs.find((s) => s.frontmatter.id === upstreamId);
      if (!upstream) continue;
      const upstreamUpdated = lastUpdated(upstream);
      if (!upstreamUpdated) continue;

      if (new Date(upstreamUpdated) > specDate) {
        diagnostics.push({
          ruleId: "freshness/staleness-check",
          severity: "warn" as const,
          message: `Potentially stale: upstream "${upstreamId}" was updated on ${upstreamUpdated}, but this spec was last updated on ${specUpdated}`,
          filePath: context.spec.filePath,
        });
      }
    }
    return diagnostics;
  },
};
