# sdx — Project Roadmap

> **S**pec **D**eveloper E**x**perience — opinionated tooling for spec-driven development with AI.
> One CLI. Validate, pack, diff, and ship specs that keep your LLM-assisted workflows honest.

---

## Vision

Most AI-assisted development workflows are ad-hoc. Developers write specs in inconsistent formats, manually paste them into context windows, and hope the LLM respects the constraints. There is no validation, no diffing, no CI integration, and no standard.

**sdx** is the missing toolchain for spec-driven development. It provides a formal schema for spec suites, a linter that catches semantic gaps before they reach an LLM, a context packer that assembles token-optimised payloads, a diff engine that detects drift between specs and between spec and implementation, and a CI layer that enforces spec health across teams.

---

## Glossary

| Term | Definition |
|---|---|
| **Spec** | A structured document (markdown with frontmatter) that describes a unit of intent — a PRD, technical design, user story, test plan, API contract, or architecture decision record. |
| **Spec Suite** | The complete collection of specs for a project, defined by a `spec.config.yaml` root config. |
| **Dependency Chain** | The declared relationship between specs. A test plan _requires_ user stories, which _require_ a PRD. Changes upstream may invalidate downstream specs. |
| **Drift** | When a downstream spec or implementation no longer reflects the intent of an upstream spec. |
| **Context Payload** | A single, token-optimised bundle of relevant spec content, formatted for LLM consumption. |
| **Spec Health** | A composite measure of a spec suite's validity, completeness, freshness, and internal consistency. |

---

## Package Structure

```
sdx/                          # monorepo root
├── packages/
│   ├── schema/                   # @sdx/schema — JSON Schema definitions, types, validators
│   ├── cli/                      # @sdx/cli — unified CLI entry point
│   ├── core/                     # @sdx/core — shared utilities (parsing, config, graph resolution)
│   ├── lint/                     # @sdx/lint — linting engine and built-in rules
│   ├── pack/                     # @sdx/pack — context packing and token optimisation
│   ├── diff/                     # @sdx/diff — spec-to-spec and spec-to-implementation diffing
│   ├── github-action/            # @sdx/action — GitHub Action wrapper
│   └── skills/                  # @sdx/skills — Claude Code skill definitions
├── rules/                        # community-contributed lint rules
├── templates/                    # starter spec templates (BMAD, lightweight, API-first)
├── docs/                         # documentation site
├── spec.config.yaml              # sdx's own spec suite (dogfooding)
└── specs/                        # sdx's own specs (dogfooding)
    ├── prd.md
    ├── technical-design.md
    ├── stories/
    └── test-plan.md
```

---

## Root Config Format

Every sdx project is defined by a `spec.config.yaml` at the repository root:

```yaml
version: "1.0"

# Optional project metadata
project:
  name: "my-project"
  description: "Short description of the project"

# Spec definitions
specs:
  prd:
    path: "specs/prd.md"
    type: "prd"
    required: true

  technical:
    path: "specs/technical-design.md"
    type: "technical-design"
    requires: ["prd"]

  adr:
    path: "specs/adr/*.md"
    type: "adr"
    requires: ["technical"]

  stories:
    path: "specs/stories/*.md"
    type: "user-story"
    requires: ["prd"]

  test-plan:
    path: "specs/test-plan.md"
    type: "test-plan"
    requires: ["technical", "stories"]

  api-contract:
    path: "specs/api-contract.md"
    type: "api-contract"
    requires: ["technical"]

# Lint configuration
lint:
  extends: "recommended"       # built-in rule presets: "minimal", "recommended", "strict"
  rules:
    completeness/story-coverage: "warn"
    freshness/max-staleness-days: ["error", 14]
    clarity/ambiguity-score: ["warn", { threshold: 0.6 }]
    structure/required-sections: "error"
  ignore:
    - "specs/archive/**"

# Pack configuration
pack:
  max_tokens: 12000            # target token budget for packed output
  format: "xml"                # output format: "xml", "markdown", "json"
  compression:
    strip_boilerplate: true
    summarise_stable: true     # summarise sections unchanged for >7 days
    collapse_resolved: true    # collapse resolved ADRs to one-liners

# Diff configuration
diff:
  staleness_threshold_days: 14
  ignore_paths:
    - "specs/archive/**"

# CI configuration
ci:
  block_on: ["error"]          # which severities block PR merges
  comment: true                # post summary comment on PRs
  badge: true                  # generate spec health badge
```

---

## Spec File Format

