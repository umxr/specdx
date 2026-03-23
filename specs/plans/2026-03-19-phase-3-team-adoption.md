# Phase 3 — Team Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship diff engine, GitHub Action, plugin distribution, team features, and new skills — making specdx a team tool that enforces spec health in CI.

**Architecture:** 5 vertical feature slices, each independently shippable. Slice 1 (plugin) has no dependencies and ships first. Slice 2 (diff engine) is the core engineering. Slices 3-5 layer on top.

**Tech Stack:** TypeScript (ESM only), Vitest, citty (CLI), `diff` npm package (unified diffs), `@actions/core` + `@actions/github` (GitHub Action), `@vercel/ncc` (action bundling)

**Design spec:** `docs/superpowers/specs/2026-03-19-phase-3-team-adoption-design.md`

---

## Slice 1: Plugin Distribution & Skill Quality

### Task 1: Claude Code Plugin Manifest

**Files:**
- Create: `packages/cli/.claude-plugin/plugin.json`
- Create: `packages/cli/hooks/hooks.json`
- Modify: `packages/cli/package.json`

- [x] **Step 1: Create plugin manifest**

Create `packages/cli/.claude-plugin/plugin.json`:
```json
{
  "name": "specdx",
  "version": "0.2.0",
  "description": "Spec-driven development skills for Claude Code",
  "commands": "./dist/skills"
}
```

- [x] **Step 2: Create hooks definition**

Create `packages/cli/hooks/hooks.json`:
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

- [x] **Step 3: Update package.json files array**

In `packages/cli/package.json`, add `.claude-plugin` and `hooks` to the `files` array:
```json
"files": ["dist", ".claude-plugin", "hooks"]
```

- [x] **Step 4: Commit**

```bash
git add packages/cli/.claude-plugin packages/cli/hooks/hooks.json packages/cli/package.json
git commit -m "feat(cli): add Claude Code plugin manifest and hooks definition"
```

---

### Task 2: Session-Start Hook Script

**Files:**
- Create: `packages/cli/hooks/session-start`

- [x] **Step 1: Write the session-start script**

Create `packages/cli/hooks/session-start` (bash script). Reference the superpowers implementation at `/Users/umar/Desktop/Work/superpowers/hooks/session-start` for the JSON output format.

```bash
#!/usr/bin/env bash
set -euo pipefail

# Search upward for spec.config.yaml
dir="$PWD"
config_path=""
while [ "$dir" != "/" ]; do
  if [ -f "$dir/spec.config.yaml" ]; then
    config_path="$dir/spec.config.yaml"
    break
  fi
  dir="$(dirname "$dir")"
done

# No config found — exit silently (no output = no injection)
if [ -z "$config_path" ]; then
  exit 0
fi

# Run validate and graph, capture JSON output
validate_out=$(npx specdx validate --format json 2>/dev/null || echo '{"valid":false}')
graph_out=$(npx specdx graph --format json 2>/dev/null || echo '{"nodes":[],"edges":[]}')

# Build lightweight summary for session context
summary="specdx project detected. Config: $config_path. Validate: $validate_out. Graph: $graph_out. Use /specdx-start-task to load full spec context for a task."

# Escape for JSON
summary="${summary//\\/\\\\}"
summary="${summary//\"/\\\"}"
summary="${summary//$'\n'/\\n}"
summary="${summary//$'\r'/}"
summary="${summary//$'\t'/\\t}"

echo "{\"hookSpecificOutput\":{\"hookEventName\":\"SessionStart\",\"additionalContext\":\"$summary\"}}"
```

- [x] **Step 2: Make it executable**

```bash
chmod +x packages/cli/hooks/session-start
```

- [x] **Step 3: Test manually**

```bash
cd /Users/umar/Desktop/Projects/varley-sanity-audit && bash /Users/umar/Desktop/Work/sdx/packages/cli/hooks/session-start
```

Expected: JSON output with project info. Then test in a dir without `spec.config.yaml` — expected: no output.

- [x] **Step 4: Commit**

```bash
git add packages/cli/hooks/session-start
git commit -m "feat(cli): add session-start hook for auto-detecting specdx projects"
```

---

### Task 3: Improved Skill Descriptions

**Files:**
- Modify: `packages/skills/skills/specdx-start-task.md`
- Modify: `packages/skills/skills/specdx-author-spec.md`

- [x] **Step 1: Update specdx-start-task description**

In `packages/skills/skills/specdx-start-task.md`, change the `description` frontmatter field to:
```yaml
description: "Use when the user describes work they're about to do, mentions implementing a feature, asks to start a task, or says 'implement', 'build', 'add', 'fix', or 'refactor'. Loads relevant spec context before coding."
```

- [x] **Step 2: Update specdx-author-spec description**

