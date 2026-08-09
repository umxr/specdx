---
name: specdx-pre-commit
description: "Use when the user is about to commit, mentions committing, or says 'let's commit', 'ready to commit', 'wrap up', or 'commit this'. Checks spec health and flags drift before committing."
allowed-tools: Bash(npx specdx:*)
---

# Pre-Commit Spec Check

Run spec health checks before committing to catch drift early.

<HARD-GATE>
Do NOT skip the diff step. Even if the user says "just commit", run the checks and surface the results before proceeding. Silent skipping leads to undetected spec drift.
</HARD-GATE>

## Workflow

### Step 1: Lint

```bash
npx specdx lint
```

If lint errors are found, report them and ask the user to fix before committing.

### Step 2: Diff

```bash
npx specdx diff --working
```

`--working` is required at this step. You are about to commit, so the changes in
question are still in the working tree. Plain `npx specdx diff` compares
committed refs only and would report "no spec changes" for the very edits being
committed — a false all-clear.

If the command fails (e.g. no git history), skip this step and note it.

### Step 3: Present results

**If no spec changes detected:**
> "No spec changes — safe to commit."

Only say this after a `--working` run. If the diff warns that spec files in the
working tree were not covered, the run was not `--working`. Re-run it before
reporting anything.

**If changes detected, present a summary:**
- Which specs changed and what sections were modified
- Downstream specs that may need updating (with staleness scores)
- Whether any downstream specs are flagged as stale

### Step 4: Ask the user

> "Do you want to update downstream specs before committing, or proceed as-is?"

Respect the user's decision either way.

## Rationalizations to Resist

| Thought | Reality |
|---------|---------|
| "The user just wants to commit quickly" | A 5-second check prevents hours of drift debugging. |
| "There are no spec files in the diff" | Code changes can still drift from specs. Run the check. |
| "I already ran lint earlier" | Specs may have changed since. Run it again. |
| "The diff command failed, so skip everything" | Report the lint results at minimum. |
| "`specdx diff` said no changes, so we're clear" | Without `--working` it never looked at the working tree. Re-run with the flag. |

## It's working if

You ran `specdx diff --working` and can state which specs changed, or that none did. If you said "safe to commit" from a run that never looked at the working tree, the check reported on the wrong thing.