All specs are **markdown files with YAML frontmatter** or **pure YAML files**. SDX supports both formats as first-class citizens. For markdown specs, the frontmatter provides machine-readable metadata; the body is human-readable content with optional structured sections. For YAML specs, the entire document is structured data. API contracts may also use OpenAPI format.

```markdown
---
id: "prd-001"
type: "prd"
title: "User Authentication System"
status: "approved"                    # draft | review | approved | superseded
version: "1.2"
created: "2026-02-15"
updated: "2026-03-10"
authors: ["umar"]
tags: ["auth", "security", "mvp"]
references:                           # cross-references to other specs
  - id: "tech-001"
    relationship: "implemented-by"
  - id: "story-auth-001"
    relationship: "decomposed-into"
---

# User Authentication System

## Problem Statement
...

## Goals
...

## Non-Goals
...

## Features
- **F1**: Email/password login
- **F2**: OAuth (Google, GitHub)
- **F3**: MFA via email OTP

## Success Criteria
...
```

---

## Phase 1 — Foundation

**Goal**: Ship a usable `sdx init` and `sdx lint` with structural validation. Establish the schema, the spec file format, and the config structure. Make it useful enough for a single developer on a single project.

**Timeline target**: 3–4 weeks

### Phase 1 Deliverables

#### 1.1 — `@sdx/schema`

The JSON Schema definitions for every supported spec type, plus TypeScript type exports.

