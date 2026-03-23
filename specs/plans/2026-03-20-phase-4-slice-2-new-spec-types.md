# Phase 4 Slice 2 — New Spec Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three new spec types — `epic`, `quick-spec`, and `project-context` — with schema validation, lint rules, pack support, and init templates.

**Architecture:** Changes span 4 packages: `@specdx/schema` (types, JSON schemas, sections), `@specdx/lint` (new rule + rule registration), `@specdx/pack` (project-context reserved allocation), and the CLI (init templates). Each spec type is self-contained; project-context has the most integration surface due to pack changes.

**Tech Stack:** TypeScript (ESM only), Vitest, AJV (JSON Schema validation), citty (CLI)

**Design spec:** `specs/designs/2026-03-20-phase-4-spec-intelligence-design.md` (Slice 2 section)

---

## File Structure

```
packages/schema/src/types.ts                    # MODIFY: add 3 types to SPEC_TYPES, add interfaces
packages/schema/src/sections.ts                 # MODIFY: add required sections for 3 new types
packages/schema/src/schemas/epic.json           # CREATE: JSON schema for epic
packages/schema/src/schemas/quick-spec.json     # CREATE: JSON schema for quick-spec
packages/schema/src/schemas/project-context.json # CREATE: JSON schema for project-context
packages/schema/src/schemas/base-spec.json      # MODIFY: add new types to type enum
packages/schema/src/validator.ts                # MODIFY: register new schemas (if needed)
packages/schema/src/index.ts                    # MODIFY: export new types

packages/lint/src/rules/single-project-context.ts       # CREATE: new lint rule
packages/lint/src/rules/single-project-context.test.ts  # CREATE: tests
packages/lint/src/rules/index.ts                        # MODIFY: register new rule

packages/pack/src/index.ts                      # MODIFY: project-context reserved allocation
packages/pack/src/allocator.ts                  # MODIFY: accept reserved specs parameter

packages/cli/src/commands/init.ts               # MODIFY: add quick and context templates
packages/cli/src/commands/init.test.ts          # MODIFY: add tests for new templates
```

---

## Task 1: Add Spec Types to Schema

**Files:**
- Modify: `packages/schema/src/types.ts`
- Modify: `packages/schema/src/sections.ts`
- Modify: `packages/schema/src/index.ts`

- [x] **Step 1: Add new types to SPEC_TYPES array**

In `packages/schema/src/types.ts`, add `"epic"`, `"quick-spec"`, `"project-context"` to the `SPEC_TYPES` array:

```typescript
export const SPEC_TYPES = [
  "prd",
  "technical-design",
  "user-story",
  "test-plan",
  "adr",
  "api-contract",
  "epic",
  "quick-spec",
  "project-context",
] as const;
```

- [x] **Step 2: Add type interfaces**

After the existing `ApiContractSpec` interface, add:

```typescript
export interface EpicSpec extends BaseSpec {
  type: "epic";
  epic_id: string;
  priority: "critical" | "high" | "medium" | "low";
}

export interface QuickSpecSpec extends BaseSpec {
  type: "quick-spec";
}

export interface ProjectContextSpec extends BaseSpec {
  type: "project-context";
}
```

Update the `Spec` union type:

```typescript
export type Spec =
  | PrdSpec
  | TechnicalDesignSpec
  | UserStorySpec
  | TestPlanSpec
  | AdrSpec
  | ApiContractSpec
  | EpicSpec
  | QuickSpecSpec
  | ProjectContextSpec;
```

- [x] **Step 3: Add required sections**

In `packages/schema/src/sections.ts`, add entries for the 3 new types:

```typescript
export const REQUIRED_SECTIONS: Record<SpecType, string[]> = {
  // ... existing entries ...
  epic: ["Overview", "Stories", "Acceptance Criteria", "Dependencies"],
  "quick-spec": ["Intent", "Boundaries", "Tasks"],
  "project-context": ["Technology Stack", "Critical Implementation Rules", "Coding Patterns"],
};
```

- [x] **Step 4: Export new types from index.ts**

In `packages/schema/src/index.ts`, add to the export block:

```typescript
  type EpicSpec,
  type QuickSpecSpec,
  type ProjectContextSpec,
```

- [x] **Step 5: Run schema tests**

```bash
pnpm --filter @specdx/schema test
```

- [x] **Step 6: Commit**

