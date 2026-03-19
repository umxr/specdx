# Phase 3 — Team Adoption Design

> Designed 2026-03-19. Covers the full Phase 3 scope: diff engine, GitHub Action, plugin distribution, team features, and new skills.

---

## Approach

Phase 3 is structured as **5 vertical feature slices**, each delivering a complete user-facing capability. Every slice is independently shippable.

```
Slice 1: Plugin Distribution & Skill Quality
  └── No dependencies — ships first

Slice 2: Diff Engine + CLI
  ├── @specdx/diff package (new)
  ├── sdx diff command
  └── Config schema extension (diff key)

Slice 3: Diff-Powered Features
  ├── sdx status command
  ├── Skill: sdx:pre-commit
  ├── Skill: sdx:sprint-review
  └── Skill: sdx:plan-from-spec

Slice 4: GitHub Action + CI
  ├── @specdx/action package (new)
  ├── Lint + diff on PRs
  ├── PR comments, health badge
  └── Config schema extension (ci key)

Slice 5: Team Features
  ├── Shared config presets
  ├── Spec ownership
  ├── Changelog generation (sdx changelog)
  ├── Onboarding mode (sdx explain)
  └── Skill: sdx:onboard
```

---

## Slice 1 — Plugin Distribution & Skill Quality

Eliminates the manual `sdx skills install` step and makes skills work automatically.

### Claude Code Plugin Manifest

Add `.claude-plugin/plugin.json` inside `packages/cli/` (the published `specdx` npm package). Include in the `files` array of `packages/cli/package.json` so it ships with the published package:

```json
{
  "name": "specdx",
  "version": "0.2.0",
  "description": "Spec-driven development skills for Claude Code",
  "commands": "./dist/skills"
}
```

The `commands` field points at the skills directory already copied into `dist/` by tsup. When a user installs the plugin, Claude Code discovers `/specdx-start-task` and `/specdx-author-spec` automatically.

No changes to skill file format — they are already valid Claude Code custom commands with frontmatter (`name`, `description`, `allowed-tools`).

### Session-Start Hook

Add `hooks/hooks.json` to the plugin:

```json
{
  "hooks": [
    {
      "event": "SessionStart",
      "command": "./hooks/session-start"
    }
  ]
}
```

The `session-start` script:
1. Searches upward from cwd for `spec.config.yaml`
2. If not found, exits silently (no output = no injection)
3. If found, runs `npx specdx validate --format json` and `npx specdx graph --format json`
4. Outputs a lightweight JSON context: project name, spec count, health status (pass/warn/fail), any lint errors, dependency tree summary

Token budget target: under 500 tokens for the injected summary. Enough to orient, not enough to bloat.

### Improved Skill Descriptions

Rewrite skill descriptions to use "Use when..." trigger conditions:

**specdx-start-task:**
```yaml
description: "Use when the user describes work they're about to do, mentions implementing a feature, asks to start a task, or says 'implement', 'build', 'add', 'fix', or 'refactor'. Loads relevant spec context before coding."
```

**specdx-author-spec:**
```yaml
description: "Use when the user wants to create a new spec, write a PRD, document a technical design, record an architecture decision, add a user story, or write a test plan. Guides spec authoring with iterative linting."
```

### Hard Gates & Rationalization Tables

Add to `specdx-author-spec`:

```markdown
<HARD-GATE>
Do NOT skip the lint step between sections. Run `npx specdx lint --path <file>`
after every 2-3 sections. Do NOT write the entire spec and lint at the end.
</HARD-GATE>

## Rationalizations to Resist

| Thought | Reality |
|---------|---------|
| "I'll lint at the end, it's faster" | Lint catches issues early. Fixing 1 issue now beats fixing 10 later. |
| "This section is simple, no need to lint" | Simple sections have frontmatter and reference issues too. |
| "The user seems in a hurry" | Shipping a broken spec wastes more time than linting. |
| "I already know the lint rules" | Rules evolve. Run the tool. |
```

### Supporting Reference Files

Add companion files alongside skills in `packages/skills/skills/`:

- `spec-type-reference.md` — table of all spec types, required sections, and frontmatter fields. Referenced by `specdx-author-spec` via Read tool when needed.