In `packages/skills/skills/specdx-author-spec.md`, change the `description` frontmatter field to:
```yaml
description: "Use when the user wants to create a new spec, write a PRD, document a technical design, record an architecture decision, add a user story, or write a test plan. Guides spec authoring with iterative linting."
```

- [x] **Step 3: Commit**

```bash
git add packages/skills/skills/specdx-start-task.md packages/skills/skills/specdx-author-spec.md
git commit -m "feat(skills): use description-driven trigger conditions for auto-discovery"
```

---

### Task 4: Hard Gates & Rationalization Tables

**Files:**
- Modify: `packages/skills/skills/specdx-author-spec.md`

- [x] **Step 1: Add hard gate and rationalization table**

In `packages/skills/skills/specdx-author-spec.md`, add after the step 5 lint section:

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

- [x] **Step 2: Commit**

```bash
git add packages/skills/skills/specdx-author-spec.md
git commit -m "feat(skills): add hard gates and rationalization tables to author-spec"
```

---

### Task 5: Supporting Reference File

**Files:**
- Create: `packages/skills/skills/spec-type-reference.md`

- [x] **Step 1: Create reference file**

Create `packages/skills/skills/spec-type-reference.md` with a table of all spec types, their required sections, and frontmatter fields. Pull data from `REQUIRED_SECTIONS` in `packages/schema/src/types.ts`.

```markdown
# Spec Type Reference

## Frontmatter Fields (all types)

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| id | yes | string | Unique across spec suite |
| type | yes | SpecType | See types below |
| title | yes | string | Human-readable title |
| status | yes | "draft" \| "review" \| "approved" \| "superseded" | |
| version | yes | string | Semantic version |
| created | yes | string | ISO date, must be quoted in YAML |
| authors | yes | string[] | At least one entry |
| updated | no | string | ISO date |
| tags | no | string[] | Keywords for search/pack relevance |
| references | no | array | Cross-references to other specs |

## Required Sections by Type

| Type | Required Sections |
|------|-------------------|
| prd | Problem Statement, Goals, Non-Goals, Features, Success Criteria |
| technical-design | Overview, Architecture, Data Model, API Design, Dependencies, Risks, Open Questions |
| user-story | Description, Acceptance Criteria, Dependencies, Notes |
| test-plan | Scope, Test Cases, Coverage Matrix, Edge Cases |
| adr | Context, Decision, Status, Consequences |
| api-contract | Endpoints, Request/Response Schemas, Auth, Error Codes |

## References Format

```yaml
references:
  - id: "other-spec-id"
    relationship: "depends-on"  # implemented-by | decomposed-into | depends-on | supersedes | related-to
```
```

- [x] **Step 2: Verify it gets copied into dist**

```bash
pnpm --filter specdx build && ls packages/cli/dist/skills/spec-type-reference.md
```

Expected: file exists in dist/skills/.

- [x] **Step 3: Commit**

```bash
git add packages/skills/skills/spec-type-reference.md
git commit -m "feat(skills): add spec-type-reference companion file"
```

---

### Task 6: Multi-Platform Documentation

**Files:**
- Create: `docs/other-platforms.md`

- [x] **Step 1: Write documentation**

Create `docs/other-platforms.md` documenting how to manually set up specdx skills in Cursor and Gemini CLI. Cover: where to copy skill files, how to configure hooks, expected behaviour.

- [x] **Step 2: Commit**

```bash
git add -f docs/other-platforms.md
git commit -m "docs: add multi-platform setup guide for Cursor and Gemini CLI"
```

---

## Slice 2: Diff Engine + CLI

### Task 7: Add `parseSpecFromString` to `@specdx/core`

**Files:**
- Modify: `packages/core/src/parser.ts`
- Modify: `packages/core/src/index.ts`
- Create: `packages/core/src/parser-from-string.test.ts`

- [x] **Step 1: Write the failing test**

Create `packages/core/src/parser-from-string.test.ts`:
```typescript
import { parseSpecFromString } from "./parser.js";

describe("parseSpecFromString", () => {
  const validPrd = `---
id: prd
type: prd
title: "Test PRD"
status: draft
version: "0.1"
created: "2026-01-01"
authors: ["test"]
---

## Problem Statement

Test problem.

## Goals

Test goals.
`;

  it("parses valid markdown spec from string", async () => {
    const result = await parseSpecFromString(validPrd, "specs/prd.md");
    expect(result.filePath).toBe("specs/prd.md");
    expect(result.frontmatter.id).toBe("prd");
    expect(result.frontmatter.type).toBe("prd");
    expect(result.sections).toContain("Problem Statement");
    expect(result.sections).toContain("Goals");
    expect(result.valid).toBe(true);
  });

  it("returns parsedSections with token counts", async () => {
    const result = await parseSpecFromString(validPrd, "specs/prd.md");
    expect(result.parsedSections.length).toBeGreaterThan(0);
    expect(result.parsedSections[0]!.heading).toBe("Problem Statement");
    expect(result.parsedSections[0]!.tokens).toBeGreaterThan(0);
  });

  it("reports validation errors for invalid spec", async () => {
    const invalid = `---
