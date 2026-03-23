import type { LintRule } from "../types.js";

export const namingConventionsRule: LintRule = {
  id: "consistency/naming-conventions",
  description: "Enforce consistent naming conventions across specs",
  severity: "warn",
  run(context) {
    const { spec } = context;
    const type = spec.frontmatter.type as string;
    const diagnostics = [];

    if (type === "prd") {
      // Split content into sections and find the Features section
      const sectionParts = spec.content.split(/^(?=## )/m);
      const featuresSection = sectionParts.find((p) => /^## Features\b/.test(p));
      if (featuresSection) {
        const bullets = featuresSection.match(/^- .+$/gm) ?? [];
        for (const bullet of bullets) {
          if (bullet.match(/^- \*\*F\d+\*\*:/) === null && bullet.trim().length > 2) {
            diagnostics.push({
              ruleId: "consistency/naming-conventions",
              severity: "warn" as const,
              message: `PRD feature missing feature ID pattern (**F<N>**:): "${bullet.slice(0, 60)}"`,
              filePath: spec.filePath,
            });
          }
        }
      }
    }

    if (type === "user-story") {
      const id = spec.frontmatter.id as string;
      if (!id.startsWith("story-")) {
        diagnostics.push({
          ruleId: "consistency/naming-conventions",
          severity: "warn" as const,
          message: `User story ID "${id}" should start with "story-" (e.g., "story-${id}")`,
          filePath: spec.filePath,
        });
      }
    }

    if (type === "api-contract") {
      // Check endpoints for camelCase path segments
      const endpointRe = /^###\s+(GET|POST|PUT|PATCH|DELETE)\s+(\S+)/gm;
      let match;
      while ((match = endpointRe.exec(spec.content)) !== null) {
        const path = match[2]!;
        if (/\/[a-z]+[A-Z]/.test(path)) {
          diagnostics.push({
            ruleId: "consistency/naming-conventions",
            severity: "warn" as const,
            message: `Endpoint path "${path}" uses camelCase — use kebab-case instead (e.g., "${path.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}")`,
            filePath: spec.filePath,
          });
        }
      }
    }

    return diagnostics;
  },
};
