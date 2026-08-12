import type { Finding, ImplementationScore } from "./types.js";

interface SpecTotals {
  routes: number;
  types: number;
  tests: number;
  artifacts: number;
}

export function computeScore(findings: Finding[], totals: SpecTotals): ImplementationScore {
  // Count missing findings per category (only "missing" and "mismatch" reduce the score, not "extra")
  const missingByCategory: Record<string, number> = { route: 0, type: 0, test: 0, artifact: 0 };

  for (const f of findings) {
    if (f.type === "missing" || f.type === "mismatch") {
      // A finding subtracts its weight in the category's own units (fields
      // for types); unweighted findings subtract 1.
      missingByCategory[f.category] = (missingByCategory[f.category] ?? 0) + (f.weight ?? 1);
    }
  }

  const categoryMap: Record<string, { total: number; categoryKey: string }> = {
    routes: { total: totals.routes, categoryKey: "route" },
    types: { total: totals.types, categoryKey: "type" },
    tests: { total: totals.tests, categoryKey: "test" },
    artifacts: { total: totals.artifacts, categoryKey: "artifact" },
  };

  const byCategory: Record<string, { matched: number; total: number }> = {};
  let totalItems = 0;
  let totalMatched = 0;

  for (const [name, { total, categoryKey }] of Object.entries(categoryMap)) {
    const missing = missingByCategory[categoryKey] ?? 0;
    const matched = Math.max(0, total - missing);
    byCategory[name] = { matched, total };
    // Test cases are reported but not scored. They are matched by Jaccard
    // similarity over prose, which measures shared vocabulary rather than
    // shared meaning: "rejects a request with an expired token" scores 0.167
    // against `returns 401 when the token has expired` and is called missing,
    // while "creates an invoice" scores 0.750 against `creates an invoice
    // draft` and is called covered. A signal that wrong cannot move a number
    // anyone acts on — and it is worst when the spec is written first, which
    // is the workflow specdx advocates.
    if (name === "tests") continue;
    totalItems += total;
    totalMatched += matched;
  }

  // Nothing checkable is "not assessed", never a vacuous 100% pass (issue #6)
  if (totalItems === 0) {
    return { overall: 0, assessed: false, byCategory };
  }

  const overall = Math.round((totalMatched / totalItems) * 100);
  return { overall, assessed: true, byCategory };
}
