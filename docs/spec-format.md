# Spec format

Every spec is a Markdown file with YAML frontmatter. The frontmatter is
validated against a JSON Schema; the headings are checked against the required
sections for that spec type.

```markdown
---
id: "prd-001"
type: "prd"
title: "User authentication"
status: "approved"
version: "1.0"
created: "2026-03-01"
authors: ["alice"]
---

## Problem Statement

The application has no authentication, so every endpoint is public.

## Goals

- Email and password login
- Sessions that survive a page reload

## Non-Goals

- Social login, which is phase 2

## Features

- **F1**: Login flow with rate limiting
- **F2**: Session management with refresh tokens

## Success Criteria

- 99.9% auth uptime
- Login responds in under 200 ms
```

## Required frontmatter

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Unique within the suite. Should match its key in `spec.config.yaml`. |
| `type` | enum | One of the nine types below |
| `title` | string | Human-readable title |
| `status` | enum | `draft`, `review`, `approved`, `superseded` |
| `version` | string | e.g. `"1.0"` |
| `created` | string | ISO 8601 date — **must be quoted**, or YAML parses it as a date object |
| `authors` | string[] | At least one |

`updated`, `tags`, `references` and `artifacts` are optional.

## Spec types

Each type requires its own sections. A missing section is an error, not a
warning.

| Type | Required sections | Extra frontmatter |
|------|------------------|--------------|
| `prd` | Problem Statement, Goals, Non-Goals, Features, Success Criteria | — |
| `technical-design` | Overview, Architecture, Data Model, API Design, Dependencies, Risks, Open Questions | — |
| `user-story` | Description, Acceptance Criteria, Dependencies, Notes | `story_id`, `priority`, `estimate` |
| `test-plan` | Scope, Test Cases, Coverage Matrix, Edge Cases | — |
| `adr` | Context, Decision, Status, Consequences | — |
| `api-contract` | Endpoints, Request/Response Schemas, Auth, Error Codes | — |
| `epic` | Overview, Stories, Acceptance Criteria, Dependencies | `epic_id`, `priority` |
| `quick-spec` | Intent, Boundaries, Tasks | — |
| `project-context` | Technology Stack, Critical Implementation Rules, Coding Patterns | — |

`priority` is one of `critical`, `high`, `medium`, `low`. `estimate` is a free
string.

## Cross-references

Specs point at each other in frontmatter. This is an array of objects, not a
list of ids:

```yaml
references:
  - id: "tech-001"
    relationship: "depends-on"
  - id: "story-auth-001"
    relationship: "decomposed-into"
```

Relationships: `implemented-by`, `decomposed-into`, `depends-on`, `supersedes`,
`related-to`.

References are validated — pointing at an id that does not exist is an error.
They also feed the dependency graph that `specdx diff` walks to find downstream
impact.

## Declared artifacts

Optional. Lists the files a spec claims to be implemented by, and the names they
must export. This is what makes a spec checkable on a stack no framework
extractor understands — static sites, CLIs, libraries.

```yaml
artifacts:
  - path: "middleware.ts"
  - path: "src/lib/bots.ts"
    exports: ["BOT_SIGNATURES"]
```

`specdx check` verifies each `path` exists and each name in `exports` is
exported from it. Export checks need `ts-morph`; without it they are skipped
with a note, never silently passed.

**Enforcement follows the spec's `status`**, so you can declare artifacts for
work that has not been built yet:

| Spec status | Missing file or export | Exit code |
|---|---|---|
| `draft`, `review`, `superseded` | reported as **pending** — planned, not built. Excluded from the score. | 0 |
| `approved` | reported as a **missing** error | 1 |

Files and exports that do exist are always verified, whatever the status.
Flipping a spec to `approved` is what makes its contract enforceable, so
`check` can tell "a plan for unbuilt work" apart from "approved, and three of
its five artifacts are missing".

## Sections `specdx check` reads

Most sections are prose that only a human reads. Three are parsed so `check`
can compare them against code. Write them in one of the shapes below — anything
else is treated as prose, and `check` reports the section as **not assessed**
rather than counting it as covered.

### `## Endpoints` (api-contract)

Either shape, or a mix of both. Listing an endpoint twice does not count it
twice.

```markdown
- `GET /invoices` — list invoices
- POST /invoices — create an invoice
- `DELETE /invoices/:id` — void an invoice

### GET /invoices/:id

Read a single invoice.
```

Bullets that are not endpoints ("Every route requires a bearer token") are
ignored.

### `## Data Model` (technical-design)

A `###` heading per type, one field per line. The heading must be a single
identifier — `### Notes on the model` is read as prose, not as a type called
`Notes`. Backticks around field names are optional.

```markdown
### Invoice

- id: string
- `amountCents`: number
- paidAt?: Date
```

A markdown table is also read, if it has a field column and a type column. A
table that cannot be read is named in the output rather than dropped silently.

### `## Test Cases` (test-plan)

One bullet per case, optionally grouped under `###` headings. Each is matched
against your test descriptions by word overlap.

```markdown
### Invoices

- creates an invoice with a valid payload
- rejects an invoice with a negative amount
```

An optional `TC1:` style prefix is recognised and stripped from the suggested
test name.
