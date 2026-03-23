# specdx

> Validate, lint, pack, and ship specs that keep your LLM-assisted workflows honest.

[![npm version](https://img.shields.io/npm/v/specdx)](https://www.npmjs.com/package/specdx)
[![license](https://img.shields.io/npm/l/specdx)](LICENSE)
[![CI](https://github.com/umxr/specdx/actions/workflows/ci.yml/badge.svg)](https://github.com/umxr/specdx/actions/workflows/ci.yml)

---

## What is specdx?

specdx is a CLI toolchain for spec-driven development. It gives your project specs (PRDs, technical designs, user stories, test plans, ADRs, API contracts) a formal schema, validates them, and packs them into token-optimised context for LLM sessions.

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

**3. Check for drift**

```bash
specdx check
```

After implementation, `check` does static analysis of your codebase against your specs. It extracts routes, types, and tests from your code (Express, Hono, and Next.js supported) and compares them against what the specs say should exist. You get a coverage percentage and a list of findings: missing routes, unimplemented types, gaps in test coverage.

**4. Lint before committing**

```bash
specdx lint
```

Validates frontmatter, checks required sections, verifies cross-references, detects circular dependencies, flags vague language, and catches hardcoded secrets in specs. Three presets: `minimal`, `recommended`, `strict`.

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
specdx changelog --from v1.0 --to HEAD
```

`diff` walks the dependency graph to find downstream specs affected by upstream changes. If you updated the PRD but forgot to update the test plan that depends on it, `diff` flags it.

### Onboarding New Team Members

```bash
specdx explain
```

Prints a human-readable overview of the spec suite: what specs exist, their types and statuses, how they relate to each other, and a brief summary of each one. A new developer can understand the project's intent in one command.

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

### Skills

| Skill | What it does |
|-------|-------------|
| `specdx-start-task` | Loads spec context before coding — runs `pack --task` and injects the result |
| `specdx-author-spec` | Guides spec creation with iterative linting gates between sections |
| `specdx-plan-from-spec` | Generates implementation plans grounded in the spec suite |
| `specdx-verify` | Verifies implementation against specs using `check` |
| `specdx-check-drift` | Cross-references code changes vs spec definitions |
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
| `specdx check` | Analyse spec-to-implementation drift |
| `specdx diff` | Show spec changes and downstream impact |
| `specdx graph` | Print the dependency graph |
| `specdx ready` | Check if specs are ready for implementation |
| `specdx explain` | Print a human-readable spec suite overview |
| `specdx changelog` | Generate changelog of spec changes |
| `specdx generate story --from <id>` | Generate user story stubs from a PRD |
| `specdx generate test-plan` | Generate test plan stub from stories |
| `specdx update` | Suggest spec updates based on code drift |
| `specdx migrate` | Check and validate spec schema version |
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
3. **Drift detection.** `specdx diff` walks the dependency graph to find specs affected by upstream changes. `specdx check` compares specs against your actual implementation.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, how to write custom lint rules, and the PR process.

## License

MIT — see [LICENSE](LICENSE).
