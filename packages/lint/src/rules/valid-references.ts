import type { LintRule } from "../types.js";

export const validReferencesRule: LintRule = {
  id: "structure/valid-references",
  description: "All references in frontmatter point to specs that exist in the suite",
  severity: "error",
  run(context) {
    const refs = context.spec.frontmatter.references;
    if (!refs || refs.length === 0) return [];
    const allIds = new Set(context.allSpecs.map((s) => s.frontmatter.id));
    return refs
      .filter((ref) => !allIds.has(ref.id))
      .map((ref) => ({
        ruleId: "structure/valid-references",
        severity: "error" as const,
        message: `Reference "${ref.id}" does not match any spec in the suite`,
        filePath: context.spec.filePath,
      }));
  },
};
