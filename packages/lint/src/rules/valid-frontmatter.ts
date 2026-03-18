import type { LintRule } from "../types.js";

export const validFrontmatterRule: LintRule = {
  id: "structure/valid-frontmatter",
  description: "Frontmatter matches the schema for the declared spec type",
  severity: "error",
  run(context) {
    if (context.spec.valid) return [];
    const errors = context.spec.validationErrors ?? [];
    return errors.map((err) => ({
      ruleId: "structure/valid-frontmatter",
      severity: "error" as const,
      message: `Invalid frontmatter: ${err.message ?? JSON.stringify(err)}`,
      filePath: context.spec.filePath,
    }));
  },
};
