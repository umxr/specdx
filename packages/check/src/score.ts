import type { Finding, ImplementationScore } from "./types.js";

interface SpecTotals {
  routes: number;
  types: number;
  tests: number;
}

export function computeScore(
  findings: Finding[],
  totals: SpecTotals,
): ImplementationScore {
  // Count missing findings per category (only "missing" and "mismatch" reduce the score, not "extra")
  const missingByCategory: Record<string, number> = { route: 0, type: 0, test: 0 };

  for (const f of findings) {
    if (f.type === "missing" || f.type === "mismatch") {
      missingByCategory[f.category] = (missingByCategory[f.category] ?? 0) + 1;
    }
  }

  const categoryMap: Record<string, { total: number; categoryKey: string }> = {
    routes: { total: totals.routes, categoryKey: "route" },
    types: { total: totals.types, categoryKey: "type" },
    tests: { total: totals.tests, categoryKey: "test" },
  };

  const byCategory: Record<string, { matched: number; total: number }> = {};
  let totalItems = 0;
  let totalMatched = 0;

  for (const [name, { total, categoryKey }] of Object.entries(categoryMap)) {
    const missing = missingByCategory[categoryKey] ?? 0;
    const matched = Math.max(0, total - missing);
    byCategory[name] = { matched, total };
    totalItems += total;
    totalMatched += matched;
  }

  const overall = totalItems === 0 ? 100 : Math.round((totalMatched / totalItems) * 100);

  return { overall, byCategory };
}