These get copied into `dist/skills/` alongside the command files.

### `sdx skills install` Retained

The `sdx skills install` command stays as a fallback for users who don't use the plugin system. It continues to copy skills to `.claude/commands/`. The plugin just makes it unnecessary.

### Multi-Platform Documentation

Add `docs/other-platforms.md` documenting how to manually set up specdx skills in Cursor and Gemini CLI (copy the `.md` files, configure hooks manually). No plugin manifests for other platforms in this phase.

### Reference Implementation

The superpowers project (`/Users/umar/Desktop/Work/superpowers`) is the reference for plugin manifest structure, session-start hooks, hard gates, and skill description patterns.

---

## Slice 2 — Diff Engine + CLI

A new `@specdx/diff` package and two CLI commands.

### `@specdx/diff` Package

**Dependencies:** `@specdx/core` (ParsedSpec, DependencyGraph, parseSpec, buildGraph), `@specdx/schema` (types)

#### Structural Diff

Compare two versions of a spec (before/after) and produce a change report.

```typescript
interface SpecDiff {
  specId: string;
  filePath: string;
  frontmatter: FieldChange[];
  sections: SectionChange[];
  summary: string;
}

interface FieldChange {
  field: string;
  type: "added" | "removed" | "modified";
  before?: unknown;
  after?: unknown;
}

interface SectionChange {
  heading: string;
  type: "added" | "removed" | "modified";
  contentDiff?: string;
}
```

Core function: `diffSpecs(before: ParsedSpec, after: ParsedSpec): SpecDiff`

Frontmatter is compared field-by-field. Sections are matched by heading name, then content is compared. New/removed headings are flagged. Content diffs use the `diff` npm package (`createPatch()` for unified diffs). Lightweight, no native dependencies, well-maintained.

#### Downstream Impact Analysis

Given a changed spec, walk the dependency graph and identify all downstream specs that may need updating.

```typescript
interface ImpactAnalysis {
  changedSpec: string;
  downstream: DownstreamImpact[];
  totalAffected: number;
}

interface DownstreamImpact {
  specId: string;
  filePath: string;
  distance: number;
  lastUpdated: string | null;
  staleness: number;
  reason: string;
}
```

Core function: `analyzeImpact(changedSpecId: string, diff: SpecDiff, graph: DependencyGraph, allSpecs: ParsedSpec[]): ImpactAnalysis`

Uses `graph.getDownstream()` for transitive dependents. Staleness is a 0–1 probability score:

```
staleness = clamp(0, 1,
  (daysSinceUpdate / thresholdDays) * 0.5
  + (structuralSectionsChanged / totalSections) * 0.3
  + (1 / distance) * 0.2
)
```

Where `structuralSectionsChanged` counts changes to high-impact sections (Goals, Architecture, Features, Endpoints) vs low-impact ones (Open Questions, Notes). `distance` is graph hops from the changed spec. Closer dependents score higher.

#### Git Integration

Compare specs between two git refs without checking out branches.

```typescript
async function diffBetweenRefs(
  configPath: string,
  baseRef: string,
  headRef: string
): Promise<DiffResult>
```

Uses `git show <ref>:<path>` to read spec content at each ref, then parses with `parseSpecFromString()`. For new/deleted specs, detect via `git diff --name-status` between refs.

**Requires a new `@specdx/core` export:** The existing `parseSpec()` reads from the filesystem. Git integration needs to parse spec content from strings (returned by `git show`). Add `parseSpecFromString(content: string, filePath: string): ParsedSpec` to `@specdx/core`, keeping the existing `parseSpec()` as a convenience wrapper that reads the file and delegates.

```typescript
interface DiffResult {
  diffs: SpecDiff[];                  // per-spec structural diffs
  added: string[];                    // spec IDs that exist in head but not base
  removed: string[];                  // spec IDs that exist in base but not head
  impact: ImpactAnalysis[];           // downstream impact for each changed spec
  summary: string;                    // human-readable overall summary
}
```

#### Cross-Reference Impact

