---
name: specdx-author-spec
description: Use when the user wants to create a new spec, write a PRD, document a technical design, record an architecture decision, add a user story, or write a test plan. Guides spec authoring with iterative linting.
allowed-tools: Bash(npx specdx *), Read, Write, Edit
---

# Author a Spec

Guide the user through writing a spec. Walk through sections one at a time, lint iteratively, and produce a spec that passes `npx specdx lint`.

## Step 1: Determine the type

Ask what kind of spec they need:

| Type | Use when | Required sections |
|---|---|---|
| `prd` | Defining what to build | Problem Statement, Goals, Non-Goals, Features, Success Criteria |
| `technical-design` | Describing how it works | Overview, Architecture, Data Model, API Design, Dependencies, Risks, Open Questions |
| `user-story` | Capturing a user workflow | Description, Acceptance Criteria, Dependencies, Notes |
| `test-plan` | Planning test coverage | Scope, Test Cases, Coverage Matrix, Edge Cases |
| `adr` | Recording a decision | Context, Decision, Status, Consequences |
| `api-contract` | Defining an API | Endpoints, Request/Response Schemas, Auth, Error Codes |

## Step 2: Check existing specs

```bash
npx specdx validate
npx specdx graph
```

This shows what specs exist and their dependency relationships.

## Step 3: Create the file with frontmatter

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

## Step 4: Write sections one at a time

For each required section:
1. Explain what the section should contain
2. Ask the user for their thoughts
3. Draft the section
4. Refine based on feedback

### PRD tips
- Use **F1**, **F2** etc. for features — the `story-coverage` lint rule checks each has a user story
- Be specific in Non-Goals — this prevents scope creep

### Technical Design tips
- Include concrete field names and types in Data Model
- List specific risks with likelihood and mitigation

### ADR tips
- State the decision in one clear sentence, then elaborate
- List both positive AND negative consequences

## Step 5: Lint after every 2-3 sections

```bash
npx specdx lint --path <file>
```

Common issues:

| Issue | Fix |
|---|---|
| Vague language ("as appropriate", "etc.", "TBD") | Replace with concrete language |
| Missing required section | Add it, even if minimal |
| Broken reference | Check the referenced spec ID exists |

<HARD-GATE>
Do NOT skip the lint step between sections. Run `npx specdx lint --path <file>`
after every 2-3 sections. Do NOT write the entire spec and lint at the end.
</HARD-GATE>

## Rationalizations to Resist

| Thought | Reality |
|---------|---------|
| "I'll lint at the end, it's faster" | Lint catches issues early. Fixing 1 issue now beats fixing 10 later. |
| "This section is simple, no need to lint" | Simple sections have frontmatter and reference issues too. |
| "The user seems in a hurry" | Shipping a broken spec wastes more time than linting. |
| "I already know the lint rules" | Rules evolve. Run the tool. |

## Step 6: Register in spec.config.yaml

If this is a new spec, add it to `spec.config.yaml`:

```yaml
specs:
  new-spec:
    path: specs/new-spec.md
    type: technical-design
    requires: ["prd"]
```

The `requires` field establishes dependency relationships used by `specdx graph` and `specdx pack`.

## Step 7: Final validation

```bash
npx specdx lint --path <file> --preset strict
npx specdx lint
npx specdx validate
```

Report: spec type, file path, lint status, and any remaining warnings.
