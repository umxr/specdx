---
name: specdx-onboard
description: "Use when a new developer joins the project, asks 'what is this project', 'explain the specs', 'how does this codebase work', 'what specs exist', or wants an overview of the spec suite. Provides a guided tour of the project's specs."
allowed-tools: Bash(npx specdx:*)
---

# Onboard — Spec Suite Overview

Walk a new developer through the project's spec suite so they understand what exists, how specs relate, and where to start.

## Workflow

### Step 1: Get the overview

```bash
npx specdx status --format json
npx specdx graph
```

`status` returns the project name, spec count, statuses, lint health, and stale specs. `graph` returns how the specs relate — both config `requires` edges and frontmatter `references`.

### Step 2: Load full spec content

```bash
npx specdx pack --full --format xml
```

This loads all spec content so you can reference specific details.

### Step 3: Walk through the project

Guide the developer through:

1. **What the project does** — summarise the PRD's Problem Statement and Goals
2. **How it's built** — summarise the Technical Design's Architecture and key decisions
3. **What specs exist** — list each spec with its type, status, and purpose
4. **How specs relate** — explain the dependency graph (what depends on what)
5. **Current health** — note any warnings, stale specs, or open questions

### Step 4: Invite questions

> "That's the spec landscape. What area would you like to dig into? I can explain any spec in more detail, show you the dependency chain for a specific feature, or help you find where a topic is covered."

## Tips

- Start high-level, then drill down based on the developer's questions
- Reference specific spec sections when explaining (e.g. "See PRD Feature F3 for details")
- If a spec is marked `draft`, note that it's tentative and may change
- If a spec is marked `superseded`, briefly mention what replaced it
- Use the dependency graph to explain why specs exist (e.g. "The test plan depends on the technical design because test cases reference the API endpoints defined there")

## It's working if

The reader can name what the project is for, which specs are authoritative, and where to look next — without opening a spec file. If your summary is a restatement of the spec list, it has not oriented anyone.