When a spec renames or removes a feature, story ID, or endpoint, flag all references to it in other specs. Implementation: after computing `SpecDiff`, scan the `frontmatter.references` of all specs in the suite for IDs that match changed or removed items. Report as a `FieldChange` with type `"broken-reference"` in the affected downstream spec's diff.

#### Git Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Git binary not available | Throw `DiffError("git is required for sdx diff")` with exit code 1 |
| Base ref does not exist | Throw `DiffError("ref 'xyz' not found")` — suggest checking branch/tag name |
| Spec exists at HEAD but not at base | Treat as "added" — include in `DiffResult.added`, no structural diff |
| Spec exists at base but not at HEAD | Treat as "removed" — include in `DiffResult.removed` |
| No git history (fresh init) | Throw `DiffError("no commits found — sdx diff requires git history")` |
| Dirty working tree, no `--head` flag | Diff working tree against base ref (default behaviour, not an error) |

### Config Schema Extension

Add `diff` key to `SdxConfig`:

```yaml
diff:
  baseline_ref: "main"
  staleness_threshold_days: 14
  ignore_paths:
    - "specs/archive/**"
```

### CLI: `sdx diff`

```
sdx diff [--base <ref>] [--head <ref>] [--spec <id>] [--format pretty|json|github]
```

- No flags: diff working tree vs `diff.baseline_ref` (default `main`)
- `--base` / `--head`: diff between two refs
- `--spec`: scope to a single spec and its downstream impact
- Output: changed specs, section-level diffs, downstream impact with staleness scores

### CLI: `sdx status`

```
sdx status [--format pretty|json|github]
```

Composite health overview:
- Total specs, by status (draft/review/approved/superseded)
- Lint health: errors, warnings, passing
- Staleness: specs not updated in > `staleness_threshold_days`
- Dependency integrity: broken references or circular deps
- One-line verdict: "Healthy", "3 warnings", or "2 errors — run `sdx lint` for details"

```typescript
interface StatusResult {
  project: string;
  specCount: number;
  byStatus: Record<string, number>;
  lintHealth: { errors: number; warnings: number; passing: number };
  staleSpecs: { specId: string; daysSinceUpdate: number; owner?: string }[];
  integrityIssues: string[];
  verdict: "healthy" | "warnings" | "errors";
}
```

The `--format github` option emits `::warning` annotations for stale specs, useful when `sdx status` is called from CI.

### Testing Strategy

- Unit tests for `diffSpecs()` with fixture spec pairs
- Unit tests for `analyzeImpact()` with multi-node dependency graphs
- Integration tests for git diffing using a temporary git repo with commits
- Target: 80%+ coverage on `@specdx/diff`

---

## Slice 3 — Diff-Powered Features

### Skill: `sdx:pre-commit`

**File:** `packages/skills/skills/specdx-pre-commit.md`

**Trigger:** Use when the user is about to commit, mentions committing, or says "let's commit", "ready to commit", "wrap up".

**Workflow:**
1. Run `npx specdx lint`
2. Run `npx specdx diff`
3. If no spec changes, report "No spec changes — safe to commit" and stop
4. If changes detected, present summary: which specs changed, downstream impact, staleness
5. Ask user: "Update downstream specs before committing, or proceed as-is?"

**Hard gate:** Do NOT silently skip the diff step.

### Skill: `sdx:sprint-review`

**File:** `packages/skills/skills/specdx-sprint-review.md`

**Trigger:** Use when the user asks for a summary, sprint review, spec health report, or progress update.

**Workflow:**
1. Run `npx specdx status --format json`
2. Run `npx specdx diff --base <ref> --format json`
3. Synthesise a report: specs changed, health status, downstream impact, recommended actions
4. Present in shareable markdown format

### Skill: `sdx:plan-from-spec`

**File:** `packages/skills/skills/specdx-plan-from-spec.md`

**Trigger:** Use when the user asks to plan implementation, create a plan from specs, or says "how should I build this".

**Workflow:**
1. Run `npx specdx pack --task "$ARGUMENTS" --format xml --full`
2. Generate step-by-step implementation plan with file targets, dependency order, test expectations, and spec references
3. Plan follows the structure expected by the superpowers `writing-plans` skill if available

No diff dependency — only needs `sdx pack`.

### Skill Distribution

