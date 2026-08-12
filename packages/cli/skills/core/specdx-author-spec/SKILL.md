---
name: specdx-author-spec
description: Use when the user wants to create a new spec, write a PRD, document a technical design, record an architecture decision, add a user story, or write a test plan. Guides spec authoring with iterative linting.
allowed-tools: Bash(npx specdx:*) Read Write Edit
---

# Author a Spec

This skill follows a 3-step workflow. Load each step file as you reach it — this keeps the context focused and prevents bloat in long authoring sessions.

## Steps

1. **Frontmatter** — Read `references/step-01-frontmatter.md`
   - Determine spec type, check existing specs, create file with frontmatter

2. **Sections** — Read `references/step-02-sections.md`
   - Write sections one at a time, lint after every 2-3 sections
   - HARD GATE: Do NOT skip lint between sections

3. **Finalize** — Read `references/step-03-finalize.md`
   - Register in spec.config.yaml, run final validation

## How to use

Start by reading `references/step-01-frontmatter.md` (relative to this file). Complete that step fully before moving to step 2.

Each step file is self-contained with its own instructions. Do NOT read ahead — load one step at a time.

For detailed reference on spec types and their fields, see `references/spec-type-reference.md`.

## It's working if

The spec lints clean *and* a reader who was not in the conversation could build from it. If you finished the steps but every section is one vague line, the skill ran and the spec still fails its job — `specdx lint` will now flag placeholder sections, so an empty pass means real content.