id: bad
type: invalid-type
title: "Bad"
status: draft
version: "0.1"
created: "2026-01-01"
authors: ["test"]
---

## Content
`;
    const result = await parseSpecFromString(invalid, "specs/bad.md");
    expect(result.valid).toBe(false);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @specdx/core test -- --run src/parser-from-string.test.ts
```

Expected: FAIL — `parseSpecFromString` not exported.

- [x] **Step 3: Implement parseSpecFromString**

In `packages/core/src/parser.ts`, refactor the existing `parseSpec()` to delegate to a new `parseSpecFromString()`:

1. Extract the markdown parsing logic (everything after `readFile`) into `parseSpecFromString(content: string, filePath: string): Promise<ParsedSpec>`
2. Keep `parseSpec(filePath)` as a wrapper that reads the file and calls `parseSpecFromString()`

- [x] **Step 4: Export from index.ts**

Add `parseSpecFromString` to `packages/core/src/index.ts` exports.

- [x] **Step 5: Run test to verify it passes**

```bash
pnpm --filter @specdx/core test -- --run src/parser-from-string.test.ts
```

Expected: PASS

- [x] **Step 6: Run all core tests**

```bash
pnpm --filter @specdx/core test
```

Expected: all existing tests still pass (parseSpec behaviour unchanged).

- [x] **Step 7: Commit**

```bash
git add packages/core/src/parser.ts packages/core/src/index.ts packages/core/src/parser-from-string.test.ts
git commit -m "feat(core): add parseSpecFromString for parsing specs from string content"
```

---

### Task 8: Diff Package Scaffolding + Types

**Files:**
- Create: `packages/diff/src/types.ts`
- Create: `packages/diff/src/index.ts`
- Modify: `packages/diff/package.json`
- Modify: `packages/diff/tsconfig.json`

- [x] **Step 1: Add workspace dependencies to package.json**

In `packages/diff/package.json`, add:
```json
"dependencies": {
  "@specdx/core": "workspace:*",
  "@specdx/schema": "workspace:*",
  "diff": "^7.0.0"
}
```

- [x] **Step 2: Create types.ts**

Create `packages/diff/src/types.ts` with all interfaces from the design spec:

```typescript
import type { ParsedSpec } from "@specdx/core";

export interface SpecDiff {
  specId: string;
  filePath: string;
  frontmatter: FieldChange[];
  sections: SectionChange[];
  summary: string;
}

export type FieldChangeType = "added" | "removed" | "modified" | "broken-reference";

export interface FieldChange {
  field: string;
  type: FieldChangeType;
  before?: unknown;
  after?: unknown;
}

export interface SectionChange {
  heading: string;
  type: "added" | "removed" | "modified";
  contentDiff?: string;
}

export interface ImpactAnalysis {
  changedSpec: string;
  downstream: DownstreamImpact[];
  totalAffected: number;
}

export interface DownstreamImpact {
  specId: string;
  filePath: string;
  distance: number;
  lastUpdated: string | null;
  staleness: number;
  reason: string;
}

export interface DiffResult {
  diffs: SpecDiff[];
  added: string[];
  removed: string[];
  impact: ImpactAnalysis[];
  summary: string;
}

export interface StatusResult {
  project: string;
  specCount: number;
  byStatus: Record<string, number>;
  lintHealth: { errors: number; warnings: number; passing: number };
  staleSpecs: { specId: string; daysSinceUpdate: number; owner?: string }[];
  integrityIssues: string[];
  verdict: "healthy" | "warnings" | "errors";
}

export interface DiffConfig {
  baseline_ref: string;
  staleness_threshold_days: number;
  ignore_paths?: string[];
}

export const DEFAULT_DIFF_CONFIG: DiffConfig = {
  baseline_ref: "main",
  staleness_threshold_days: 14,
};
```

- [x] **Step 3: Create index.ts with placeholder exports**

Create `packages/diff/src/index.ts`:
```typescript
export type {
  SpecDiff,
  FieldChange,
  FieldChangeType,
  SectionChange,
  ImpactAnalysis,
  DownstreamImpact,
  DiffResult,
  StatusResult,
  DiffConfig,
} from "./types.js";
export { DEFAULT_DIFF_CONFIG } from "./types.js";
```

- [x] **Step 4: Install deps and build**

```bash
pnpm install && pnpm --filter @specdx/diff build
```

