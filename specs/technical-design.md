---
id: technical-design
type: technical-design
title: "Technical Design — sdx"
status: approved
version: "1.0"
created: "2026-03-17"
updated: "2026-03-19"
authors: ["umar"]
tags: ["monorepo", "typescript", "cli"]
references:
  - id: "prd"
    relationship: "implemented-by"
---

## Overview

sdx is a TypeScript monorepo with 8 packages built on pnpm workspaces + Turborepo. The CLI (`specdx`) bundles all internal packages into a single dist via tsup. No LLM calls in the core pipeline — AI integration is delegated to Claude Code skills that wrap CLI commands.

## Architecture

```
schema          <- types, JSON schemas, validators (ajv)
  |
core            <- config loading, spec parsing, dependency graph, tokenization
  |
lint            <- linting engine + 7 built-in rules
pack            <- 3-stage pipeline: Resolve -> Allocate -> Format
diff            <- structural diffing, impact analysis, git integration [Phase 3]
  |
cli (specdx)    <- citty commands: init, lint, validate, graph, pack, diff, status, skills
skills          <- flat .md files bundled into CLI dist at build time
github-action   <- GitHub Action wrapping lint + diff for CI [Phase 3]
```

Data flows upward. Each package depends only on packages below it. The CLI bundles everything via tsup with `noExternal` for all `@specdx/*` packages.

## Data Model

**ParsedSpec** — parsed spec file with frontmatter, content, sections (headings), parsedSections (with token counts per section), and validation results.

**SdxConfig** — `spec.config.yaml` structure: version, project metadata, specs map (path, type, requires, owner), lint config (extends preset, rules, ignore), pack config (max_tokens, format, compression), diff config (baseline_ref, staleness_threshold_days), ci config (block_on, trigger_paths).

**DependencyGraph** — DAG from spec `requires` declarations. Supports topological sort, getDownstream (transitive), getUpstream (transitive). Cycle detection via Kahn's algorithm.

**Diagnostic** — lint/diff output: ruleId, severity (error/warn/info), message, filePath, line, section.

**SpecDiff** — structural diff between two spec versions: frontmatter field changes, section changes (added/removed/modified with unified diffs), summary string.

**DiffResult** — aggregation of all SpecDiff entries plus added/removed specs and ImpactAnalysis per changed spec.

## API Design

All packages export plain functions and interfaces — no classes except Error subclasses. Key exports:

- `@specdx/schema`: `validateSpec()`, `validateConfig()`, type definitions
- `@specdx/core`: `loadConfig()`, `parseSpec()`, `parseSpecFromString()`, `buildGraph()`, `countTokens()`, `resolveGlob()`
- `@specdx/lint`: `createLintEngine()`, `getPreset()`, rule implementations
- `@specdx/pack`: `pack()`, resolver/allocator/formatter pipeline
- `@specdx/diff`: `diffSpecs()`, `analyzeImpact()`, `diffBetweenRefs()`, `checkCrossReferences()`

CLI commands: `init`, `lint`, `validate`, `graph`, `pack`, `diff`, `status`, `changelog`, `explain`, `skills install`

## Dependencies

| Package | Key Dependencies |
|---------|-----------------|
| schema | ajv, ajv-formats |
| core | gray-matter, unified, remark-parse, js-tiktoken, yaml, tinyglobby |
| lint | (core, schema only) |
| pack | (core, schema only) |
| diff | diff (npm), core, schema |
| cli | citty, consola, all @specdx/* packages (bundled via tsup) |
| github-action | @actions/core, @actions/github, @vercel/ncc |

## Risks

- **Schema rigidity** — keep extensible with custom fields and multiple presets
- **Pack relevance noise** — keyword + dependency graph matching; add embedding-based matching later if needed
- **Usage map drift in skills** — skills reference CLI commands, not internal APIs, so changes are localised
- **Plugin system stability** — skills are thin CLI wrappers; if Claude Code's plugin format changes, skills are quick to update
- **Scope creep** — stay focused on the spec layer; integrate with PM tools, do not replace them

## Open Questions

- Should the `diff` npm package be inlined or kept as an external dependency?
- Should `sdx status` support `--format github` for CI annotations?
- How should the config schema version field be managed when adding new config blocks?
