import type { Diagnostic } from "@specdx/lint";
export function formatJson(diagnostics: Diagnostic[]): string {
  return JSON.stringify(diagnostics, null, 2);
}