Expected: builds cleanly.

- [x] **Step 5: Commit**

```bash
git add packages/diff/
git commit -m "feat(diff): scaffold package with types and dependencies"
```

---

### Task 9: Structural Diff — `diffSpecs()`

**Files:**
- Create: `packages/diff/src/diff-specs.ts`
- Create: `packages/diff/src/diff-specs.test.ts`
- Modify: `packages/diff/src/index.ts`

- [x] **Step 1: Write failing tests**

Create `packages/diff/src/diff-specs.test.ts` with tests covering:
- Identical specs → empty diffs
- Modified frontmatter field (e.g. status changed) → `FieldChange` with type "modified"
- Added frontmatter field → `FieldChange` with type "added"
- Removed frontmatter field → `FieldChange` with type "removed"
- Added section → `SectionChange` with type "added"
- Removed section → `SectionChange` with type "removed"
- Modified section content → `SectionChange` with type "modified" and `contentDiff` populated
- Summary string generated

Use `parseSpecFromString()` to create `ParsedSpec` fixtures from string literals.

- [x] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @specdx/diff test -- --run src/diff-specs.test.ts
```

- [x] **Step 3: Implement diffSpecs()**

Create `packages/diff/src/diff-specs.ts`:
- Compare frontmatter field-by-field using `Object.keys()` on both before/after
- Match sections by heading name
- Use `createPatch()` from the `diff` package for content diffs on modified sections
- Generate summary string: "prd: 2 fields changed, 1 section modified"

- [x] **Step 4: Export from index.ts**

- [x] **Step 5: Run tests to verify they pass**

- [x] **Step 6: Commit**

```bash
git commit -m "feat(diff): implement diffSpecs for structural spec comparison"
```

---

### Task 10: Downstream Impact Analysis — `analyzeImpact()`

**Files:**
- Create: `packages/diff/src/impact.ts`
- Create: `packages/diff/src/impact.test.ts`
- Modify: `packages/diff/src/index.ts`

- [x] **Step 1: Write failing tests**

Create `packages/diff/src/impact.test.ts` with tests covering:
- Single downstream spec → returns 1 impact entry with correct distance
- Transitive downstream (A→B→C, A changed) → returns B (distance 1) and C (distance 2)
- Staleness score calculation: recently updated downstream → low score, stale downstream → high score
- Structural sections changed (Goals) → higher staleness than minor sections (Notes)
- No downstream specs → empty array, totalAffected 0

Build test dependency graphs using `buildGraph()` from `@specdx/core` with mock config objects.

- [x] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @specdx/diff test -- --run src/impact.test.ts
```

- [x] **Step 3: Implement analyzeImpact()**

Create `packages/diff/src/impact.ts`:
- Use `graph.getDownstream(changedSpecId)` for transitive dependents
- Calculate distance via BFS from changed spec
- Implement staleness formula from design spec:
  ```
  staleness = clamp(0, 1,
    (daysSinceUpdate / thresholdDays) * 0.5
    + (structuralSectionsChanged / totalSections) * 0.3
    + (1 / distance) * 0.2
  )
  ```
- Structural sections: Goals, Architecture, Features, Endpoints, Data Model, API Design
- Generate reason string from diff summary + distance

- [x] **Step 4: Export from index.ts**

- [x] **Step 5: Run tests to verify they pass**

- [x] **Step 6: Commit**

```bash
git commit -m "feat(diff): implement downstream impact analysis with staleness scoring"
```

---

### Task 11: Cross-Reference Impact

**Files:**
- Create: `packages/diff/src/cross-refs.ts`
- Create: `packages/diff/src/cross-refs.test.ts`
- Modify: `packages/diff/src/index.ts`

- [x] **Step 1: Write failing tests**

Tests covering:
- Spec removes a referenced ID → downstream spec with that reference flagged as "broken-reference"
- Spec renames ID (old removed, new added) → downstream refs to old ID flagged
- No cross-reference breakage → empty result

- [x] **Step 2: Run tests to verify they fail**

- [x] **Step 3: Implement checkCrossReferences()**

Scan `frontmatter.references` of all specs in the suite. For each reference, check if the target ID still exists. If a spec was removed or its ID changed, flag as broken.

- [x] **Step 4: Export from index.ts**

- [x] **Step 5: Run tests to verify they pass**

- [x] **Step 6: Commit**

```bash
git commit -m "feat(diff): detect broken cross-references from upstream changes"
```

---

### Task 12: Git Integration — `diffBetweenRefs()`

**Files:**
- Create: `packages/diff/src/git.ts`
- Create: `packages/diff/src/git.test.ts`
- Modify: `packages/diff/src/index.ts`

- [x] **Step 1: Write failing tests**

