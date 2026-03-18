import type { LintRule } from "../types.js";

const FEATURE_PATTERN = /\*\*F\d+\*\*:\s*(.+)/g;

export const storyCoverageRule: LintRule = {
  id: "completeness/story-coverage",
  description: "Every feature listed in a PRD has at least one corresponding user story",
  severity: "warn",
  run(context) {
    if (context.spec.frontmatter.type !== "prd") return [];
    const features: string[] = [];
    let match;
    const re = new RegExp(FEATURE_PATTERN.source, "g");
    while ((match = re.exec(context.spec.content)) !== null) {
      features.push(match[1]!.trim());
    }
    if (features.length === 0) return [];
    const stories = context.allSpecs.filter((s) => s.frontmatter.type === "user-story");
    const storyContent = stories.map((s) => s.content + " " + s.frontmatter.title).join(" ");
    return features
      .filter((feature) => !storyContent.toLowerCase().includes(feature.toLowerCase()))
      .map((feature) => ({
        ruleId: "completeness/story-coverage",
        severity: "warn" as const,
        message: `Feature "${feature}" has no corresponding user story`,
        filePath: context.spec.filePath,
      }));
  },
};
