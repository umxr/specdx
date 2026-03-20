# Phase 4 — Spec Intelligence Design

> Designed 2026-03-20. Covers the full Phase 4 scope: static spec-to-implementation analysis, LLM-assisted analysis, new spec types, spec generation, MCP server, advanced lint rules.

---

## Approach

Phase 4 is structured as **6 vertical slices**, ordered by dependency and value. The core differentiator — static spec-to-implementation drift detection — ships first. Each subsequent slice builds on it.

```
Slice 1: @specdx/check + sdx check CLI
  ├── Framework route extractors (Express, Hono, Next.js)
  ├── Type/schema matcher (TS types, Zod, Prisma)
  ├── Test coverage mapper
  └── Implementation completeness score

Slice 2: New Spec Types
  ├── epic (groups stories under PRD)
  ├── quick-spec (lightweight bug fix / small feature)
  └── project-context (always-loaded constitution)

Slice 3: Skills + LLM-Assisted Analysis
  ├── sdx:verify skill (host LLM reviews check output)
  ├── sdx:review-spec skill (multi-layer subagent review)
  ├── sdx:check-drift skill (pre-commit drift detection)
  └── sdx check --ai (Anthropic API fallback)

Slice 4: Spec Generation & Maintenance
  ├── sdx generate story --from prd
  ├── sdx generate test-plan --from stories
  ├── sdx update --from-code
  └── sdx migrate

Slice 5: MCP Server + Integrations
  ├── MCP server (spec health, pack, check)
  ├── Methodology modules (sdx init --module)
  └── Skills adapter architecture docs

Slice 6: Advanced Lint Rules
  ├── consistency/naming-conventions
  ├── consistency/terminology
  ├── security/threat-coverage
  ├── completeness/edge-case-coverage
  └── clarity/ambiguity-score-ai (opt-in LLM)
```

---

## Slice 1 — Static Spec-to-Implementation Analysis

The headline feature. A new `@specdx/check` package that compares specs against code using AST parsing and pattern matching. No LLM calls.

### `@specdx/check` Package

**Dependencies:** `@specdx/core` (ParsedSpec, config), `@specdx/schema` (types), `ts-morph` (TS AST parsing)

**Architecture:**

```
@specdx/check
├── src/
│   ├── index.ts              # exports
│   ├── types.ts              # CheckResult, Finding, etc.
│   ├── check.ts              # orchestrator: runs all matchers
│   ├── extractors/
│   │   ├── types.ts          # ExtractedRoute, ExtractedType
│   │   ├── express.ts        # Express route extractor
│   │   ├── hono.ts           # Hono route extractor
│   │   ├── nextjs.ts         # Next.js App Router extractor
│   │   ├── typescript.ts     # TS type/interface extractor
│   │   ├── zod.ts            # Zod schema extractor
│   │   └── prisma.ts         # Prisma model extractor
│   ├── matchers/
│   │   ├── routes.ts         # API contract → route matching
│   │   ├── types.ts          # Data model → type matching
│   │   └── tests.ts          # Test plan → test file matching
│   └── score.ts              # Implementation completeness score
```

### Core Types

```typescript
interface CheckResult {
  findings: Finding[];
  score: ImplementationScore;
  summary: string;
}

interface Finding {
  type: "missing" | "extra" | "mismatch" | "drift";
  category: "route" | "type" | "test";
  specId: string;
  specSection?: string;
  codeLocation?: { file: string; line: number };
  expected: string;
  actual?: string;
  severity: "error" | "warn" | "info";
  suggestion?: string;
}

interface ImplementationScore {
  overall: number;                    // 0-100
  byCategory: Record<string, { matched: number; total: number }>;
}

interface ExtractedRoute {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  params: string[];
  file: string;
  line: number;
}

interface ExtractedType {
  name: string;
  fields: { name: string; type: string; optional: boolean }[];
  file: string;
  line: number;
}
```

### API Route Matching

The route matcher compares API contract specs against actual route definitions extracted from code.

**Spec side:** Parse the `## Endpoints` section of `api-contract` specs. Expected format:

```markdown
## Endpoints

### GET /api/users
Returns a list of users.

### POST /api/users
Creates a new user.
- Body: `{ name: string, email: string }`

### GET /api/users/:id
Returns a single user by ID.
```

Extract: method, path, path params, body fields (if mentioned). Use regex: `/^###\s+(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/gm`.