Create `packages/diff/src/git.test.ts`. Tests use a temporary git repo:

```typescript
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

// beforeEach: create tmp dir, git init, write spec.config.yaml + spec files, commit as "base"
// Then modify specs, commit as "head"
// Test: diffBetweenRefs(configPath, "base-tag", "head-tag") returns expected diffs
```

Tests covering:
- Modified spec between refs → `SpecDiff` with changes
- Added spec (exists at head, not base) → in `DiffResult.added`
- Removed spec (exists at base, not head) → in `DiffResult.removed`
- No changes → empty diffs
- Invalid ref → throws `DiffError`
- No git binary → throws `DiffError` (mock `execSync`)

- [x] **Step 2: Run tests to verify they fail**

- [x] **Step 3: Create DiffError class**

In `packages/diff/src/types.ts`, add:
```typescript
export class DiffError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiffError";
  }
}
```

- [x] **Step 4: Implement git.ts**

Create `packages/diff/src/git.ts`:
- `getSpecContentAtRef(ref: string, filePath: string): string` — runs `git show <ref>:<path>`, throws DiffError on failure
- `getChangedFiles(baseRef: string, headRef: string): {added: string[], modified: string[], deleted: string[]}` — runs `git diff --name-status`
- `diffBetweenRefs(configPath, baseRef, headRef): Promise<DiffResult>` — orchestrates: load config, detect changed spec files, parse before/after with `parseSpecFromString()`, run `diffSpecs()` on each, run `analyzeImpact()`, aggregate into `DiffResult`
- For working tree diffs (no headRef), use filesystem `parseSpec()` for head

- [x] **Step 5: Export from index.ts**

- [x] **Step 6: Run tests to verify they pass**

- [x] **Step 7: Run all diff tests**

```bash
pnpm --filter @specdx/diff test
```

- [x] **Step 8: Commit**

```bash
git commit -m "feat(diff): implement git-based diffing between refs"
```

---

### Task 13: Config Schema Extension — `diff` Block

**Files:**
- Modify: `packages/schema/src/schemas/config.json`
- Modify: `packages/schema/src/types.ts`

- [x] **Step 1: Write failing test**

In the existing schema tests, add a test that validates a config with a `diff` block containing `baseline_ref`, `staleness_threshold_days`, and `ignore_paths`.

- [x] **Step 2: Run test to verify it fails**

- [x] **Step 3: Update JSON schema**

In `packages/schema/src/schemas/config.json`, replace the `diff` placeholder:
```json
"diff": {
  "type": "object",
  "properties": {
    "baseline_ref": { "type": "string", "default": "main" },
    "staleness_threshold_days": { "type": "integer", "minimum": 1, "default": 14 },
    "ignore_paths": { "type": "array", "items": { "type": "string" } }
  },
  "additionalProperties": false
}
```

- [x] **Step 4: Update TypeScript types**

In `packages/schema/src/types.ts`, replace the `diff` field type:
```typescript
diff?: {
  baseline_ref?: string;
  staleness_threshold_days?: number;
  ignore_paths?: string[];
};
```

- [x] **Step 5: Run tests to verify they pass**

- [x] **Step 6: Commit**

```bash
git commit -m "feat(schema): add diff config block with baseline_ref and staleness options"
```

---

### Task 14: CLI — `sdx diff` Command

**Files:**
- Create: `packages/cli/src/commands/diff.ts`
- Modify: `packages/cli/src/main.ts`
- Modify: `packages/cli/src/index.ts`
- Modify: `packages/cli/tsup.config.ts`

- [x] **Step 1: Add @specdx/diff to CLI tsup noExternal**

In `packages/cli/tsup.config.ts`, add `"@specdx/diff"` to both `noExternal` arrays.

- [x] **Step 2: Create diff command**

Create `packages/cli/src/commands/diff.ts` following the pattern of `lint.ts` and `pack.ts`:

```typescript
import { defineCommand } from "citty";
import { loadConfig, parseSpec, buildGraph, resolveGlob, createLogger } from "@specdx/core";
import { diffBetweenRefs, DEFAULT_DIFF_CONFIG } from "@specdx/diff";
import type { DiffResult } from "@specdx/diff";

export async function runDiff(options: {
  base?: string;
  head?: string;
  spec?: string;
  format?: string;
}): Promise<DiffResult> {
  // Load config, resolve diff options, call diffBetweenRefs
}

export default defineCommand({
  meta: { name: "diff", description: "Show spec changes and downstream impact" },
  args: {
    base: { type: "string", description: "Base git ref (default: diff.baseline_ref or 'main')" },
    head: { type: "string", description: "Head git ref (default: working tree)" },
    spec: { type: "string", description: "Scope to a single spec ID" },
    format: { type: "string", description: "Output format: pretty, json, github", default: "pretty" },
  },
  async run({ args }) {
    // Call runDiff, format output, exit
  },
});
```

