---
name: specdx:start-task
description: Load relevant spec context before starting a coding task. Packs specs into your session so you have requirements, architecture, and constraints at hand.
---

# specdx:start-task

You are starting a coding task in a project that uses **specdx** to manage its specifications. Before writing code, load the relevant spec context so you work with real requirements instead of guesses.

## Step 1: Pack the context

Extract the task description from the user's message, then run:

```bash
npx specdx pack --task "<task description>" --format xml --full
```

If the output is too large, drop `--full` to enable compression (collapses stable sections, strips boilerplate):

```bash
npx specdx pack --task "<task description>" --format xml
```

To limit token usage further:

```bash
npx specdx pack --task "<task description>" --format xml --budget 8000
```

If the command fails with "No spec.config.yaml found", the project hasn't been set up with specdx yet. Inform the user and proceed without spec context.

## Step 2: Understand the output

The pack command outputs XML with this structure:

```xml
<context budget="12000" used="2349" specs="2" compressed="0">
  <spec id="prd" type="prd" relevance="0.92" tokens="860">
    <section name="Features">
      - **F1**: Email login
      - **F2**: OAuth support
    </section>
    <section name="Data Model" compressed="true">
      [Unchanged since 2026-02-15 — 342 tokens omitted]
    </section>
  </spec>
</context>
```

Key elements:
- Each `<spec>` has an `id`, `type`, `relevance` score (0–1), and `tokens` count
- Sections contain the actual spec content you should reference
- Sections with `compressed="true"` were collapsed because they haven't changed recently — if you need them, re-run with `--full`
- Specs are ranked by relevance to your task. Higher-scored specs matched more keywords.

### Spec types in specdx

| Type | What it contains |
|---|---|
| `prd` | Problem statement, goals, non-goals, features (F1, F2...), success criteria |
| `technical-design` | Architecture, data model, API design, dependencies, risks, open questions |
| `user-story` | User story description, acceptance criteria, priority, estimate |
| `test-plan` | Test scope, test cases, coverage matrix, edge cases |
| `adr` | Architecture decision: context, decision, status, consequences |
| `api-contract` | Endpoints, request/response schemas, auth, error codes |

## Step 3: Apply the context

With spec context loaded, follow these rules for the rest of the session:

### Reference specs when implementing

When your code relates to a spec requirement, mention it:
- "This implements **F3** from the PRD (collection editorial content)"
- "Following the technical design's data model, `colorTheme` is a referenced document, not embedded"

### Flag drift

If the codebase or the user's request contradicts a spec, say so:
- "The PRD lists this as a non-goal. Should we proceed anyway, or update the spec first?"
- "The technical design specifies Sanity handles colour themes, but this code puts them in Shopify metafields. Is that intentional?"

Do NOT silently ignore spec contradictions. Surface them clearly.

### Note gaps

If the task requires decisions not covered by any loaded spec:
- "No spec covers error handling strategy for failed Shopify syncs. Consider adding this to the technical design's Risks section."

### Respect status

- `approved` / `review` — these are current. Follow them.
- `draft` — proposed but not finalised. Follow tentatively and note it may change.
- `superseded` — check what replaced it. These appear as collapsed one-liners in the pack output.

## Step 4: Before finishing

Quick alignment check:
- Does the implementation match the loaded specs?
- Did you find any drift between specs and code?
- Are there gaps that should be documented?
- If you found issues, mention them in your response.

## Troubleshooting

**No specs returned:** Try a broader task description. The relevance matcher uses keywords from spec titles, tags, and content.

**Too many tokens:** Use `--budget 6000` to cap output size. Lower-relevance specs get dropped first.

**Command not found:** Install with `npm install -D specdx` or use `npx specdx pack`.

## When NOT to use this skill

- Trivial tasks that don't touch architecture (fixing a typo, updating a dependency version)
- When the user explicitly says to skip spec context
- Projects without a `spec.config.yaml` file
