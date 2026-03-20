---
name: specdx-review-spec
description: "Use when the user asks to review a spec, says 'is this spec good enough', 'review my spec', 'check spec quality', or 'audit this spec'. Runs multi-layer spec quality review."
allowed-tools: Bash(npx specdx *), Read, Agent
---

# Review Spec Quality

Run a three-layer review of a spec: completeness, consistency, and adversarial analysis. Each layer uses a specialized subagent.

## Workflow

### Step 1: Identify the spec to review

Ask the user which spec to review if not clear from context. Get the file path.

### Step 2: Gather context

```bash
npx specdx lint --path <spec-file> --preset strict
npx specdx graph
npx specdx status --format json
```

### Step 3: Run three review passes

Dispatch three subagents using the templates in the `templates/` directory next to this file's parent directory. Each subagent gets the spec path and related context.

**Pass 1 — Completeness** (use `templates/spec-reviewer.md`):
- Are all required sections present and non-empty?
- Is the frontmatter valid?
- Are cross-references intact?

**Pass 2 — Consistency** (use `templates/consistency-reviewer.md`):
- Is terminology consistent across specs?
- Do names and IDs align?
- Are versions and statuses coherent?

**Pass 3 — Adversarial** (use `templates/adversarial-reviewer.md`):
- What edge cases are missing?
- What's ambiguous?
- What could go wrong?

### Step 4: Aggregate results

Present a combined report:

```
## Spec Review: <spec-title>

### Completeness
[pass 1 results]

### Consistency
[pass 2 results]

### Adversarial Analysis
[pass 3 results]

### Summary
- X critical issues
- Y improvements recommended
- Overall: ready for implementation | needs revision | needs major rework
```

<HARD-GATE>
Do NOT skip any of the three review passes. Each catches different classes of problems. A spec that passes completeness review may still have critical adversarial gaps.
</HARD-GATE>

## Rationalizations to Resist

| Thought | Reality |
|---------|---------|
| "The spec looks fine to me" | You're not adversarial enough. Run all three passes. |
| "Three passes is overkill for a small spec" | Small specs have the most gaps. Run all three. |
| "The completeness pass already found issues, so skip the rest" | Consistency and adversarial reviews find different issues. |
| "I can combine the passes into one review" | Separate passes with different prompts catch more. |
