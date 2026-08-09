# specdx

> The context engine for spec-driven development — keeps AI coding sessions grounded in validated, token-budgeted spec context.

[![npm version](https://img.shields.io/npm/v/specdx)](https://www.npmjs.com/package/specdx)
[![license](https://img.shields.io/npm/l/specdx)](LICENSE)
[![CI](https://github.com/umxr/specdx/actions/workflows/ci.yml/badge.svg)](https://github.com/umxr/specdx/actions/workflows/ci.yml)

---

## What is specdx?

specdx does a few things really well: it gives your project specs (PRDs, technical designs, user stories, test plans, ADRs, API contracts) a formal schema, **validates and lints** them, **packs** them into token-optimised context for LLM sessions, and **tracks freshness** so drift between specs gets caught before it compounds.

No LLM calls in the core pipeline. No API keys required. Deterministic validation you can run in CI.

```bash
npm install -g specdx
```

---

## The Real-World Workflow

specdx fits into how developers actually work with AI coding tools. Here's what day-to-day usage looks like.

### Setting Up a New Project

```bash
cd your-project
specdx init --name "my-app" --template lightweight
```

This creates `spec.config.yaml` and starter specs in `specs/`. Five templates available:

| Template | What you get | Best for |
|----------|-------------|----------|
| `lightweight` | PRD + Technical Design | Small projects, solo devs |
| `bmad` | PRD + Technical Design + Test Plan + stories/ + adr/ | Full methodology |
| `api-first` | Technical Design + API Contract + Test Plan | Backend/API projects |
| `quick` | Single Quick Spec | Rapid prototyping |
| `context` | Project Context only | Adding to existing projects |

### Adding specdx to an Existing Project

If you already have a codebase and want to introduce specs:

```bash
cd existing-project
specdx init --name "my-app" --template context
```

Start with `context` to create a project-context spec describing your stack, conventions, and constraints. Then add specs incrementally as you plan new work:

```bash
# Add a PRD when you're planning a feature
# Add a technical design when you're making architecture decisions
# Add user stories when you're breaking work into tasks
```

Edit `spec.config.yaml` to register each new spec with its type and dependencies.

### Daily Development Loop

This is the core loop. Every coding session follows the same pattern:

**1. Load context before you code**

```bash
specdx pack --task "implement user authentication" --copy
```

This scores every spec in your suite for relevance to your task, allocates a token budget, compresses boilerplate, and copies the result to your clipboard. Paste it into your LLM session or let the Claude Code skill handle it automatically.

**2. Write code informed by specs**

Your LLM session now has the right context — the PRD features you're implementing, the technical constraints, the acceptance criteria, the API contract. No manual copy-pasting, no guessing which specs matter.

**3. Lint before committing**

```bash
specdx lint
```

Validates frontmatter, checks required sections, verifies cross-references, detects circular dependencies, flags vague language, and catches hardcoded secrets in specs. Three presets: `minimal`, `recommended`, `strict`.

**4. Keep specs fresh**

```bash
specdx diff        # what changed, and which downstream specs it affects
specdx ready       # is the suite fit to implement from?
```

If you updated the PRD but not the test plan that depends on it, `diff` flags it before the staleness compounds.

### Planning New Work

When you're starting a new feature or project phase:

```bash
# Check what state the spec suite is in
specdx status

# See the dependency graph
specdx graph

# Check if specs are ready for implementation
specdx ready
```

`ready` validates that all required specs exist, lint is clean, no references are broken, no specs are stale, and PRD features have corresponding user stories. It's the gate between "planning" and "building."

### Reviewing Changes

When specs change (or should have changed):

```bash
# What specs changed since main?
specdx diff

# What's the downstream impact?
specdx diff --base main --head HEAD

# Generate a changelog for sprint review
specdx diff --base v1.0 --head HEAD --format changelog

# Include specs you haven't committed yet
specdx diff --working
```

`diff` walks the dependency graph to find downstream specs affected by upstream changes. If you updated the PRD but forgot to update the test plan that depends on it, `diff` flags it.

### Onboarding New Team Members

```bash
specdx status
specdx graph
specdx pack --full
```

`status` reports what specs exist and how healthy they are, `graph` shows how they relate, and `pack --full` loads the content itself. A new developer can understand the project's intent without opening a spec file. The `specdx-onboard` skill drives this sequence as a guided tour.

### CI Integration

Add spec health checks to your CI pipeline with the GitHub Action:

```yaml
# .github/workflows/specs.yml
- uses: umxr/specdx-action@v1
  with:
    preset: recommended
```

The action runs lint + diff on every PR, posts a formatted comment with results, and can block merges on spec health failures. Configure severity thresholds in `spec.config.yaml`:

```yaml
ci:
  block_on: ["error"]
  post_comment: true
```

---

## Experimental Features

These ship with specdx but are **not part of the stable surface** — they lean on static code analysis, which is inherently fuzzy, and their output and interfaces may change or produce noise. They are flagged `[experimental]` in CLI help.

| Command | What it does |
|---------|-------------|
| `specdx check` | Spec-to-implementation drift analysis: extracts routes (Express, Hono, Next.js), types (TS, Zod, Prisma), and tests from your code and compares them against specs |
| Declared artifacts | Framework-agnostic checkable surfaces for `check`: a spec's optional `artifacts:` frontmatter lists files that must exist and names they must export, so any project — static sites, CLIs, libraries — gets drift checking. See below. |
| `specdx check --ai` | Sends check findings to Claude for assessment (requires `ANTHROPIC_API_KEY`) |
| `specdx update --from-code` | Suggests spec updates from check findings |
| `specdx generate test-plan` | Generates test-plan stubs from story acceptance criteria |
| `specdx migrate` | Schema-version migration for spec suites |

Feedback on these is especially welcome — accuracy improvements (confidence scoring, better matching) are what graduates them to stable.

### Declared artifacts

When no framework extractor applies (Astro, static sites, CLIs, libraries), declare what "implemented" means directly in a spec's frontmatter:

```yaml
artifacts:
  - path: "middleware.ts"
  - path: "scripts/export-crawler-log.mjs"
  - path: "src/lib/bots.ts"
    exports: ["BOT_SIGNATURES"]
```

`specdx check` verifies each `path` exists and each name in `exports` is exported from it (export checks use ts-morph and are skipped with a note — never silently passed — when it isn't installed). Declared artifacts count toward the implementation score as their own category and make a spec checkable on any stack.

**Enforcement follows the spec's `status`**, so you can declare artifacts in a spec written before the code exists:

| Spec status | Declared file or export missing | Exit code |
|---|---|---|
| `draft`, `review`, `superseded` | reported as **pending** — planned, not yet built. Excluded from the score. | 0 |
| `approved` | reported as a **missing** error — the spec says this should exist | 1 |

The rule applies identically to a planned `path` and a planned entry in `exports`, so a spec can declare that an existing file will gain a new export. Files and exports that *do* exist are always verified, whatever the status. Flipping a spec to `approved` is what makes its contract enforceable, so `check` can tell "this is a plan for unbuilt work" apart from "this was approved but three of its five artifacts are missing".

---

## Claude Code Integration

specdx ships as a Claude Code plugin with 9 skills that automate the workflow above.

### Automatic Setup

Install specdx as a dev dependency and the plugin is discovered automatically:

```bash
npm install -D specdx
```

Or install skills manually:

```bash
specdx skills install
```

Skills install to `.claude/skills/<name>/SKILL.md` and follow the
[Agent Skills specification](https://agentskills.io/specification).

### Skills

| Skill | What it does |
|-------|-------------|
| `specdx-start-task` | Loads spec context before coding — runs `pack --task` and injects the result |
| `specdx-author-spec` | Guides spec creation with iterative linting gates between sections |
| `specdx-plan-from-spec` | Generates implementation plans grounded in the spec suite |
| `specdx-verify` | *(experimental)* Verifies implementation against specs using `check` |
| `specdx-check-drift` | *(experimental)* Cross-references code changes vs spec definitions |
| `specdx-pre-commit` | Runs lint + diff before commits to catch drift early |
| `specdx-review-spec` | Multi-layer quality review (completeness, consistency, adversarial) |
| `specdx-onboard` | Guided overview for new developers |
| `specdx-sprint-review` | Generates shareable spec health summary for standups |

### MCP Server

specdx also exposes all tools over MCP (Model Context Protocol) for programmatic access:

```bash
specdx mcp
```

7 tools available: `sdx_validate`, `sdx_lint`, `sdx_pack`, `sdx_status`, `sdx_check`, `sdx_diff`, `sdx_graph`.

---

## Spec File Format

Every spec is a Markdown file with YAML frontmatter:

```markdown
---
id: "prd-001"
type: "prd"
title: "User Authentication System"
status: "approved"
version: "1.0"
created: "2026-03-01"
authors: ["alice"]
---

## Problem Statement

Our application has no authentication...

## Goals

1. Support email/password login
2. ...

## Non-Goals

- Social login (Phase 2)
- ...

## Features

- **F1 Login Flow**: Email and password with rate limiting...
- **F2 Session Management**: JWT tokens with refresh...

## Success Criteria

- 99.9% auth uptime
- < 200ms login response time
```

### Spec Types

| Type | Required Sections | Extra Fields |
|------|------------------|--------------|
| `prd` | Problem Statement, Goals, Non-Goals, Features, Success Criteria | — |
| `technical-design` | Overview, Architecture, Data Model, API Design, Dependencies, Risks, Open Questions | — |
| `user-story` | Description, Acceptance Criteria, Dependencies, Notes | `story_id`, `priority`, `estimate` |
| `test-plan` | Scope, Test Cases, Coverage Matrix, Edge Cases | — |
| `adr` | Context, Decision, Status, Consequences | — |
| `api-contract` | Endpoints, Request/Response Schemas, Auth, Error Codes | — |
| `epic` | (flexible) | `epic_id`, `priority` |
| `quick-spec` | (flexible) | — |
| `project-context` | (flexible) | — |

### Required Frontmatter

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier within the spec suite |
| `type` | enum | One of the 9 spec types above |
| `title` | string | Human-readable title |
| `status` | enum | `draft`, `review`, `approved`, `superseded` |
| `version` | string | Version string (e.g. `"1.0"`) |
| `created` | string | ISO 8601 date — must be quoted in YAML |
| `authors` | string[] | At least one author |

### Cross-References

Specs can reference each other in frontmatter:

```yaml
references:
  - id: "tech-001"
    relationship: "depends-on"
  - id: "story-auth-001"
    relationship: "decomposed-into"
```

Relationships: `implemented-by`, `decomposed-into`, `depends-on`, `supersedes`, `related-to`.

---

## Configuration

`spec.config.yaml` at the project root:

```yaml
version: "1.0"

project:
  name: "my-project"

specs:
  prd:
    path: specs/prd.md
    type: prd
    required: true

  technical:
    path: specs/technical-design.md
    type: technical-design
    requires: ["prd"]

  stories:
    path: "specs/stories/*.md"
    type: user-story
    requires: ["prd"]

  test-plan:
    path: specs/test-plan.md
    type: test-plan
    requires: ["technical"]

lint:
  extends: "recommended"
  rules:
    consistency/naming-conventions: off

pack:
  max_tokens: 12000
  format: xml
  compression:
    strip_boilerplate: true
    stable_days: 30

diff:
  baseline_ref: main
  staleness_threshold_days: 14

check:
  framework: auto  # auto | express | hono | nextjs

ci:
  block_on: ["error"]
  post_comment: true
```

---

## CLI Reference

| Command | Description |
|---------|-------------|
| `specdx init --name <name>` | Scaffold a new spec suite |
| `specdx lint` | Lint all specs against configured rules |
| `specdx validate` | Validate `spec.config.yaml` |
| `specdx pack --task <task>` | Pack specs into token-optimised context |
| `specdx status` | Show spec suite health overview |
| `specdx check` | *(experimental)* Analyse spec-to-implementation drift |
| `specdx diff` | Show spec changes and downstream impact (`--working`, `--format changelog`) |
| `specdx graph` | Print the dependency graph |
| `specdx ready` | Check if specs are ready for implementation |
| `specdx generate story --from <id>` | Generate user story stubs from a PRD |
| `specdx generate test-plan` | *(experimental)* Generate test plan stub from stories |
| `specdx update` | *(experimental)* Suggest spec updates based on code drift |
| `specdx migrate` | *(experimental)* Check and validate spec schema version |
| `specdx skills install` | Install Claude Code skills |
| `specdx mcp` | Start the MCP server |

Global flags: `--format pretty|json|github`, `--quiet`, `--verbose`.

---

## Why specdx?

**vs. Markdown linters** (markdownlint, remark-lint) — They check formatting. specdx checks semantics: required sections by spec type, cross-reference validity, dependency chain cycles, downstream staleness.

**vs. YAML validators** (JSON Schema + AJV) — They check structure. specdx combines schema validation with document-level semantic rules that understand spec relationships.

**What makes it different:**

1. **Dependency chains.** `requires` declarations build a DAG. Rules catch staleness and broken references across the entire suite.
2. **Context packing.** `specdx pack` assembles token-optimised payloads with relevance filtering, budget allocation, and boilerplate stripping.
3. **Drift detection.** `specdx diff` walks the dependency graph to find specs affected by upstream changes, and `specdx ready` gates implementation on suite health. (Experimental: `specdx check` compares specs against your actual implementation.)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, how to write custom lint rules, and the PR process.

## License

MIT — see [LICENSE](LICENSE).