```bash
git add packages/schema/src/
git commit -m "feat(schema): add epic, quick-spec, and project-context spec types"
```

---

## Task 2: JSON Schemas for New Types

**Files:**
- Create: `packages/schema/src/schemas/epic.json`
- Create: `packages/schema/src/schemas/quick-spec.json`
- Create: `packages/schema/src/schemas/project-context.json`
- Modify: `packages/schema/src/schemas/base-spec.json`
- Modify: `packages/schema/src/validator.ts` (if it loads schemas by name)

- [x] **Step 1: Update base-spec.json type enum**

In `packages/schema/src/schemas/base-spec.json`, find the `type` property's `enum` array and add `"epic"`, `"quick-spec"`, `"project-context"`. Read the file first to see the exact structure.

- [x] **Step 2: Create epic.json**

```json
{
  "$id": "epic",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "allOf": [
    { "$ref": "base-spec" },
    {
      "type": "object",
      "properties": {
        "type": { "const": "epic" },
        "epic_id": { "type": "string", "minLength": 1 },
        "priority": { "type": "string", "enum": ["critical", "high", "medium", "low"] }
      },
      "required": ["type", "epic_id", "priority"]
    }
  ]
}
```

- [x] **Step 3: Create quick-spec.json**

```json
{
  "$id": "quick-spec",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "allOf": [
    { "$ref": "base-spec" },
    {
      "type": "object",
      "properties": {
        "type": { "const": "quick-spec" }
      },
      "required": ["type"]
    }
  ]
}
```

- [x] **Step 4: Create project-context.json**

```json
{
  "$id": "project-context",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "allOf": [
    { "$ref": "base-spec" },
    {
      "type": "object",
      "properties": {
        "type": { "const": "project-context" }
      },
      "required": ["type"]
    }
  ]
}
```

- [x] **Step 5: Register new schemas in validator**

In `packages/schema/src/validator.ts`, add three imports after the existing schema imports (line 11):

```typescript
import epicSchema from "./schemas/epic.json" with { type: "json" };
import quickSpecSchema from "./schemas/quick-spec.json" with { type: "json" };
import projectContextSchema from "./schemas/project-context.json" with { type: "json" };
```

Then add three entries to the `specValidators` record (after line 36):

```typescript
  epic: ajv.compile(epicSchema),
  "quick-spec": ajv.compile(quickSpecSchema),
  "project-context": ajv.compile(projectContextSchema),
```

- [x] **Step 6: Write validation tests**

Add tests to the existing schema test file (read it first to see the pattern) that validate:
- A valid epic spec passes validation
- A valid quick-spec passes validation
- A valid project-context passes validation
- An epic missing `epic_id` fails validation

- [x] **Step 7: Run tests**

```bash
pnpm --filter @specdx/schema test
```

- [x] **Step 8: Commit**

```bash
git add packages/schema/src/schemas/ packages/schema/src/validator.ts
git commit -m "feat(schema): add JSON schemas for epic, quick-spec, project-context"
```

---

## Task 3: Single Project-Context Lint Rule

**Files:**
- Create: `packages/lint/src/rules/single-project-context.ts`
- Create: `packages/lint/src/rules/single-project-context.test.ts`
- Modify: `packages/lint/src/rules/index.ts`

- [x] **Step 1: Write failing test**

`packages/lint/src/rules/single-project-context.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { singleProjectContextRule } from "./single-project-context.js";
import type { ParsedSpec } from "@specdx/core";

const makeSpec = (id: string, type: string): ParsedSpec => ({
  filePath: `specs/${id}.md`,
  frontmatter: { id, type, title: id, status: "draft", version: "1.0", created: "2026-01-01", authors: ["dev"] },
  content: "",
  sections: [],
  parsedSections: [],
  valid: true,
  validationErrors: null,
});

describe("singleProjectContextRule", () => {
  it("passes when there is exactly one project-context", () => {
    const specs = [makeSpec("ctx", "project-context"), makeSpec("prd", "prd")];
    const result = singleProjectContextRule.run({
      spec: specs[0]!,
      allSpecs: specs,
    });
    expect(result).toHaveLength(0);
  });

  it("warns when there are multiple project-context specs", () => {
    const specs = [
      makeSpec("ctx-1", "project-context"),
      makeSpec("ctx-2", "project-context"),
      makeSpec("prd", "prd"),
    ];
    const result = singleProjectContextRule.run({
      spec: specs[0]!,
      allSpecs: specs,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe("warn");
    expect(result[0]!.message).toContain("project-context");
  });

  it("passes when there are no project-context specs", () => {
    const specs = [makeSpec("prd", "prd")];
    const result = singleProjectContextRule.run({
      spec: specs[0]!,
      allSpecs: specs,
    });
    expect(result).toHaveLength(0);
  });

  it("only runs on project-context specs (skips other types)", () => {
    const specs = [
      makeSpec("ctx-1", "project-context"),
      makeSpec("ctx-2", "project-context"),
      makeSpec("prd", "prd"),
    ];
    const result = singleProjectContextRule.run({
      spec: specs[2]!,
      allSpecs: specs,
    });
    expect(result).toHaveLength(0);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @specdx/lint test
```