**Code side:** Framework-specific extractors:

#### Express Extractor

Use `ts-morph` to find calls to `app.get()`, `app.post()`, `router.get()`, etc. Pattern:

```typescript
// Match: app.get("/path", handler) | router.post("/path", handler)
// Also: app.route("/path").get(handler).post(handler)
```

Walk the AST for `CallExpression` nodes where the callee is a property access with name matching HTTP methods. Extract the first string literal argument as the path. Handle `Router()` prefix by tracking the mount path from `app.use("/prefix", router)`.

#### Hono Extractor

Same pattern as Express — Hono uses identical method syntax: `app.get("/path", handler)`. Additionally detect `app.route("/prefix", subApp)` for mounted sub-apps.

#### Next.js App Router Extractor

File-system based. Walk `app/` directory:
- `app/api/users/route.ts` → `/api/users`
- `app/api/users/[id]/route.ts` → `/api/users/:id`
- Dynamic segments: `[param]` → `:param`, `[...slug]` → `:slug*`
- Route groups: `(group)` → ignored in path

Read each `route.ts` file. Exported functions (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) determine supported methods.

#### Framework Detection

Auto-detect framework from `package.json` dependencies:
- `express` → Express extractor
- `hono` → Hono extractor
- `next` → Next.js extractor

Fall back to explicit config if multiple frameworks or non-standard setup:

```yaml
check:
  framework: "express"          # or "hono", "nextjs"
  routes_dir: "src/routes"      # where to find route files
  app_dir: "app"                # Next.js app directory
  types_dir: "src/types"        # where to find type definitions
  tests_dir: "src"              # where to find test files
```

#### Matching Algorithm

1. Normalise both spec paths and code paths (strip trailing slashes, normalise param syntax)
2. For each spec endpoint, find matching code route (method + path)
3. Report:
   - `missing`: spec defines endpoint, code doesn't implement it
   - `extra`: code has endpoint not in spec (info severity — may be intentional)
   - `mismatch`: endpoint exists but method differs, or params don't match

### Type/Schema Matching

Compare data model sections in `technical-design` specs against TypeScript types, Zod schemas, or Prisma models.

**Spec side:** Parse `## Data Model` sections. Expected format:

```markdown
## Data Model

### User
- `id`: string (UUID)
- `name`: string
- `email`: string
- `role`: "admin" | "user"
- `createdAt`: Date
```

Extract: type name, field name, field type, optional marker.

**Code side:**

- **TypeScript:** `ts-morph` to find `interface` and `type` declarations. Extract field names, types, optional markers.
- **Zod:** Find `z.object({...})` calls assigned to named variables. Extract field names from `.shape`, infer types from Zod method names (`z.string()` → `string`, `z.number()` → `number`, `z.enum([...])` → union).
- **Prisma:** Parse `schema.prisma` file. Extract `model` blocks with field names and types. Map Prisma types to TS equivalents (`String` → `string`, `Int` → `number`, `DateTime` → `Date`).

**Matching:** Fuzzy match type names (case-insensitive, strip suffixes like `Schema`, `Model`, `Type`). For each matched pair, compare fields. Report missing/extra/mismatched fields.

### Test Coverage Mapping

Compare `test-plan` specs against actual test files.

**Spec side:** Parse `## Test Cases` sections. Extract test case descriptions.

**Code side:** Find test files (`.test.ts`, `.spec.ts`). Extract `describe()` and `it()` / `test()` string literals using `ts-morph`.

**Matching:** Fuzzy string match between spec test case descriptions and actual test descriptions. Use normalised word overlap (Jaccard similarity) with a threshold of 0.4. Report:
- Spec'd test cases with matching tests (covered)
- Spec'd test cases with no match (uncovered)
- Actual tests with no spec match (info — extra coverage)

### Implementation Completeness Score

Aggregate findings into a percentage:

```
overall = (matched_items / total_spec_items) * 100
```

Where `total_spec_items` = endpoints + type fields + test cases defined in specs, and `matched_items` = items with a corresponding implementation found.

Break down by category:
```
Routes: 8/10 (80%)
Types: 15/18 (83%)
Tests: 12/20 (60%)
Overall: 35/48 (73%)
```

### CLI: `sdx check`

```
sdx check [--format pretty|json] [--spec <id>] [--framework express|hono|nextjs]
```

