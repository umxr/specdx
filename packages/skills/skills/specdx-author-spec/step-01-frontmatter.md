---
step: 1
name: Frontmatter
description: Determine spec type, check existing specs, create file with frontmatter
---

# Step 1: Frontmatter

## Determine the type

Ask what kind of spec they need:

| Type | Use when | Required sections |
|---|---|---|
| `prd` | Defining what to build | Problem Statement, Goals, Non-Goals, Features, Success Criteria |
| `technical-design` | Describing how it works | Overview, Architecture, Data Model, API Design, Dependencies, Risks, Open Questions |
| `user-story` | Capturing a user workflow | Description, Acceptance Criteria, Dependencies, Notes |
| `test-plan` | Planning test coverage | Scope, Test Cases, Coverage Matrix, Edge Cases |
| `adr` | Recording a decision | Context, Decision, Status, Consequences |
| `api-contract` | Defining an API | Endpoints, Request/Response Schemas, Auth, Error Codes |

For detailed guidance on each type, read `spec-type-reference.md` in the parent directory.

## Check existing specs

```bash
npx specdx validate
npx specdx graph
```

This shows what specs exist and their dependency relationships. Use this to determine where the new spec fits.

## Create the file with frontmatter

```yaml
---
id: "<type>-<short-name>"
type: "<spec-type>"
title: "<clear title>"
status: "draft"
version: "0.1"
created: "<YYYY-MM-DD>"
authors: ["<name>"]
tags: ["<keyword>", "<keyword>"]
references:
  - id: "<other-spec-id>"
    relationship: "depends-on"
---
```

Rules:
- **Always quote dates**: `"2026-03-18"` — unquoted YAML dates fail validation
- **authors must have at least one entry** — `authors: []` fails validation
- **id** must be unique across the spec suite
- **type** must be one of: `prd`, `technical-design`, `user-story`, `test-plan`, `adr`, `api-contract`
- **status** must be one of: `draft`, `review`, `approved`, `superseded`
- **references.relationship** must be one of: `implemented-by`, `decomposed-into`, `depends-on`, `supersedes`, `related-to`

Run an initial lint to verify frontmatter:

```bash
npx specdx lint --path <file>
```

---
**Next:** When frontmatter passes lint, read `step-02-sections.md` in this directory.
