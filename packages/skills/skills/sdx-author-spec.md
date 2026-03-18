---
name: sdx:author-spec
description: Guided, interactive spec authoring with iterative linting
---

# sdx:author-spec

You are helping the user author a new SDX spec. SDX specs are structured markdown documents with YAML frontmatter that capture project decisions, architecture, processes, and conventions.

This is an **interactive, guided process**. Walk through sections one at a time, validate iteratively, and produce a clean, lintable spec at the end.

## Step 1: Determine the spec type

Ask the user what kind of spec they want to create. The supported types are:

| Type | Purpose | Common use |
|------|---------|------------|
| `rfc` | Request for Comments — proposes a change or new approach | Architecture proposals, feature designs, process changes |
| `adr` | Architecture Decision Record — captures a specific decision | Technology choices, pattern selections, trade-off resolutions |
| `runbook` | Operational procedure — step-by-step instructions | Deployment, incident response, on-call procedures |
| `design` | Design document — detailed technical design | System design, API design, data model design |
| `standard` | Standard — defines conventions and rules | Coding standards, naming conventions, API guidelines |
| `custom` | Custom type — any other structured document | Meeting notes, retrospectives, onboarding guides |

If the user isn't sure, help them choose:
- "I need to propose something" → `rfc`
- "I made a decision and want to record it" → `adr`
- "I need step-by-step instructions" → `runbook`
- "I need to detail how something works" → `design`
- "I need to define rules/conventions" → `standard`

## Step 2: Collect metadata

Each spec needs YAML frontmatter. Collect the following from the user:

### Required fields (all types)
- **id**: A unique identifier. Convention: `<type>-<NNN>` (e.g., `rfc-004`, `adr-015`). Check existing specs to find the next available number.
- **title**: A clear, concise title. Should be specific enough to understand the decision or topic without reading the body.
- **status**: Starting status. Usually `draft` for new specs.

### Required date fields
- **createdDate**: Today's date in `YYYY-MM-DD` format.
- **updatedDate**: Same as createdDate for new specs.

### Optional but recommended fields
- **author**: The person or team authoring the spec.
- **reviewers**: List of people who should review it.
- **dependencies**: List of spec IDs this spec relates to or depends on.
- **tags**: List of keywords for discoverability.
- **supersedes**: (For ADRs) ID of the spec this one replaces.

### Tips for good metadata
- Use feature IDs from your issue tracker in tags (e.g., `PROJ-1234`)
- Quote dates in YAML: `"2026-03-18"` to avoid parser issues
- Keep titles under 80 characters
- Use lowercase kebab-case for IDs: `adr-015` not `ADR_015`

## Step 3: Write sections one at a time

Each spec type has required and recommended sections. Walk through them **one at a time**, asking the user for input, then assembling the section.

### RFC sections

1. **Summary** (required) — One paragraph overview of the proposal. Write this LAST after all other sections are done, but it appears first in the document.
2. **Context** (required) — What is the current situation? What problem or opportunity does this address?
3. **Proposal** (required) — What specifically is being proposed? Be concrete and detailed.
4. **Alternatives Considered** (recommended) — What other approaches were evaluated? Why were they rejected?
5. **Migration Strategy** (recommended) — How do we get from the current state to the proposed state?
6. **Risks** (recommended) — What could go wrong? What are the trade-offs?
7. **Open Questions** (optional) — Unresolved points that need discussion during review.

### ADR sections

1. **Context** (required) — What forces are at play? What is the situation that led to this decision?
2. **Decision** (required) — What was decided? State it clearly and unambiguously.
3. **Consequences** (required) — What are the results of this decision? Include both positive and negative consequences.
4. **Alternatives Considered** (recommended) — What other options were evaluated?

### Runbook sections

1. **Overview** (required) — What does this runbook cover? When should it be used?
2. **Prerequisites** (required) — What access, tools, or knowledge is needed before starting?
3. **Steps** (required) — The numbered, step-by-step procedure. Each step should be atomic and verifiable.
4. **Rollback** (recommended) — How to undo or recover if something goes wrong.
5. **Troubleshooting** (recommended) — Common issues and their resolutions.