| Task | Description | Acceptance Criteria |
|---|---|---|
| Define base spec schema | Common frontmatter fields shared by all spec types (`id`, `type`, `title`, `status`, `version`, `created`, `updated`, `authors`, `tags`, `references`) | JSON Schema validates all base fields with correct types and enums |
| Define PRD schema | Required and optional sections for a PRD (Problem Statement, Goals, Non-Goals, Features, Success Criteria) | Schema validates a well-formed PRD and rejects one missing required sections |
| Define Technical Design schema | Sections: Overview, Architecture, Data Model, API Design, Dependencies, Risks, Open Questions | Validates well-formed technical design |
| Define User Story schema | Sections: Description, Acceptance Criteria, Dependencies, Notes. Frontmatter: `story_id`, `priority`, `estimate` | Validates well-formed user stories |
| Define Test Plan schema | Sections: Scope, Test Cases, Coverage Matrix, Edge Cases | Validates well-formed test plans |
| Define ADR schema | Sections: Context, Decision, Status, Consequences (follows Michael Nygard's ADR format) | Validates well-formed ADRs |
| Define API Contract schema | Sections: Endpoints, Request/Response schemas, Auth, Error codes | Validates well-formed API contracts |
| Define `spec.config.yaml` schema | Validates the root config including spec entries, dependency declarations, and lint/pack/diff config blocks | Schema validates example configs and rejects malformed ones |
| Export TypeScript types | Generate TS types from JSON Schema for use across all packages | Types compile cleanly and match schema definitions |
| Schema versioning strategy | Document how schema versions will evolve and how migration works between versions | README section explaining version policy |

#### 1.2 — `@sdx/core`

Shared utilities used by all other packages.

| Task | Description | Acceptance Criteria |
|---|---|---|
| Config loader | Parse and validate `spec.config.yaml`, resolve paths, handle missing config gracefully | Loads config, throws descriptive errors for invalid configs |
| Spec parser | Parse specs from multiple formats (markdown-with-frontmatter, pure YAML, OpenAPI). Validate against schema, return typed spec objects. Plugin-based architecture for format extensibility. | Parses all supported spec types and formats correctly |
| Dependency graph builder | Build a DAG from spec `requires` declarations, detect circular dependencies | Builds graph, topological sort works, circular deps throw |
| Glob resolver | Resolve glob patterns in spec paths (e.g. `specs/stories/*.md`) to actual files | Handles nested globs, returns empty array for no matches |
| Token counter | Estimate token count for a given string (use `tiktoken` or a lightweight approximation) | Counts within ±5% of actual tokenisation for GPT-4/Claude |
| Logger | Structured, levelled logging with colour support for CLI output | Supports debug/info/warn/error, respects `--quiet` and `--verbose` flags |

#### 1.3 — `@sdx/lint`

The linting engine and initial set of built-in rules.

| Task | Description | Acceptance Criteria |
|---|---|---|
| Lint engine | Rule runner that loads rules, executes them against parsed specs, collects diagnostics with severity levels | Runs rules, outputs diagnostics with file/line/severity/message |
| Rule: `structure/valid-frontmatter` | Frontmatter matches the schema for the declared spec type | Catches missing required fields, wrong types, invalid enums |
| Rule: `structure/required-sections` | Spec body contains all required sections for its type | Catches missing sections, suggests what's missing |
| Rule: `structure/valid-references` | All `references` in frontmatter point to specs that exist in the suite | Catches broken cross-references |
| Rule: `structure/no-circular-deps` | The dependency graph has no cycles | Catches circular dependency chains |
| Rule: `completeness/story-coverage` | Every feature listed in a PRD has at least one corresponding user story | Reports which features lack stories |
| Rule: `freshness/staleness-check` | Warns if a downstream spec hasn't been updated since its upstream dependency changed | Compares `updated` timestamps across the dependency chain |
| Rule: `clarity/no-vague-language` | Flags known ambiguous phrases ("as appropriate", "handle edge cases", "etc.", "TBD") | Catches common vague patterns, configurable word list |
| Rule presets | Define `minimal`, `recommended`, and `strict` presets that bundle rules with default severities | Presets resolve correctly, can be extended/overridden |
| Custom rule API | Document and expose the interface for writing custom lint rules | A custom rule can be loaded from a local path and executed |

#### 1.4 — `@sdx/cli`

The unified CLI entry point.

| Task | Description | Acceptance Criteria |
|---|---|---|
| `sdx init` | Interactive scaffolding: ask project name, which spec types to include, which lint preset. Generate `spec.config.yaml` and template spec files. | Generates valid config and spec stubs. Templates are useful starting points, not empty files. |
| `sdx init --template bmad` | Scaffold a spec suite matching the BMAD methodology structure | Generates BMAD-aligned spec files with appropriate sections |
| `sdx lint` | Run all configured lint rules against the spec suite. Output diagnostics to stdout. Exit code 1 if any errors. | Lints all specs, outputs formatted diagnostics, correct exit codes |
| `sdx lint --fix` | Auto-fix issues where possible (e.g. add missing frontmatter fields with defaults) | Fixes auto-fixable issues, reports what was fixed |
| `sdx lint <path>` | Lint a single spec file rather than the whole suite | Works for individual files, still resolves cross-references |
| `sdx validate` | Validate the `spec.config.yaml` itself (paths resolve, schemas valid, no config errors) | Reports config issues before lint even runs |
| `sdx graph` | Print the dependency graph to stdout (ASCII tree or DOT format for Graphviz) | Outputs readable graph, supports `--format dot` for visualisation |
| Output formatters | Support `--format` flag: `pretty` (default, coloured terminal), `json`, `github` (GitHub Actions annotation format) | All three formats produce correct output |
| `--quiet` / `--verbose` flags | Control log verbosity across all commands | Quiet suppresses info, verbose adds debug output |

#### 1.5 — Documentation & Dogfooding

| Task | Description | Acceptance Criteria |
|---|---|---|
| Write sdx's own specs | Use sdx to spec sdx. The `specs/` directory at repo root is the real spec suite for the project. | Specs pass `sdx lint` with `strict` preset |
| README | Project overview, installation, quick start, philosophy, comparison to alternatives | Clear enough that a developer can go from zero to linting in 5 minutes |
| Contributing guide | How to write custom rules, how to contribute spec type schemas | Community members can follow it to add a rule |
| Init template: `lightweight` | A minimal 2-file setup (PRD + technical design) for small projects | Works for solo devs on side projects |
| Init template: `bmad` | Full BMAD methodology suite | Matches the workflow you use on client projects |
| Init template: `api-first` | API contract + technical design + test plan | Suited for backend/API projects |

#### 1.6 — Project Infrastructure

| Task | Description | Acceptance Criteria |
|---|---|---|
| Monorepo setup | Turborepo or Nx, pnpm workspaces, shared tsconfig | `pnpm build` builds all packages, `pnpm test` runs all tests |
| Testing strategy | Vitest for unit tests, fixture-based tests using example spec suites | Coverage >80% on core and lint packages |
| CI pipeline | GitHub Actions: lint, typecheck, test on every PR | Pipeline passes on clean main branch |
| Publish pipeline | Changesets for versioning, automated npm publish on merge to main | Packages publish correctly to npm |
| Linting & formatting | ESLint + Prettier for the sdx codebase itself | Codebase passes its own linting |

### Phase 1 Exit Criteria

- [x] `npx specdx init` scaffolds a valid spec suite
- [x] `npx specdx lint` validates specs and reports diagnostics
- [x] `npx specdx graph` visualises the dependency tree
- [x] sdx's own specs pass `sdx lint --preset strict`
- [x] Published to npm as `specdx@0.1.0-alpha.1` (CLI) — `@sdx/*` packages pending org creation
- [x] README with quick start guide
- [ ] At least one external user (even if it's just using it on Flarecast or a NearForm project)

---

## Phase 2 — Daily Driver

**Goal**: Add `sdx pack` so developers get daily value from the tool every time they context-switch to an LLM. Make sdx the thing you reach for before every Claude/Cursor session.

**Timeline target**: 3–4 weeks after Phase 1

**Prerequisite**: Phase 1 complete and published.

### Phase 2 Deliverables

#### 2.1 — `@sdx/pack`

The context packing engine.

| Task | Description | Acceptance Criteria |
|---|---|---|
| Relevance resolver | Given a task description (free text), determine which specs are relevant. Use the dependency graph + keyword/section matching. | Returns ranked list of relevant specs with relevance scores |
| Token budget allocator | Given a max token budget and a set of relevant specs, allocate tokens proportionally based on relevance and spec size | Allocation respects budget, higher-relevance specs get more tokens |
| Section extractor | Extract only the sections of a spec relevant to the task, rather than including the entire document | Extracts correct sections, maintains context coherence |
| Boilerplate stripper | Remove changelog sections, revision history, author lists, and other metadata not useful for LLM context | Strips boilerplate, preserves all substantive content |
| Stable section summariser | For sections unchanged in >N days, generate a one-line summary instead of including full text (configurable) | Summarises correctly, saves tokens, no information loss for active sections |
| Resolved ADR collapser | Collapse resolved/superseded ADRs to a single line ("Decision: chose X over Y because Z") | Collapsed output is accurate and concise |
| Output formatter: XML | Format packed output with XML section tags (`<spec type="prd" id="prd-001">...</spec>`) | Valid XML, clear section boundaries |
| Output formatter: Markdown | Format packed output as structured markdown with headers and metadata | Clean markdown, parseable by LLMs |
| Output formatter: JSON | Format packed output as JSON (useful for API integrations) | Valid JSON, typed structure |
| Token count report | After packing, report: total tokens, tokens per spec, budget remaining, compression ratio | Accurate counts displayed to user |

#### 2.2 — CLI Integration

| Task | Description | Acceptance Criteria |
|---|---|---|
| `sdx pack` | Pack the full spec suite within the configured token budget | Produces formatted output to stdout |
| `sdx pack --task "implement login flow"` | Pack only specs relevant to the given task description | Returns relevant subset, respects token budget |
| `sdx pack --specs prd,technical` | Pack only the named specs | Packs specified specs, resolves their dependencies too |
| `sdx pack --budget 8000` | Override the configured token budget | Respects override budget |
| `sdx pack --copy` | Copy packed output directly to clipboard | Works on macOS (pbcopy) and Linux (xclip/xsel) |
| `sdx pack --out context.md` | Write packed output to a file | Writes correctly, reports file path |
| `sdx pack --format xml\|markdown\|json` | Choose output format | All three formats work |
| `sdx pack --dry-run` | Show what would be packed (spec list, estimated tokens) without producing output | Outputs plan without full packing |

#### 2.3 — Editor Integration (Stretch)

| Task | Description | Acceptance Criteria |
|---|---|---|
| VS Code extension: pack command | Command palette action: "SDX: Pack for LLM" that runs pack and copies to clipboard | Works from VS Code, copies output |
| VS Code extension: inline token count | Show estimated token count in the status bar for the current spec file | Updates on file change |
| Cursor rules file generation | `sdx pack --cursor` generates a `.cursorrules` file from the packed context | Valid Cursor rules file |
| Claude Project knowledge export | `sdx pack --claude-project` formats output optimised for Claude Project knowledge | Format matches Claude Project knowledge expectations |

#### 2.4 — `@sdx/skills` (Claude Code)

AI coding tool integration via opinionated workflow skills. Skills wrap sdx CLI commands and encode methodology — not just "how to call sdx" but when and why. Initially Claude Code only, with architecture open to Cursor/Codex adapters later. Depends on 2.1 (`@sdx/pack`) and 2.2 (CLI Integration) being complete first.

| Task | Description | Acceptance Criteria |
|---|---|---|
| Skills package scaffolding | Set up `@sdx/skills` package with skill file structure, README, and install instructions. | `npm install @sdx/skills` makes skills available to Claude Code. |
| Skill: `sdx:start-task` | Developer describes their task. Skill runs `sdx pack --task "..."`, injects the packed spec context, establishes guardrails. | Spec context is loaded automatically. LLM references specs during implementation. |
| Skill: `sdx:author-spec` | Guided spec authoring. Determines type, walks through sections, runs `sdx lint` iteratively, validates references. This is an interactive workflow distinct from Phase 4's `sdx generate` commands, which are deterministic stub generators for batch use. | Developer can author a valid spec without knowing the schema by heart. |
| Skill installation docs | How to install and configure sdx skills for Claude Code. Cover install, project setup, available skills, customization. | Developer can go from zero to working skills in under 2 minutes. |

### Phase 2 Exit Criteria

- [x] `sdx pack` produces token-optimised context payloads
- [x] Task-based relevance filtering returns sensible results
- [x] Clipboard integration works (`--copy`)
- [x] Token budget is respected and reported
- [x] At least 3 output formats supported (XML, Markdown, JSON)
- [ ] Used daily on at least one real project (Flarecast or NearForm client)
- [x] `sdx:start-task` skill loads spec context into Claude Code sessions
- [x] `sdx:author-spec` skill guides spec creation with iterative linting

---

## Phase 3 — Team Adoption

**Goal**: Ship the GitHub Action and spec-to-spec diffing. Make sdx a team tool that enforces spec health in CI. This is the phase that enables adoption across NearForm client projects and produces the Staff Engineer blog content.

**Timeline target**: 4–5 weeks after Phase 2

**Prerequisite**: Phase 2 complete.

### Phase 3 Deliverables

#### 3.1 — `@sdx/diff`

The spec-to-spec diffing engine.

| Task | Description | Acceptance Criteria |
|---|---|---|
| Structural diff | Detect added/removed/modified sections between two versions of a spec | Reports section-level changes accurately |
| Frontmatter diff | Detect changes in frontmatter fields (status, version, references, tags) | Reports field-level changes |
| Downstream impact analysis | Given a changed spec, walk the dependency graph and identify all downstream specs that may be affected | Returns complete list of potentially stale downstream specs |
| Staleness scorer | Score how likely a downstream spec is to be stale based on: time since last update, scope of upstream change, number of cross-references | Produces a 0–1 staleness probability score |
| Change summary generator | Produce a human-readable summary of what changed and what's impacted | Summary is concise and accurate |
| Git integration | Compare specs between git refs (branches, commits, tags) rather than just files on disk | `sdx diff --base main --head feature/auth` works |
| Cross-reference impact | If a spec adds/removes/renames a feature, story, or endpoint, flag all references to it in other specs | Catches broken references caused by upstream changes |

#### 3.2 — CLI Integration

| Task | Description | Acceptance Criteria |
|---|---|---|
| `sdx diff` | Show diff of the entire spec suite between working tree and last commit | Reports all changes and downstream impacts |
| `sdx diff --base <ref> --head <ref>` | Diff between two git refs | Works with branches, commits, tags |
| `sdx diff --spec prd` | Diff only a specific spec and show its downstream impact | Scoped diff with impact analysis |
| `sdx diff --format json` | Machine-readable diff output for CI consumption | Valid JSON diff report |
| `sdx status` | Show the overall health of the spec suite: which specs are stale, which have lint errors, which are up to date | Clear status overview, useful for standups |

#### 3.3 — `@sdx/action` (GitHub Action)

| Task | Description | Acceptance Criteria |
|---|---|---|
| Lint on PR | Run `sdx lint` on every PR that touches spec files or `spec.config.yaml` | Posts lint results as PR check, fails on errors |
| Diff on PR | Run `sdx diff` comparing PR branch to base branch | Posts downstream impact summary as PR comment |
| Staleness warnings | If a PR touches upstream specs without updating downstream ones, warn in the PR comment | Comment clearly identifies which downstream specs may need attention |
| Configurable blocking | Respect `ci.block_on` config to determine which severities block merges | Blocks on configured severities, passes on others |
| PR comment format | Post a well-formatted summary comment with: lint results, diff summary, staleness warnings, spec health score | Comment is scannable and actionable |
| Spec health badge | Generate a badge (SVG) showing spec suite health for the repo README | Badge updates on main branch, shows pass/warn/fail |
| Caching | Cache parsed specs and dependency graph between runs for faster CI execution | Measurably faster on subsequent runs |
| Action marketplace listing | Publish to GitHub Marketplace with documentation | Listed and installable from Marketplace |

#### 3.4 — Team Features

| Task | Description | Acceptance Criteria |
|---|---|---|
| Shared config presets | Publishable, shareable lint configs (like `eslint-config-airbnb` pattern) | `@sdx/config-nearform` or similar can be published and extended |
| Spec ownership | Assign owners to specs in config. Staleness warnings tag owners. | CI comment @-mentions the right people |
| Changelog generation | `sdx changelog` generates a changelog of spec changes between two refs | Useful for sprint reviews and handoffs |
| Onboarding mode | `sdx explain` prints a human-readable summary of the spec suite for new team members | Clear overview of project structure and intent |
| Skill: `sdx:pre-commit` | Before committing, runs `sdx lint` + `sdx diff` (working tree vs. last commit). LLM interprets drift, suggests whether specs or code need updating. Can also be wired as a Claude Code hook. Depends on 3.1 (`@sdx/diff`) and 3.2 (CLI Integration). | Drift is caught before entering commit history. Developer makes an informed decision. |
| Skill: `sdx:onboard` | Wraps `sdx explain` + full suite pack + graph + status. LLM walks new developer through the project. | New developer understands the spec landscape within one conversation. |
| Skill: `sdx:sprint-review` | Wraps `sdx status` + `sdx diff` + `sdx changelog`. LLM produces actionable spec health summary. | Team gets a shareable summary without manually running commands. |

#### 3.5 — Content & Adoption

| Task | Description | Acceptance Criteria |
|---|---|---|
| NearForm blog post | "How We Enforce Spec Health in CI with sdx" — real-world usage on a client project | Published on NearForm engineering blog |
| Conference talk outline | Abstract + outline for a talk on spec-driven development tooling | Submittable to JSConf, React Summit, or similar |
| Demo video | 5-minute screencast showing init → lint → pack → CI workflow | Published on YouTube/project site |
| NearForm internal adoption | Introduce sdx on at least one NearForm client project as a trial | Feedback collected from team members |

### Phase 3 Exit Criteria

- [ ] `sdx diff` detects spec changes and downstream impact
- [ ] GitHub Action runs lint + diff on PRs and posts formatted comments
- [ ] CI can block merges on spec health failures
- [ ] Spec health badge in repo README
- [ ] `sdx status` gives a useful overview for standups
- [ ] Blog post published
- [ ] Used on at least one NearForm client project
- [ ] Claude Code skills cover pre-commit checks, onboarding, and sprint review workflows
- [ ] Skills are documented and installable from npm

---

## Phase 4 — Spec Intelligence

**Goal**: Add spec-to-implementation diffing with optional LLM-assisted analysis. This is the ambitious, differentiated phase that makes sdx genuinely novel. No other tool in the ecosystem does this.

**Timeline target**: 4–5 weeks after Phase 3

**Prerequisite**: Phase 3 complete with real-world usage feedback.

### Phase 4 Deliverables

#### 4.1 — Static Spec-to-Implementation Analysis

LLM-free analysis that compares specs against code using AST parsing and pattern matching.

| Task | Description | Acceptance Criteria |
|---|---|---|
| API route matcher | Compare API contract spec (endpoints, methods, params) against actual route definitions in the codebase | Detects missing/extra routes, mismatched methods, missing params |
| Supported frameworks: Express | Parse Express route definitions | Correctly extracts routes from Express apps |
| Supported frameworks: Hono | Parse Hono route definitions | Correctly extracts routes from Hono apps |
| Supported frameworks: Next.js App Router | Parse Next.js file-based routes | Correctly maps file structure to routes |
| Type/schema matcher | Compare data model specs against TypeScript types, Zod schemas, or Prisma models | Detects missing/extra fields, type mismatches |
| Test coverage mapper | Compare test plan spec against actual test files to estimate spec coverage | Reports which spec'd test cases have corresponding tests |
| Implementation completeness score | Aggregate analysis into a percentage: "72% of specified features have detectable implementations" | Score is defensible and reproducible |
| `sdx check` CLI command | Run spec-to-implementation analysis | Reports findings with file locations and suggested actions |

#### 4.2 — LLM-Assisted Analysis (Opt-In)

Lightweight fallback for developers not using an AI coding tool. The recommended path for AI-assisted analysis is via the `sdx:verify` skill (see below), which delegates reasoning to the host tool's LLM. The `--ai` flag is a minimal single-provider alternative.

| Task | Description | Acceptance Criteria |
|---|---|---|
| `sdx check --ai` | Opt-in flag that sends spec + code + static analysis results to a single LLM provider (Anthropic only). Lightweight fallback for developers not using an AI coding tool. | Returns assessment for each drift finding. Works with an `ANTHROPIC_API_KEY` env var. |
| Spec generation suggestions | When drift is detected, output actionable suggestions in a structured format that both humans and skills can consume. | Suggestions are specific. Skills can parse the output. |
| Skill: `sdx:verify` | After implementing a feature, runs `sdx check`, feeds results + specs + code to the LLM. This is the recommended path for AI-assisted verification — replaces the need for provider abstraction, caching, and cost management. | Developer gets spec-vs-implementation review without configuring API keys or providers. |

#### 4.3 — Spec Generation & Maintenance

Tools that help maintain and evolve specs over time.

| Task | Description | Acceptance Criteria |
|---|---|---|
| `sdx generate story --from prd` | Generate user story stubs from a PRD's feature list | Generated stories reference the correct PRD features |
| `sdx generate test-plan --from stories` | Generate test plan stubs from user stories' acceptance criteria | Generated test cases map to acceptance criteria |
| `sdx update --from-code` | Suggest spec updates based on detected implementation drift | Suggestions are presented as diffs the user can accept/reject |
| `sdx migrate` | Migrate spec suite to a new schema version | Handles schema changes gracefully, reports what changed |

#### 4.4 — Ecosystem & Integrations

| Task | Description | Acceptance Criteria |
|---|---|---|
| MCP server | Expose sdx as an MCP server so LLMs can query spec health, pack context, and check drift directly | MCP protocol compliant, works with Claude |
| Mastra integration | SDX as a Mastra tool — agents can validate specs, pack context, and check drift as part of a workflow | Works within a Mastra agent pipeline |
| Jira/Linear sync | Map user stories to issue tracker tickets, detect when tickets drift from specs | Two-way awareness between specs and tickets |
| Slack notifications | Post spec health updates to a Slack channel (daily digest or on-change) | Configurable, useful for team awareness |
| Dashboard | Web-based dashboard showing spec health across multiple projects | Deployable as a standalone app or embedded in existing tools |
| Skills adapter architecture | Document how to write adapter layers for Cursor rules, Codex plugins, Windsurf, etc. Claude Code ships first; interface defined so community can contribute adapters. | Adapter guide with at least one worked example. Community can follow it to add a new tool. |

#### 4.5 — Advanced Lint Rules

| Task | Description | Acceptance Criteria |
|---|---|---|
| Rule: `consistency/naming-conventions` | Enforce consistent naming across specs (feature IDs, story IDs, endpoint naming) | Catches inconsistencies, suggests fixes |
| Rule: `consistency/terminology` | Detect when the same concept is referred to by different names across specs | Flags terminology drift, suggests canonical terms |
| Rule: `security/threat-coverage` | If a threat model spec exists, check that technical design addresses identified threats | Maps threats to mitigations |
| Rule: `completeness/edge-case-coverage` | Flag user stories or test plans that don't address error states, boundary conditions, or failure modes | Catches common omissions |
| Rule: `clarity/ambiguity-score-ai` (opt-in) | Use an LLM to score ambiguity more accurately than heuristic pattern matching. Note: the `sdx:author-spec` skill (Phase 2) already provides real-time ambiguity guidance during authoring — this rule is for CI/batch validation. | Better detection than rule-based, clearly flagged as AI-assisted |

### Phase 4 Exit Criteria

- [ ] `sdx check` detects drift between specs and code (static analysis)
- [ ] `sdx check --ai` provides single-provider LLM-assisted analysis as fallback (opt-in)
- [ ] `sdx:verify` skill provides AI-assisted spec review within AI coding tools (recommended path)
- [ ] API route matching works for at least Express, Hono, and Next.js
- [ ] MCP server is functional and tested with Claude
- [ ] Skills adapter architecture is documented for community contributions
- [ ] Spec generation stubs are useful starting points
- [ ] Conference talk delivered or submitted
- [ ] npm weekly downloads >500

---

## Success Metrics

### Adoption

| Metric | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|---|---|---|---|---|
| npm weekly downloads | 50+ | 200+ | 500+ | 1,000+ |
| GitHub stars | 100+ | 300+ | 750+ | 1,500+ |
| External contributors | 0 | 1–2 | 5+ | 10+ |
| Projects using sdx | 2 (own) | 5+ | 15+ | 30+ |

### Quality

| Metric | Target |
|---|---|
| Test coverage | >80% across all packages |
| Lint rule accuracy (precision) | >90% (low false positive rate) |
| Pack relevance accuracy | >80% (relevant specs selected for a given task) |
| CI execution time | <30s for a typical spec suite |

### Content & Visibility

| Milestone | Target Phase |
|---|---|
| First blog post (NearForm) | Phase 1 |
| "Why I'll Never Go Back to Vibe Coding" references sdx | Phase 1 |
| Conference talk submitted | Phase 3 |
| Conference talk delivered | Phase 4 |
| Featured in a newsletter or podcast | Phase 3–4 |

---

## Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Language | TypeScript | Target audience is TS developers. Dogfooding the "TypeScript ships" ethos. |
| Monorepo tool | Turborepo | Fast, well-maintained, good TS support. |
| Package manager | pnpm | Workspace support, fast installs, disk efficient. |
| Test framework | Vitest | Fast, TS-native, good DX. |
| Markdown parsing | `unified` / `remark` | Battle-tested, plugin ecosystem, AST access for section extraction. |
| YAML parsing | `yaml` (npm) | Full YAML 1.2 support, good error messages. |
| Token counting | `js-tiktoken` | Accurate token estimation without native dependencies. |
| AST parsing (Phase 4) | `ts-morph` | TypeScript AST analysis for spec-to-implementation matching. |
| CLI framework | `citty` or `commander` | Lightweight, good subcommand support. |
| Schema validation | `ajv` | Fast JSON Schema validation, well-maintained. |
| AI integration strategy | Skills-first, API-fallback | AI coding tools already have an LLM. sdx exposes structured spec data and deterministic analysis; the host tool provides reasoning. Eliminates provider abstraction, cost management, and caching. Opt-in `--ai` flag retained as lightweight fallback. |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Schema becomes too rigid for diverse workflows | Medium | High | Keep schema extensible with custom fields. Offer multiple presets. Gather feedback early. |
| Token counting diverges across LLM providers | Medium | Low | Use conservative estimates. Allow per-provider overrides. |
| Pack relevance is too noisy without LLM | Medium | Medium | Start with keyword + dependency graph matching. Add embedding-based matching later if needed. |
| GitHub Action is slow on large spec suites | Low | Medium | Implement caching, incremental analysis. |
| Scope creep into full project management tool | High | High | Stay focused on the spec layer. Integrate with PM tools, don't replace them. |
| Adoption stalls without community | Medium | High | Dogfood aggressively. Write content. Ship templates that lower the barrier. |
| LLM-assisted features (Phase 4) are unreliable | Low | Low | Skills delegate reasoning to the host tool's LLM, so unreliability is the host tool's concern, not sdx's. The lightweight `--ai` fallback uses a single provider (Anthropic) with no complex orchestration. Keep opt-in. Never required for core workflows. |
| Dependency on Claude Code's skill system stability | Medium | Medium | Skills are thin workflow orchestrators over the CLI — if the skill system changes, the skills are quick to update. CLI commands work independently of skills. Plan adapter layers for other tools (Cursor, Codex) to avoid single-platform lock-in. |

---

## Resolved Decisions

1. **Spec format flexibility** — SDX supports multiple spec formats, not just markdown-with-frontmatter. YAML specs are a first-class citizen, and OpenAPI can be used for API contract specs. The schema layer is format-agnostic — it defines what a valid PRD _contains_, not what file format it lives in. The parser in `@sdx/core` uses a plugin architecture: markdown parser, YAML parser, and OpenAPI parser for API contracts.

2. **Monorepo vs multi-repo specs** — Monorepo-first with a federation model for later. Phase 1–3 assumes single-repo. In Phase 4, a `sdx.federation.yaml` will allow declaring external spec sources with URLs or package references, similar to TypeScript project references. Each repo owns its own specs, but can declare dependencies on specs published from other repos.

3. **Versioning granularity** — Individual specs are versioned independently via the `version` field in frontmatter. The `version` field in `spec.config.yaml` tracks the config schema version, not the content version.

4. **Pack personalisation** — No provider-specific formatting. Modern LLMs all handle XML and structured markdown well enough that the differences are marginal. SDX offers three output formats (XML, markdown, JSON) and lets the user pick. If a meaningful provider divergence emerges later, it can be added as a community-contributed format plugin.

5. **Naming** — The project is called `sdx` (Spec Developer Experience) and the CLI command is `sdx`. The npm package is published as `specdx` (the `sdx` name was unavailable on npm). The `@sdx` npm scope will be registered as an npm org. Target domain: `sdx.dev`. The name mirrors the "DX" (Developer Experience) abbreviation familiar to the TypeScript ecosystem.

6. **AI integration model** — Skills-first, not API-first. The original design had sdx calling LLM APIs directly for intent analysis, ambiguity scoring, and drift detection. This required provider abstraction, cost estimation, caching, and confidence thresholds — significant complexity. The revised approach recognizes that developers using AI-assisted workflows already have an LLM available in their coding tool. sdx skills orchestrate the workflow (when to pack, lint, diff, check) and feed structured results to the host LLM for reasoning. The `--ai` flag on `sdx check` is retained as a minimal single-provider fallback, not the primary path. This cuts ~40% of Phase 4 scope and moves the highest-value AI integration (spec-aware coding sessions) from Phase 4 to Phase 2.