- No flags: auto-detect framework, check all spec types
- `--spec`: scope to a single spec
- `--framework`: override auto-detection
- Exit code 1 if any `error` severity findings

Output (pretty):

```
  sdx check — 73% implementation coverage

  Routes (8/10):
    ✓ GET /api/users
    ✓ POST /api/users
    ✗ GET /api/users/:id — missing implementation
    ✗ DELETE /api/users/:id — missing implementation
    ...

  Types (15/18):
    ✓ User — 5/5 fields match
    ⚠ Post — missing field "publishedAt" (spec: Date)
    ...

  Tests (12/20):
    ✗ "should reject invalid email" — no matching test found
    ...

  3 errors, 2 warnings, 30 passing
```

### Config Schema Extension

Add `check` key to `SdxConfig`:

```yaml
check:
  framework: "express"            # auto | express | hono | nextjs
  routes_dir: "src/routes"        # where to scan for routes
  app_dir: "app"                  # Next.js app directory
  types_dir: "src"                # where to scan for types
  tests_dir: "src"                # where to scan for tests
  ignore:
    - "src/internal/**"           # paths to skip
```

Add to `@specdx/schema` types:

```typescript
interface CheckConfig {
  framework?: "auto" | "express" | "hono" | "nextjs";
  routes_dir?: string;
  app_dir?: string;
  types_dir?: string;
  tests_dir?: string;
  ignore?: string[];
}
```

### Testing Strategy

- Unit tests for each extractor with fixture source files
- Unit tests for each matcher with known spec/code pairs
- Integration test: fixture project with Express routes + TS types + test files, run full check
- Target: 80%+ coverage on `@specdx/check`
- Estimated: 30-40 tests

### `ts-morph` Considerations

`ts-morph` is a large dependency (~10MB). Options:

1. **Bundle into CLI via tsup** — increases CLI size significantly. Not ideal.
2. **Make `@specdx/check` a peer dependency** — users install separately. Adds friction.
3. **Lazy import with optional dependency** — `sdx check` installs/imports `ts-morph` on first use. Other commands unaffected.

**Decision: Option 3 (lazy import).** The `@specdx/check` package declares `ts-morph` as an optional peer dependency. The CLI's `sdx check` command checks for `ts-morph` at runtime:

```typescript
let tsMorph: typeof import("ts-morph");
try {
  tsMorph = await import("ts-morph");
} catch {
  console.error("sdx check requires ts-morph. Install it: pnpm add -D ts-morph");
  process.exit(1);
}
```

This keeps the base CLI lightweight while enabling the heavy analysis when needed.

**Alternative for Prisma:** Parse `schema.prisma` with regex instead of an AST parser — the format is simple enough. No extra dependency needed.

---

## Slice 2 — New Spec Types

### `epic` Spec Type

Groups related user stories under a PRD feature. Sits between PRD and user-stories in the dependency chain.

**Schema:**
```typescript
interface EpicSpec extends BaseSpec {
  type: "epic";
  epic_id: string;
  priority: "critical" | "high" | "medium" | "low";
}
```

**Required sections:** Overview, Stories, Acceptance Criteria, Dependencies

**Dependency position:** PRD → Epic → User Story

**Changes required:**
- Add `"epic"` to `SPEC_TYPES` in `@specdx/schema`
- Add `EpicSpec` interface and JSON schema
- Update `story-coverage` lint rule: if epics exist, check PRD → Epic → Story chain
- Update `sdx pack` relevance resolver to include epics in context
- Add `sdx init` template support

### `quick-spec` Spec Type

Lightweight spec for bug fixes and small features that don't need full PRD/technical-design ceremony. Inspired by BMAD's tech-spec quick flow.

**Schema:**
```typescript
interface QuickSpecSpec extends BaseSpec {
  type: "quick-spec";
}
```

**Required sections:** Intent, Boundaries, Tasks

**Target size:** 900-1300 tokens. The lint rule `structure/required-sections` enforces the minimal sections. A new optional lint rule `clarity/spec-size` could warn if a quick-spec exceeds 1500 tokens.

**Changes required:**
- Add `"quick-spec"` to `SPEC_TYPES`
- Add `QuickSpecSpec` interface and JSON schema
- Add `sdx init --template quick` to scaffold a quick-spec
- Quick-specs have no mandatory `requires` — they're standalone by default

### `project-context` Spec Type

