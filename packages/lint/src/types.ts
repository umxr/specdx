import type { ParsedSpec, DependencyGraph } from "@sdx/core";
import type { SdxConfig } from "@sdx/schema";

export type Severity = "error" | "warn" | "info";

export interface Diagnostic {
  ruleId: string;
  severity: Severity;
  message: string;
  filePath: string;
  line?: number;
  section?: string;
}

export interface LintContext {
  spec: ParsedSpec;
  allSpecs: ParsedSpec[];
  config?: SdxConfig;
  graph?: DependencyGraph;
}

export interface LintRule {
  id: string;
  description: string;
  severity: Severity;
  run(context: LintContext): Diagnostic[];
}

export interface LintResults {
  diagnostics: Diagnostic[];
  hasErrors: boolean;
  hasWarnings: boolean;
}
