import type { Diagnostic } from "@specdx/lint";

/**
 * GitHub workflow-command annotations.
 *
 * Info-severity diagnostics map to `::notice`, not `::warning`. Rendering an
 * advisory as a warning put five warnings in the Actions log for a suite that
 * was clean and exited 0 — the ambiguity advisory in particular, which is info
 * precisely so it cannot fail a build (audit run 5, F5).
 */
export function formatGithub(diagnostics: Diagnostic[]): string {
  return diagnostics
    .map((d) => {
      const level = d.severity === "error" ? "error" : d.severity === "warn" ? "warning" : "notice";
      const line = d.line ? `,line=${d.line}` : "";
      return `::${level} file=${d.filePath}${line}::${d.message} (${d.ruleId})`;
    })
    .join("\n");
}
