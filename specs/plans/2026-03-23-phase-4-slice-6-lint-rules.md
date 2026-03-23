# Phase 4 Slice 6 — Advanced Lint Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 advanced lint rules: naming-conventions, terminology consistency, edge-case coverage, threat coverage, and AI-powered ambiguity scoring.

**Architecture:** Each rule is a standalone file in `packages/lint/src/rules/` implementing the `LintRule` interface. Rules are registered in `index.ts` — the first 4 go into `contentRules` (included in recommended+strict presets), the AI rule goes into a new `advancedRules` array (strict-only by default, opt-in via config). All rules are pure functions operating on `LintContext`.

**Tech Stack:** TypeScript (ESM only), Vitest, `@anthropic-ai/sdk` (optional, for AI rule only)

**Design spec:** `specs/designs/2026-03-20-phase-4-spec-intelligence-design.md` (Slice 6 section)

---

## File Structure

```
packages/lint/src/rules/naming-conventions.ts           # CREATE
packages/lint/src/rules/naming-conventions.test.ts      # CREATE
packages/lint/src/rules/terminology.ts                  # CREATE
packages/lint/src/rules/terminology.test.ts             # CREATE
packages/lint/src/rules/edge-case-coverage.ts           # CREATE
packages/lint/src/rules/edge-case-coverage.test.ts      # CREATE
packages/lint/src/rules/threat-coverage.ts              # CREATE
packages/lint/src/rules/threat-coverage.test.ts         # CREATE
packages/lint/src/rules/ambiguity-score-ai.ts           # CREATE
packages/lint/src/rules/ambiguity-score-ai.test.ts      # CREATE
packages/lint/src/rules/index.ts                        # MODIFY: register 5 new rules
```

---

## Task 1: Naming Conventions Rule

**Files:**
- Create: `packages/lint/src/rules/naming-conventions.ts`
- Create: `packages/lint/src/rules/naming-conventions.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { namingConventionsRule } from "./naming-conventions.js";
import type { ParsedSpec } from "@specdx/core";

const makeSpec = (overrides: Partial<ParsedSpec> & { frontmatter: Record<string, unknown> }): ParsedSpec => ({
  filePath: "specs/test.md",
  content: "",
  sections: [],
  parsedSections: [],
  valid: true,
  validationErrors: null,
  ...overrides,
});

describe("namingConventionsRule", () => {
  it("passes when PRD features use F<N> pattern", () => {
    const spec = makeSpec({
      frontmatter: { id: "prd-001", type: "prd", title: "Test", status: "draft", version: "1.0", created: "2026-01-01", authors: ["dev"] },
      content: "## Features\n\n- **F1**: Login\n- **F2**: Signup\n",
    });
    const result = namingConventionsRule.run({ spec, allSpecs: [spec] });
    expect(result).toHaveLength(0);
  });

  it("warns when PRD features don't use F<N> pattern", () => {
    const spec = makeSpec({
      frontmatter: { id: "prd-001", type: "prd", title: "Test", status: "draft", version: "1.0", created: "2026-01-01", authors: ["dev"] },
      content: "## Features\n\n- Login feature\n- Signup feature\n",
    });
    const result = namingConventionsRule.run({ spec, allSpecs: [spec] });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]!.message).toContain("feature ID");
  });

  it("warns when user-story ID doesn't follow story-<slug> pattern", () => {
    const spec = makeSpec({
      frontmatter: { id: "auth-login", type: "user-story", title: "Login", status: "draft", version: "1.0", created: "2026-01-01", authors: ["dev"], story_id: "auth-login", priority: "high", estimate: "3d" },
      content: "## Description\n\nLogin flow.",
    });
    const result = namingConventionsRule.run({ spec, allSpecs: [spec] });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]!.message).toContain("story-");
  });

  it("passes when user-story ID follows story-<slug> pattern", () => {
    const spec = makeSpec({
      frontmatter: { id: "story-auth-login", type: "user-story", title: "Login", status: "draft", version: "1.0", created: "2026-01-01", authors: ["dev"], story_id: "story-auth-login", priority: "high", estimate: "3d" },
      content: "## Description\n\nLogin flow.",
    });
    const result = namingConventionsRule.run({ spec, allSpecs: [spec] });
    expect(result).toHaveLength(0);
  });

  it("warns when api-contract endpoints use camelCase", () => {
    const spec = makeSpec({
      frontmatter: { id: "api-001", type: "api-contract", title: "API", status: "draft", version: "1.0", created: "2026-01-01", authors: ["dev"] },
      content: "## Endpoints\n\n### GET /api/userProfiles\nReturns profiles.\n",
    });
    const result = namingConventionsRule.run({ spec, allSpecs: [spec] });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]!.message).toContain("camelCase");
  });

  it("skips non-applicable spec types", () => {
    const spec = makeSpec({
      frontmatter: { id: "adr-001", type: "adr", title: "ADR", status: "draft", version: "1.0", created: "2026-01-01", authors: ["dev"] },
      content: "## Context\n\nSome context.",
    });
    const result = namingConventionsRule.run({ spec, allSpecs: [spec] });
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement naming-conventions rule**

Key logic:
- For `prd` specs: check `## Features` section for bullet points. Each feature should match `**F\d+**:`. Warn if features exist but don't follow the pattern.
- For `user-story` specs: check that `id` starts with `story-`. Warn if not.
- For `api-contract` specs: check `## Endpoints` section for paths containing camelCase segments (regex: `/\/[a-z]+[A-Z]/`). Warn per endpoint.
- Skip other spec types.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add packages/lint/src/rules/naming-conventions.*
git commit -m "feat(lint): add consistency/naming-conventions rule"
```

---

## Task 2: Terminology Rule

**Files:**
- Create: `packages/lint/src/rules/terminology.ts`
- Create: `packages/lint/src/rules/terminology.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { terminologyRule } from "./terminology.js";
import type { ParsedSpec } from "@specdx/core";

