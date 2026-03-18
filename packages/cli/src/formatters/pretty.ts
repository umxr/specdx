import type { Diagnostic } from "@sdx/lint";

export function formatPretty(diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) return "  ✓ All specs pass lint checks.\n";
  return diagnostics
    .map((d) => {
      const icon = d.severity === "error" ? "✗" : d.severity === "warn" ? "⚠" : "ℹ";
      return `  ${icon} ${d.severity}  ${d.message}  (${d.ruleId})\n    ${d.filePath}${d.line ? `:${d.line}` : ""}`;
    })
    .join("\n");
}