- [x] **Step 3: Register in main.ts**

Add `diff` to the `subCommands` map in `packages/cli/src/main.ts`:
```typescript
diff: () => import("./commands/diff.js").then((m) => m.default),
```

- [x] **Step 4: Export runDiff from index.ts**

- [x] **Step 5: Build and test**

```bash
pnpm build && node packages/cli/dist/main.js diff --help
```

- [x] **Step 6: Commit**

```bash
git commit -m "feat(cli): add sdx diff command"
```

---

### Task 15: CLI — `sdx status` Command

**Files:**
- Create: `packages/cli/src/commands/status.ts`
- Modify: `packages/cli/src/main.ts`
- Modify: `packages/cli/src/index.ts`

- [x] **Step 1: Create status command**

Create `packages/cli/src/commands/status.ts`:

```typescript
export async function runStatus(options: { format?: string }): Promise<StatusResult> {
  // 1. loadConfig()
  // 2. Resolve and parse all specs
  // 3. Run lint engine, count errors/warnings/passing
  // 4. Calculate staleness per spec (daysSinceUpdate from frontmatter.updated or frontmatter.created)
  // 5. Check dependency integrity (buildGraph, look for broken refs)
  // 6. Determine verdict: "errors" if lint errors, "warnings" if warnings or stale specs, "healthy" otherwise
  // 7. Return StatusResult
}
```

- [x] **Step 2: Register in main.ts**

- [x] **Step 3: Build and test**

```bash
pnpm build && node packages/cli/dist/main.js status
```

- [x] **Step 4: Commit**

```bash
git commit -m "feat(cli): add sdx status command for spec health overview"
```

---

## Slice 3: Diff-Powered Features

### Task 16: Skill — `specdx-pre-commit`

**Files:**
- Create: `packages/skills/skills/specdx-pre-commit.md`

- [x] **Step 1: Write skill file**

Create `packages/skills/skills/specdx-pre-commit.md` with frontmatter and workflow from the design spec. Include:
- `name: specdx-pre-commit`
- `description: "Use when the user is about to commit, mentions committing, or says 'let's commit', 'ready to commit', 'wrap up'. Checks spec health before committing."`
- `allowed-tools: Bash(npx specdx *)`
- Hard gate: do NOT skip the diff step
- Workflow steps (lint → diff → present summary → ask user)

- [x] **Step 2: Commit**

```bash
git add packages/skills/skills/specdx-pre-commit.md
git commit -m "feat(skills): add specdx-pre-commit skill"
```

---

### Task 17: Skill — `specdx-sprint-review`

**Files:**
- Create: `packages/skills/skills/specdx-sprint-review.md`

- [x] **Step 1: Write skill file**

Create with frontmatter, workflow (status → diff → synthesise report), and output format guidance.

- [x] **Step 2: Commit**

```bash
git add packages/skills/skills/specdx-sprint-review.md
git commit -m "feat(skills): add specdx-sprint-review skill"
```

---

### Task 18: Skill — `specdx-plan-from-spec`

**Files:**
- Create: `packages/skills/skills/specdx-plan-from-spec.md`

- [x] **Step 1: Write skill file**

Create with frontmatter, workflow (pack → generate plan with file targets, dependency order, test expectations, spec references). Note compatibility with superpowers `writing-plans` skill.

- [x] **Step 2: Commit**

```bash
git add packages/skills/skills/specdx-plan-from-spec.md
git commit -m "feat(skills): add specdx-plan-from-spec skill"
```

---

### Task 19: Update SKILL_NAMES + Install Tests

**Files:**
- Modify: `packages/skills/src/install.ts`
- Modify: `packages/skills/src/install.test.ts`

- [x] **Step 1: Update SKILL_NAMES**

In `packages/skills/src/install.ts`, update:
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

Note: `specdx-onboard` is listed here but created in Task 24. The install test for it will fail until Task 24 is complete. Either create a placeholder file or add `specdx-onboard` to `SKILL_NAMES` in Task 24 instead.

- [x] **Step 2: Update install tests**

Update `packages/skills/src/install.test.ts`:
- Change `toHaveLength(2)` to `toHaveLength(6)` (or 5 if deferring onboard)
- Add expectations for new skill names
- Update installed/updated count expectations

- [x] **Step 3: Run tests**

```bash
pnpm --filter @specdx/skills test
```

- [x] **Step 4: Commit**

```bash
git commit -m "feat(skills): register new skills in SKILL_NAMES and update install tests"
```

---

## Slice 4: GitHub Action + CI

### Task 20: Config Schema Extension — `ci` Block

