import type { Diagnostic } from "@sdx/lint";
export function formatGithub(diagnostics: Diagnostic[]): string {
  return diagnostics
    .map((d) => {
      const level = d.severity === "error" ? "error" : "warning";
      const line = d.line ? `,line=${d.line}` : "";
      return `::${level} file=${d.filePath}${line}::${d.message} (${d.ruleId})`;
    })
    .join("\n");
}
