import type { Diagnostic } from "@sdx/lint";
export function formatJson(diagnostics: Diagnostic[]): string {
  return JSON.stringify(diagnostics, null, 2);
}