All new skills are flat `.md` files in `packages/skills/skills/`, copied to `dist/skills/` by tsup, installed to `.claude/commands/` by `sdx skills install`, and auto-discovered via the Claude Code plugin.

Updated `SKILL_NAMES`:
```typescript
export const SKILL_NAMES = [
  "specdx-start-task",
  "specdx-author-spec",
  "specdx-pre-commit",
  "specdx-sprint-review",
  "specdx-plan-from-spec",
  "specdx-onboard",
];
```

---

## Slice 4 — GitHub Action + CI

### `@specdx/action` Package

JavaScript action bundled with `@vercel/ncc` into a single `dist/index.js`.

**Build changes required:**
- Replace `tsc --build` with `ncc build src/main.ts -o dist` in `packages/github-action/package.json`
- Add dependencies: `@actions/core`, `@actions/github`
- Add devDependency: `@vercel/ncc`
- The action package has its own build — it is NOT bundled into the CLI's tsup build
- The CLI's `tsup.config.ts` must add `@specdx/diff` to the `noExternal` array

```
packages/github-action/
├── action.yml
├── src/
│   ├── main.ts
│   ├── comment.ts
│   └── badge.ts
├── dist/
│   └── index.js
└── package.json
```

### Action Behaviour

1. **Detect trigger paths** — reads `ci.trigger_paths` from `spec.config.yaml` (defaults to `["spec.config.yaml", "specs/**"]`). If no changed files match, posts brief annotation and exits 0.
2. **Run lint** — calls `runLint()`, collects diagnostics.
3. **Run diff** — calls `diffBetweenRefs()` comparing PR base → head. Collects changes and downstream impact.
4. **Post PR comment** — formatted markdown:
   ```markdown
   ## Spec Health Report

   **Lint:** 2 specs pass (0 errors, 1 warning)
   **Changes:** 1 spec modified (prd.md)

   ### Changes
   | Spec | Sections Modified |
   |------|-------------------|
   | prd | Goals, Features |

   ### Downstream Impact
   | Spec | Staleness | Action Needed |
   |------|-----------|---------------|
   | technical-design | 0.7 (12 days) | Goals changed upstream — review |

   ---
   *Generated by [specdx](https://github.com/umxr/specdx)*
   ```
5. **Set exit code** — reads `ci.block_on` (default: `["error"]`). Fail check if any diagnostic matches.
6. **GitHub annotations** — lint diagnostics emitted as `::error` / `::warning` for inline display.

### Config Schema Extension

```yaml
ci:
  block_on: ["error"]
  post_comment: true
  update_badge: true
  trigger_paths:
    - "spec.config.yaml"
    - "specs/**"
```

### Health Badge

Static SVG updated by the action. Three states: green (passing), yellow (warnings), red (failing). Users add to README via standard markdown image syntax.

### Usage

```yaml
name: Spec Health
on:
  pull_request:
    paths:
      - "spec.config.yaml"
      - "specs/**"
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: umxr/specdx@v1
```

### Testing

- Unit tests for comment formatting and badge generation
- Integration test with fixture repo, asserting correct output and exit codes
- `@actions/core` mocked for local testing

---

## Slice 5 — Team Features

### Shared Config Presets

Follow the `eslint-config-*` pattern. A preset is a publishable npm package exporting a partial config structure.

```yaml
lint:
  extends: "@specdx/config-strict"
```

Resolution: check built-in preset → check local path → `require.resolve()` npm package. Deep-merge with user config (user wins on conflicts).

Add `resolvePreset()` to `@specdx/core`.

**Schema migration required:** The current `lint.extends` field is typed as `"minimal" | "recommended" | "strict"` (enum) in both `@specdx/schema` types and the JSON schema. Supporting npm package names requires:
1. Change `extends` type from string enum to `string` in TypeScript types
2. Update JSON schema to accept any string (remove enum constraint, add pattern for validation)
3. Update `getPreset()` in `@specdx/lint` to call `resolvePreset()` when value is not a built-in name

This touches `@specdx/schema`, `@specdx/core`, and `@specdx/lint`. Existing configs remain valid since built-in names are still accepted.

### Spec Ownership

Add optional `owner` field to `SpecEntry`:

