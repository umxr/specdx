---
name: specdx-check-drift
description: "[experimental — built on sdx check, whose static analysis can be noisy] Use when the user says 'check drift', 'did I drift from spec', 'am I still aligned', or as part of a pre-commit check. Compares recent code changes against spec definitions."
allowed-tools: Bash(npx specdx *), Read
---

# Check Spec Drift

Compare recent code changes against spec definitions to detect drift.

## Workflow

### Step 1: Check for spec changes

```bash
npx specdx diff --working
```

This shows which specs changed, including edits still in the working tree. Note any upstream spec changes.

Use `--working` here. Plain `npx specdx diff` compares committed refs only, so it cannot see uncommitted spec edits — the ones most likely to have caused the drift you are looking for.

### Step 2: Check implementation alignment

```bash
npx specdx check --format json
```

This compares specs against code. Note any missing implementations or mismatches.

### Step 3: Cross-reference changes

Compare the two results:

| Situation | Meaning |
|---|---|
| Spec changed, code matches | Spec was updated to reflect reality. Good. |
| Spec changed, code doesn't match | Spec was updated but code wasn't. Needs code update. |
| Spec unchanged, code diverges | Code drifted from spec. Either update code or update spec. |
| Both changed in alignment | Normal development. Verify alignment. |

### Step 4: Present drift report

```
## Drift Report

### Spec Changes (since last commit)
[diff results — which specs changed and how]

### Implementation Alignment
[check results — score, findings]

### Drift Detected
- [list of drifts with suggested resolution: "update code" or "update spec"]

### Verdict
[aligned | minor drift | significant drift]
```

### Step 5: Suggest resolution

For each drift:
- If spec is the source of truth → suggest code changes
- If code is intentionally ahead → suggest spec updates
- If unclear → ask the user which direction to go

## Rationalizations to Resist

| Thought | Reality |
|---------|---------|
| "No specs changed, so no drift" | Code can drift even when specs don't change. Run the check. |
| "The check score is high enough" | Even 95% means 5% drift. Review the findings. |
| "I'll check drift later" | Drift compounds. Check now. |
