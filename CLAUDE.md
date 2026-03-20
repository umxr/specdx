# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

specdx — a spec-driven development toolchain. Validates, lints, packs, and ships specs for LLM-assisted workflows. No LLM calls in the core pipeline; AI integration is delegated to Claude Code skills.

Published to npm as `specdx` (CLI). Internal packages use `@specdx/*` scope but are bundled into the CLI via tsup (not published separately).

## Commands

```bash
pnpm build                          # Build all packages (Turborepo, dependency order)
pnpm test                           # Test all packages (Vitest, 80% coverage threshold)
pnpm typecheck                      # Type-check all packages
pnpm lint:code                      # ESLint
pnpm format:check                   # Prettier check
pnpm format                         # Prettier auto-fix

# Single package
pnpm --filter @specdx/core test     # Test one package
pnpm --filter @specdx/lint test     # Test another
pnpm --filter @specdx/pack build    # Build one package

# CLI locally (after build)
node packages/cli/dist/main.js lint
node packages/cli/dist/main.js pack --task "implement auth"
```

Tests must pass `pnpm build` before running since Turbo declares `test` depends on `^build`.

## Architecture

**Monorepo:** pnpm workspaces + Turborepo. 8 packages in `packages/`.

**Dependency graph (data flows up):**
```
schema          ← types, JSON schemas, validators (ajv)
  ↑
core            ← config loading, spec parsing, dependency graph, tokenization
  ↑
lint            ← linting engine + 7 built-in rules
pack            ← 3-stage pipeline: Resolve → Allocate → Format
  ↑
cli (specdx)    ← citty commands: init, lint, validate, graph, pack, skills
skills          ← SKILL.md files bundled into CLI dist at build time
```

**CLI build is special:** Uses tsup to bundle all `@specdx/*` packages into a single dist. Other packages use plain `tsc` with composite project references.

**Pack pipeline (packages/pack):** `resolver.ts` scores spec relevance → `allocator.ts` distributes token budget → `formatter-*.ts` outputs XML/JSON/Markdown.

**Lint rules (packages/lint/src/rules/):** Each rule implements `LintRule` interface with `run(context: LintContext): Diagnostic[]`. Three presets: minimal, recommended, strict.

**Skills (packages/skills/skills/):** Flat `.md` files for Claude Code custom commands. Copied into CLI dist at build time via tsup `onSuccess` hook. Installed to `.claude/commands/` by `sdx skills install`.

## Code Conventions

- **ESM only** — all packages use `"type": "module"`. Imports require explicit `.js` extensions.
- **TypeScript strict** — `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters` all enabled.
- **Tests live alongside source** — `src/foo.test.ts` next to `src/foo.ts`. Test patterns: `src/**/*.test.ts` and `test/**/*.test.ts`.
- **Vitest globals** — `describe`, `it`, `expect` available without imports.
- **Prettier** — double quotes, semicolons, trailing commas, 100 char width.
- **Unused vars** — prefix with `_` to suppress the `no-unused-vars` error.

## Key Types

- `ParsedSpec` (core) — parsed spec file: frontmatter, content, sections, parsedSections with token counts
- `SdxConfig` (schema) — `spec.config.yaml` structure: specs map, lint/pack/diff config
- `LintRule` / `Diagnostic` (lint) — rule interface and its output
- `PackOptions` / `PackResult` (pack) — pack pipeline input/output
- `SpecType` (schema) — `"prd" | "technical-design" | "user-story" | "test-plan" | "adr" | "api-contract"`

## Spec Format

Markdown files with YAML frontmatter. Required fields: `id`, `type`, `title`, `status`, `version`, `created`, `authors`. Dates must be quoted strings in YAML. Config file is `spec.config.yaml` at project root.

## Dogfooding

This project uses specdx to spec itself. The `spec.config.yaml` at the root and `specs/` directory are the live spec suite.

**Skill priority:** When authoring specs or planning implementation, use specdx's own skills (`specdx-author-spec`, `specdx-plan-from-spec`, `specdx-start-task`) instead of generic equivalents (e.g., superpowers:brainstorming, superpowers:writing-plans). This project dogfoods its own tooling.

```bash
# Validate specs
node packages/cli/dist/main.js validate
node packages/cli/dist/main.js lint

# Pack context before working on a task
node packages/cli/dist/main.js pack --task "implement diff engine"

# View dependency graph
node packages/cli/dist/main.js graph
```

## Key Documents

- **Roadmap:** `roadmap.md` — full project roadmap with phases, deliverables, and exit criteria
- **Design specs:** `specs/designs/` — design documents from brainstorming sessions
- **Implementation plans:** `specs/plans/` — step-by-step plans with checkboxes
- **Phase 3 design:** `specs/designs/2026-03-19-phase-3-team-adoption-design.md`
- **Phase 3 plan:** `specs/plans/2026-03-19-phase-3-team-adoption.md` — 29 tasks across 5 slices
