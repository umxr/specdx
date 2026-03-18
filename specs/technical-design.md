---
id: "tech-001"
type: "technical-design"
title: "sdx — Technical Design"
status: "approved"
version: "1.0"
created: "2026-01-20"
authors: ["umar"]
tags: ["sdx", "architecture", "monorepo", "cli"]
references:
  - id: "prd-001"
    relationship: "depends-on"
---

# sdx — Technical Design

## Overview

sdx is a TypeScript monorepo providing a CLI and a set of composable npm packages for spec-driven
development. The project is structured so that each concern (schema, parsing, linting, packing,
diffing, CI) lives in a dedicated package with a clear public API. The CLI package composes these
packages into user-facing commands.

The monorepo is managed with pnpm workspaces and Turborepo for build orchestration. All packages
are published under the `@sdx` npm scope, with the top-level `sdx` package being the CLI entry
point.

## Architecture

The package graph flows from schema definitions through core utilities to feature packages and
finally to the CLI:

```
@sdx/schema  ──────────────────────────────────────────────┐
     │                                                       │
     ▼                                                       │
@sdx/core  ─────────────────────────────────────────────────┤
     │                                                       │
     ├──► @sdx/lint  ───────────────────────────────────────┤
     │                                                       │
     ├──► @sdx/pack  ───────────────────────────────────────┤
     │                                                       │
     ├──► @sdx/diff  ───────────────────────────────────────┤
     │                                                       │
     └──► @sdx/cli   (consumes all of the above)
```

**`@sdx/schema`** is the foundation. It contains JSON Schema definitions for every supported spec
type plus the `spec.config.yaml` schema. It exports TypeScript types generated from those schemas
and AJV-based validators. No runtime dependencies beyond `ajv`.

**`@sdx/core`** provides the shared utilities that all other packages depend on: config loading,
spec parsing (markdown-with-frontmatter and YAML), glob resolution, dependency graph building,
token counting, and structured logging. It depends only on `@sdx/schema` and a small set of
well-maintained libraries (`gray-matter`, `yaml`, `glob`).

**`@sdx/lint`** implements the linting engine and built-in rules. It accepts parsed specs and a
configuration object, runs rules against each spec, and returns structured diagnostics. Rules are
plain TypeScript objects implementing a `LintRule` interface — no class inheritance required.

**`@sdx/cli`** is the user-facing entry point. It uses `citty` for subcommand routing and wires
up the underlying packages into `sdx init`, `sdx lint`, `sdx validate`, and `sdx graph` commands.
Output formatters (pretty, JSON, GitHub Annotations) are pluggable.

**`@sdx/pack`** (Phase 2) implements the context packing engine: relevance scoring, token budget
allocation, section extraction, boilerplate stripping, and output formatting.

**`@sdx/diff`** (Phase 3) implements spec-to-spec structural diffing, downstream impact analysis,
and Git-integrated comparison.

**`@sdx/github-action`** (Phase 3) wraps the CLI as a GitHub Action with PR comment posting and
badge generation.

## Data Model

### Spec file (markdown-with-frontmatter)

Every spec is a markdown file with a YAML frontmatter block. The frontmatter is parsed by
`gray-matter` and validated against the JSON Schema for the declared `type`. The markdown body is
parsed with `unified`/`remark` to extract section headings for required-sections validation.

Core frontmatter fields (from `base-spec` schema):

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Unique identifier within the spec suite |
| `type` | enum | yes | One of: prd, technical-design, user-story, test-plan, adr, api-contract |
| `title` | string | yes | Human-readable title |
| `status` | enum | yes | draft, review, approved, superseded |
| `version` | string | yes | Semantic version string (e.g. "1.0") |
| `created` | date string | yes | ISO 8601 date of creation |
| `updated` | date string | no | ISO 8601 date of last update |
| `authors` | string[] | yes | At least one author |
| `tags` | string[] | no | Arbitrary labels |
| `references` | Reference[] | no | Cross-references to other specs |

### Parsed spec (`ParsedSpec`)

After parsing, a spec is represented as:

```typescript
interface ParsedSpec {
  filePath: string;
  frontmatter: Record<string, unknown>;
  content: string;
  sections: string[];
}
```

`sections` is the list of top-level `##` heading texts extracted from the markdown body. This is
what the `structure/required-sections` rule checks.

### Config (`SdxConfig`)

The `spec.config.yaml` is parsed into a typed `SdxConfig` object:

```typescript
interface SdxConfig {
  version: string;
  project?: { name: string; description: string };
  specs: Record<string, SpecEntry>;
  lint?: LintConfig;
  pack?: PackConfig;
  diff?: DiffConfig;
  ci?: CiConfig;
}
```

### Dependency graph

