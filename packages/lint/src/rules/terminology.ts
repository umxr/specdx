import type { LintRule } from "../types.js";

function normalizeCompound(term: string): string {
  // Split camelCase: "UserProfile" → "user profile"
  // Split hyphens/underscores: "user-profile" → "user profile"
  return term
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .toLowerCase()
    .trim();
}

function extractCompoundTerms(content: string): string[] {
  const terms: string[] = [];

  // Extract camelCase words (e.g., UserProfile, userProfile)
  const camelCaseRegex = /\b[a-zA-Z]*[a-z][A-Z][a-zA-Z]*\b/g;
  let match;
  while ((match = camelCaseRegex.exec(content)) !== null) {
    terms.push(match[0]);
  }

  // Extract hyphenated words (e.g., user-profile, my-component)
  const hyphenatedRegex = /\b[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)+\b/g;
  while ((match = hyphenatedRegex.exec(content)) !== null) {
    terms.push(match[0]);
  }

  return terms;
}

export const terminologyRule: LintRule = {
  id: "consistency/terminology",
  description:
    "Detects terminology drift (e.g., user-profile vs UserProfile vs user profile) across specs",
  severity: "warn",
  run(context) {
    // Only run on the first spec to avoid duplicate diagnostics
    if (context.spec !== context.allSpecs[0]) return [];

    // Build a map: normalized form → Set of original forms found across all specs
    const termMap = new Map<string, Set<string>>();

    for (const spec of context.allSpecs) {
      if (!spec.content) continue;
      const terms = extractCompoundTerms(spec.content);
      for (const term of terms) {
        const normalized = normalizeCompound(term);
        // Only track multi-word normalized forms (skip single words)
        if (!normalized.includes(" ")) continue;
        if (!termMap.has(normalized)) {
          termMap.set(normalized, new Set());
        }
        termMap.get(normalized)!.add(term);
      }
    }

    const diagnostics = [];

    for (const [normalized, variants] of termMap) {
      if (variants.size >= 2) {
        const variantList = [...variants].join(", ");
        diagnostics.push({
          ruleId: "consistency/terminology",
          severity: "warn" as const,
          message: `Inconsistent terminology for "${normalized}": found variants [${variantList}]. Standardize terminology across specs.`,
          filePath: context.spec.filePath,
        });
      }
    }

    return diagnostics;
  },
};