**Files:**
- Modify: `packages/schema/src/schemas/config.json`
- Modify: `packages/schema/src/types.ts`

- [x] **Step 1: Update JSON schema**

Replace the `ci` placeholder in `packages/schema/src/schemas/config.json`:
```json
"ci": {
  "type": "object",
  "properties": {
    "block_on": { "type": "array", "items": { "type": "string", "enum": ["error", "warn", "info"] } },
    "post_comment": { "type": "boolean", "default": true },
    "update_badge": { "type": "boolean", "default": true },
    "trigger_paths": { "type": "array", "items": { "type": "string" } }
  },
  "additionalProperties": false
}
```

- [x] **Step 2: Update TypeScript types**

In `packages/schema/src/types.ts`:
```typescript
ci?: {
  block_on?: ("error" | "warn" | "info")[];
  post_comment?: boolean;
  update_badge?: boolean;
  trigger_paths?: string[];
};
```

- [x] **Step 3: Run schema tests**

```bash
pnpm --filter @specdx/schema test
```

- [x] **Step 4: Commit**

```bash
git commit -m "feat(schema): add ci config block with trigger_paths and block_on"
```

---

### Task 21: GitHub Action — Entry Point

**Files:**
- Modify: `packages/github-action/package.json`
- Create: `packages/github-action/src/main.ts`
- Create: `packages/github-action/action.yml`

- [x] **Step 1: Update package.json**

Add dependencies:
```json
"dependencies": {
  "@actions/core": "^1.10.0",
  "@actions/github": "^6.0.0",
  "@specdx/core": "workspace:*",
  "@specdx/lint": "workspace:*",
  "@specdx/diff": "workspace:*",
  "@specdx/schema": "workspace:*"
},
"devDependencies": {
  "@vercel/ncc": "^0.38.0",
  "typescript": "^5.7.0"
}
```

Change build script to: `"build": "ncc build src/main.ts -o dist"`

- [x] **Step 2: Create action.yml**

```yaml
name: "specdx"
description: "Lint and diff specs on pull requests"
inputs:
  working-directory:
    description: "Directory containing spec.config.yaml"
    default: "."
runs:
  using: "node20"
  main: "dist/index.js"
```

- [x] **Step 3: Implement main.ts**

Create `packages/github-action/src/main.ts`:
- Read inputs from `@actions/core`
- Load config from working directory
- Check trigger paths against changed files (use `@actions/github` to get PR files)
- Run lint, run diff
- Post comment (delegate to comment.ts)
- Emit annotations
- Set exit code based on `ci.block_on`

- [x] **Step 4: Build and verify**

```bash
pnpm --filter @specdx/action build && ls packages/github-action/dist/index.js
```

- [x] **Step 5: Commit**

```bash
git commit -m "feat(action): implement GitHub Action entry point with lint + diff"
```

---

### Task 22: GitHub Action — PR Comment Formatter

**Files:**
- Create: `packages/github-action/src/comment.ts`
- Create: `packages/github-action/src/comment.test.ts`

- [x] **Step 1: Write failing tests**

Test that `formatComment()` produces expected markdown given mock lint diagnostics and diff results.

- [x] **Step 2: Implement comment.ts**

Format as per design spec: Spec Health Report header, lint summary, changes table, downstream impact table, footer.

- [x] **Step 3: Run tests**

- [x] **Step 4: Commit**

```bash
git commit -m "feat(action): add PR comment formatter"
```

---

### Task 23: GitHub Action — Health Badge

**Files:**
- Create: `packages/github-action/src/badge.ts`
- Create: `packages/github-action/src/badge.test.ts`

- [x] **Step 1: Write failing tests**

Test `generateBadge()` returns valid SVG for each state: passing (green), warnings (yellow), failing (red).

- [x] **Step 2: Implement badge.ts**

Generate shields.io-compatible SVG badge. Three states based on lint results.

- [x] **Step 3: Run tests**

- [x] **Step 4: Commit**

```bash
git commit -m "feat(action): add health badge SVG generator"
```

---

## Slice 5: Team Features

### Task 24: Schema Migration — `extends` + `owner`

**Files:**
- Modify: `packages/schema/src/types.ts`
- Modify: `packages/schema/src/schemas/config.json`

- [x] **Step 1: Widen lint.extends type**

In `packages/schema/src/types.ts`, change:
```typescript
// Before
extends?: "minimal" | "recommended" | "strict";
// After
extends?: string;
```

In `packages/schema/src/schemas/config.json`, change `lint.extends`:
```json
"extends": { "type": "string" }
```

- [x] **Step 2: Add owner to SpecEntry**

In `packages/schema/src/types.ts`, add to `SpecEntry`:
```typescript
owner?: string;
```

In config.json, add to spec entry properties:
```json
"owner": { "type": "string" }
```

