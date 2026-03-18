---
name: specdx:author-spec
description: Guided, interactive spec authoring with iterative linting. Walk through sections, validate as you go, produce a spec that passes specdx lint.
---

# specdx:author-spec

You are helping the user author a new spec for a project that uses **specdx**. Specs are structured markdown documents with YAML frontmatter. Walk through sections one at a time, lint iteratively, and produce a clean spec.

## Step 1: Determine the spec type

Ask the user what they want to write. The supported types are:

| Type | Purpose | Required sections |
|---|---|---|
| `prd` | Product requirements document | Problem Statement, Goals, Non-Goals, Features, Success Criteria |
| `technical-design` | Technical/architecture design | Overview, Architecture, Data Model, API Design, Dependencies, Risks, Open Questions |
| `user-story` | User story with acceptance criteria | Description, Acceptance Criteria, Dependencies, Notes |
| `test-plan` | Test scope and cases | Scope, Test Cases, Coverage Matrix, Edge Cases |
| `adr` | Architecture decision record | Context, Decision, Status, Consequences |
| `api-contract` | API endpoint specification | Endpoints, Request/Response Schemas, Auth, Error Codes |

If the user isn't sure, help them choose:
- "I need to define what we're building" → `prd`
- "I need to describe how it works technically" → `technical-design`
- "I need to capture a specific user workflow" → `user-story`
- "I made a decision and want to record it" → `adr`
- "I need to define an API" → `api-contract`

## Step 2: Check existing specs

See what specs already exist in the project:

```bash
npx specdx validate
```

This confirms the project has a valid `spec.config.yaml` and shows how many specs are defined.

Also check the dependency graph to understand relationships:

```bash
npx specdx graph
```

## Step 3: Create the frontmatter

Every spec needs YAML frontmatter. Generate it based on the user's input:

```yaml
---
id: "<type>-<number or short-name>"
type: "<spec-type>"
title: "<clear, specific title>"
status: "draft"
version: "0.1"
created: "<today YYYY-MM-DD>"
authors: ["<user's name>"]
tags: ["<relevant>", "<keywords>"]
---
```

### Frontmatter rules
- **id**: Unique across the spec suite. Use lowercase with hyphens: `prd-payments`, `adr-001`
- **type**: Must be one of: `prd`, `technical-design`, `user-story`, `test-plan`, `adr`, `api-contract`
- **status**: One of: `draft`, `review`, `approved`, `superseded`
- **version**: String, e.g. `"0.1"`, `"1.0"`
- **created**: Date string, always quoted: `"2026-03-18"`
- **authors**: Array with at least one entry: `["umar"]`
- **tags**: Optional array of keywords for relevance matching in `specdx pack`
- **references**: Optional cross-references to other specs:
  ```yaml
  references:
    - id: prd
      relationship: "depends-on"
  ```
  Valid relationships: `implemented-by`, `decomposed-into`, `depends-on`, `supersedes`, `related-to`

### Important
- Always **quote dates** in YAML — unquoted dates get parsed as Date objects and fail validation
- Always include at least one author — `authors: []` fails validation

## Step 4: Write sections one at a time

For each required section of the chosen spec type:

1. Explain what the section should contain
2. Ask the user for their thoughts
3. Draft the section based on their input
4. Show them the draft and refine

### PRD guidance

- **Problem Statement**: What's broken or missing? Be specific about who is affected and how.
- **Goals**: Bullet list of what success looks like. Make them measurable where possible.
- **Non-Goals**: Explicitly state what you're NOT doing. This prevents scope creep.
- **Features**: Use feature IDs (e.g., **F1**, **F2**). The `story-coverage` lint rule checks that each feature has a corresponding user story.
- **Success Criteria**: How do you know you've succeeded? Quantify where possible.

### Technical Design guidance

- **Overview**: One paragraph explaining what this is and why it exists.
- **Architecture**: System components, data flow, key decisions. Diagrams help.
- **Data Model**: Tables, schemas, types. Be concrete — show field names and types.
- **API Design**: Endpoints, query patterns, auth model.
- **Dependencies**: External libraries, services, APIs with versions.
- **Risks**: What could go wrong? Include likelihood, impact, and mitigation.
- **Open Questions**: Unresolved decisions. These are valuable — they show what still needs discussion.

### ADR guidance

- **Context**: What forces led to this decision? What was the situation?
- **Decision**: State it clearly in one sentence, then elaborate.
- **Status**: Usually matches the frontmatter status. Can include more detail.
- **Consequences**: Both positive AND negative. Be honest about trade-offs.

## Step 5: Lint after every 2-3 sections

Save the file and run:

```bash
npx specdx lint --path <file>
```

Fix any errors immediately. For warnings, discuss with the user:

| Common issue | Fix |
|---|---|
| Missing required section | Add it, even if minimal — flesh out later |
| Vague language ("as appropriate", "etc.", "TBD") | Replace with concrete language |
| Missing frontmatter field | Add the field with an appropriate value |
| Broken reference | Check the referenced spec ID exists in the suite |

## Step 6: Validate references

If the spec references other specs, verify they exist:

```bash
npx specdx lint
```

Running lint on the full suite (not just the file) checks cross-references. If the user's spec depends on a PRD, make sure the PRD's `id` matches what's in the `references` list.

## Step 7: Register in spec.config.yaml

If this is a new spec, it needs to be added to `spec.config.yaml`:

```yaml
specs:
  # ...existing specs...
  new-spec:
    path: specs/new-spec.md
    type: technical-design
    requires: ["prd"]        # if it depends on other specs
```

The `requires` field establishes the dependency graph — `specdx graph` will show these relationships, and `specdx pack` uses them for relevance scoring.

## Step 8: Final validation

Run the strict preset:

```bash
npx specdx lint --path <file> --preset strict
```

This enables all rules including content quality checks. Address any remaining issues.

Then confirm the full suite is healthy:

```bash
npx specdx lint
npx specdx validate
```

Report to the user: spec type, location, lint status, and any remaining warnings.

## Writing tips

### Avoid vague language (the linter will catch these)

| Avoid | Prefer |
|---|---|
| "as appropriate" | State the specific criteria |
| "handle edge cases" | List the specific edge cases |
| "etc." | List all items explicitly |
| "TBD" | State what needs deciding and by when |
| "obviously" | Remove — if it's obvious, it doesn't need saying |
| "simple" / "straightforward" | Describe the actual complexity |

### Use feature IDs in PRDs

The `story-coverage` rule checks that each `**F<N>**` in the PRD has a corresponding user story. This is how specdx tracks requirement coverage:

```markdown
## Features

- **F1**: Email/password login
- **F2**: OAuth (Google, GitHub)
- **F3**: MFA via email OTP
```

### Keep specs focused

One spec should cover one concern. If a PRD is growing beyond 5 features, consider splitting into multiple PRDs or decomposing into user stories.