A "constitution" spec loaded by all skills and always included at highest priority in `sdx pack`. Contains technology stack decisions, critical implementation rules, and coding patterns.

**Schema:**
```typescript
interface ProjectContextSpec extends BaseSpec {
  type: "project-context";
}
```

**Required sections:** Technology Stack, Critical Implementation Rules, Coding Patterns

**Special behaviour:**
- `sdx pack` always includes `project-context` first, at full fidelity (no compression/summarisation)
- `project-context` gets a reserved token allocation (configurable, default 2000 tokens) that doesn't compete with task-relevant specs
- Skills reference it for implementation decisions
- Only one `project-context` spec per suite (lint rule enforces this)

**Changes required:**
- Add `"project-context"` to `SPEC_TYPES`
- Add interface and JSON schema
- Modify `@specdx/pack` allocator: reserve tokens for project-context before relevance-based allocation
- Add lint rule `structure/single-project-context`: warn if more than one project-context spec exists
- Add `sdx init --template context` to scaffold one

### Schema Migration

Adding 3 new spec types is a schema change. Since we're pre-1.0 and all users are on alpha, this is non-breaking. The `SPEC_TYPES` array expands, existing types remain valid.

---

## Slice 3 — Skills + LLM-Assisted Analysis

### Skill: `sdx:verify`

**File:** `packages/skills/skills/specdx-verify.md`

**Trigger:** Use when the user says "verify", "check against spec", "does this match the spec", "review implementation", or after completing a feature.

