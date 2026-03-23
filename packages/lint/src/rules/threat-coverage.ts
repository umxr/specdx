import type { LintRule } from "../types.js";

const STOPWORDS = new Set(["the", "and", "for", "with", "from", "that", "this", "into", "via"]);

function extractThreats(content: string): string[] {
  // Split into sections at each ## heading, then filter for Threats/Security
  const parts = content.split(/^(?=## )/m);
  const threats: string[] = [];
  for (const part of parts) {
    if (!/^##\s+(Threats|Security)\b/i.test(part)) continue;
    const bullets = part.match(/^- .+$/gm) ?? [];
    threats.push(...bullets.map((b) => b.slice(2).trim()));
  }
  return threats;
}

function extractKeyTerms(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3)
    .filter((w) => !STOPWORDS.has(w));
}

export const threatCoverageRule: LintRule = {
  id: "security/threat-coverage",
  description: "Technical design specs must address threats identified in other specs",
  severity: "warn",
  run(context) {
    if (context.spec.frontmatter.type !== "technical-design") return [];

    const allThreats: string[] = [];
    for (const spec of context.allSpecs) {
      if (spec.filePath === context.spec.filePath) continue;
      allThreats.push(...extractThreats(spec.content));
    }

    if (allThreats.length === 0) return [];

    const techContent = context.spec.content.toLowerCase();
    const diagnostics = [];

    for (const threat of allThreats) {
      const keyTerms = extractKeyTerms(threat);
      const covered = keyTerms.some((term) => techContent.includes(term));
      if (!covered) {
        diagnostics.push({
          ruleId: "security/threat-coverage",
          severity: "warn" as const,
          message: `Threat not addressed in technical design: "${threat}". Ensure the design covers this threat.`,
          filePath: context.spec.filePath,
        });
      }
    }

    return diagnostics;
  },
};