- [x] **Step 3: Implement the rule**

`packages/lint/src/rules/single-project-context.ts`:

```typescript
import type { LintRule } from "../types.js";

export const singleProjectContextRule: LintRule = {
  id: "structure/single-project-context",
  description: "Only one project-context spec should exist per suite",
  severity: "warn",
  run(context) {
    if (context.spec.frontmatter.type !== "project-context") return [];

    const contextSpecs = context.allSpecs.filter(
      (s) => s.frontmatter.type === "project-context",
    );

    if (contextSpecs.length > 1) {
      return [
        {
          ruleId: "structure/single-project-context",
          severity: "warn" as const,
          message: `Multiple project-context specs found (${contextSpecs.length}). Only one should exist per suite.`,
          filePath: context.spec.filePath,
        },
      ];
    }

    return [];
  },
};
```

- [x] **Step 4: Register the rule**

In `packages/lint/src/rules/index.ts`:

1. Import: `import { singleProjectContextRule } from "./single-project-context.js";`
2. Add to `structureRules` array: `singleProjectContextRule,`
3. Add to the named exports at the bottom

- [x] **Step 5: Run tests**

```bash
pnpm --filter @specdx/lint test
```

- [x] **Step 6: Commit**

```bash
git add packages/lint/src/rules/
git commit -m "feat(lint): add single-project-context rule"
```

---

## Task 4: Project-Context Pack Support

**Files:**
- Modify: `packages/pack/src/index.ts`

- [x] **Step 1: Write failing test**

Add a test to the existing pack test file that verifies project-context specs are always included first and get reserved token allocation. Read the existing test file first to understand the pattern.

The test should verify:
- A project-context spec is included even when it has zero relevance score
- It appears first in the output
- It reduces the available budget for other specs

- [x] **Step 2: Run test to verify it fails**

- [x] **Step 3: Implement project-context reservation in pack()**

In `packages/pack/src/index.ts`, modify the `pack()` function:

1. Before the resolve step, find any project-context specs in the input
2. If found, remove them from the regular scoring pipeline
3. Allocate them at full fidelity (no compression) with a reserved budget (default 2000 tokens, or configurable via `packConfig`)
4. Reduce the remaining budget by the reserved amount
5. Run the regular resolve → allocate pipeline on the remaining specs
6. Prepend the project-context specs to the final output

The key change is between lines 80-95 of `packages/pack/src/index.ts`:

```typescript
// NEW: Extract project-context specs and reserve budget
const projectContextSpecs: ParsedSpec[] = [];
const regularSpecs: ParsedSpec[] = [];
for (const spec of specs) {
  if (spec.frontmatter.type === "project-context") {
    projectContextSpecs.push(spec);
  } else {
    regularSpecs.push(spec);
  }
}

let reservedTokens = 0;
let reservedCompressed: CompressedSpec[] = [];
if (projectContextSpecs.length > 0) {
  // Allocate project-context at full fidelity with a capped budget
  // Cap prevents a huge project-context from consuming the entire budget
  const maxReserved = Math.min(budget, 2000); // default cap: 2000 tokens
  const ctxScores = projectContextSpecs.map((s) => ({
    specId: s.frontmatter.id,
    score: 1.0,
    rawScore: 1.0,
    matchedKeywords: [] as string[],
    graphBoosted: false,
  }));
  const ctxResult = allocate(projectContextSpecs, ctxScores, {
    budget: maxReserved,
    full: true,     // no compression for project-context
    compression,
  });
  reservedCompressed = ctxResult.specs;
  reservedTokens = ctxResult.stats.used;
}

// Regular pipeline with reduced budget
const regularBudget = Math.max(0, budget - reservedTokens);

// Build spec map for resolver (regular specs only)
const specMap = new Map<string, ParsedSpec>();
for (const spec of regularSpecs) {
  specMap.set(spec.frontmatter.id, spec);
}

const scores = options.specs
  ? scoreSpecsByIds(specMap, options.specs, resolvedGraph)
  : scoreSpecs(specMap, options.task, resolvedGraph);

const { specs: compressedSpecs, stats } = allocate(regularSpecs, scores, {
  budget: regularBudget,
  full,
  compression,
});

// Combine: project-context first, then regular
const allCompressed = [...reservedCompressed, ...compressedSpecs];

// Update stats
stats.budget = budget;
stats.used += reservedTokens;
stats.specsIncluded += reservedCompressed.length;
```

