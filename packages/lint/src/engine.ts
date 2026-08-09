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
          // The rule object's `severity` is the authority, not the severity a
          // rule happens to write into the diagnostic it returns.
          //
          // Every built-in rule emits exactly one severity -- its own -- but ten
          // of them hardcoded it as a literal in the diagnostic. Presets rewrite
          // `rule.severity`, so nothing downstream read what `strict` set, and
          // `--preset strict` produced output byte-identical to `recommended` on
          // the CLI, in `extends:`, in the Action's `preset` input and in
          // `runLint({ preset })`. Stamping it here is what makes a preset mean
          // anything.
          for (const diagnostic of results) {
            diagnostics.push({ ...diagnostic, severity: rule.severity });
          }
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