- [x] **Step 3: Run all schema tests**

```bash
pnpm --filter @specdx/schema test
```

- [x] **Step 4: Commit**

```bash
git commit -m "feat(schema): widen lint.extends to string, add owner to SpecEntry"
```

---

### Task 25: Shared Config Presets — `resolvePreset()`

**Files:**
- Create: `packages/core/src/preset.ts`
- Create: `packages/core/src/preset.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/lint/src/presets.ts`

- [x] **Step 1: Write failing tests**

Tests for `resolvePreset()`:
- Built-in name ("recommended") → returns null (handled by lint's getPreset)
- Local file path ("./my-config.yaml") → loads and returns parsed config
- npm package name ("@specdx/config-strict") → resolves via import (mock for test)

- [x] **Step 2: Implement resolvePreset()**

```typescript
export async function resolvePreset(name: string): Promise<Record<string, unknown> | null> {
  const builtins = ["minimal", "recommended", "strict"];
  if (builtins.includes(name)) return null;
  // Try local path
  // Try npm package require.resolve
  // Throw ConfigError if not found
}
```

- [x] **Step 3: Update getPreset() in lint**

In `packages/lint/src/presets.ts`, add fallback to `resolvePreset()` when name is not a built-in.

- [x] **Step 4: Run tests**

- [x] **Step 5: Commit**

```bash
git commit -m "feat(core): add resolvePreset for external config packages"
```

---

### Task 26: CLI — `sdx changelog` Command

**Files:**
- Create: `packages/cli/src/commands/changelog.ts`
- Modify: `packages/cli/src/main.ts`

- [x] **Step 1: Create changelog command**

Thin wrapper: parse `--from` and `--to` args, call `diffBetweenRefs()`, format as markdown changelog (Modified/Added/Removed sections with version info from frontmatter).

- [x] **Step 2: Register in main.ts**

- [x] **Step 3: Build and test**

```bash
pnpm build && node packages/cli/dist/main.js changelog --help
```

- [x] **Step 4: Commit**

```bash
git commit -m "feat(cli): add sdx changelog command"
```

---

### Task 27: CLI — `sdx explain` Command

**Files:**
- Create: `packages/cli/src/commands/explain.ts`
- Modify: `packages/cli/src/main.ts`

- [x] **Step 1: Create explain command**

Compose existing functions: `loadConfig()`, parse all specs, `buildGraph()`, run lint health check. Format as human-readable summary: project name, spec count by type/status, dependency tree, brief description per spec, health verdict.

- [x] **Step 2: Register in main.ts**

- [x] **Step 3: Build and test**

```bash
pnpm build && node packages/cli/dist/main.js explain
```

- [x] **Step 4: Commit**

```bash
git commit -m "feat(cli): add sdx explain command for onboarding"
```

---

### Task 28: Skill — `specdx-onboard`

**Files:**
- Create: `packages/skills/skills/specdx-onboard.md`

- [x] **Step 1: Write skill file**

Create with frontmatter:
- `name: specdx-onboard`
- `description: "Use when a new developer joins the project, asks 'what is this project', 'explain the specs', 'how does this codebase work', or wants an overview of the spec suite."`
- `allowed-tools: Bash(npx specdx *)`
- Workflow: explain → pack → walk through → invite questions

- [x] **Step 2: Run install tests**

```bash
pnpm --filter @specdx/skills test
```

All 6 skills should now be installable.

- [x] **Step 3: Commit**

```bash
git add packages/skills/skills/specdx-onboard.md
git commit -m "feat(skills): add specdx-onboard skill"
```

---

## Final Verification

### Task 29: Full Build + Test Suite

- [x] **Step 1: Build all packages**

```bash
pnpm build
```

Expected: all 8 packages build successfully.

- [x] **Step 2: Run all tests**

```bash
pnpm test
```

Expected: all tests pass, 80%+ coverage on `@specdx/diff`.

- [x] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: no type errors.

- [x] **Step 4: Run lint and format**

```bash
pnpm lint:code && pnpm format:check
```

Expected: clean.

- [x] **Step 5: Test skills install**

```bash
node packages/cli/dist/main.js skills install --dir /tmp/sdx-test
ls /tmp/sdx-test/.claude/commands/
```

Expected: 6 skill files installed.

- [x] **Step 6: End-to-end smoke test**

```bash
cd /Users/umar/Desktop/Projects/varley-sanity-audit
node /Users/umar/Desktop/Work/sdx/packages/cli/dist/main.js status
node /Users/umar/Desktop/Work/sdx/packages/cli/dist/main.js diff
node /Users/umar/Desktop/Work/sdx/packages/cli/dist/main.js explain
```

- [x] **Step 7: Commit any final fixes**