```yaml
specs:
  prd:
    path: specs/prd.md
    type: prd
    owner: "@umar"
```

Surfaces in: `sdx status` (alongside staleness warnings), GitHub Action PR comment (@-mentions owners), `sdx diff` (downstream impact output).

Schema change: add `owner?: string` to `SpecEntry` in `@specdx/schema`.

### Changelog Generation

**Command:** `sdx changelog [--from <ref>] [--to <ref>]`

Thin wrapper over `diffBetweenRefs()` + a markdown formatter. Output:

```markdown
## Spec Changes (main..HEAD)

### Modified
- **prd** (v0.1 → v0.2) — Goals updated, 2 features added

### Added
- **user-story-auth** — New user story for authentication flow

### Downstream Impact
- technical-design may be stale (prd changed 3 days ago)
```

Formatter lives in `@specdx/diff`.

### Onboarding Mode

**Command:** `sdx explain [--format pretty|json]`

Human-readable spec suite summary: project name, spec count by type/status, dependency tree, brief description of each spec, health summary.

Composes existing functions — `loadConfig()`, `parseSpec()`, `buildGraph()`, lint health. New code is just the explain-specific formatter.

### Skill: `sdx:onboard`

**File:** `packages/skills/skills/specdx-onboard.md`

**Trigger:** Use when a new developer joins, asks "what is this project", "explain the specs", or wants a codebase overview.

**Workflow:**
1. Run `npx specdx explain --format json`
2. Run `npx specdx pack --full --format xml`
3. Walk developer through: what the project does, how it's built, what specs exist and how they relate, current health
4. Invite questions

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Overall structure | 5 vertical feature slices | Each ships something usable. Front-loads plugin. |
| Diff baseline | Git-based (compare against refs) | Users are developers, git is assumed. No snapshot state. |
| Diff algorithm | Section-level matching by heading, unified diff for content | Sections are the natural unit of spec change. |
| GitHub Action trigger | Configurable, defaults to spec files only | Sensible default, opt-in for broader scope. |
| Action type | JavaScript (ncc-bundled) | Faster than Docker, same language as codebase. |
| Plugin strategy | CLI-first with thin plugin layer | CLI already works. Plugin adds manifest + hook. |
| Session-start injection | Lightweight summary (validate + graph) | Cheap per-session. Full pack deferred to task time. |
| Skill discovery | Description-driven "Use when..." triggers | Auto-selection without manual slash commands. |
| Multi-platform | Claude Code plugin ships, Cursor/Gemini documented only | Ship one plugin well. Skill files are portable. |
| Shared presets | npm package pattern (eslint-config-*) | Familiar to TS ecosystem. Deep-merge with user config. |
| Changelog | Thin wrapper over diff engine | Reuses existing types and git integration. |
| Health badge | Static SVG committed by action | Simpler than hosting an endpoint. |
| Content diffs | `diff` npm package (`createPatch()`) | Lightweight, no native deps, well-maintained. |
| `parseSpec` for git | New `parseSpecFromString()` in `@specdx/core` | Existing `parseSpec()` reads filesystem; git needs string input. |

---

## Deferred to Later Phases

These roadmap items are explicitly descoped from this design:

| Item | Reason | Deferred to |
|---|---|---|
| Multi-platform plugin manifests (Cursor, Gemini CLI) | Ship Claude Code first, document the rest. No demand yet. | Phase 4 or on-demand |
| Subagent prompt templates | Complex to design well. Skills work without them initially. | Phase 4 (with `sdx:review-spec` and `sdx:check-drift`) |
| GitHub Action caching | Optimisation — ship correct first, fast later. | Post Phase 3 |
| Action marketplace listing | Mechanical step after the action works. | End of Phase 3 or post-release |
| Content & adoption (blog, talk, video, NearForm trial) | Non-technical. Tracked separately in roadmap section 3.5. | Parallel track |

**Roadmap exit criteria to update:**
- "Skills work in at least 2 platforms" → change to "Skills work in Claude Code; Cursor/Gemini setup documented"
- "Session-start hook auto-runs `sdx pack`" → change to "Session-start hook injects lightweight summary (validate + graph)"
