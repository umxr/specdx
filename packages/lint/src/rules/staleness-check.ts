import type { LintRule } from "../types.js";

export const stalenessCheckRule: LintRule = {
  id: "freshness/staleness-check",
  description: "Warns if a spec hasn't been updated since its upstream dependency changed",
  severity: "warn",
  run(context) {
    const refs = context.spec.frontmatter.references;
    if (!refs || (refs as unknown[]).length === 0) return [];
    const specUpdated =
      (context.spec.frontmatter.updated as string | undefined) ??
      (context.spec.frontmatter.created as string);
    const specDate = new Date(specUpdated);
    const diagnostics = [];
    for (const ref of refs as Array<{ id: string; relationship: string }>) {
      if (ref.relationship !== "depends-on" && ref.relationship !== "implemented-by") continue;
      const upstream = context.allSpecs.find((s) => s.frontmatter.id === ref.id);
      if (!upstream) continue;
      const upstreamUpdated =
        (upstream.frontmatter.updated as string | undefined) ??
        (upstream.frontmatter.created as string);
      const upstreamDate = new Date(upstreamUpdated);
      if (upstreamDate > specDate) {
        diagnostics.push({
          ruleId: "freshness/staleness-check",
          severity: "warn" as const,
          message: `Potentially stale: upstream "${upstream.frontmatter.id}" was updated on ${upstreamUpdated}, but this spec was last updated on ${specUpdated}`,
          filePath: context.spec.filePath,
        });
      }
    }
    return diagnostics;
  },
};