### Design sections

1. **Overview** (required) — High-level summary of the design.
2. **Goals and Non-Goals** (required) — What this design does and does not aim to achieve.
3. **Architecture** (required) — The technical design. Include diagrams if helpful (Mermaid syntax works well).
4. **Data Model** (recommended) — Schema, types, data flow.
5. **API Design** (recommended) — Endpoints, interfaces, contracts.
6. **Security Considerations** (recommended) — Authentication, authorization, data protection.
7. **Performance Considerations** (recommended) — Scalability, latency, resource usage.

### Standard sections

1. **Purpose** (required) — Why does this standard exist? What problem does it solve?
2. **Scope** (required) — What does this standard apply to? What is excluded?
3. **Rules** (required) — The actual rules or conventions. Be specific and enforceable.
4. **Examples** (recommended) — Good and bad examples demonstrating the rules.
5. **Exceptions** (recommended) — When is it acceptable to deviate from this standard?

### For each section

When writing each section:
1. Ask the user for their thoughts on the topic
2. Draft the section content based on their input
3. Show them the draft and ask for feedback
4. Refine until they're satisfied
5. Move to the next section

## Step 4: Assemble and lint iteratively

After each section is drafted, assemble the full document so far and run:

```bash
sdx lint --path <file>
```

This catches issues early:
- Missing required frontmatter fields
- Missing required sections for the spec type
- Vague language (weasel words like "should probably", "might", "fairly")
- Missing status field
- Structural issues

### Handling lint results

- **Errors**: Must be fixed. Work with the user to resolve them before continuing.
- **Warnings**: Should be addressed. Discuss with the user whether to fix or accept.
- **Info**: Optional improvements. Mention them but don't block on them.

### Common lint fixes

| Issue | Fix |
|-------|-----|
| "Vague language detected" | Replace weasel words with concrete language. "We should probably use caching" → "We will use Redis for caching" |
| "Missing required section" | Add the section, even if minimal. Can flesh out later. |
| "Status field missing" | Add `status: draft` to frontmatter |
| "Title too long" | Shorten to under 80 characters. Move detail to Summary section. |
| "Missing dependencies" | If referencing other specs, add their IDs to `dependencies` list |

## Step 5: Handle references and dependencies

If the spec references other specs:

1. List them in the `dependencies` frontmatter field
2. Use the spec ID when referencing inline: "As decided in ADR-007, we use cursor-based pagination."
3. Check that referenced specs exist: `sdx validate` will catch broken references

If the spec supersedes another:
1. Add `supersedes: <old-spec-id>` to frontmatter
2. Mention the superseded spec in the Context section
3. After publishing, update the old spec's status to `superseded`

## Step 6: Final validation

When all sections are complete, run the strict lint preset:

```bash
sdx lint --path <file> --preset strict
```

The strict preset enables all rules including:
- Content quality checks (no vague language, no TODOs in accepted specs)
- Reference validation (all dependency IDs exist)
- Section completeness (all recommended sections present, not just required)
- Frontmatter completeness (all recommended fields present)

### Final checklist

Before declaring the spec done, verify:

- [ ] All required sections are present and substantive
- [ ] Frontmatter has all required fields with valid values
- [ ] Status is set correctly (usually `draft` for new specs)
- [ ] Dates are in `YYYY-MM-DD` format and quoted in YAML
- [ ] Title is clear, specific, and under 80 characters
- [ ] No vague or hedging language remains
- [ ] Dependencies list is complete and all referenced specs exist
- [ ] The Summary/Overview section accurately reflects the full content
- [ ] The spec is saved in the correct directory (usually `specs/<type>/`)

## Step 7: Save the spec

Save the completed spec to the project's specs directory:

```bash
# Check the configured specs directory
cat sdx.config.ts  # or sdx.config.yaml
```

The default location is `specs/` at the project root, organized by type:
```
specs/
  rfc/
    rfc-001-api-versioning.md
    rfc-002-event-driven-architecture.md
  adr/
    adr-001-use-typescript.md
    adr-002-use-postgresql.md
  runbook/
    runbook-001-deployment.md
```

