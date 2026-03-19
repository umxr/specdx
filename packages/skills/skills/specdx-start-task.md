---
name: specdx-start-task
description: Load relevant spec context before starting a coding task. Run this when the user describes work they're about to do, mentions implementing a feature, or asks to start a task. Packs project specs into the session so you have requirements, architecture, and constraints.
allowed-tools: Bash(npx specdx *)
---

# Load Spec Context

Run the following command, replacing the task description with what the user wants to work on:

```bash
npx specdx pack --task "$ARGUMENTS" --format xml --full
```

If the output is too large (over 8000 tokens), re-run with compression:

```bash
npx specdx pack --task "$ARGUMENTS" --format xml
```

If the command fails with "No spec.config.yaml found", tell the user the project isn't set up with specdx yet and proceed without spec context.

## Reading the output

The pack command outputs XML like this:

```xml
<context budget="12000" used="2349" specs="2" compressed="0">
  <spec id="prd" type="prd" relevance="0.92" tokens="860">
    <section name="Features">
      - **F1**: Email login
      - **F2**: OAuth support
    </section>
  </spec>
</context>
```

Each `<spec>` has a relevance score (0-1). Sections marked `compressed="true"` were collapsed because they haven't changed recently — re-run with `--full` if you need them.

## Spec types

| Type | Contains |
|---|---|
| `prd` | Problem statement, goals, non-goals, features (F1, F2...), success criteria |
| `technical-design` | Architecture, data model, API design, dependencies, risks, open questions |
| `user-story` | Description, acceptance criteria, priority, estimate |
| `test-plan` | Scope, test cases, coverage matrix, edge cases |
| `adr` | Architecture decision: context, decision, consequences |
| `api-contract` | Endpoints, request/response schemas, auth, error codes |

## How to use the context

For the rest of the session:

1. **Reference specs** — mention feature IDs or spec sections when your implementation relates to them
2. **Flag drift** — if the code or the user's request contradicts a spec, surface it clearly. Do NOT silently ignore contradictions.
3. **Note gaps** — if the task needs decisions not covered by any spec, say so
4. **Respect status** — `approved` specs are current truth; `draft` specs are tentative; `superseded` specs show as collapsed one-liners