**Workflow:**
1. Run `npx specdx check --format json`
2. Run `npx specdx pack --task "$ARGUMENTS" --format xml`
3. Present check findings to the LLM (the host tool's LLM — no API key needed)
4. LLM reviews each finding: is it a real issue or a false positive?
5. LLM suggests fixes for real issues, grouped by file
6. Present structured report to user

**This is the recommended path** for AI-assisted analysis. No API keys, no provider config, no cost management — the host tool already has an LLM.

### Skill: `sdx:review-spec`

**File:** `packages/skills/skills/specdx-review-spec.md`

**Trigger:** Use when the user asks to review a spec, says "is this spec good enough", "review my spec", or "check spec quality".

**Workflow — Multi-Layer Review (inspired by BMAD):**

Three review passes, each a separate subagent dispatch using the templates in `packages/skills/templates/`:

1. **Completeness review** — uses `spec-reviewer.md` template. Checks: all required sections present and non-empty, frontmatter valid, cross-references intact.
2. **Consistency review** — new template `consistency-reviewer.md`. Checks: terminology drift across specs, naming conflicts, version alignment.
3. **Adversarial review** — new template `adversarial-reviewer.md`. Forced problem-finding: what edge cases are missing? What could go wrong? What's ambiguous?

Each pass produces a structured report. The skill aggregates them into a single review with issues categorised by layer.

**New templates to create:**
- `packages/skills/templates/consistency-reviewer.md`
- `packages/skills/templates/adversarial-reviewer.md`

### Skill: `sdx:check-drift`

**File:** `packages/skills/skills/specdx-check-drift.md`

**Trigger:** Use when the user says "check drift", "did I drift from spec", or as part of `sdx:pre-commit`.

**Workflow:**
1. Run `npx specdx diff` to detect spec changes
2. Run `npx specdx check --format json` to detect implementation drift
3. Compare: are code changes aligned with spec changes?
4. Flag deviations where implementation contradicts or extends beyond specs
5. Suggest: update code to match spec, or update spec to match code

### `sdx check --ai` (Opt-In Fallback)

For developers not using an AI coding tool. Sends spec + code + static analysis results to the Anthropic API.

**Implementation:**
- Requires `ANTHROPIC_API_KEY` env var
- Uses `@anthropic-ai/sdk` (added as optional peer dependency of `@specdx/check`)
- Sends a focused prompt: "Here are the static analysis findings. For each finding, assess whether it's a real issue or a false positive, and suggest a fix if real."
- Token budget: cap at ~4000 tokens of context per finding
- Output: same `Finding` type with an added `aiAssessment` field

**This is the lightweight fallback**, not the recommended path. The `sdx:verify` skill is better because it has the host LLM's full context window.

---

## Slice 4 — Spec Generation & Maintenance

### `sdx generate story --from prd`

Parse the PRD's `## Features` section. For each feature (matching `**F\d+**:` pattern), generate a user story stub:

```markdown
---
id: "story-<feature-slug>"
type: "user-story"
title: "<feature title>"
status: "draft"
version: "0.1"
created: "<today>"
authors: ["<from config>"]
references:
  - id: "<prd-id>"
    relationship: "decomposed-into"
---

# <Feature Title>

## Description

[Generated from PRD feature: <feature text>]

## Acceptance Criteria

- [ ] [Derived from PRD feature description]

## Dependencies

- Implements PRD feature **F<N>**

## Notes

[To be filled in]
```

Write files to `specs/stories/` (or configured path). Run `npx specdx lint` on each generated file.

### `sdx generate test-plan --from stories`

Parse user stories' `## Acceptance Criteria` sections. For each criterion, generate a test case entry in a test plan stub. Group by story.

### `sdx update --from-code`

Requires `sdx check` output. For each `missing` or `mismatch` finding in the check results, generate a suggested spec update as a diff:

```
--- specs/api-contract.md
+++ specs/api-contract.md (suggested)
@@ -15,6 +15,9 @@
 ### GET /api/users/:id
 Returns a single user by ID.

+### PATCH /api/users/:id
+Updates a user's profile.
+
```

Present as accept/reject choices. On accept, apply the edit.

### `sdx migrate`

Schema version migration. For now, the only migration is adding the 3 new spec types to `SPEC_TYPES`. Future migrations handled by a `migrations/` directory with versioned migration scripts.

---

## Slice 5 — MCP Server + Integrations

### MCP Server

Expose sdx as a Model Context Protocol server so LLMs can query spec health, pack context, and run checks directly.

**Package:** `@specdx/mcp` (new package in `packages/mcp/`)

**Tools exposed:**

| Tool | Description | Parameters |
|------|-------------|------------|
| `sdx_validate` | Validate spec config | `{ configPath?: string }` |
| `sdx_lint` | Run lint | `{ preset?: string, specPath?: string }` |
| `sdx_pack` | Pack context | `{ task?: string, format?: string, budget?: number }` |
| `sdx_status` | Get health status | `{}` |
| `sdx_check` | Run implementation check | `{ framework?: string, specId?: string }` |
| `sdx_diff` | Diff specs | `{ base?: string, head?: string }` |
| `sdx_graph` | Get dependency graph | `{ format?: string }` |

**Implementation:** Use `@modelcontextprotocol/sdk` to create a stdio-based MCP server. Each tool delegates to the existing programmatic APIs (e.g., `runLint()`, `runReady()`, `runStatus()`).

**Transport:** stdio (for local use with Claude Desktop, Cursor, etc.)

**Config:** Users add to their MCP settings:
```json
{
  "mcpServers": {
    "specdx": {
      "command": "npx",
      "args": ["specdx", "mcp"]
    }
  }
}
```

New CLI command: `sdx mcp` starts the MCP server on stdio.

### Methodology Modules

Evolve `sdx init --template` into a full module system. A module is a publishable npm package containing:

```
@specdx/module-bmad/
├── package.json          # { "specdx": { "module": true } }
├── templates/            # spec file templates
├── skills/               # additional skills
├── lint-preset.json      # lint rule configuration
└── config.partial.yaml   # merged into spec.config.yaml on init
```

**Command:** `sdx init --module @specdx/module-bmad`

Resolution: `require.resolve()` the module, read its contents, scaffold project.

### Skills Adapter Architecture Docs

Document how to write adapter layers for other AI coding tools:
- What files to create (plugin manifest, hooks)
- How to map tool names (Read → read_file for Gemini)
- How to test skills in the target platform

This is documentation only — we already have Cursor and Gemini manifests from Phase 3.

---

## Slice 6 — Advanced Lint Rules

### `consistency/naming-conventions`

Enforce consistent naming across specs:
- Feature IDs follow `F<N>` pattern in PRDs
- Story IDs follow `story-<slug>` pattern
- Endpoint paths follow consistent casing (`/api/user-profiles` not `/api/userProfiles`)

Configurable patterns via lint config.

### `consistency/terminology`

Detect when the same concept is referred to by different names across specs. Build a term frequency map across all specs, flag terms that appear similar (edit distance < 3) but differ (e.g., "user profile" vs "user-profile" vs "UserProfile").

### `security/threat-coverage`

If a spec with type containing "security" or "threat" exists, or if any spec has a `## Threats` or `## Security` section, check that the technical design addresses identified threats. Match threat descriptions against technical design mitigation sections.

### `completeness/edge-case-coverage`

Flag user stories or test plans that don't mention error states, boundary conditions, or failure modes. Heuristic: check for keywords like "error", "invalid", "empty", "timeout", "fails", "boundary", "edge case", "null", "undefined". If none found, emit a warning.

### `clarity/ambiguity-score-ai` (opt-in)

Uses the Anthropic API (same as `sdx check --ai`) to score ambiguity more accurately than heuristic pattern matching. Opt-in via config:

```yaml
lint:
  rules:
    clarity/ambiguity-score-ai: ["warn", { provider: "anthropic" }]
```

Requires `ANTHROPIC_API_KEY`. Falls back to the existing `clarity/no-vague-language` rule if no key.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| AST parser | `ts-morph` | Full TS AST access, handles imports/exports. Heavy but accurate. |
| `ts-morph` loading | Lazy/optional | Keep base CLI lightweight. Only loaded for `sdx check`. |
| Prisma parsing | Regex | Simple format, no extra dependency needed. |
| Framework detection | Auto from package.json | Sensible default, configurable override. |
| Route matching | Normalised path comparison | Simple, deterministic, handles param syntax differences. |
| Type matching | Fuzzy name match + field comparison | Types may have suffix differences (User vs UserModel). |
| Test matching | Jaccard similarity on normalised words | Test descriptions are natural language, exact match too strict. |
| Completeness score | Simple ratio (matched/total) | Easy to understand, reproducible, no subjective weighting. |
| New spec types | 3 types added to SPEC_TYPES enum | Non-breaking for pre-1.0 alpha. Existing types unaffected. |
| project-context priority | Reserved token allocation in pack | Must always be included, should not compete with task-relevant specs. |
| MCP transport | stdio | Simplest, works with Claude Desktop and Cursor out of the box. |
| LLM integration | Host LLM via skills (recommended) + Anthropic API (fallback) | Skills are zero-config. API fallback for non-AI-tool users. |
| Multi-layer review | 3 subagent passes | Different perspectives catch different issues. Follows BMAD pattern. |
| Methodology modules | npm packages with convention-based structure | Familiar to TS ecosystem. Community can publish modules. |

---

## Dependency Graph

```
Slice 1: @specdx/check
  └── depends on: @specdx/core, @specdx/schema
  └── optional: ts-morph

Slice 2: New Spec Types
  └── depends on: @specdx/schema (types), @specdx/lint (rules), @specdx/pack (allocator)
  └── independent of Slice 1

Slice 3: Skills + LLM
  └── depends on: Slice 1 (sdx check output)
  └── optional: @anthropic-ai/sdk (for --ai flag)

Slice 4: Generation
  └── depends on: Slice 1 (sdx check for update --from-code)
  └── depends on: @specdx/core (spec parsing)

Slice 5: MCP + Modules
  └── depends on: all prior slices (exposes them over MCP)
  └── depends on: @modelcontextprotocol/sdk

Slice 6: Lint Rules
  └── depends on: @specdx/lint (rule interface)
  └── independent of other slices
```

**Parallelisation:** Slices 1, 2, and 6 can be developed in parallel. Slice 3 needs Slice 1. Slice 4 needs Slice 1. Slice 5 needs all others.

---

## Deferred / Out of Scope

| Item | Reason | When |
|---|---|---|
| Jira/Linear sync | Complex integration, needs real-world demand first | Post Phase 4 |
| Slack notifications | Nice-to-have, not differentiating | Post Phase 4 |
| Dashboard (web UI) | Large scope, orthogonal to core value | Post Phase 4 |
| VS Code extension | Stretch goal from Phase 2, not blocking | Post Phase 4 |
| Mastra integration | Evaluate after MCP server ships | Post Phase 4 if demand |

---

## Estimated Test Counts

| Package | New Tests | Running Total |
|---|---|---|
| @specdx/check (new) | 35-40 | 35-40 |
| @specdx/schema | 8-10 (new types) | ~41 |
| @specdx/lint | 8-10 (new rules) | ~42 |
| @specdx/pack | 3-5 (project-context) | ~59 |
| @specdx/mcp (new) | 10-15 | 10-15 |
| specdx CLI | 5-8 (new commands) | ~21 |
| **Total** | ~75-90 | ~280-290 |
