---
id: prd
type: prd
title: "Product Requirements — sdx"
status: approved
version: "1.0"
created: "2026-03-17"
updated: "2026-03-19"
authors: ["umar"]
tags: ["spec-driven-development", "cli", "toolchain"]
---

## Problem Statement

Most AI-assisted development workflows are ad-hoc. Developers write specs in inconsistent formats, manually paste them into context windows, and hope the LLM respects the constraints. There is no validation, no diffing, no CI integration, and no standard for spec-driven development.

## Goals

- Provide a formal schema for spec suites with validation, linting, and dependency tracking
- Ship a context packer that assembles token-optimised payloads from specs, ranked by task relevance
- Detect drift between specs via structural diffing and downstream impact analysis
- Enforce spec health in CI via a GitHub Action that lints and diffs specs on PRs
- Integrate with AI coding tools (Claude Code, Cursor, Gemini CLI) via skills that load spec context automatically

## Non-Goals

- No LLM calls in the core pipeline — AI integration is delegated to the host coding tool via skills
- Not a project management tool — integrates with PM tools, does not replace them
- Not an LLM provider abstraction layer — uses the host tool's LLM for reasoning
- No GUI or web dashboard in the initial phases

## Features

- **F1**: Spec validation — validate frontmatter, required sections, cross-references, and dependency graphs
- **F2**: Spec linting — 7+ built-in rules across structure, completeness, freshness, and clarity categories with 3 presets (minimal, recommended, strict)
- **F3**: Context packing — task-based relevance scoring, token budget allocation, 3 output formats (XML, Markdown, JSON), compression for stable/resolved content
- **F4**: Spec diffing — structural diff between spec versions, downstream impact analysis with staleness scoring, git integration
- **F5**: GitHub Action — lint + diff on PRs, PR comments with spec health reports, configurable blocking, health badge
- **F6**: Claude Code skills — start-task (loads spec context), author-spec (guided authoring), pre-commit (drift check), sprint-review, plan-from-spec, onboard
- **F7**: Plugin distribution — Claude Code plugin manifest for auto-discovery, session-start hook for lightweight context injection
- **F8**: Team features — shared config presets, spec ownership, changelog generation, onboarding mode

## Success Criteria

- `npx specdx init` scaffolds a valid spec suite in under 30 seconds
- `npx specdx lint` catches structural and semantic spec issues with over 90% precision
- `npx specdx pack --task "..."` returns relevant spec context within token budget
- GitHub Action enforces spec health on PRs with formatted comments
- Used daily on at least 2 real projects (sdx itself + one external)
- npm weekly downloads over 500 by end of Phase 3
