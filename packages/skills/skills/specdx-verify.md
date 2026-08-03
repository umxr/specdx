---
name: specdx-verify
description: "[experimental — built on sdx check, whose static analysis can be noisy] Use when the user says 'verify', 'check against spec', 'does this match the spec', 'review implementation', or after completing a feature. Runs spec-to-implementation analysis and reviews findings."
allowed-tools: Bash(npx specdx *), Read
---

# Verify Implementation Against Specs

Run static analysis to check if the implementation matches the specs, then review each finding.

## Workflow

### Step 1: Run spec-to-implementation check

```bash
npx specdx check --format json
```

If the command fails with "ts-morph is required", tell the user to install it: `pnpm add -D ts-morph`.

If it fails with "No spec.config.yaml found", the project isn't set up with specdx. Stop and inform the user.

If it exits 3 ("coverage not assessed — no checkable surfaces"), the project has no extractable routes/types/tests — common outside Express/Hono/Next.js. Suggest declaring checkable artifacts in the relevant spec's frontmatter so check has something real to verify:

```yaml
artifacts:
  - path: "middleware.ts"
  - path: "src/lib/bots.ts"
    exports: ["BOT_SIGNATURES"]
```

Declaring artifacts for work that is not built yet is safe: while the spec is `draft` or `review`, absent files report as *pending* (info, exit 0). They become enforceable errors when the spec status is `approved`. So write the declaration when you write the spec — do not wait for the implementation.

### Step 2: Load spec context

```bash
npx specdx pack --task "$ARGUMENTS" --format xml
```

This gives you the spec content to compare findings against.

### Step 3: Review each finding

For each finding in the check output:

| Finding Type | Action |
|---|---|
| `missing` (error) | Check if the spec requirement is genuinely unimplemented, or if the static analysis missed it (different naming, different file location). Report your assessment. |
| `extra` (info) | Check if the code addition is intentional (feature beyond spec) or accidental scope creep. Note it but don't flag as an issue unless it contradicts a Non-Goal. |
| `mismatch` (warn) | Compare the spec expectation against the code. Determine if the deviation is intentional (spec needs updating) or a bug (code needs fixing). |

### Step 4: Present structured report

```
## Verification Report

**Score:** X% implementation coverage

### Real Issues
- [finding] — [why it's a real issue] — [suggested fix]

### False Positives
- [finding] — [why it's not actually an issue]

### Recommendations
- [any spec updates needed]
- [any additional tests suggested]
```

<HARD-GATE>
Do NOT skip Step 1. Always run `npx specdx check` before reviewing. Do not rely on your knowledge of the code alone — the static analysis catches things you might miss.
</HARD-GATE>

## Rationalizations to Resist

| Thought | Reality |
|---------|---------|
| "I already know the code matches the spec" | Static analysis catches structural mismatches you can't see. Run the check. |
| "There are too many findings to review" | Group by category, prioritize errors over warnings. Review all errors. |
| "The check failed, so skip it" | Report the failure. Partial results are still valuable. |
| "The user didn't ask for verification" | If you just finished implementing, verify. It's part of the job. |
