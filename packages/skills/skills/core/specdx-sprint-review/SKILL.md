---
name: specdx-sprint-review
description: "Use when the user asks for a summary, sprint review, spec health report, progress update, or says 'how are specs looking', 'spec health', or 'what changed'. Generates a shareable spec health report."
allowed-tools: Bash(npx specdx:*)
---

# Sprint Review — Spec Health Report

Generate a shareable summary of spec suite health and recent changes.

## Workflow

### Step 1: Get current health

```bash
npx specdx status --format json
```

Parse the JSON output to understand: project name, spec count, lint health (errors/warnings), stale specs, verdict.

### Step 2: Get recent changes

```bash
npx specdx diff --format json
```

If this fails (e.g. no git history or no baseline branch), skip and note "diff unavailable".

Parse the JSON to understand: which specs changed, sections modified, downstream impact.

### Step 3: Synthesise the report

Present a markdown report covering:

1. **Health verdict** — healthy/warnings/errors with spec count
2. **Lint status** — errors and warnings count
3. **Recent changes** — specs added, modified, or removed (from diff)
4. **Downstream impact** — which specs may need attention, staleness scores
5. **Stale specs** — any specs not updated past the threshold
6. **Recommended actions** — concrete suggestions (e.g. "technical-design hasn't been updated since prd changed 5 days ago")

### Step 4: Format for sharing

Present the report in clean markdown that can be pasted directly into Slack, a PR description, or a standup document.

## Reading the output

The `status --format json` output looks like:
```json
{
  "project": "my-project",
  "specFiles": 3,
  "byStatus": {"approved": 2, "draft": 1},
  "lintHealth": {"errors": 0, "warnings": 2, "passing": 3},
  "staleSpecs": [{"specId": "tech", "daysSinceUpdate": 15}],
  "verdict": "warnings"
}
```

The `diff --format json` output looks like:
```json
{
  "diffs": [{"specId": "prd", "summary": "prd: 1 field(s) changed, 1 section(s) changed"}],
  "added": [],
  "removed": [],
  "impact": [{"changedSpec": "prd", "downstream": [{"specId": "tech", "staleness": 0.7}]}],
  "summary": "1 spec changed, 1 downstream affected"
}
```

## It's working if

Someone who did not attend the work can read the report and know the suite's health and what changed. If `diff` was unavailable, the report says so rather than implying nothing changed.