const makeSpec = (id: string, content: string, type = "prd"): ParsedSpec => ({
  filePath: `specs/${id}.md`,
  frontmatter: { id, type, title: id, status: "draft", version: "1.0", created: "2026-01-01", authors: ["dev"] },
  content,
  sections: [],
  parsedSections: [],
  valid: true,
  validationErrors: null,
});

describe("terminologyRule", () => {
  it("warns when similar terms are used across specs", () => {
    const specs = [
      makeSpec("prd", "The user profile allows editing personal details."),
      makeSpec("tech", "The UserProfile component renders the user-profile page.", "technical-design"),
    ];
    const result = terminologyRule.run({ spec: specs[0]!, allSpecs: specs });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]!.message).toContain("terminology");
  });

  it("passes when terminology is consistent", () => {
    const specs = [
      makeSpec("prd", "The user profile allows editing."),
      makeSpec("tech", "The user profile component renders data.", "technical-design"),
    ];
    const result = terminologyRule.run({ spec: specs[0]!, allSpecs: specs });
    expect(result).toHaveLength(0);
  });

  it("only runs on the first spec to avoid duplicate warnings", () => {
    const specs = [
      makeSpec("prd", "user profile editing"),
      makeSpec("tech", "UserProfile component", "technical-design"),
    ];
    // Running on the second spec should produce no warnings (first spec owns the check)
    const result = terminologyRule.run({ spec: specs[1]!, allSpecs: specs });
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement terminology rule**

Key logic:
- Only run on the first spec in `allSpecs` (to avoid duplicate diagnostics)
- Extract multi-word terms from all specs: find capitalized compound words and hyphenated terms
- Compare terms across specs using Levenshtein edit distance
- If two terms from different specs have edit distance < 3 but aren't identical, flag as potential terminology drift
- Example: "user profile" vs "user-profile" vs "UserProfile" — these should all be the same term

Simple Levenshtein implementation (no external deps needed):
```typescript
function editDistance(a: string, b: string): number {
  // standard DP implementation
}
```

Extract terms: split on whitespace and punctuation, find sequences of 2+ words that appear as compounds (e.g., "user profile", "user-profile", "UserProfile"). Normalize: lowercase, strip hyphens.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add packages/lint/src/rules/terminology.*
git commit -m "feat(lint): add consistency/terminology rule"
```

---

## Task 3: Edge-Case Coverage Rule

**Files:**
- Create: `packages/lint/src/rules/edge-case-coverage.ts`
- Create: `packages/lint/src/rules/edge-case-coverage.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { edgeCaseCoverageRule } from "./edge-case-coverage.js";
import type { ParsedSpec } from "@specdx/core";

const makeSpec = (type: string, content: string): ParsedSpec => ({
  filePath: `specs/test.md`,
  frontmatter: { id: "test", type, title: "Test", status: "draft", version: "1.0", created: "2026-01-01", authors: ["dev"] },
  content,
  sections: [],
  parsedSections: [],
  valid: true,
  validationErrors: null,
});

describe("edgeCaseCoverageRule", () => {
  it("warns when user-story has no error/edge case keywords", () => {
    const spec = makeSpec("user-story", "## Description\n\nUser can log in.\n\n## Acceptance Criteria\n\n- User enters credentials\n- User sees dashboard");
    const result = edgeCaseCoverageRule.run({ spec, allSpecs: [spec] });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]!.message).toContain("edge case");
  });

  it("passes when user-story mentions error handling", () => {
    const spec = makeSpec("user-story", "## Description\n\nUser can log in.\n\n## Acceptance Criteria\n\n- Invalid credentials show error message\n- Empty email field shows validation error");
    const result = edgeCaseCoverageRule.run({ spec, allSpecs: [spec] });
    expect(result).toHaveLength(0);
  });

  it("warns when test-plan has no edge case coverage", () => {
    const spec = makeSpec("test-plan", "## Test Cases\n\n- User can log in\n- User can sign up");
    const result = edgeCaseCoverageRule.run({ spec, allSpecs: [spec] });
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("passes for test-plan with edge cases", () => {
    const spec = makeSpec("test-plan", "## Test Cases\n\n- User can log in\n- Invalid password returns 401\n- Empty input shows boundary error");
    const result = edgeCaseCoverageRule.run({ spec, allSpecs: [spec] });
    expect(result).toHaveLength(0);
  });

  it("skips non-applicable spec types", () => {
    const spec = makeSpec("prd", "## Features\n\n- **F1**: Login");
    const result = edgeCaseCoverageRule.run({ spec, allSpecs: [spec] });
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement edge-case-coverage rule**

Key logic:
- Only applies to `user-story` and `test-plan` specs
- Check content for keywords: `error`, `invalid`, `empty`, `timeout`, `fails`, `failure`, `boundary`, `edge case`, `null`, `undefined`, `reject`, `unauthorized`, `forbidden`, `404`, `500`
- If none found, emit a warning: "No error states or edge cases mentioned. Consider adding error handling, boundary conditions, or failure mode scenarios."

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add packages/lint/src/rules/edge-case-coverage.*
git commit -m "feat(lint): add completeness/edge-case-coverage rule"
```

---

## Task 4: Threat Coverage Rule

**Files:**
- Create: `packages/lint/src/rules/threat-coverage.ts`
- Create: `packages/lint/src/rules/threat-coverage.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { threatCoverageRule } from "./threat-coverage.js";
import type { ParsedSpec } from "@specdx/core";

const makeSpec = (id: string, type: string, content: string): ParsedSpec => ({
  filePath: `specs/${id}.md`,
  frontmatter: { id, type, title: id, status: "draft", version: "1.0", created: "2026-01-01", authors: ["dev"] },
  content,
  sections: ["Threats"],
  parsedSections: [{ heading: "Threats", content, tokens: 100 }],
  valid: true,
  validationErrors: null,
});

describe("threatCoverageRule", () => {
  it("warns when threats exist but technical design doesn't address them", () => {
    const threatSpec = makeSpec("security", "prd", "## Threats\n\n- SQL injection via user input\n- XSS in comment fields");
    const techSpec = makeSpec("tech", "technical-design", "## Architecture\n\nStandard MVC pattern.");
    const specs = [threatSpec, techSpec];
    const result = threatCoverageRule.run({ spec: techSpec, allSpecs: specs });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]!.message).toContain("threat");
  });

  it("passes when technical design addresses threats", () => {
    const threatSpec = makeSpec("security", "prd", "## Threats\n\n- SQL injection via user input");
    const techSpec = makeSpec("tech", "technical-design", "## Architecture\n\nAll queries use parameterized statements to prevent SQL injection.");
    const specs = [threatSpec, techSpec];
    const result = threatCoverageRule.run({ spec: techSpec, allSpecs: specs });
    expect(result).toHaveLength(0);
  });

  it("skips when no threats section exists in any spec", () => {
    const spec = makeSpec("tech", "technical-design", "## Architecture\n\nBasic design.");
    spec.sections = ["Architecture"];
    const result = threatCoverageRule.run({ spec, allSpecs: [spec] });
    expect(result).toHaveLength(0);
  });

  it("only runs on technical-design specs", () => {
    const spec = makeSpec("prd", "prd", "## Threats\n\n- SQL injection");
    const result = threatCoverageRule.run({ spec, allSpecs: [spec] });
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement threat-coverage rule**

Key logic:
- Only runs on `technical-design` specs
- Scan all specs in suite for `## Threats` or `## Security` sections
- Extract threat descriptions (bullet points from those sections)
- For each threat, check if the technical design content mentions related keywords (extract 2-3 key terms from each threat description)
- If a threat has no corresponding mention in the technical design, warn

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add packages/lint/src/rules/threat-coverage.*
git commit -m "feat(lint): add security/threat-coverage rule"
```

---

## Task 5: AI Ambiguity Score Rule

**Files:**
- Create: `packages/lint/src/rules/ambiguity-score-ai.ts`
- Create: `packages/lint/src/rules/ambiguity-score-ai.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi } from "vitest";
import { ambiguityScoreAiRule } from "./ambiguity-score-ai.js";
import type { ParsedSpec } from "@specdx/core";

const makeSpec = (content: string): ParsedSpec => ({
  filePath: "specs/test.md",
  frontmatter: { id: "test", type: "prd", title: "Test", status: "draft", version: "1.0", created: "2026-01-01", authors: ["dev"] },
  content,
  sections: [],
  parsedSections: [],
  valid: true,
  validationErrors: null,
});

describe("ambiguityScoreAiRule", () => {
  it("returns empty when no API key is set", () => {
    delete process.env["ANTHROPIC_API_KEY"];
    const spec = makeSpec("Some vague content that might be ambiguous.");
    const result = ambiguityScoreAiRule.run({ spec, allSpecs: [spec] });
    expect(result).toHaveLength(0);
  });

  it("returns empty (sync rule cannot call async API)", () => {
    // The AI rule is sync (LintRule interface requires sync run()).
    // It can only flag a diagnostic if it detects the API key is set,
    // suggesting the user run a separate async analysis.
    // For now, the rule is a placeholder that documents the intent.
    process.env["ANTHROPIC_API_KEY"] = "test-key";
    const spec = makeSpec("Content.");
    const result = ambiguityScoreAiRule.run({ spec, allSpecs: [spec] });
    // Returns info diagnostic suggesting to use sdx check --ai
    expect(result.length).toBeLessThanOrEqual(1);
    delete process.env["ANTHROPIC_API_KEY"];
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement ambiguity-score-ai rule**

**Important design note:** The `LintRule` interface has a synchronous `run()` method — it returns `Diagnostic[]`, not `Promise<Diagnostic[]>`. The Anthropic API requires async calls. Options:

1. Make the AI rule a no-op placeholder that emits an `info` diagnostic pointing users to `sdx check --ai` for async AI analysis
2. Change the LintRule interface to support async (big change, not worth it for one rule)

**Go with option 1.** The rule checks if `ANTHROPIC_API_KEY` is set. If so, it emits an `info` diagnostic: "AI ambiguity analysis available — run `sdx check --ai` for LLM-powered ambiguity detection." This makes the rule discoverable without breaking the sync interface.

```typescript
import type { LintRule } from "../types.js";

export const ambiguityScoreAiRule: LintRule = {
  id: "clarity/ambiguity-score-ai",
  description: "AI-powered ambiguity detection (requires ANTHROPIC_API_KEY)",
  severity: "info",
  run(context) {
    // Only emit hint if API key is configured
    if (!process.env["ANTHROPIC_API_KEY"]) return [];

    return [
      {
        ruleId: "clarity/ambiguity-score-ai",
        severity: "info" as const,
        message: "AI ambiguity analysis available — run `sdx check --ai` for LLM-powered ambiguity detection",
        filePath: context.spec.filePath,
      },
    ];
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add packages/lint/src/rules/ambiguity-score-ai.*
git commit -m "feat(lint): add clarity/ambiguity-score-ai rule (placeholder for async AI)"
```

---

## Task 6: Register All Rules

**Files:**
- Modify: `packages/lint/src/rules/index.ts`

- [ ] **Step 1: Add imports and register rules**

In `packages/lint/src/rules/index.ts`, add:

Imports (after existing imports):
```typescript
import { namingConventionsRule } from "./naming-conventions.js";
import { terminologyRule } from "./terminology.js";
import { edgeCaseCoverageRule } from "./edge-case-coverage.js";
import { threatCoverageRule } from "./threat-coverage.js";
import { ambiguityScoreAiRule } from "./ambiguity-score-ai.js";
```

Add to `contentRules` array:
```typescript
  namingConventionsRule,
  terminologyRule,
  edgeCaseCoverageRule,
  threatCoverageRule,
  ambiguityScoreAiRule,
```

Add to named exports:
```typescript
  namingConventionsRule,
  terminologyRule,
  edgeCaseCoverageRule,
  threatCoverageRule,
  ambiguityScoreAiRule,
```

- [ ] **Step 2: Run lint package tests**

```bash
pnpm --filter @specdx/lint test
```

- [ ] **Step 3: Commit**

```bash
git add packages/lint/src/rules/index.ts
git commit -m "feat(lint): register 5 new advanced lint rules"
```

---

## Task 7: Final Integration

- [ ] **Step 1: Build all packages**

```bash
pnpm build
```

- [ ] **Step 2: Run full test suite**

```bash
pnpm test
```

- [ ] **Step 3: Typecheck and lint**

```bash
pnpm typecheck && pnpm lint:code
```

- [ ] **Step 4: Smoke test — run lint with new rules**

```bash
node packages/cli/dist/main.js lint
node packages/cli/dist/main.js lint --preset strict
```

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "feat: complete Phase 4 Slice 6 — advanced lint rules"
```
