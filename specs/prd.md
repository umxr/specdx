---
id: "prd-001"
type: "prd"
title: "sdx — Spec Developer Experience"
status: "approved"
version: "1.0"
created: "2026-01-15"
authors: ["umar"]
tags: ["sdx", "spec-driven-development", "tooling", "cli"]
---

# sdx — Spec Developer Experience

## Problem Statement

Most AI-assisted development workflows are ad-hoc. Developers write specs in inconsistent formats,
manually paste them into context windows, and hope the LLM respects the constraints. There is no
validation, no diffing, no CI integration, and no standard.

The core problems are:

1. **No schema enforcement.** Specs live as freeform markdown with no structural guarantees. A PRD
   missing its "Non-Goals" section ships the same as one that's complete. There is nothing to catch
   the omission before it reaches an LLM or a team member.

2. **No dependency awareness.** Specs reference each other implicitly (a test plan references a
   technical design) but no tool tracks these relationships. When the technical design changes,
   downstream specs silently become stale.

3. **No context assembly pipeline.** Before every LLM session, developers manually copy-paste spec
   fragments into a context window. This is time-consuming, error-prone, and produces bloated
   context payloads that consume unnecessary tokens.

4. **No CI enforcement.** Spec health is not gate-checked. A PR can merge while the spec suite has
   broken references, missing sections, or downstream drift — with no automated signal.

These gaps mean spec-driven development is aspirational rather than operational for most teams.

## Goals

- Provide a formal schema for spec suites covering the most common spec types (PRD, technical
  design, user story, test plan, ADR, API contract).
- Ship a linter that catches structural and semantic gaps before specs reach an LLM or a reviewer.
- Deliver a context packer that assembles token-optimised payloads from a spec suite for LLM
  sessions.
- Build a diff engine that detects drift between spec versions and between upstream and downstream
  specs in a dependency chain.
- Provide a CI integration layer (GitHub Action) that enforces spec health on every PR.
- Be usable by a single developer on a side project within 5 minutes of installation.
- Be adoptable by a team without a lengthy configuration or migration process.

## Non-Goals

- sdx is not a project management tool. It does not replace Jira, Linear, or GitHub Issues.
- sdx does not generate spec content from scratch. It validates, lints, and packs existing specs.
- sdx does not manage code — only the spec layer that sits above code.
- sdx does not run LLM inference directly during Phase 1. AI integration is opt-in and skills-based.
- sdx does not enforce a specific methodology. It provides schemas and presets that support multiple
  workflows (BMAD, lightweight, API-first).
- sdx does not federate across multiple repositories in Phase 1. Multi-repo support is a Phase 4
  concern.

## Features

- **Feature 1 — Spec validation and linting:** A formal JSON Schema for each supported spec type
  (PRD, technical design, user story, test plan, ADR, API contract) paired with a pluggable linting
  engine. Built-in rule presets (minimal, recommended, strict) catch missing sections, broken
  references, circular dependencies, vague language, and staleness signals. Custom rules are
  loadable from local paths. The CLI exposes `sdx lint` and `sdx validate`.

- **Feature 2 — Context packing for LLMs:** A packing engine that assembles token-optimised context
  payloads from a spec suite. Supports task-scoped packing (only relevant specs), token budget
  allocation, boilerplate stripping, and stable-section summarisation. Outputs XML, Markdown, or
  JSON. Clipboard integration for immediate use in LLM sessions.

- **Feature 3 — Spec-to-spec diffing:** A diff engine that compares spec versions and walks the
  dependency graph to identify downstream specs affected by upstream changes. Produces
  human-readable change summaries and staleness scores. Integrates with Git refs for branch-to-branch
  comparison. Exposed via `sdx diff` and `sdx status`.

- **Feature 4 — CI integration:** A GitHub Action that runs `sdx lint` and `sdx diff` on every PR
  touching spec files. Posts formatted diagnostic comments, blocks merges on configured severities,
  and generates a spec health badge for the repository README.

## Success Criteria

- `npx specdx init` scaffolds a valid spec suite in under 60 seconds for a first-time user.
- `npx specdx lint` runs against a 20-spec suite in under 10 seconds and reports all structural errors
  with precise file and section references.
- `npx specdx graph` renders the full dependency tree in ASCII and DOT formats.
- sdx's own spec suite (this repo's `specs/` directory) passes `sdx lint` with the `strict` preset.
- At least one external project uses sdx in Phase 1.
- The README enables a developer to go from zero to a passing lint run in under 5 minutes.
- Test coverage exceeds 80% across the `@sdx/core` and `@sdx/lint` packages.
- npm weekly downloads reach 50+ within 4 weeks of Phase 1 publication.
