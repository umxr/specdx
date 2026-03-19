# Spec Type Reference

## Frontmatter Fields (all types)

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| id | yes | string | Unique across spec suite |
| type | yes | SpecType | See types below |
| title | yes | string | Human-readable title |
| status | yes | "draft" \| "review" \| "approved" \| "superseded" | |
| version | yes | string | Semantic version |
| created | yes | string | ISO date, must be quoted in YAML |
| authors | yes | string[] | At least one entry |
| updated | no | string | ISO date |
| tags | no | string[] | Keywords for search/pack relevance |
| references | no | SpecReference[] | Cross-references to other specs |

### Extra Fields for `user-story` type

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| story_id | yes | string | Unique story identifier |
| priority | yes | "critical" \| "high" \| "medium" \| "low" | |
| estimate | yes | string | Story point or time estimate |

## Required Sections by Type

| Type | Required Sections |
|------|-------------------|
| prd | Problem Statement, Goals, Non-Goals, Features, Success Criteria |
| technical-design | Overview, Architecture, Data Model, API Design, Dependencies, Risks, Open Questions |
| user-story | Description, Acceptance Criteria, Dependencies, Notes |
| test-plan | Scope, Test Cases, Coverage Matrix, Edge Cases |
| adr | Context, Decision, Status, Consequences |
| api-contract | Endpoints, Request/Response Schemas, Auth, Error Codes |

## References Format

The `references` frontmatter field is an array of `SpecReference` objects:

```yaml
references:
  - id: "spec-id-here"
    relationship: "depends-on"
  - id: "another-spec-id"
    relationship: "implemented-by"
```

### Relationship Values

| Value | Meaning |
|-------|---------|
| implemented-by | This spec is implemented by the referenced spec |
| decomposed-into | This spec breaks down into the referenced spec |
| depends-on | This spec depends on the referenced spec |
| supersedes | This spec replaces the referenced spec |
| related-to | General association with the referenced spec |
