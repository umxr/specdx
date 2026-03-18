import type { LintRule } from "../types.js";
import { REQUIRED_SECTIONS } from "@specdx/schema";
import type { SpecType } from "@specdx/schema";

export const requiredSectionsRule: LintRule = {
  id: "structure/required-sections",
  description: "Spec body contains all required sections for its type",
  severity: "error",
  run(context) {
    // Skip YAML specs (no markdown body)
    const ext = context.spec.filePath.split(".").pop()?.toLowerCase();
    if (ext === "yaml" || ext === "yml") return [];

    const specType = context.spec.frontmatter.type as SpecType;
    const required = REQUIRED_SECTIONS[specType];
    if (!required) return [];

    const missing = required.filter((s) => !context.spec.sections.includes(s));
    return missing.map((section) => ({
      ruleId: "structure/required-sections",
      severity: "error" as const,
      message: `Missing required section: "${section}"`,
      filePath: context.spec.filePath,
      section,
    }));
  },
};
