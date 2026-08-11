export { createLintEngine, type LintEngine, type LintEngineOptions } from "./engine.js";
export type { LintRule, LintContext, LintResults, Diagnostic, Severity } from "./types.js";
export { getPreset } from "./presets.js";
export { resolveLintConfig } from "./resolve-lint-config.js";
export type { ResolveLintConfigOptions, ResolvedLintConfig } from "./resolve-lint-config.js";
export { parseFeatures, parseFeatureEntries, uncoveredFeatures } from "./rules/story-coverage.js";
export type { FeatureEntry } from "./rules/story-coverage.js";
export { loadCustomRule } from "./custom-rule-loader.js";
export {
  structureRules,
  contentRules,
  allBuiltinRules,
  validFrontmatterRule,
  requiredSectionsRule,
  validReferencesRule,
  noCircularDepsRule,
  storyCoverageRule,
  stalenessCheckRule,
  noVagueLanguageRule,
} from "./rules/index.js";

// Agent instruction files (AGENTS.md, CLAUDE.md). A separate namespace on
// purpose: these are not specs, and the spec presets must not be able to pick
// their rules up. See specs/adr/2026-08-11-linting-formats-we-do-not-own.md.
export {
  lintAgentFiles,
  lintAgentFilesWithoutConfig,
  resolveAgentRules,
  discoverAgentFiles,
  extractReferences,
  AgentConfigError,
  AGENT_RULES,
  DEFAULT_AGENT_PATHS,
  DEFAULT_MAX_TOKENS,
} from "./agents/index.js";
export type {
  AgentFile,
  AgentRule,
  AgentLintContext,
  AgentLintResults,
  LintAgentFilesOptions,
} from "./agents/index.js";