The graph is a directed acyclic graph (DAG) built from `requires` declarations in `spec.config.yaml`.
Nodes are spec entry keys; edges point from a spec to its dependencies. A topological sort of this
graph determines evaluation order for rules that need upstream context (e.g. staleness check).

## API Design

### `@sdx/schema` public API

```typescript
// Validators
validateSpec(data: unknown, type: SpecType): ValidationResult
validateConfig(data: unknown): ValidationResult

// Types
type SpecType = "prd" | "technical-design" | "user-story" | "test-plan" | "adr" | "api-contract"
type SpecStatus = "draft" | "review" | "approved" | "superseded"
interface BaseSpec { id: string; type: SpecType; title: string; /* ... */ }

// Sections
const REQUIRED_SECTIONS: Record<SpecType, string[]>
```

### `@sdx/core` public API

```typescript
// Config
loadConfig(filePath?: string, searchFrom?: string): Promise<SdxConfig>

// Parsing
parseSpec(filePath: string): Promise<ParsedSpec>

// Graph
buildGraph(config: SdxConfig): DependencyGraph

// Utilities
resolveGlob(pattern: string, cwd: string): Promise<string[]>
createLogger(opts: LoggerOptions): Logger
```

### `@sdx/lint` public API

```typescript
// Engine
createLintEngine(opts: LintEngineOptions): LintEngine
interface LintEngine { lint(specs: ParsedSpec[]): LintResults }

// Presets
getPreset(name: "minimal" | "recommended" | "strict"): LintRule[]

// Rule interface
interface LintRule {
  id: string;
  description: string;
  severity: "error" | "warn";
  run(context: LintContext): Diagnostic[];
}
```

### CLI commands

| Command | Description |
|---|---|
| `sdx init` | Interactive scaffolding of `spec.config.yaml` and spec templates |
| `sdx lint [path]` | Run lint rules; exit 1 on errors |
| `sdx validate` | Validate `spec.config.yaml` structure |
| `sdx graph` | Print dependency tree (ASCII or DOT) |

All commands accept `--format pretty|json|github`, `--quiet`, and `--verbose`.

## Dependencies

### Runtime dependencies (by package)

| Package | Dependency | Purpose |
|---|---|---|
| `@sdx/schema` | `ajv`, `ajv-formats` | JSON Schema validation |
| `@sdx/core` | `gray-matter` | Frontmatter parsing |
| `@sdx/core` | `yaml` | YAML config parsing |
| `@sdx/core` | `glob` | Path glob resolution |
| `@sdx/core` | `unified`, `remark-parse` | Markdown AST parsing |
| `@sdx/cli` | `citty` | CLI subcommand framework |

### Development dependencies (monorepo root)

| Tool | Purpose |
|---|---|
| `pnpm` | Package manager and workspace orchestration |
| `turborepo` | Incremental build and task caching |
| `typescript` | Language |
| `vitest` | Test framework |
| `eslint`, `prettier` | Code quality and formatting |
| `@changesets/cli` | Versioning and changelog generation |

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Schema rigidity prevents adoption | High | Schemas allow `additionalProperties: true` on base spec. Custom fields do not break validation. Multiple presets lower the barrier. |
| Token counting diverges across providers | Low | Use conservative estimates based on character count approximations. The `js-tiktoken` library provides GPT-4-calibrated counts which are close enough for Claude. |
| Pack relevance is noisy without embedding support | Medium | Phase 2 starts with keyword and dependency-graph matching. Embedding-based matching is deferred to Phase 4 if needed. |
| Circular dependency detection degrades on large graphs | Low | The graph builder uses a depth-first topological sort with O(V+E) complexity. Suites with hundreds of specs remain within acceptable bounds. |
| CLI framework lock-in | Low | `citty` is thin. The command logic is decoupled from the framework; migration to a different framework would affect only `src/commands/*.ts` files. |

## Open Questions

1. **Multi-repo federation** — Phase 4 will introduce `sdx.federation.yaml` for cross-repo spec
   references. The design of how spec IDs are namespaced across repos needs to be settled before
   Phase 4 kicks off.

2. **YAML spec format** — The parser currently supports markdown-with-frontmatter. Pure YAML specs
   (where frontmatter fields and body sections are all YAML keys) are mentioned in the roadmap as
   first-class, but the section-extraction logic for YAML is not yet implemented.

3. **Windows path compatibility** — Glob resolution uses forward slashes internally. Paths on
   Windows may behave unexpectedly. A cross-platform path normalisation pass should be added before
   v1.0 publication.

4. **Incremental linting** — Currently, all specs are re-parsed and re-linted on every run. For
   large suites (50+ specs), caching parsed results between runs (keyed by file hash) would
   meaningfully reduce CLI latency.