- [x] **Step 4: Run tests**

```bash
pnpm --filter @specdx/pack test
```

- [x] **Step 5: Commit**

```bash
git add packages/pack/src/
git commit -m "feat(pack): reserve token allocation for project-context specs"
```

---

## Task 5: Init Templates for New Types

**Files:**
- Modify: `packages/cli/src/commands/init.ts`
- Modify: `packages/cli/src/commands/init.test.ts`

- [x] **Step 1: Add new templates**

In `packages/cli/src/commands/init.ts`:

1. Update the `Template` type: `export type Template = "lightweight" | "bmad" | "api-first" | "quick" | "context";`

2. Add to `TEMPLATE_SPECS`:

```typescript
  quick: [
    { filename: "quick-spec.md", type: "quick-spec" },
  ],
  context: [
    { filename: "project-context.md", type: "project-context" },
  ],
```

3. Add to `TEMPLATE_EXTRA_DIRS`:

```typescript
  quick: [],
  context: [],
```

4. Update the `validTemplates` array in the `run()` function to include `"quick"` and `"context"`.

- [x] **Step 2: Write tests**

Add to `packages/cli/src/commands/init.test.ts`:

```typescript
it("scaffolds a quick-spec project", async () => {
  await scaffoldProject({ projectName: "quick-project", template: "quick", targetDir: tempDir });
  const files = await readdir(join(tempDir, "specs"));
  expect(files).toContain("quick-spec.md");
  const content = await readFile(join(tempDir, "specs/quick-spec.md"), "utf-8");
  expect(content).toContain("type: quick-spec");
  expect(content).toContain("## Intent");
  expect(content).toContain("## Boundaries");
  expect(content).toContain("## Tasks");
});

it("scaffolds a context project", async () => {
  await scaffoldProject({ projectName: "ctx-project", template: "context", targetDir: tempDir });
  const files = await readdir(join(tempDir, "specs"));
  expect(files).toContain("project-context.md");
  const content = await readFile(join(tempDir, "specs/project-context.md"), "utf-8");
  expect(content).toContain("type: project-context");
  expect(content).toContain("## Technology Stack");
});
```

- [x] **Step 3: Run tests**

```bash
pnpm build && pnpm --filter specdx test
```

- [x] **Step 4: Commit**

```bash
git add packages/cli/src/commands/init.ts packages/cli/src/commands/init.test.ts
git commit -m "feat(cli): add quick and context init templates for new spec types"
```

---

## Task 6: Full Integration Test + Cleanup

- [x] **Step 1: Build all packages**

```bash
pnpm build
```

- [x] **Step 2: Run full test suite**

```bash
pnpm test
```

- [x] **Step 3: Run typecheck and lint**

```bash
pnpm typecheck && pnpm lint:code
```

- [x] **Step 4: Smoke test — create a project-context spec**

```bash
node packages/cli/dist/main.js init --name test-ctx --template context --dir /tmp/sdx-ctx-test
node packages/cli/dist/main.js validate --dir /tmp/sdx-ctx-test
```

- [x] **Step 5: Smoke test — lint with project-context**

```bash
node packages/cli/dist/main.js lint --dir /tmp/sdx-ctx-test
```

- [x] **Step 6: Commit final changes (if any fixes needed)**

```bash
git add -A
git commit -m "feat: complete Phase 4 Slice 2 — epic, quick-spec, project-context spec types"
```
