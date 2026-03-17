# Skills-First AI Integration Design

> **For agentic workers:** This is a design spec, not an implementation plan. See the corresponding plan document for implementation steps.

**Goal:** Restructure sdx's AI integration strategy so that AI coding tools (Claude Code, Cursor, Codex) integrate with sdx via opinionated workflow skills, rather than sdx calling LLM APIs directly.

**Core Insight:** Developers using AI-assisted workflows already have an LLM in their coding tool. sdx should stay deterministic and expose structured spec data; the host tool provides the reasoning. This eliminates provider abstraction, cost management, and caching from sdx's scope.

**Scope:** Changes to the sdx roadmap across all four phases. No code changes — this is a strategic design decision.

---

## Context

The original sdx roadmap (Phase 4, Section 4.2) planned for sdx to call LLM APIs directly for:

- Intent drift detection (send spec + code to LLM, assess alignment)
- Ambiguity scoring (LLM-powered clarity analysis)
- Spec generation suggestions (LLM-assisted updates)

This required significant infrastructure:

- Provider abstraction (Anthropic, OpenAI, Ollama)
- Cost estimation and user confirmation before LLM calls
- Caching layer for LLM results
- Confidence thresholds to filter noisy results
- Per-provider configuration (`sdx check --ai --provider anthropic`)

The skills-first approach recognizes that this complexity is unnecessary when the developer is already inside an AI coding tool.

---

## Design

### New Package: `@sdx/skills`

Added to the monorepo package structure:

```
sdx/
├── packages/
│   ├── schema/
│   ├── cli/
│   ├── core/
│   ├── lint/
│   ├── pack/
│   ├── diff/
│   ├── github-action/
│   └── skills/              # @sdx/skills — Claude Code skill definitions
```

