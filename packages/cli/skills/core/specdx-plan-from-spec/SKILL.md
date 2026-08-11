---
name: specdx-plan-from-spec
description: "Use when the user asks to plan implementation, create a plan from specs, or says 'how should I build this', 'plan this', 'create an implementation plan', or 'what's the approach'. Generates a step-by-step plan grounded in project specs."
allowed-tools: Bash(npx specdx:*)
---

# Plan From Spec

Generate an implementation plan grounded in the project's specs.

## Workflow

### Step 1: Load spec context

```bash
npx specdx pack --task "$ARGUMENTS" --format xml --full
```

Replace `$ARGUMENTS` with the user's task description.

If the output is too large (over 8000 tokens), re-run without `--full`:

```bash
npx specdx pack --task "$ARGUMENTS" --format xml
```

### Step 2: Understand the specs

Read the packed output. Each `<spec>` has:
- `id` and `type` — what kind of spec
- `relevance` — how relevant to the task (0-1)
- Sections with the actual content

Focus on the highest-relevance specs first.

### Step 3: Generate the plan

Create a step-by-step implementation plan with:

1. **File targets** — which files to create or modify
2. **Dependency order** — what to build first based on the spec dependency graph
3. **Test expectations** — what tests to write for each step
4. **Spec references** — link each step back to the relevant spec section (e.g. "implements PRD Feature F2", "satisfies test-plan edge case 3")

### Step 4: Structure for execution

If the user has the superpowers plugin installed, structure the plan to be compatible with the `writing-plans` skill format:

- Use checkbox syntax (`- [ ]`) for each step
- Include exact file paths
- Include code snippets where helpful
- Group steps into logical tasks (2-5 minutes each)

If the user doesn't have superpowers, use a simpler numbered list format.

## Spec types and what they tell you

| Type | What to extract for the plan |
|---|---|
| `prd` | Feature list (F1, F2...), success criteria, non-goals (what NOT to build) |
| `technical-design` | Architecture, data model, API design, dependencies, risks |
| `user-story` | Acceptance criteria, priority, estimate |
| `test-plan` | Test cases, coverage matrix, edge cases |
| `adr` | Decisions and constraints to respect |
| `api-contract` | Endpoints, schemas, auth requirements |

## How to use the context

1. **Reference specs** — mention feature IDs or spec sections when your plan relates to them
2. **Flag gaps** — if the task needs decisions not covered by any spec, say so
3. **Respect non-goals** — if the PRD says "not X", don't plan for X
4. **Note risks** — if the technical design lists risks relevant to the task, address them in the plan

## It's working if

Every step traces to a spec section or is explicitly flagged as a gap the specs do not cover. A plan with steps that trace to neither is invention, not planning.