Name the file using the pattern: `<id>-<kebab-case-title>.md`

## Writing tips

### Avoid vague language
The SDX linter will flag these. Replace them with concrete statements:

| Avoid | Prefer |
|-------|--------|
| "We should probably..." | "We will..." |
| "This might help..." | "This reduces latency by ~200ms" |
| "Fairly straightforward" | "Requires updating 3 files in the auth module" |
| "In the near future" | "By 2026-Q2" or "Before the v2.0 release" |
| "Various improvements" | "Adds caching, batching, and connection pooling" |
| "Relatively simple" | "Estimated 2-day implementation" |
| "It seems like" | "Based on load testing results," |
| "Potentially" | "If traffic exceeds 10k RPM," |

### Use feature IDs
If your project uses an issue tracker, link specs to issues:
```yaml
tags:
  - PROJ-1234
  - authentication
  - security
```

### Quote dates in YAML
YAML can interpret unquoted dates in unexpected ways:
```yaml
# Bad — YAML may parse as a Date object
createdDate: 2026-03-18

# Good — always a string
createdDate: "2026-03-18"
```

### Be specific in Consequences (ADRs)
Both positive and negative consequences should be listed:
```markdown
## Consequences

### Positive
- Type safety catches bugs at compile time rather than runtime
- IDE support improves developer experience (autocomplete, refactoring)

### Negative
- Build step adds ~15 seconds to CI pipeline
- Team needs TypeScript training (estimated 1-week ramp-up)
- Some npm packages lack type definitions
```

### Make runbook steps atomic
Each step should be independently verifiable:
```markdown
## Steps

1. SSH into the production server:
   ```bash
   ssh deploy@prod.example.com
   ```
   **Verify:** You see the `deploy@prod` prompt.

2. Pull the latest release:
   ```bash
   cd /opt/app && git pull origin main
   ```
   **Verify:** Git reports the new commit hash.
```

## Troubleshooting

### `sdx lint` not found
- Install: `npm install -g specdx` or use `npx sdx lint`
- In a monorepo, check if it's a devDependency

### Lint reports "unknown spec type"
- Ensure the `type` in frontmatter matches one of: `rfc`, `adr`, `runbook`, `design`, `standard`, `custom`
- Check for typos (e.g., `RFC` instead of `rfc`)

### Lint passes but spec feels incomplete
- Try the strict preset: `sdx lint --path <file> --preset strict`
- Review the recommended (not just required) sections for the spec type
- Ask a colleague to review — specs benefit from a second perspective

### User isn't sure what to write for a section
- Offer prompting questions:
  - **Context**: "What problem are you trying to solve? What's the current situation?"
  - **Decision**: "If you had to state the decision in one sentence, what would it be?"
  - **Consequences**: "What gets better? What gets worse or harder?"
  - **Alternatives**: "What else did you consider? Why didn't you go with those?"

## Example: Creating an ADR

User: "I want to record our decision to use SQLite for the local cache"

1. **Type**: ADR (recording a decision)
2. **Metadata**:
   ```yaml
   ---
   id: adr-015
   type: adr
   title: Use SQLite for local cache storage
   status: draft
   createdDate: "2026-03-18"
   updatedDate: "2026-03-18"
   author: Team Backend
   tags:
     - caching
     - storage
     - PROJ-892
   ---
   ```
3. **Context section**: Discuss why a local cache is needed, what options exist
4. **Decision section**: "We will use SQLite via better-sqlite3 for local cache storage"
5. **Consequences section**: List pros (embedded, zero-config, fast reads) and cons (single-writer, no replication)
6. **Alternatives section**: Redis (too heavy for local), plain files (no querying), LevelDB (less tooling)
7. **Lint**: `sdx lint --path specs/adr/adr-015-use-sqlite-for-local-cache.md`
8. **Strict lint**: `sdx lint --path specs/adr/adr-015-use-sqlite-for-local-cache.md --preset strict`
9. **Save**: `specs/adr/adr-015-use-sqlite-for-local-cache.md`
