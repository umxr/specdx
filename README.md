# sdx — Spec Developer Experience

> One CLI to validate, pack, diff, and ship specs that keep your LLM-assisted workflows honest.

[![npm version](https://img.shields.io/npm/v/sdx)](https://www.npmjs.com/package/sdx)
[![license](https://img.shields.io/npm/l/sdx)](LICENSE)

---

## The Problem

Most AI-assisted development workflows are ad-hoc. Developers write specs in inconsistent formats,
manually paste them into context windows, and hope the LLM respects the constraints. There is no
validation, no diffing, no CI integration, and no standard.

A PRD missing its "Non-Goals" section ships the same as one that is complete. A technical design
that was updated last month silently invalidates the test plan nobody touched. A developer context-
switches into a Claude session and spends 10 minutes assembling the right spec fragments by hand.

**sdx** is the missing toolchain for spec-driven development. It enforces structure on the way in,
packs context on the way out, and catches drift along the way.

---

## Philosophy

### Spec-driven development is a discipline, not a file format

sdx does not care whether you use a particular methodology. It provides a formal schema for the
most common spec types — PRD, technical design, user story, test plan, ADR, API contract — and
lets you bring your own content. The structure is enforced; the ideas are yours.

### Deterministic validation before AI reasoning

sdx's core pipeline is entirely deterministic. No LLM calls during validation, linting, or graph
resolution. You get reproducible results in CI, fast feedback at the CLI, and no API keys required
for the fundamental workflow. AI integration is opt-in and skills-based, delegating reasoning to
the tool you already have open.

### Skills-first AI integration

Modern developers already have an LLM in their coding environment. sdx does not bolt on a second
one. Instead, it exposes structured spec data and deterministic analysis through Claude Code skills
that orchestrate *when* to pack context, lint, or check drift. The host tool provides the
reasoning; sdx provides the signal.

---

## Why Not Just Markdown Lint?

Standard markdown linters (markdownlint, remark-lint) check formatting and syntax. sdx checks
**semantics**:

| Concern | Markdown linters | sdx |
|---|---|---|
| Valid YAML frontmatter | No | Yes |
| Required sections by spec type | No | Yes |
| Cross-reference validity | No | Yes |
| Dependency chain cycles | No | Yes |
| Downstream staleness detection | No | Yes |
| Token-optimised context packing | No | Yes |
| CI spec health enforcement | No | Yes |

## Why Not Just YAML Schemas?

YAML schema validators (e.g. JSON Schema + AJV) validate structure. They cannot check that a PRD
contains a "Problem Statement" section, that a cross-reference resolves to a real spec, or that
a downstream test plan is still fresh relative to the technical design it depends on. sdx combines
schema validation with document-level semantic rules.

## What Makes sdx Different

1. **Dependency chains.** `requires` declarations in `spec.config.yaml` build a DAG. Rules that
   understand this graph catch staleness and broken references across the entire suite.

2. **Context packing.** `sdx pack` (Phase 2) assembles a token-optimised payload for any LLM
   session. Relevance filtering, budget allocation, and boilerplate stripping mean you send the
   right content, not all of it.

3. **Drift detection.** `sdx diff` (Phase 3) compares spec versions and walks the dependency graph
   to identify downstream specs affected by upstream changes. Drift is caught before it reaches a
   reviewer or an LLM.

---

## Installation

```bash
npm install -g sdx
```

Or use without installing:

```bash
npx sdx init
```

---

## Quick Start

### 1. Initialise a spec suite

```bash
cd your-project
sdx init
```

Follow the prompts to choose a project name, which spec types to include, and a lint preset.
This generates `spec.config.yaml` and starter spec files in `specs/`.

### 2. Edit your specs

Open `specs/prd.md` (or whichever spec type you chose) and fill in the content. Every spec is a
markdown file with YAML frontmatter:

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

# User Authentication System

## Problem Statement

...

## Goals

...

## Non-Goals

...

## Features

...

## Success Criteria

...
```

### 3. Lint your specs

```bash
sdx lint
```

sdx validates frontmatter, checks that all required sections are present, verifies cross-references,
and runs the configured rule preset. Exit code 0 means clean; exit code 1 means errors.

### 4. View the dependency graph

```bash
sdx graph
```

Prints the dependency tree derived from `requires` declarations. Use `--format dot` to get
Graphviz DOT output for visualisation.

---

## Spec File Format

All specs are markdown files with YAML frontmatter. The frontmatter provides machine-readable
metadata; the body is human-readable content.

### Required frontmatter fields

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique identifier within the spec suite |
| `type` | enum | `prd`, `technical-design`, `user-story`, `test-plan`, `adr`, `api-contract` |
| `title` | string | Human-readable title |
| `status` | enum | `draft`, `review`, `approved`, `superseded` |
| `version` | string | Semantic version (e.g. `"1.0"`) |
| `created` | date string | ISO 8601 date (e.g. `"2026-03-01"`) — quote it to avoid YAML date parsing |
| `authors` | string[] | At least one author name or handle |

### Optional frontmatter fields

| Field | Type | Description |
|---|---|---|
| `updated` | date string | Date of last meaningful edit |
| `tags` | string[] | Arbitrary labels for filtering |
| `references` | object[] | Cross-references to other specs |

### References

```yaml
references:
  - id: "tech-001"
    relationship: "depends-on"
  - id: "story-auth-001"
    relationship: "decomposed-into"
```

Valid relationship types: `implemented-by`, `decomposed-into`, `depends-on`, `supersedes`,
`related-to`.

### Required sections by spec type

| Type | Required sections |
|---|---|
| `prd` | Problem Statement, Goals, Non-Goals, Features, Success Criteria |
| `technical-design` | Overview, Architecture, Data Model, API Design, Dependencies, Risks, Open Questions |
| `user-story` | Description, Acceptance Criteria, Dependencies, Notes |
| `test-plan` | Scope, Test Cases, Coverage Matrix, Edge Cases |
| `adr` | Context, Decision, Status, Consequences |
| `api-contract` | Endpoints, Request/Response Schemas, Auth, Error Codes |

---

## Configuration

`spec.config.yaml` at the repository root defines the spec suite:

```yaml
version: "1.0"

project:
  name: "my-project"
  description: "Short description"

specs:
  prd:
    path: "specs/prd.md"
    type: "prd"
    required: true

  technical:
    path: "specs/technical-design.md"
    type: "technical-design"
    requires: ["prd"]

  stories:
    path: "specs/stories/*.md"
    type: "user-story"
    requires: ["prd"]

  test-plan:
    path: "specs/test-plan.md"
    type: "test-plan"
    requires: ["technical"]

lint:
  extends: "recommended"   # minimal | recommended | strict
```

Validate the config with:

```bash
sdx validate
```

---

## Schema Versioning

sdx uses a three-level versioning model:

- **Schema version** — tracked by the `version` field in `spec.config.yaml`. This is the version
  of the sdx config schema itself. Increment when sdx releases breaking config changes.

- **Spec version** — tracked by the `version` field in each spec's frontmatter. Authors manage
  this independently per spec. Use semver conventions: increment the minor version for additive
  changes, the major version for breaking changes.

- **Package version** — sdx packages use semver with Changesets. Breaking changes to the JSON
  Schema, public TypeScript APIs, or CLI interface increment the major version.

When the schema version changes between sdx releases, a `sdx migrate` command (Phase 4) will
handle upgrading spec suites.

---

## CLI Reference

| Command | Description |
|---|---|
| `sdx init` | Scaffold a new spec suite interactively |
| `sdx init --template bmad` | Scaffold using the BMAD methodology template |
| `sdx init --template api-first` | Scaffold for API-first projects |
| `sdx lint` | Lint all specs in the suite |
| `sdx lint [path]` | Lint a single spec file |
| `sdx lint --preset strict` | Override the configured preset |
| `sdx validate` | Validate `spec.config.yaml` structure |
| `sdx graph` | Print the dependency tree |
| `sdx graph --format dot` | Print in Graphviz DOT format |

Global flags: `--format pretty|json|github`, `--quiet`, `--verbose`.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, how to write custom lint rules,
and the PR process.

---

## License

MIT — see [LICENSE](LICENSE).
