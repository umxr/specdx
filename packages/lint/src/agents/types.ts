import type { Diagnostic, Severity } from "../types.js";

/**
 * An agent instruction file — AGENTS.md, CLAUDE.md, and their nested variants.
 *
 * Deliberately *not* a `ParsedSpec`. These files carry no frontmatter, are
 * absent from the `specs` map, and never enter the dependency graph. Keeping
 * them in their own type is what stops `pack`, `diff`, `status` and `check`
 * from ever having to know they exist. See
 * `specs/adr/2026-08-11-linting-formats-we-do-not-own.md`, constraint 1.
 */
export interface AgentFile {
  /** Absolute path on disk. */
  filePath: string;
  /** Path relative to the config directory — what a diagnostic should show. */
  relativePath: string;
  /** Raw file content, unmodified. specdx reads these files and never writes them. */
  content: string;
  /** Content split into lines once, so rules do not each re-split it. */
  lines: string[];
  /** Token count under the same tokenizer `pack` uses, so the numbers agree. */
  tokens: number;
}

export interface AgentLintContext {
  file: AgentFile;
  /** Absolute path of the directory holding spec.config.yaml. */
  configDir: string;
  /**
   * Does this config-dir-relative path exist on disk?
   *
   * Injected rather than called directly so rules stay pure functions of their
   * context and can be tested without a fixture tree on disk.
   */
  exists: (relativePath: string) => boolean;
  /** Ceiling for `agents/size-budget`. */
  maxTokens: number;
}

/**
 * Mirrors `LintRule`, but over an `AgentFile`.
 *
 * A separate interface rather than a widened `LintRule` because the two must
 * not be interchangeable: a spec preset must be unable to pick up an agent
 * rule, and vice versa (ADR constraint 2). The type system is doing that work.
 */
export interface AgentRuleResult {
  diagnostics: Diagnostic[];
  /**
   * Did this rule find anything it could actually judge?
   *
   * Defaults to true. A reference check over a file naming no paths must set
   * this false: it returned no diagnostics, and calling that a pass would
   * claim the references were verified when none were looked at. Reported as
   * an `info` notice by the engine, so the rule never has to hand-write a
   * severity — the severity literal in a diagnostic is exactly what let
   * `--preset strict` mean nothing for ten spec rules.
   */
  assessed?: boolean;
  /** Why nothing was assessed. Required when `assessed` is false. */
  notAssessedReason?: string;
}

export interface AgentRule {
  /** Always prefixed `agents/`, so output says which vocabulary a finding came from. */
  id: string;
  description: string;
  severity: Severity;
  run(context: AgentLintContext): AgentRuleResult;
}

export interface AgentLintResults {
  diagnostics: Diagnostic[];
  /** Agent files actually linted. */
  filesLinted: number;
  /**
   * False when `agents.paths` matched nothing. "No diagnostics" is then not a
   * pass — it is a configuration that inspected nothing (ADR constraint 3).
   */
  assessed: boolean;
}