Contains markdown skill files (Claude Code's skill format) that orchestrate sdx CLI commands within AI coding sessions. Each skill encodes an opinionated workflow — not just "how to call sdx" but when and why.

Published to npm so users can install skills with a single command. Initially Claude Code only, with the architecture open to Cursor/Codex adapters later.

### Six Skills Across Three Phases

| Skill | Phase | Trigger | Description |
|---|---|---|---|
| `sdx:start-task` | 2 | Developer begins work on a task | Runs `sdx pack --task "..."`, injects packed spec context into the conversation, establishes guardrails so the LLM references specs during implementation. |
| `sdx:author-spec` | 2 | Developer writes or updates a spec | Guided spec authoring workflow. Determines spec type, walks through required sections, runs `sdx lint` iteratively, validates cross-references, ensures frontmatter completeness. |
| `sdx:pre-commit` | 3 | Developer is about to commit | Runs `sdx lint` + `sdx diff` against working tree. If drift detected, LLM interprets impact — suggests whether specs or code need updating. Developer approves or revises before committing. Can also be wired as a Claude Code hook. |
| `sdx:onboard` | 3 | Developer is new to the project | Runs `sdx pack` (full suite) + `sdx graph` (dependency tree) + `sdx status` (current health). LLM walks the developer through the project's intent, architecture decisions, and active areas. |
| `sdx:sprint-review` | 3 | Team reviews sprint progress | Runs `sdx status` + `sdx diff --base <last-tag>` + `sdx changelog`. LLM produces an actionable summary: what changed, what's healthy, what's drifting. Formatted for standup or sprint review sharing. |
| `sdx:verify` | 4 | Developer finishes implementing a feature | Runs `sdx check`, feeds static analysis results + relevant specs + changed code to the LLM. LLM assesses intent alignment, flags gaps, suggests fixes. Replaces the need for provider abstraction, caching, and cost management. |

### Phase 2 Changes — Daily Driver

New section **2.4 — `@sdx/skills` (Claude Code)** added after existing 2.3 (Editor Integration):

| Task | Description | Acceptance Criteria |
|---|---|---|
| Skills package scaffolding | Set up `@sdx/skills` package with skill file structure, README, and install instructions. | `npm install @sdx/skills` makes skills available to Claude Code. |
| Skill: `sdx:start-task` | Developer describes their task. Skill runs `sdx pack --task "..."`, injects the packed spec context, establishes guardrails. | Spec context is loaded automatically. LLM references specs during implementation. |
| Skill: `sdx:author-spec` | Guided spec authoring. Determines type, walks through sections, runs `sdx lint` iteratively, validates references. | Developer can author a valid spec without knowing the schema by heart. |
| Skill installation docs | How to install and configure sdx skills for Claude Code. Cover install, project setup, available skills, customization. | Developer can go from zero to working skills in under 2 minutes. |

New Phase 2 exit criteria:

- `sdx:start-task` skill loads spec context into Claude Code sessions
- `sdx:author-spec` skill guides spec creation with iterative linting

### Phase 3 Changes — Team Adoption

Added to existing **3.4 — Team Features**:

| Task | Description | Acceptance Criteria |
|---|---|---|
| Skill: `sdx:pre-commit` | Before committing, runs `sdx lint` + `sdx diff`. LLM interprets drift, suggests whether specs or code need updating. | Drift is caught before entering commit history. Developer makes an informed decision. |
| Skill: `sdx:onboard` | Full suite pack + graph + status. LLM walks new developer through the project. | New developer understands the spec landscape within one conversation. |
| Skill: `sdx:sprint-review` | Status + diff + changelog. LLM produces actionable spec health summary. | Team gets a shareable summary without manually running commands. |

New Phase 3 exit criteria:

- Claude Code skills cover pre-commit checks, onboarding, and sprint review workflows
- Skills are documented and installable from npm

### Phase 4 Changes — Simplified Intelligence

#### 4.1 — Static Analysis: Unchanged

API route matching, type/schema matching, test coverage mapper, `sdx check` — all deterministic.

#### 4.2 — LLM-Assisted Analysis: Dramatically simplified

**Removed:**

- Provider abstraction (Anthropic, OpenAI, Ollama)
- Cost estimation and confirmation flow
- Caching layer for LLM results
- Confidence thresholds
- `--provider` flag

**Retained:**

| Task | Description | Acceptance Criteria |
|---|---|---|
| `sdx check --ai` | Opt-in flag that sends spec + code + static analysis results to a single LLM provider (Anthropic only to start). Lightweight fallback for developers not using an AI coding tool. | Returns assessment for each drift finding. Works with an API key env var. |
| Spec generation suggestions | When drift is detected, output actionable suggestions in a structured format that both humans and skills can consume. | Suggestions are specific. Skills can parse the output. |

**Added:**

| Task | Description | Acceptance Criteria |
|---|---|---|
| Skill: `sdx:verify` | After implementing a feature, runs `sdx check`, feeds results + specs + code to the LLM. Recommended path for AI-assisted verification. | Developer gets spec-vs-implementation review without configuring API keys or providers. |

#### 4.3 — Spec Generation & Maintenance: Unchanged

#### 4.4 — Ecosystem & Integrations: Adjusted

- MCP server: unchanged (complementary integration surface)
- Mastra integration: unchanged
- Jira/Linear sync: unchanged
- Slack notifications: unchanged
- **Added:** Skills adapter architecture — document how to write adapter layers for Cursor rules, Codex plugins, Windsurf, etc. Claude Code ships first; interface defined so community can contribute adapters.

#### 4.5 — Advanced Lint Rules: Minor change

`clarity/ambiguity-score-ai` rule: kept with opt-in `--ai`, but noted that `sdx:author-spec` skill already provides real-time ambiguity guidance during authoring. The rule is for CI/batch validation.

#### Phase 4 scope reduction

~40% less scope. Phase 4 timeline estimate changes from 6-8 weeks to 4-5 weeks.

### Technical Decisions — New Entry

| Decision | Choice | Rationale |
|---|---|---|
| AI integration strategy | Skills-first, API-fallback | AI coding tools already have an LLM. sdx exposes structured spec data and deterministic analysis; the host tool provides reasoning. Eliminates provider abstraction, cost management, and caching. Opt-in `--ai` flag retained as lightweight fallback. |

### Resolved Decisions — New Entry (#6)

**6. AI integration model** — Skills-first, not API-first. The original design had sdx calling LLM APIs directly for intent analysis, ambiguity scoring, and drift detection. This required provider abstraction, cost estimation, caching, and confidence thresholds — significant complexity. The revised approach recognizes that developers using AI-assisted workflows already have an LLM available in their coding tool. sdx skills orchestrate the workflow (when to pack, lint, diff, check) and feed structured results to the host LLM for reasoning. The `--ai` flag on `sdx check` is retained as a minimal single-provider fallback, not the primary path. This cuts ~40% of Phase 4 scope and moves the highest-value AI integration (spec-aware coding sessions) from Phase 4 to Phase 2.

---

## What This Does NOT Change

- **Phase 1** — Entirely unaffected. Foundation work (schema, core, lint, CLI) is prerequisite for everything.
- **Spec file format** — Unchanged. Skills consume specs through the CLI, not directly.
- **`spec.config.yaml`** — No new config fields needed. Skills use existing CLI flags.
- **MCP server** — Complementary, not competing. MCP exposes sdx to any MCP-compatible tool. Skills are opinionated workflows for specific coding tools.
- **GitHub Action** — Unchanged. CI is a different integration surface than interactive coding.

## Trade-offs

| Pro | Con |
|---|---|
| Highest-value AI integration moves from Phase 4 to Phase 2 | Claude Code-only initially — other tools come later |
| No provider abstraction, caching, or cost management in sdx | Developers without AI coding tools get a simpler `--ai` experience |
| Skills encode methodology, not just tool calls | Skill maintenance is an ongoing concern as sdx CLI evolves |
| ~40% Phase 4 scope reduction | Skills are a new package to maintain |
| Zero-config AI experience (no API keys for skill users) | Dependent on Claude Code's skill system stability |
