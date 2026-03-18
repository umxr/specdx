import type { ParsedSpec, DependencyGraph } from "@specdx/core";
import type { SdxConfig } from "@specdx/schema";
import type { LintRule, LintResults, Diagnostic } from "./types.js";

export interface LintEngineOptions {
  rules: LintRule[];
  config?: SdxConfig;
  graph?: DependencyGraph;
}

export interface LintEngine {
  lint(specs: ParsedSpec[]): LintResults;
}

export function createLintEngine(options: LintEngineOptions): LintEngine {
  return {
    lint(specs: ParsedSpec[]): LintResults {
      const diagnostics: Diagnostic[] = [];
      for (const spec of specs) {
        for (const rule of options.rules) {
          const results = rule.run({
            spec,
            allSpecs: specs,
            config: options.config,
            graph: options.graph,
          });
          diagnostics.push(...results);
        }
      }
      return {
        diagnostics,
        hasErrors: diagnostics.some((d) => d.severity === "error"),
        hasWarnings: diagnostics.some((d) => d.severity === "warn"),
      };
    },
  };
}
