import type { Finding, SpecEndpoint, ExtractedRoute } from "../types.js";

function normalisePath(path: string): string {
  return "/" + path.replace(/^\/+/, "").replace(/\/+$/, "").replace(/\/+/g, "/");
}

export function matchRoutes(
  specEndpoints: SpecEndpoint[],
  codeRoutes: ExtractedRoute[],
  specId: string,
): Finding[] {
  const findings: Finding[] = [];

  const codeSet = new Set(codeRoutes.map((r) => `${r.method} ${normalisePath(r.path)}`));
  const specSet = new Set(specEndpoints.map((e) => `${e.method} ${normalisePath(e.path)}`));

  // Missing: in spec but not code
  for (const endpoint of specEndpoints) {
    const key = `${endpoint.method} ${normalisePath(endpoint.path)}`;
    if (!codeSet.has(key)) {
      findings.push({
        type: "missing",
        category: "route",
        specId,
        specSection: "Endpoints",
        expected: key,
        severity: "error",
        suggestion: `Implement ${key} in your route handler`,
      });
    }
  }

  // Extra: in code but not spec
  for (const route of codeRoutes) {
    const key = `${route.method} ${normalisePath(route.path)}`;
    if (!specSet.has(key)) {
      findings.push({
        type: "extra",
        category: "route",
        specId,
        codeLocation: { file: route.file, line: route.line },
        expected: "(not in spec)",
        actual: key,
        severity: "info",
        suggestion: `Route ${key} exists in code but not in spec — add to spec if intentional`,
      });
    }
  }

  return findings;
}
