# Phase 2 — Daily Driver Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add `sdx pack` for token-optimised context packing, and Claude Code skills (`sdx:start-task`, `sdx:author-spec`) for spec-aware coding sessions.

**Architecture:** Three-stage pack pipeline (Resolve → Allocate → Format) in `@sdx/pack`, two CLI commands (`sdx pack`, `sdx skills install`), two Claude Code skill files bundled into the `specdx` npm package.

**Tech Stack:** TypeScript, js-tiktoken, unified/remark-parse (reuse from @sdx/core), citty (CLI), tsup (bundling)

**Design Spec:** `docs/superpowers/specs/2026-03-18-phase-2-daily-driver-design.md`

---

## Task 1: Extend ParsedSpec with Section-Level Content

**Files:**
- Modify: `packages/core/src/parser.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/parser.test.ts`

The pack engine needs per-section content, not just heading names. Extend the parser to extract section content using remark AST position offsets. Also optimize to avoid double AST parsing — derive `sections` from `parsedSections`.

- [x] **Step 1: Write failing test for ParsedSection**

Add to the existing test file at `packages/core/src/parser.test.ts`. Use relative imports matching the existing pattern.

```typescript
// Add to existing parser.test.ts (uses relative imports like the existing tests)
import { parseSpec, ParseError, type ParsedSection } from "./parser.js";

describe("parsedSections", () => {
  it("extracts section content between H2 headings", async () => {
    // Use an existing fixture or create a temp file
    const spec = await parseSpec(join(fixturesDir, "prd.md"));
    expect(spec.parsedSections).toBeDefined();
    expect(spec.parsedSections.length).toBeGreaterThan(0);

    const features = spec.parsedSections.find((s) => s.heading === "Features");
    expect(features).toBeDefined();
    expect(features!.content).toContain("F1");
    expect(features!.tokens).toBeGreaterThan(0);
  });

  it("returns empty heading for content before first H2", async () => {
    // Create a temp spec file with content before first heading
    const tmpDir = await mkdtemp(join(tmpdir(), "sdx-test-"));
    const specPath = join(tmpDir, "test.md");
    await writeFile(specPath, [
      "---",
      "id: test",
      "type: prd",
      "title: Test",
      "status: draft",
      'version: "1.0"',
      'created: "2026-01-01"',
      "authors: [\"dev\"]",
      "---",
      "",
      "Preamble content here.",
      "",
      "## Section One",
      "",
      "Section one content.",
      "",
      "## Section Two",
      "",
      "Section two content.",
    ].join("\n"), "utf-8");

    const spec = await parseSpec(specPath);
    expect(spec.parsedSections).toHaveLength(3);
    expect(spec.parsedSections[0].heading).toBe("");
    expect(spec.parsedSections[0].content).toContain("Preamble");
    expect(spec.parsedSections[1].heading).toBe("Section One");
    expect(spec.parsedSections[1].content).toContain("Section one content");
    expect(spec.parsedSections[2].heading).toBe("Section Two");
    expect(spec.parsedSections[2].content).toContain("Section two content");

    await rm(tmpDir, { recursive: true });
  });

  it("returns empty parsedSections for YAML specs", async () => {
    const spec = await parseSpec(join(fixturesDir, "story.yaml"));
    expect(spec.parsedSections).toEqual([]);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm --filter @sdx/core test`
Expected: FAIL — `parsedSections` does not exist on `ParsedSpec`

- [x] **Step 3: Add ParsedSection interface and extend ParsedSpec**

In `packages/core/src/parser.ts`:

```typescript
// Add after ParseError class, before ParsedSpec interface:
export interface ParsedSection {
  heading: string;   // H2 heading text ("" for preamble before first H2)
  content: string;   // Markdown content under this heading
  tokens: number;    // Token count for this section's content
}

// Update ParsedSpec to include parsedSections:
export interface ParsedSpec {
  filePath: string;
  frontmatter: BaseSpec & Record<string, unknown>;
  content: string;
  sections: string[];           // Preserved for backward compat
  parsedSections: ParsedSection[]; // NEW: section-level content
  valid: boolean;
  validationErrors: ValidationResult["errors"];
}
```

Add import for `countTokens`:

```typescript
import { countTokens } from "./tokens.js";
```

Replace the `extractSections` function with `extractParsedSections`. The old `sections: string[]` field is derived from `parsedSections` to avoid double AST parsing:

```typescript
// DELETE the old extractSections function — replaced by extractParsedSections

function extractParsedSections(markdown: string): ParsedSection[] {
  if (!markdown.trim()) return [];

  const tree = unified().use(remarkParse).parse(markdown);
  const headings: Array<{ text: string; startOffset: number; endOffset: number }> = [];

  visit(tree, "heading", (node: any) => {
    if (node.depth === 2 && node.position) {
      const text = node.children
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.value)
        .join("");
      if (text) {
        headings.push({
          text,
          startOffset: node.position.start.offset as number,
          endOffset: node.position.end.offset as number,
        });
      }
    }
  });

  const sections: ParsedSection[] = [];

  if (headings.length === 0) {
    const trimmed = markdown.trim();
    if (trimmed) {
      sections.push({ heading: "", content: trimmed, tokens: countTokens(trimmed) });
    }
    return sections;
  }

  // Preamble before first heading
  const preamble = markdown.slice(0, headings[0]!.startOffset).trim();
  if (preamble) {
    sections.push({ heading: "", content: preamble, tokens: countTokens(preamble) });
  }

  // Each heading + content until next heading
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i]!;
    const nextStart = i + 1 < headings.length ? headings[i + 1]!.startOffset : markdown.length;
    const sectionContent = markdown.slice(heading.endOffset, nextStart).trim();
    sections.push({
      heading: heading.text,
      content: sectionContent,
      tokens: countTokens(sectionContent),
    });
  }

  return sections;
}
```

Update `parseMarkdownSpec` to call `extractParsedSections` and derive `sections` from it (single AST parse):

```typescript
function parseMarkdownSpec(filePath: string, raw: string): ParsedSpec {
  const { data, content } = matter(raw);
  const parsedSections = extractParsedSections(content);
  const sections = parsedSections.map((s) => s.heading).filter(Boolean);
  const frontmatter = data as BaseSpec & Record<string, unknown>;
  const specType = frontmatter.type as SpecType | undefined;

  let valid = false;
  let validationErrors: ValidationResult["errors"] = null;
  if (specType) {
    const result = validateSpec(specType, data);
    valid = result.valid;
    validationErrors = result.errors;
  }

  return { filePath, frontmatter, content, sections, parsedSections, valid, validationErrors };
}
```

Update `parseYamlSpec` to include empty `parsedSections`:

```typescript
return { filePath, frontmatter, content: "", sections: [], parsedSections: [], valid, validationErrors };
```

- [x] **Step 4: Export ParsedSection from index.ts**

In `packages/core/src/index.ts`, update the parser export line:

```typescript
export { parseSpec, ParseError, type ParsedSpec, type ParsedSection } from "./parser.js";
```

- [x] **Step 5: Run tests to verify they pass**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm --filter @sdx/core test`
Expected: All tests PASS (existing + new)

- [x] **Step 6: Run full test suite to check no regressions**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm test`
Expected: All 85+ tests PASS across all packages

- [x] **Step 7: Commit**

```bash
git add packages/core/src/parser.ts packages/core/src/index.ts packages/core/test/parser.test.ts
git commit -m "feat(core): add parsedSections to ParsedSpec for section-level content extraction"
```

---

## Task 2: Pack Config Schema + PackConfig Type

**Files:**
- Modify: `packages/schema/src/schemas/config.json`
- Modify: `packages/schema/src/types.ts`
- Modify: `packages/schema/src/index.ts`
- Test: `packages/schema/src/validator.test.ts`

- [x] **Step 1: Write failing test for pack config validation**

```typescript
// Add to existing validator tests
describe("pack config validation", () => {
  it("accepts valid pack config", () => {
    const config = {
      version: "1.0",
      specs: { prd: { path: "specs/prd.md", type: "prd" } },
      pack: {
        max_tokens: 12000,
        format: "xml",
        compression: {
          strip_boilerplate: true,
          stable_days: 7,
          collapse_resolved_adrs: true,
        },
        boilerplate_sections: ["Changelog", "Revision History"],
      },
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(true);
  });

  it("rejects invalid pack format", () => {
    const config = {
      version: "1.0",
      specs: { prd: { path: "specs/prd.md", type: "prd" } },
      pack: { format: "invalid" },
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
  });

  it("rejects negative max_tokens", () => {
    const config = {
      version: "1.0",
      specs: { prd: { path: "specs/prd.md", type: "prd" } },
      pack: { max_tokens: -1 },
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
  });

  it("rejects zero max_tokens (minimum is 1)", () => {
    const config = {
      version: "1.0",
      specs: { prd: { path: "specs/prd.md", type: "prd" } },
      pack: { max_tokens: 0 },
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm --filter @sdx/schema test`
Expected: FAIL — pack config with properties is rejected (currently `"pack": { "type": "object" }` with no properties defined)

- [x] **Step 3: Update config.json with pack schema**

Replace the `"pack"` property in `packages/schema/src/schemas/config.json`:

```json
"pack": {
  "type": "object",
  "properties": {
    "max_tokens": { "type": "integer", "minimum": 1 },
    "format": { "type": "string", "enum": ["xml", "markdown", "json"] },
    "compression": {
      "type": "object",
      "properties": {
        "strip_boilerplate": { "type": "boolean" },
        "stable_days": { "type": "integer", "minimum": 0 },
        "collapse_resolved_adrs": { "type": "boolean" }
      },
      "additionalProperties": false
    },
    "boilerplate_sections": {
      "type": "array",
      "items": { "type": "string" }
    }
  },
  "additionalProperties": false
}
```

- [x] **Step 4: Add PackConfig type to types.ts**

In `packages/schema/src/types.ts`:

```typescript
export interface PackCompressionConfig {
  strip_boilerplate?: boolean;
  stable_days?: number;
  collapse_resolved_adrs?: boolean;
}

export interface PackConfig {
  max_tokens?: number;
  format?: "xml" | "markdown" | "json";
  compression?: PackCompressionConfig;
  boilerplate_sections?: string[];
}
```

Update `SdxConfig`:

```typescript
export interface SdxConfig {
  version: string;
  project?: { name?: string; description?: string };
  specs: Record<string, SpecEntry>;
  lint?: {
    extends?: "minimal" | "recommended" | "strict";
    rules?: Record<string, unknown>;
    ignore?: string[];
  };
  pack?: PackConfig;
  diff?: Record<string, unknown>;
  ci?: Record<string, unknown>;
}
```

- [x] **Step 5: Export new types from index.ts**

In `packages/schema/src/index.ts`, add to the type exports:

```typescript
export {
  // ...existing exports...
  type PackConfig,
  type PackCompressionConfig,
  // ...
} from "./types.js";
```

- [x] **Step 6: Run tests**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm --filter @sdx/schema test`
Expected: All tests PASS

- [x] **Step 7: Commit**

```bash
git add packages/schema/src/schemas/config.json packages/schema/src/types.ts packages/schema/src/index.ts packages/schema/test/
git commit -m "feat(schema): add PackConfig type and pack config validation schema"
```

---

## Task 3: @sdx/pack Package Setup + Types

**Files:**
- Modify: `packages/pack/package.json`
- Modify: `packages/pack/tsconfig.json`
- Create: `packages/pack/vitest.config.ts` (if doesn't exist or is empty)
- Create: `packages/pack/src/types.ts` (tests go in `src/` alongside source files, matching the existing package convention)
- Modify: `packages/pack/src/index.ts`

- [x] **Step 1: Update package.json with dependencies**

`packages/pack/package.json`:

```json
{
  "name": "@sdx/pack",
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc --build",
    "typecheck": "tsc --build --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist *.tsbuildinfo"
  },
  "dependencies": {
    "@sdx/schema": "workspace:*",
    "@sdx/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

After updating package.json, run `pnpm install` from the workspace root to link the new dependencies.

- [x] **Step 2: Update tsconfig.json with references**

`packages/pack/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"],
  "references": [
    { "path": "../schema" },
    { "path": "../core" }
  ]
}
```

- [x] **Step 3: Verify vitest.config.ts matches existing pattern**

`packages/pack/vitest.config.ts` (should already exist with this content):

```typescript
import { mergeConfig } from "vitest/config";
import shared from "../../vitest.shared.js";

export default mergeConfig(shared, {});
```

- [x] **Step 4: Create types.ts**

`packages/pack/src/types.ts`:

```typescript
export interface PackOptions {
  task?: string;
  specs?: string[];
  budget?: number;
  format?: "xml" | "markdown" | "json";
  full?: boolean;
  dryRun?: boolean;
}

export interface PackResult {
  output: string;
  stats: PackStats;
}

export interface PackStats {
  budget: number;
  used: number;
  specsIncluded: number;
  specsExcluded: number;
  sectionsCompressed: number;
  allocations: SpecAllocation[];
}

export interface SpecAllocation {
  specId: string;
  type: string;
  relevance: number;
  tokens: number;
  compressed: boolean;
  included: boolean;
}

export interface RelevanceScore {
  specId: string;
  score: number;
  rawScore: number;
  matchedKeywords: string[];
  graphBoosted: boolean;
}

export interface CompressedSpec {
  specId: string;
  type: string;
  title: string;
  sections: CompressedSection[];
  collapsed: boolean;
  collapsedSummary?: string;
}

export interface CompressedSection {
  heading: string;
  content: string;
  tokens: number;
  compressed: boolean;
  originalTokens: number;
}

export interface CompressionOptions {
  stripBoilerplate: boolean;
  stableDays: number;
  collapseResolvedAdrs: boolean;
  boilerplateSections: string[];
}
```

- [x] **Step 5: Update index.ts with type exports**

`packages/pack/src/index.ts` (temporary, will be expanded later):

```typescript
export type {
  PackOptions,
  PackResult,
  PackStats,
  SpecAllocation,
  RelevanceScore,
  CompressedSpec,
  CompressedSection,
  CompressionOptions,
} from "./types.js";
```

- [x] **Step 6: Verify build**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm --filter @sdx/pack build`
Expected: Build succeeds

- [x] **Step 7: Commit**

```bash
git add packages/pack/
git commit -m "feat(pack): scaffold package with types and dependencies"
```

---

## Task 4: Relevance Resolver

**Files:**
- Create: `packages/pack/src/resolver.ts`
- Create: `packages/pack/src/resolver.test.ts`

- [x] **Step 1: Write failing tests**

`packages/pack/src/resolver.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { scoreSpecs, scoreSpecsByIds } from "./resolver.js";
import type { ParsedSpec, DependencyGraph, Edge } from "@sdx/core";

function makeSpec(overrides: Partial<ParsedSpec> & { id: string }): ParsedSpec {
  return {
    filePath: `specs/${overrides.id}.md`,
    frontmatter: {
      id: overrides.id,
      type: "prd",
      title: overrides.frontmatter?.title ?? overrides.id,
      status: "draft",
      version: "1.0",
      created: "2026-01-01",
      authors: ["dev"],
      tags: overrides.frontmatter?.tags ?? [],
      ...overrides.frontmatter,
    } as any,
    content: overrides.content ?? "",
    sections: overrides.sections ?? [],
    parsedSections: overrides.parsedSections ?? [],
    valid: true,
    validationErrors: null,
  };
}

function makeGraph(nodes: string[], edges: Edge[]): DependencyGraph {
  return {
    nodes,
    edges,
    topologicalSort: () => [...nodes],
    getDownstream: () => [],
    getUpstream: () => [],
  };
}

describe("scoreSpecs", () => {
  it("returns all specs with score 1.0 when no task provided", () => {
    const specs = [makeSpec({ id: "prd" }), makeSpec({ id: "tech" })];
    const result = scoreSpecs(specs, undefined, undefined);
    expect(result).toHaveLength(2);
    expect(result[0]!.score).toBe(1.0);
    expect(result[1]!.score).toBe(1.0);
  });

  it("scores higher for tag matches (3x weight)", () => {
    const specs = [
      makeSpec({ id: "auth", frontmatter: { tags: ["authentication", "login"] } as any }),
      makeSpec({ id: "payments", frontmatter: { tags: ["billing", "stripe"] } as any }),
    ];
    const result = scoreSpecs(specs, "login authentication", undefined);
    const auth = result.find((r) => r.specId === "auth");
    const payments = result.find((r) => r.specId === "payments");
    expect(auth).toBeDefined();
    expect(auth!.score).toBeGreaterThan(0);
    // payments may be filtered out (score < 0.1) or have score 0
    if (payments) {
      expect(auth!.score).toBeGreaterThan(payments.score);
    }
  });

  it("scores higher for title matches (3x weight)", () => {
    const specs = [
      makeSpec({ id: "auth", frontmatter: { title: "User Authentication System" } as any }),
      makeSpec({ id: "other", frontmatter: { title: "Data Pipeline" } as any }),
    ];
    const result = scoreSpecs(specs, "authentication", undefined);
    const auth = result.find((r) => r.specId === "auth");
    expect(auth).toBeDefined();
    expect(auth!.score).toBe(1.0);
  });

  it("scores section headings at 2x weight", () => {
    const specs = [
      makeSpec({ id: "spec1", sections: ["Authentication Flow", "Database Schema"] }),
      makeSpec({ id: "spec2", sections: ["Deployment", "Monitoring"] }),
    ];
    const result = scoreSpecs(specs, "authentication", undefined);
    const spec1 = result.find((r) => r.specId === "spec1");
    expect(spec1).toBeDefined();
    expect(spec1!.score).toBe(1.0);
  });

  it("includes body content at 1x weight", () => {
    const specs = [
      makeSpec({ id: "spec1", content: "The authentication module handles login." }),
      makeSpec({ id: "spec2", content: "The billing module processes payments." }),
    ];
    const result = scoreSpecs(specs, "authentication login", undefined);
    const spec1 = result.find((r) => r.specId === "spec1");
    expect(spec1).toBeDefined();
    expect(spec1!.score).toBe(1.0);
  });

  it("filters stopwords from task string", () => {
    const specs = [makeSpec({ id: "spec1", content: "implement the login flow" })];
    // "the" is a stopword, "implement" and "login" and "flow" are keywords
    const result = scoreSpecs(specs, "implement the login flow", undefined);
    expect(result).toHaveLength(1);
    expect(result[0]!.matchedKeywords).not.toContain("the");
  });

  it("excludes specs below 0.1 threshold", () => {
    const specs = [
      makeSpec({ id: "match", frontmatter: { title: "Login System" } as any }),
      makeSpec({ id: "nomatch", frontmatter: { title: "Unrelated" } as any }),
    ];
    const result = scoreSpecs(specs, "login", undefined);
    const noMatch = result.find((r) => r.specId === "nomatch");
    expect(noMatch).toBeUndefined();
  });

  it("propagates scores to immediate graph neighbors", () => {
    const specs = [
      makeSpec({ id: "prd", frontmatter: { title: "Login PRD" } as any }),
      makeSpec({ id: "tech", frontmatter: { title: "Technical Design" } as any }),
    ];
    const graph = makeGraph(["prd", "tech"], [{ from: "prd", to: "tech" }]);
    const result = scoreSpecs(specs, "login", graph);

    // prd matches directly, tech should be boosted via graph
    const prd = result.find((r) => r.specId === "prd");
    const tech = result.find((r) => r.specId === "tech");
    expect(prd).toBeDefined();
    expect(tech).toBeDefined();
    expect(tech!.graphBoosted).toBe(true);
    expect(tech!.score).toBeGreaterThan(0);
    expect(tech!.score).toBeLessThan(prd!.score);
  });

  it("returns results sorted by score descending", () => {
    const specs = [
      makeSpec({ id: "low", content: "unrelated content" }),
      makeSpec({ id: "high", frontmatter: { title: "Login Auth", tags: ["login"] } as any }),
      makeSpec({ id: "mid", sections: ["Login Flow"] }),
    ];
    const result = scoreSpecs(specs, "login", undefined);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1]!.score).toBeGreaterThanOrEqual(result[i]!.score);
    }
  });

  it("tracks matched keywords", () => {
    const specs = [
      makeSpec({ id: "spec1", frontmatter: { tags: ["auth", "login"] } as any, content: "handles payments" }),
    ];
    const result = scoreSpecs(specs, "auth login payments", undefined);
    expect(result[0]!.matchedKeywords).toContain("auth");
    expect(result[0]!.matchedKeywords).toContain("login");
    expect(result[0]!.matchedKeywords).toContain("payments");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm --filter @sdx/pack test`
Expected: FAIL — module `../src/resolver.js` not found

- [x] **Step 3: Implement resolver.ts**

`packages/pack/src/resolver.ts`:

```typescript
import type { ParsedSpec, DependencyGraph } from "@sdx/core";
import type { RelevanceScore } from "./types.js";

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "to", "of", "in",
  "for", "on", "with", "at", "by", "from", "as", "into", "through",
  "during", "before", "after", "between", "out", "off", "over", "under",
  "again", "then", "once", "here", "there", "when", "where", "why",
  "how", "all", "each", "every", "both", "few", "more", "most", "other",
  "some", "such", "no", "not", "only", "own", "same", "so", "than",
  "too", "very", "just", "because", "but", "and", "or", "if", "while",
  "that", "this", "it", "i", "we", "you", "my", "our", "your",
]);

function tokenizeTask(task: string): string[] {
  return task
    .toLowerCase()
    .split(/[\s\-_/.,;:!?()[\]{}'"]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

function countHits(text: string, keywords: string[]): { count: number; matched: string[] } {
  const lower = text.toLowerCase();
  const matched: string[] = [];
  let count = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) {
      count++;
      matched.push(kw);
    }
  }
  return { count, matched };
}

export function scoreSpecs(
  specs: ParsedSpec[],
  task: string | undefined,
  graph: DependencyGraph | undefined,
): RelevanceScore[] {
  if (!task) {
    return specs.map((s) => ({
      specId: s.frontmatter.id,
      score: 1.0,
      rawScore: 1.0,
      matchedKeywords: [],
      graphBoosted: false,
    }));
  }

  const keywords = tokenizeTask(task);
  if (keywords.length === 0) {
    return specs.map((s) => ({
      specId: s.frontmatter.id,
      score: 1.0,
      rawScore: 1.0,
      matchedKeywords: [],
      graphBoosted: false,
    }));
  }

  const scores = new Map<string, { rawScore: number; matched: Set<string> }>();

  for (const spec of specs) {
    const fm = spec.frontmatter;
    const matched = new Set<string>();
    let total = 0;

    // Tags: 3x
    if (fm.tags) {
      const { count, matched: m } = countHits(fm.tags.join(" "), keywords);
      total += count * 3;
      m.forEach((k) => matched.add(k));
    }

    // Title: 3x
    const titleResult = countHits(fm.title, keywords);
    total += titleResult.count * 3;
    titleResult.matched.forEach((k) => matched.add(k));

    // Section headings: 2x
    const headingsResult = countHits(spec.sections.join(" "), keywords);
    total += headingsResult.count * 2;
    headingsResult.matched.forEach((k) => matched.add(k));

    // Body content: 1x
    const bodyResult = countHits(spec.content, keywords);
    total += bodyResult.count;
    bodyResult.matched.forEach((k) => matched.add(k));

    scores.set(fm.id, { rawScore: total / keywords.length, matched });
  }

  // Graph propagation: immediate neighbors get 0.5x of the scorer's rawScore
  const boosted = new Set<string>();
  if (graph) {
    const boosts = new Map<string, number>();

    for (const [specId, { rawScore }] of scores) {
      if (rawScore <= 0) continue;
      const boost = rawScore * 0.5;

      for (const edge of graph.edges) {
        let neighborId: string | undefined;
        if (edge.from === specId) neighborId = edge.to;
        else if (edge.to === specId) neighborId = edge.from;

        if (neighborId && scores.has(neighborId)) {
          const existing = boosts.get(neighborId) ?? 0;
          boosts.set(neighborId, Math.max(existing, boost));
        }
      }
    }

    for (const [specId, boost] of boosts) {
      const entry = scores.get(specId)!;
      entry.rawScore += boost;
      boosted.add(specId);
    }
  }

  // Normalize
  const maxScore = Math.max(...[...scores.values()].map((v) => v.rawScore), 0.001);

  const results: RelevanceScore[] = [];
  for (const spec of specs) {
    const id = spec.frontmatter.id;
    const entry = scores.get(id);
    if (!entry) continue;
    const normalized = entry.rawScore / maxScore;
    if (normalized < 0.1) continue;

    results.push({
      specId: id,
      score: Math.round(normalized * 100) / 100,
      rawScore: entry.rawScore,
      matchedKeywords: [...entry.matched],
      graphBoosted: boosted.has(id),
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Score specs by explicit IDs. Named specs get 1.0, their transitive
 * upstream dependencies (via graph.getUpstream) get 0.5.
 * Throws if any requested ID doesn't exist in the spec list.
 */
export function scoreSpecsByIds(
  specs: ParsedSpec[],
  specIds: string[],
  graph: DependencyGraph | undefined,
): RelevanceScore[] {
  const specIdSet = new Set(specs.map((s) => s.frontmatter.id));
  const requestedSet = new Set(specIds);

  // Validate all requested IDs exist
  for (const id of specIds) {
    if (!specIdSet.has(id)) {
      const available = [...specIdSet].join(", ");
      throw new Error(`Unknown spec: "${id}". Available specs: ${available}`);
    }
  }

  // Find transitive upstream deps for requested specs
  const upstreamIds = new Set<string>();
  if (graph) {
    for (const id of specIds) {
      for (const upstream of graph.getUpstream(id)) {
        if (!requestedSet.has(upstream)) {
          upstreamIds.add(upstream);
        }
      }
    }
  }

  return specs
    .filter((s) => requestedSet.has(s.frontmatter.id) || upstreamIds.has(s.frontmatter.id))
    .map((s) => ({
      specId: s.frontmatter.id,
      score: requestedSet.has(s.frontmatter.id) ? 1.0 : 0.5,
      rawScore: requestedSet.has(s.frontmatter.id) ? 1.0 : 0.5,
      matchedKeywords: [],
      graphBoosted: upstreamIds.has(s.frontmatter.id),
    }));
}
```

Also add tests for `scoreSpecsByIds` in the same test file:

```typescript
describe("scoreSpecsByIds", () => {
  it("scores named specs at 1.0", () => {
    const specs = [makeSpec({ id: "prd" }), makeSpec({ id: "tech" })];
    const result = scoreSpecsByIds(specs, ["prd"], undefined);
    expect(result).toHaveLength(1);
    expect(result[0]!.specId).toBe("prd");
    expect(result[0]!.score).toBe(1.0);
  });

  it("includes upstream deps at 0.5 via graph", () => {
    const specs = [makeSpec({ id: "prd" }), makeSpec({ id: "tech" })];
    const graph = makeGraph(["prd", "tech"], [{ from: "prd", to: "tech" }]);
    // tech requires prd, so asking for tech should include prd as upstream
    const result = scoreSpecsByIds(specs, ["tech"], graph);
    expect(result).toHaveLength(2);
    const prd = result.find((r) => r.specId === "prd");
    expect(prd).toBeDefined();
    expect(prd!.score).toBe(0.5);
    expect(prd!.graphBoosted).toBe(true);
  });

  it("throws for unknown spec IDs", () => {
    const specs = [makeSpec({ id: "prd" })];
    expect(() => scoreSpecsByIds(specs, ["nonexistent"], undefined)).toThrow(
      /Unknown spec: "nonexistent"/,
    );
  });
});
```

- [x] **Step 4: Run tests**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm --filter @sdx/pack test`
Expected: All resolver tests PASS

- [x] **Step 5: Commit**

```bash
git add packages/pack/src/resolver.ts packages/pack/src/resolver.test.ts
git commit -m "feat(pack): implement relevance resolver with keyword scoring, graph propagation, and ID-based scoring"
```

---

## Task 5: Compressor

**Files:**
- Create: `packages/pack/src/compressor.ts`
- Create: `packages/pack/src/compressor.test.ts`

- [x] **Step 1: Write failing tests**

`packages/pack/src/compressor.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { compressSpec } from "./compressor.js";
import type { CompressionOptions } from "../src/types.js";
import type { ParsedSection } from "@sdx/core";

const defaultOptions: CompressionOptions = {
  stripBoilerplate: true,
  stableDays: 7,
  collapseResolvedAdrs: true,
  boilerplateSections: ["Changelog", "Revision History", "Document History"],
};

function makeSection(heading: string, content: string, tokens = 100): ParsedSection {
  return { heading, content, tokens };
}

describe("compressSpec", () => {
  it("collapses superseded ADRs to one-liner", () => {
    const sections = [makeSection("Context", "Some context"), makeSection("Decision", "We chose X")];
    const result = compressSpec("adr-001", "adr", "Choose Database", "superseded", "2026-01-01", sections, defaultOptions);
    expect(result.collapsed).toBe(true);
    expect(result.collapsedSummary).toBe("[ADR] Choose Database — superseded");
    expect(result.sections).toHaveLength(0);
  });

  it("does not collapse non-superseded ADRs", () => {
    const sections = [makeSection("Context", "Context content")];
    const result = compressSpec("adr-002", "adr", "Choose DB", "approved", "2026-03-18", sections, defaultOptions);
    expect(result.collapsed).toBe(false);
    expect(result.sections).toHaveLength(1);
  });

  it("strips boilerplate sections", () => {
    const sections = [
      makeSection("Features", "Feature content"),
      makeSection("Changelog", "v1.0 - initial release"),
      makeSection("Goals", "Goal content"),
    ];
    const result = compressSpec("prd-001", "prd", "Test PRD", "draft", "2026-03-18", sections, defaultOptions);
    expect(result.sections).toHaveLength(2);
    expect(result.sections.map((s) => s.heading)).toEqual(["Features", "Goals"]);
  });

  it("boilerplate matching is case-insensitive", () => {
    const sections = [makeSection("changelog", "content")];
    const result = compressSpec("prd", "prd", "Test", "draft", "2026-03-18", sections, defaultOptions);
    expect(result.sections).toHaveLength(0);
  });

  it("collapses sections when spec is stale", () => {
    const sections = [
      makeSection("Features", "Feature list here", 150),
      makeSection("Goals", "Goal content here", 200),
    ];
    // updated date is very old
    const result = compressSpec("prd-001", "prd", "Test PRD", "draft", "2025-01-01", sections, defaultOptions);
    expect(result.sections).toHaveLength(2);
    for (const section of result.sections) {
      expect(section.compressed).toBe(true);
      expect(section.content).toContain("Unchanged since 2025-01-01");
      expect(section.content).toContain("tokens omitted");
      expect(section.originalTokens).toBeGreaterThan(0);
    }
  });

  it("does not collapse sections when spec is fresh", () => {
    const today = new Date().toISOString().slice(0, 10);
    const sections = [makeSection("Features", "Feature content", 100)];
    const result = compressSpec("prd", "prd", "Test", "draft", today, sections, defaultOptions);
    expect(result.sections[0]!.compressed).toBe(false);
    expect(result.sections[0]!.content).toBe("Feature content");
  });

  it("does not collapse when updated is undefined (treat as fresh)", () => {
    const sections = [makeSection("Features", "Content", 100)];
    const result = compressSpec("prd", "prd", "Test", "draft", undefined, sections, defaultOptions);
    expect(result.sections[0]!.compressed).toBe(false);
  });

  it("passes through sections with no compression when full mode", () => {
    const noCompression: CompressionOptions = {
      stripBoilerplate: false,
      stableDays: 0,
      collapseResolvedAdrs: false,
      boilerplateSections: [],
    };
    const sections = [makeSection("Changelog", "Log"), makeSection("Features", "Content")];
    const result = compressSpec("prd", "prd", "Test", "draft", "2020-01-01", sections, noCompression);
    expect(result.sections).toHaveLength(2);
    expect(result.sections.every((s) => !s.compressed)).toBe(true);
  });

  it("preserves preamble sections (empty heading)", () => {
    const sections = [makeSection("", "Preamble text"), makeSection("Features", "Content")];
    const result = compressSpec("prd", "prd", "Test", "draft", "2025-01-01", sections, defaultOptions);
    // Preamble has empty heading — stable collapsing only applies to sections with headings
    const preamble = result.sections.find((s) => s.heading === "");
    expect(preamble).toBeDefined();
    expect(preamble!.compressed).toBe(false);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm --filter @sdx/pack test`
Expected: FAIL — `compressSpec` not found

- [x] **Step 3: Implement compressor.ts**

`packages/pack/src/compressor.ts`:

```typescript
import { countTokens } from "@sdx/core";
import type { ParsedSection } from "@sdx/core";
import type { CompressionOptions, CompressedSpec, CompressedSection } from "./types.js";

export function compressSpec(
  specId: string,
  type: string,
  title: string,
  status: string,
  updatedDate: string | undefined,
  parsedSections: ParsedSection[],
  options: CompressionOptions,
): CompressedSpec {
  // Resolved ADR collapsing
  if (type === "adr" && status === "superseded" && options.collapseResolvedAdrs) {
    return {
      specId,
      type,
      title,
      sections: [],
      collapsed: true,
      collapsedSummary: `[ADR] ${title} — superseded`,
    };
  }

  const isStale =
    options.stableDays > 0 && updatedDate != null
      ? isOlderThanDays(updatedDate, options.stableDays)
      : false;

  const sections: CompressedSection[] = [];

  for (const section of parsedSections) {
    // Boilerplate stripping
    if (
      options.stripBoilerplate &&
      section.heading &&
      options.boilerplateSections.some((b) => section.heading.toLowerCase() === b.toLowerCase())
    ) {
      continue;
    }

    // Stable section collapsing (only for named sections, not preamble)
    if (isStale && section.heading) {
      const stub = `[Unchanged since ${updatedDate} — ${section.tokens} tokens omitted]`;
      sections.push({
        heading: section.heading,
        content: stub,
        tokens: countTokens(stub),
        compressed: true,
        originalTokens: section.tokens,
      });
      continue;
    }

    sections.push({
      heading: section.heading,
      content: section.content,
      tokens: section.tokens,
      compressed: false,
      originalTokens: section.tokens,
    });
  }

  return { specId, type, title, sections, collapsed: false };
}

function isOlderThanDays(dateStr: string, days: number): boolean {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > days;
}
```

- [x] **Step 4: Run tests**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm --filter @sdx/pack test`
Expected: All compressor tests PASS

- [x] **Step 5: Commit**

```bash
git add packages/pack/src/compressor.ts packages/pack/src/compressor.test.ts
git commit -m "feat(pack): implement compression strategies (boilerplate, stable sections, ADR collapse)"
```

---

## Task 6: Token Allocator

**Files:**
- Create: `packages/pack/src/allocator.ts`
- Create: `packages/pack/src/allocator.test.ts`

- [x] **Step 1: Write failing tests**

`packages/pack/src/allocator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { allocate } from "./allocator.js";
import type { ParsedSpec, ParsedSection } from "@sdx/core";
import type { RelevanceScore, CompressionOptions } from "../src/types.js";

function makeSpec(id: string, sections: ParsedSection[], overrides: Partial<ParsedSpec["frontmatter"]> = {}): ParsedSpec {
  return {
    filePath: `specs/${id}.md`,
    frontmatter: {
      id,
      type: "prd",
      title: `${id} title`,
      status: "draft",
      version: "1.0",
      created: "2026-01-01",
      authors: ["dev"],
      ...overrides,
    } as any,
    content: sections.map((s) => s.content).join("\n"),
    sections: sections.map((s) => s.heading).filter(Boolean),
    parsedSections: sections,
    valid: true,
    validationErrors: null,
  };
}

function makeScore(specId: string, score: number): RelevanceScore {
  return { specId, score, rawScore: score, matchedKeywords: [], graphBoosted: false };
}

function sec(heading: string, content: string, tokens: number): ParsedSection {
  return { heading, content, tokens };
}

const defaultCompression: CompressionOptions = {
  stripBoilerplate: true,
  stableDays: 7,
  collapseResolvedAdrs: true,
  boilerplateSections: ["Changelog"],
};

describe("allocate", () => {
  it("includes all specs when within budget", () => {
    const specs = [
      makeSpec("prd", [sec("Features", "content", 100)]),
      makeSpec("tech", [sec("Architecture", "content", 200)]),
    ];
    const scores = [makeScore("prd", 1.0), makeScore("tech", 0.8)];

    const result = allocate(specs, scores, {
      budget: 1000,
      full: false,
      compression: defaultCompression,
    });

    expect(result.stats.specsIncluded).toBe(2);
    expect(result.stats.specsExcluded).toBe(0);
    expect(result.stats.used).toBeLessThanOrEqual(result.stats.budget);
  });

  it("drops lowest-relevance specs when over budget", () => {
    const specs = [
      makeSpec("high", [sec("A", "content", 500)]),
      makeSpec("low", [sec("B", "content", 500)]),
    ];
    const scores = [makeScore("high", 1.0), makeScore("low", 0.3)];

    const result = allocate(specs, scores, {
      budget: 600,
      full: false,
      compression: defaultCompression,
    });

    expect(result.stats.specsIncluded).toBe(1);
    expect(result.specs[0]!.specId).toBe("high");
  });

  it("applies compression when not in full mode", () => {
    const specs = [
      makeSpec("prd", [
        sec("Features", "content", 100),
        sec("Changelog", "log content", 50),
      ]),
    ];
    const scores = [makeScore("prd", 1.0)];

    const result = allocate(specs, scores, {
      budget: 1000,
      full: false,
      compression: defaultCompression,
    });

    // Changelog should be stripped
    expect(result.specs[0]!.sections).toHaveLength(1);
    expect(result.specs[0]!.sections[0]!.heading).toBe("Features");
  });

  it("skips compression in full mode", () => {
    const specs = [
      makeSpec("prd", [
        sec("Features", "content", 100),
        sec("Changelog", "log content", 50),
      ]),
    ];
    const scores = [makeScore("prd", 1.0)];

    const result = allocate(specs, scores, {
      budget: 1000,
      full: true,
      compression: defaultCompression,
    });

    expect(result.specs[0]!.sections).toHaveLength(2);
  });

  it("reports correct stats", () => {
    const specs = [
      makeSpec("prd", [sec("Features", "content", 100)]),
    ];
    const scores = [makeScore("prd", 1.0)];

    const result = allocate(specs, scores, {
      budget: 5000,
      full: false,
      compression: defaultCompression,
    });

    expect(result.stats.budget).toBe(5000);
    expect(result.stats.used).toBeGreaterThan(0);
    expect(result.stats.allocations).toHaveLength(1);
    expect(result.stats.allocations[0]!.specId).toBe("prd");
    expect(result.stats.allocations[0]!.included).toBe(true);
  });

  it("collapses resolved ADRs", () => {
    const specs = [
      makeSpec("adr-001", [sec("Context", "context", 200)], { type: "adr", status: "superseded" } as any),
    ];
    const scores = [makeScore("adr-001", 1.0)];

    const result = allocate(specs, scores, {
      budget: 1000,
      full: false,
      compression: defaultCompression,
    });

    expect(result.specs[0]!.collapsed).toBe(true);
    expect(result.specs[0]!.collapsedSummary).toContain("superseded");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm --filter @sdx/pack test`
Expected: FAIL — `allocate` not found

- [x] **Step 3: Implement allocator.ts**

`packages/pack/src/allocator.ts`:

```typescript
import { countTokens } from "@sdx/core";
import type { ParsedSpec } from "@sdx/core";
import type { RelevanceScore, CompressedSpec, CompressionOptions, PackStats, SpecAllocation } from "./types.js";
import { compressSpec } from "./compressor.js";

export interface AllocatorOptions {
  budget: number;
  full: boolean;
  compression: CompressionOptions;
}

export interface AllocationResult {
  specs: CompressedSpec[];
  stats: PackStats;
}

function noCompress(spec: ParsedSpec): CompressedSpec {
  return {
    specId: spec.frontmatter.id,
    type: spec.frontmatter.type,
    title: spec.frontmatter.title,
    sections: spec.parsedSections.map((s) => ({
      heading: s.heading,
      content: s.content,
      tokens: s.tokens,
      compressed: false,
      originalTokens: s.tokens,
    })),
    collapsed: false,
  };
}

function specTokenCount(spec: CompressedSpec): number {
  if (spec.collapsed) {
    return countTokens(spec.collapsedSummary ?? "");
  }
  return spec.sections.reduce((sum, s) => sum + s.tokens, 0);
}

export function allocate(
  specs: ParsedSpec[],
  scores: RelevanceScore[],
  options: AllocatorOptions,
): AllocationResult {
  const specMap = new Map(specs.map((s) => [s.frontmatter.id, s]));

  // Compress each scored spec
  const entries: Array<{ spec: CompressedSpec; relevance: number; tokens: number }> = [];

  for (const score of scores) {
    const parsed = specMap.get(score.specId);
    if (!parsed) continue;

    const compressed = options.full
      ? noCompress(parsed)
      : compressSpec(
          score.specId,
          parsed.frontmatter.type,
          parsed.frontmatter.title,
          parsed.frontmatter.status,
          parsed.frontmatter.updated,
          parsed.parsedSections,
          options.compression,
        );

    entries.push({
      spec: compressed,
      relevance: score.score,
      tokens: specTokenCount(compressed),
    });
  }

  // Sort by relevance descending
  entries.sort((a, b) => b.relevance - a.relevance);

  // Check if everything fits
  const totalTokens = entries.reduce((sum, e) => sum + e.tokens, 0);

  let included: typeof entries;
  let excluded: typeof entries;

  if (totalTokens <= options.budget) {
    included = entries;
    excluded = [];
  } else {
    // Drop lowest-relevance specs until budget fits
    included = [];
    excluded = [];
    let used = 0;

    for (const entry of entries) {
      if (used + entry.tokens <= options.budget) {
        included.push(entry);
        used += entry.tokens;
      } else {
        excluded.push(entry);
      }
    }
  }

  const usedTokens = included.reduce((sum, e) => sum + e.tokens, 0);
  const sectionsCompressed = included.reduce(
    (sum, e) => sum + e.spec.sections.filter((s) => s.compressed).length,
    0,
  );

  const allocations: SpecAllocation[] = [
    ...included.map((e) => ({
      specId: e.spec.specId,
      type: e.spec.type,
      relevance: e.relevance,
      tokens: e.tokens,
      compressed: e.spec.collapsed || e.spec.sections.some((s) => s.compressed),
      included: true,
    })),
    ...excluded.map((e) => ({
      specId: e.spec.specId,
      type: e.spec.type,
      relevance: e.relevance,
      tokens: e.tokens,
      compressed: false,
      included: false,
    })),
  ];

  return {
    specs: included.map((e) => e.spec),
    stats: {
      budget: options.budget,
      used: usedTokens,
      specsIncluded: included.length,
      specsExcluded: excluded.length,
      sectionsCompressed,
      allocations,
    },
  };
}
```

- [x] **Step 4: Run tests**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm --filter @sdx/pack test`
Expected: All allocator tests PASS

- [x] **Step 5: Commit**

```bash
git add packages/pack/src/allocator.ts packages/pack/src/allocator.test.ts
git commit -m "feat(pack): implement token allocator with budget enforcement and compression"
```

---

## Task 7: XML Formatter

**Files:**
- Create: `packages/pack/src/formatters/xml.ts`
- Create: `packages/pack/src/formatters.test.ts`

- [x] **Step 1: Write failing test**

`packages/pack/src/formatters.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { formatXml } from "./formatters/xml.js";
import type { CompressedSpec, PackStats } from "../src/types.js";

function makeCompressedSpec(overrides: Partial<CompressedSpec> = {}): CompressedSpec {
  return {
    specId: "prd-001",
    type: "prd",
    title: "Test PRD",
    sections: [
      { heading: "Features", content: "Feature list", tokens: 10, compressed: false, originalTokens: 10 },
    ],
    collapsed: false,
    ...overrides,
  };
}

const defaultStats: PackStats = {
  budget: 12000,
  used: 500,
  specsIncluded: 1,
  specsExcluded: 0,
  sectionsCompressed: 0,
  allocations: [],
};

describe("formatXml", () => {
  it("wraps output in <context> root element with stats", () => {
    const output = formatXml([makeCompressedSpec()], defaultStats);
    expect(output).toContain('<context budget="12000" used="500" specs="1" compressed="0">');
    expect(output).toContain("</context>");
  });

  it("creates <spec> elements with attributes", () => {
    const output = formatXml(
      [makeCompressedSpec()],
      { ...defaultStats, allocations: [{ specId: "prd-001", type: "prd", relevance: 0.92, tokens: 500, compressed: false, included: true }] },
    );
    expect(output).toContain('id="prd-001"');
    expect(output).toContain('type="prd"');
    expect(output).toContain('relevance="0.92"');
  });

  it("creates <section> elements for each section", () => {
    const output = formatXml([makeCompressedSpec()], defaultStats);
    expect(output).toContain('<section name="Features">');
    expect(output).toContain("Feature list");
    expect(output).toContain("</section>");
  });

  it("marks compressed sections", () => {
    const spec = makeCompressedSpec({
      sections: [
        { heading: "Data Model", content: "[Unchanged since 2026-01-01 — 100 tokens omitted]", tokens: 10, compressed: true, originalTokens: 100 },
      ],
    });
    const output = formatXml([spec], { ...defaultStats, sectionsCompressed: 1 });
    expect(output).toContain('compressed="true"');
  });

  it("handles collapsed ADRs", () => {
    const spec = makeCompressedSpec({
      specId: "adr-001",
      type: "adr",
      collapsed: true,
      collapsedSummary: "[ADR] Choose DB — superseded",
      sections: [],
    });
    const output = formatXml([spec], defaultStats);
    expect(output).toContain("[ADR] Choose DB — superseded");
  });

  it("escapes XML special characters in content", () => {
    const spec = makeCompressedSpec({
      sections: [
        { heading: "API", content: "Use <auth> & handle \"errors\"", tokens: 10, compressed: false, originalTokens: 10 },
      ],
    });
    const output = formatXml([spec], defaultStats);
    expect(output).toContain("&lt;auth&gt;");
    expect(output).toContain("&amp;");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm --filter @sdx/pack test`
Expected: FAIL — module not found

- [x] **Step 3: Implement XML formatter**

`packages/pack/src/formatters/xml.ts`:

```typescript
import type { CompressedSpec, PackStats } from "../types.js";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatXml(specs: CompressedSpec[], stats: PackStats): string {
  const lines: string[] = [];
  lines.push(
    `<context budget="${stats.budget}" used="${stats.used}" specs="${stats.specsIncluded}" compressed="${stats.sectionsCompressed}">`,
  );

  for (const spec of specs) {
    const allocation = stats.allocations.find((a) => a.specId === spec.specId);
    const relevance = allocation?.relevance ?? 1.0;
    const tokens = allocation?.tokens ?? 0;

    lines.push(`  <spec id="${escapeXml(spec.specId)}" type="${escapeXml(spec.type)}" relevance="${relevance}" tokens="${tokens}">`);

    if (spec.collapsed && spec.collapsedSummary) {
      lines.push(`    ${escapeXml(spec.collapsedSummary)}`);
    } else {
      for (const section of spec.sections) {
        const compressedAttr = section.compressed ? ' compressed="true"' : "";
        lines.push(`    <section name="${escapeXml(section.heading)}"${compressedAttr}>`);
        lines.push(`      ${escapeXml(section.content)}`);
        lines.push(`    </section>`);
      }
    }

    lines.push(`  </spec>`);
  }

  lines.push(`</context>`);
  return lines.join("\n");
}
```

- [x] **Step 4: Run tests**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm --filter @sdx/pack test`
Expected: All XML formatter tests PASS

- [x] **Step 5: Commit**

```bash
git add packages/pack/src/formatters/xml.ts packages/pack/src/formatters.test.ts
git commit -m "feat(pack): implement XML output formatter"
```

---

## Task 8: Markdown Formatter

**Files:**
- Create: `packages/pack/src/formatters/markdown.ts`
- Modify: `packages/pack/src/formatters.test.ts`

- [x] **Step 1: Write failing tests**

Add to `packages/pack/src/formatters.test.ts`:

```typescript
import { formatMarkdown } from "./formatters/markdown.js";

describe("formatMarkdown", () => {
  it("creates H1 headers for each spec", () => {
    const output = formatMarkdown([makeCompressedSpec()], defaultStats);
    expect(output).toContain("# prd-001 (prd)");
  });

  it("includes relevance in header", () => {
    const output = formatMarkdown(
      [makeCompressedSpec()],
      { ...defaultStats, allocations: [{ specId: "prd-001", type: "prd", relevance: 0.92, tokens: 500, compressed: false, included: true }] },
    );
    expect(output).toContain("[relevance: 0.92]");
  });

  it("creates H2 headers for sections", () => {
    const output = formatMarkdown([makeCompressedSpec()], defaultStats);
    expect(output).toContain("## Features");
    expect(output).toContain("Feature list");
  });

  it("separates specs with horizontal rules", () => {
    const specs = [
      makeCompressedSpec({ specId: "prd-001" }),
      makeCompressedSpec({ specId: "tech-001", type: "technical-design" }),
    ];
    const output = formatMarkdown(specs, { ...defaultStats, specsIncluded: 2 });
    expect(output).toContain("---");
  });

  it("handles collapsed ADRs", () => {
    const spec = makeCompressedSpec({
      collapsed: true,
      collapsedSummary: "[ADR] Choose DB — superseded",
      sections: [],
    });
    const output = formatMarkdown([spec], defaultStats);
    expect(output).toContain("[ADR] Choose DB — superseded");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm --filter @sdx/pack test`
Expected: FAIL

- [x] **Step 3: Implement Markdown formatter**

`packages/pack/src/formatters/markdown.ts`:

```typescript
import type { CompressedSpec, PackStats } from "../types.js";

export function formatMarkdown(specs: CompressedSpec[], stats: PackStats): string {
  const parts: string[] = [];

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i]!;
    const allocation = stats.allocations.find((a) => a.specId === spec.specId);
    const relevance = allocation?.relevance ?? 1.0;

    parts.push(`# ${spec.specId} (${spec.type}) [relevance: ${relevance}]`);
    parts.push("");

    if (spec.collapsed && spec.collapsedSummary) {
      parts.push(spec.collapsedSummary);
      parts.push("");
    } else {
      for (const section of spec.sections) {
        if (section.heading) {
          parts.push(`## ${section.heading}`);
          parts.push("");
        }
        parts.push(section.content);
        parts.push("");
      }
    }

    if (i < specs.length - 1) {
      parts.push("---");
      parts.push("");
    }
  }

  return parts.join("\n").trimEnd();
}
```

- [x] **Step 4: Run tests**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm --filter @sdx/pack test`
Expected: All formatter tests PASS

- [x] **Step 5: Commit**

```bash
git add packages/pack/src/formatters/markdown.ts packages/pack/src/formatters.test.ts
git commit -m "feat(pack): implement Markdown output formatter"
```

---

## Task 9: JSON Formatter

**Files:**
- Create: `packages/pack/src/formatters/json.ts`
- Modify: `packages/pack/src/formatters.test.ts`

- [x] **Step 1: Write failing tests**

Add to `packages/pack/src/formatters.test.ts`:

```typescript
import { formatJson } from "./formatters/json.js";

describe("formatJson", () => {
  it("produces valid JSON", () => {
    const output = formatJson([makeCompressedSpec()], defaultStats);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it("includes budget and used in root", () => {
    const output = formatJson([makeCompressedSpec()], defaultStats);
    const parsed = JSON.parse(output);
    expect(parsed.budget).toBe(12000);
    expect(parsed.used).toBe(500);
  });

  it("includes specs array with sections", () => {
    const output = formatJson([makeCompressedSpec()], defaultStats);
    const parsed = JSON.parse(output);
    expect(parsed.specs).toHaveLength(1);
    expect(parsed.specs[0].id).toBe("prd-001");
    expect(parsed.specs[0].sections).toHaveLength(1);
    expect(parsed.specs[0].sections[0].name).toBe("Features");
    expect(parsed.specs[0].sections[0].compressed).toBe(false);
  });

  it("handles collapsed ADRs", () => {
    const spec = makeCompressedSpec({
      specId: "adr-001",
      type: "adr",
      collapsed: true,
      collapsedSummary: "[ADR] Choose DB — superseded",
      sections: [],
    });
    const output = formatJson([spec], defaultStats);
    const parsed = JSON.parse(output);
    expect(parsed.specs[0].collapsed).toBe(true);
    expect(parsed.specs[0].summary).toBe("[ADR] Choose DB — superseded");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm --filter @sdx/pack test`
Expected: FAIL

- [x] **Step 3: Implement JSON formatter**

`packages/pack/src/formatters/json.ts`:

```typescript
import type { CompressedSpec, PackStats } from "../types.js";

export function formatJson(specs: CompressedSpec[], stats: PackStats): string {
  const output = {
    budget: stats.budget,
    used: stats.used,
    specs: specs.map((spec) => {
      const allocation = stats.allocations.find((a) => a.specId === spec.specId);

      if (spec.collapsed) {
        return {
          id: spec.specId,
          type: spec.type,
          relevance: allocation?.relevance ?? 1.0,
          tokens: allocation?.tokens ?? 0,
          collapsed: true,
          summary: spec.collapsedSummary ?? "",
          sections: [],
        };
      }

      return {
        id: spec.specId,
        type: spec.type,
        relevance: allocation?.relevance ?? 1.0,
        tokens: allocation?.tokens ?? 0,
        collapsed: false,
        sections: spec.sections.map((s) => ({
          name: s.heading,
          content: s.content,
          compressed: s.compressed,
        })),
      };
    }),
  };

  return JSON.stringify(output, null, 2);
}
```

- [x] **Step 4: Run tests**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm --filter @sdx/pack test`
Expected: All formatter tests PASS

- [x] **Step 5: Commit**

```bash
git add packages/pack/src/formatters/json.ts packages/pack/src/formatters.test.ts
git commit -m "feat(pack): implement JSON output formatter"
```

---

## Task 10: Pack Entry Point

**Files:**
- Modify: `packages/pack/src/index.ts`
- Create: `packages/pack/src/pack.test.ts`

The `pack()` function orchestrates the three stages and is the public API.

- [x] **Step 1: Write failing integration test**

`packages/pack/src/pack.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { pack } from "./index.js";
import type { ParsedSpec, ParsedSection, DependencyGraph } from "@sdx/core";
import type { PackConfig } from "@sdx/schema";

function sec(heading: string, content: string, tokens: number): ParsedSection {
  return { heading, content, tokens };
}

function makeSpec(id: string, overrides: Partial<ParsedSpec> = {}): ParsedSpec {
  const sections = overrides.parsedSections ?? [
    sec("Features", "Login feature, signup feature", 50),
    sec("Goals", "Improve user experience", 30),
  ];
  return {
    filePath: `specs/${id}.md`,
    frontmatter: {
      id,
      type: "prd",
      title: `${id} Title`,
      status: "draft",
      version: "1.0",
      created: "2026-01-01",
      authors: ["dev"],
      tags: [],
      ...overrides.frontmatter,
    } as any,
    content: sections.map((s) => s.content).join("\n"),
    sections: sections.map((s) => s.heading).filter(Boolean),
    parsedSections: sections,
    valid: true,
    validationErrors: null,
    ...overrides,
  };
}

describe("pack", () => {
  it("packs all specs with no task (default XML format)", () => {
    const specs = [makeSpec("prd"), makeSpec("tech")];
    const result = pack(specs, {}, undefined, undefined);
    expect(result.output).toContain("<context");
    expect(result.output).toContain("</context>");
    expect(result.stats.specsIncluded).toBe(2);
  });

  it("filters by task relevance", () => {
    const specs = [
      makeSpec("auth", { frontmatter: { title: "Authentication System", tags: ["login"] } as any }),
      makeSpec("billing", { frontmatter: { title: "Billing System", tags: ["payments"] } as any }),
    ];
    const result = pack(specs, { task: "login authentication" }, undefined, undefined);
    // auth should be included, billing may be excluded
    const authAlloc = result.stats.allocations.find((a) => a.specId === "auth");
    expect(authAlloc).toBeDefined();
    expect(authAlloc!.included).toBe(true);
  });

  it("filters by explicit spec IDs", () => {
    const specs = [makeSpec("prd"), makeSpec("tech"), makeSpec("stories")];
    const result = pack(specs, { specs: ["prd"] }, undefined, undefined);
    expect(result.stats.specsIncluded).toBeGreaterThanOrEqual(1);
    const prdAlloc = result.stats.allocations.find((a) => a.specId === "prd");
    expect(prdAlloc).toBeDefined();
    expect(prdAlloc!.included).toBe(true);
  });

  it("respects budget", () => {
    const specs = [
      makeSpec("big", { parsedSections: [sec("Content", "x".repeat(10000), 5000)] }),
      makeSpec("small", { parsedSections: [sec("Content", "small", 10)] }),
    ];
    const result = pack(specs, { budget: 100 }, undefined, undefined);
    expect(result.stats.used).toBeLessThanOrEqual(100);
  });

  it("outputs markdown format", () => {
    const specs = [makeSpec("prd")];
    const result = pack(specs, { format: "markdown" }, undefined, undefined);
    expect(result.output).toContain("# prd (prd)");
  });

  it("outputs JSON format", () => {
    const specs = [makeSpec("prd")];
    const result = pack(specs, { format: "json" }, undefined, undefined);
    const parsed = JSON.parse(result.output);
    expect(parsed.specs).toBeDefined();
  });

  it("returns dry-run stats without output", () => {
    const specs = [makeSpec("prd")];
    const result = pack(specs, { dryRun: true }, undefined, undefined);
    expect(result.output).toBe("");
    expect(result.stats.specsIncluded).toBeGreaterThan(0);
  });

  it("uses pack config defaults when provided", () => {
    const specs = [makeSpec("prd")];
    const config: PackConfig = { max_tokens: 500, format: "json" };
    const result = pack(specs, {}, config, undefined);
    expect(result.stats.budget).toBe(500);
    const parsed = JSON.parse(result.output);
    expect(parsed).toBeDefined();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm --filter @sdx/pack test`
Expected: FAIL — `pack` not exported

- [x] **Step 3: Implement pack() in index.ts**

`packages/pack/src/index.ts`:

```typescript
import type { ParsedSpec, DependencyGraph } from "@sdx/core";
import type { PackConfig } from "@sdx/schema";
import type { PackOptions, PackResult, CompressionOptions } from "./types.js";
import { scoreSpecs, scoreSpecsByIds } from "./resolver.js";
import { allocate } from "./allocator.js";
import { formatXml } from "./formatters/xml.js";
import { formatMarkdown } from "./formatters/markdown.js";
import { formatJson } from "./formatters/json.js";

export type {
  PackOptions,
  PackResult,
  PackStats,
  SpecAllocation,
  RelevanceScore,
  CompressedSpec,
  CompressedSection,
  CompressionOptions,
} from "./types.js";
export { scoreSpecs, scoreSpecsByIds } from "./resolver.js";
export { compressSpec } from "./compressor.js";
export { allocate } from "./allocator.js";
export { formatXml } from "./formatters/xml.js";
export { formatMarkdown } from "./formatters/markdown.js";
export { formatJson } from "./formatters/json.js";

const DEFAULT_BUDGET = 12000;
const DEFAULT_FORMAT = "xml";
const DEFAULT_BOILERPLATE = ["Changelog", "Revision History", "Document History"];

export function pack(
  specs: ParsedSpec[],
  options: PackOptions,
  packConfig: PackConfig | undefined,
  graph: DependencyGraph | undefined,
): PackResult {
  const budget = options.budget ?? packConfig?.max_tokens ?? DEFAULT_BUDGET;
  const format = options.format ?? packConfig?.format ?? DEFAULT_FORMAT;

  const compression: CompressionOptions = {
    stripBoilerplate: packConfig?.compression?.strip_boilerplate ?? true,
    stableDays: packConfig?.compression?.stable_days ?? 7,
    collapseResolvedAdrs: packConfig?.compression?.collapse_resolved_adrs ?? true,
    boilerplateSections: packConfig?.boilerplate_sections ?? DEFAULT_BOILERPLATE,
  };

  // Stage 1: Resolve relevance
  let scores;
  if (options.specs) {
    // Explicit spec IDs: score 1.0 for named, 0.5 for upstream deps
    scores = scoreSpecsByIds(specs, options.specs, graph);
  } else {
    scores = scoreSpecs(specs, options.task, graph);
  }

  // Stage 2: Allocate tokens
  const allocation = allocate(specs, scores, {
    budget,
    full: options.full ?? false,
    compression,
  });

  // Dry run: return stats only
  if (options.dryRun) {
    return { output: "", stats: allocation.stats };
  }

  // Stage 3: Format output
  const formatter =
    format === "json" ? formatJson : format === "markdown" ? formatMarkdown : formatXml;
  const output = formatter(allocation.specs, allocation.stats);

  return { output, stats: allocation.stats };
}

// scoreSpecsByIds is imported from resolver.ts (see Task 4)
```

- [x] **Step 4: Run tests**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm --filter @sdx/pack test`
Expected: All tests PASS

- [x] **Step 5: Run full test suite**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm test`
Expected: All tests PASS across all packages

- [x] **Step 6: Commit**

```bash
git add packages/pack/src/index.ts packages/pack/src/pack.test.ts
git commit -m "feat(pack): implement pack() entry point orchestrating resolve, allocate, format pipeline"
```

---

## Task 11: CLI `sdx pack` Command

**Files:**
- Create: `packages/cli/src/commands/pack.ts`
- Modify: `packages/cli/src/main.ts`

- [x] **Step 1: Write failing test**

Create `packages/cli/test/pack.test.ts` (or add to existing CLI test file):

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

describe("sdx pack", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "sdx-pack-test-"));
    await mkdir(join(tmpDir, "specs"), { recursive: true });

    await writeFile(
      join(tmpDir, "spec.config.yaml"),
      [
        'version: "1.0"',
        "project:",
        '  name: "test"',
        "specs:",
        "  prd:",
        "    path: specs/prd.md",
        "    type: prd",
      ].join("\n"),
      "utf-8",
    );

    await writeFile(
      join(tmpDir, "specs/prd.md"),
      [
        "---",
        "id: prd",
        "type: prd",
        'title: "Test PRD"',
        "status: draft",
        'version: "1.0"',
        'created: "2026-01-01"',
        'authors: ["dev"]',
        "---",
        "",
        "## Problem Statement",
        "",
        "We need authentication.",
        "",
        "## Goals",
        "",
        "Secure login.",
        "",
        "## Non-Goals",
        "",
        "Social login.",
        "",
        "## Features",
        "",
        "- **F1**: Email login",
        "",
        "## Success Criteria",
        "",
        "Users can log in.",
      ].join("\n"),
      "utf-8",
    );
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true });
  });

  it("outputs XML by default", () => {
    const result = execSync(`node dist/main.js pack`, { cwd: tmpDir, env: { ...process.env, PATH: process.env.PATH } }).toString();
    // The actual sdx binary may not work in test, so we'll test the runPack function instead
    // This test validates the CLI integration exists
  });
});
```

Actually, CLI tests are better as integration tests against the exported `runPack` function. Let me adjust:

```typescript
// packages/cli/test/pack.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runPack } from "../src/commands/pack.js";

describe("runPack", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "sdx-pack-test-"));
    await mkdir(join(tmpDir, "specs"), { recursive: true });

    await writeFile(join(tmpDir, "spec.config.yaml"), [
      'version: "1.0"',
      "specs:",
      "  prd:",
      "    path: specs/prd.md",
      "    type: prd",
    ].join("\n"), "utf-8");

    await writeFile(join(tmpDir, "specs/prd.md"), [
      "---",
      "id: prd",
      "type: prd",
      'title: "Test PRD"',
      "status: draft",
      'version: "1.0"',
      'created: "2026-01-01"',
      'authors: ["dev"]',
      "---",
      "",
      "## Problem Statement",
      "",
      "We need better auth.",
      "",
      "## Goals",
      "",
      "Secure login.",
      "",
      "## Non-Goals",
      "",
      "None.",
      "",
      "## Features",
      "",
      "- **F1**: Login",
      "",
      "## Success Criteria",
      "",
      "Users can log in.",
    ].join("\n"), "utf-8");
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true });
  });

  it("returns XML pack result", async () => {
    const result = await runPack({ configDir: tmpDir });
    expect(result.output).toContain("<context");
    expect(result.output).toContain("</context>");
    expect(result.stats.specsIncluded).toBe(1);
  });

  it("returns JSON format when requested", async () => {
    const result = await runPack({ configDir: tmpDir, format: "json" });
    const parsed = JSON.parse(result.output);
    expect(parsed.specs).toHaveLength(1);
  });

  it("returns dry-run stats without output", async () => {
    const result = await runPack({ configDir: tmpDir, dryRun: true });
    expect(result.output).toBe("");
    expect(result.stats.specsIncluded).toBe(1);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm --filter specdx test`
Expected: FAIL — `runPack` not found

- [x] **Step 3: Implement pack.ts command**

`packages/cli/src/commands/pack.ts`:

```typescript
import { defineCommand } from "citty";
import { writeFile } from "node:fs/promises";
import { loadConfig, parseSpec, resolveGlob, buildGraph, createLogger } from "@sdx/core";
import { pack, type PackResult } from "@sdx/pack";
import type { ParsedSpec } from "@sdx/core";
import { sharedArgs } from "../shared-args.js";

export interface RunPackOptions {
  configDir: string;
  task?: string;
  specs?: string[];
  budget?: number;
  format?: "xml" | "markdown" | "json";
  full?: boolean;
  dryRun?: boolean;
}

export async function runPack(options: RunPackOptions): Promise<PackResult> {
  const config = await loadConfig(undefined, options.configDir);

  const allSpecs: ParsedSpec[] = [];
  for (const [, entry] of Object.entries(config.specs)) {
    const files = await resolveGlob(entry.path, options.configDir);
    for (const file of files) {
      allSpecs.push(await parseSpec(file));
    }
  }

  let graph;
  try {
    graph = buildGraph(config);
  } catch {
    // Graph errors are non-fatal for pack
  }

  return pack(
    allSpecs,
    {
      task: options.task,
      specs: options.specs,
      budget: options.budget,
      format: options.format,
      full: options.full,
      dryRun: options.dryRun,
    },
    config.pack,
    graph,
  );
}

export default defineCommand({
  meta: { name: "pack", description: "Pack spec context for LLM consumption" },
  args: {
    quiet: sharedArgs.quiet,
    verbose: sharedArgs.verbose,
    task: { type: "string", description: "Task description for relevance filtering" },
    specs: { type: "string", description: "Comma-separated spec IDs to pack" },
    budget: { type: "string", description: "Token budget (default: 12000)" },
    format: { type: "string", description: "Output format: xml, markdown, json (default: xml)" },
    out: { type: "string", description: "Write output to file" },
    full: { type: "boolean", description: "Disable compression" },
    "dry-run": { type: "boolean", description: "Show plan without packing" },
  },
  async run({ args }) {
    const logger = createLogger({ quiet: args.quiet, verbose: args.verbose });

    if (args.task && args.specs) {
      console.error("  ✗ --task and --specs are mutually exclusive");
      process.exit(1);
    }

    try {
      const budget = args.budget ? parseInt(args.budget, 10) : undefined;
      if (budget !== undefined && isNaN(budget)) {
        console.error("  ✗ --budget must be a number");
        process.exit(1);
      }

      const result = await runPack({
        configDir: process.cwd(),
        task: args.task,
        specs: args.specs ? args.specs.split(",").map((s: string) => s.trim()) : undefined,
        budget,
        format: args.format as "xml" | "markdown" | "json" | undefined,
        full: args.full,
        dryRun: args["dry-run"],
      });

      if (args["dry-run"]) {
        console.log("\n  Dry Run — Pack Plan:\n");
        for (const alloc of result.stats.allocations) {
          const status = alloc.included ? "✓" : "✗";
          const compressed = alloc.compressed ? " (compressed)" : "";
          console.log(`  ${status} ${alloc.specId} (${alloc.type}) — ${alloc.tokens} tokens, relevance ${alloc.relevance}${compressed}`);
        }
        console.log(`\n  Budget: ${result.stats.used} / ${result.stats.budget} tokens`);
        console.log(`  Specs: ${result.stats.specsIncluded} included, ${result.stats.specsExcluded} excluded\n`);
        return;
      }

      if (args.out) {
        await writeFile(args.out, result.output, "utf-8");
        logger.info(`Packed output written to ${args.out}`);
      } else {
        process.stdout.write(result.output);
      }

      // Token report to stderr
      console.error(
        `\nPacked ${result.stats.specsIncluded}/${result.stats.specsIncluded + result.stats.specsExcluded} specs • ${result.stats.used} / ${result.stats.budget} tokens • ${result.stats.sectionsCompressed} sections compressed`,
      );
    } catch (err) {
      console.error(`\n  ✗ ${(err as Error).message}\n`);
      process.exit(1);
    }
  },
});
```

- [x] **Step 4: Register in main.ts**

In `packages/cli/src/main.ts`, add the pack subcommand:

```typescript
subCommands: {
  init: initCommand,
  lint: () => import("./commands/lint.js").then((m) => m.default),
  validate: () => import("./commands/validate.js").then((m) => m.default),
  graph: () => import("./commands/graph.js").then((m) => m.default),
  pack: () => import("./commands/pack.js").then((m) => m.default),
},
```

- [x] **Step 5: Add @sdx/pack dependency to CLI package.json**

In `packages/cli/package.json`, add to devDependencies:

```json
"@sdx/pack": "workspace:*"
```

- [x] **Step 6: Run tests**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm --filter specdx test`
Expected: All CLI tests PASS

- [x] **Step 7: Commit**

```bash
git add packages/cli/src/commands/pack.ts packages/cli/src/main.ts packages/cli/package.json packages/cli/test/
git commit -m "feat(cli): add sdx pack command with task relevance, budget, and format options"
```

---

## Task 12: Skills Install Logic

**Files:**
- Modify: `packages/skills/package.json`
- Modify: `packages/skills/tsconfig.json`
- Create: `packages/skills/src/install.ts`
- Modify: `packages/skills/src/index.ts`
- Create: `packages/skills/src/install.test.ts`

- [x] **Step 1: Write failing test**

`packages/skills/src/install.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { installSkills, SKILL_FILES } from "./install.js";

describe("installSkills", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "sdx-skills-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true });
  });

  it("copies skill files to .claude/skills/ directory", async () => {
    const results = await installSkills(tmpDir);

    for (const file of SKILL_FILES) {
      const targetPath = join(tmpDir, ".claude", "skills", file);
      const s = await stat(targetPath);
      expect(s.isFile()).toBe(true);
    }

    expect(results.installed.length).toBeGreaterThan(0);
  });

  it("creates .claude/skills/ directory if it doesn't exist", async () => {
    await installSkills(tmpDir);
    const s = await stat(join(tmpDir, ".claude", "skills"));
    expect(s.isDirectory()).toBe(true);
  });

  it("reports 'updated' when overwriting existing files", async () => {
    // Install once
    await installSkills(tmpDir);
    // Install again
    const results = await installSkills(tmpDir);
    expect(results.updated.length).toBeGreaterThan(0);
    expect(results.installed.length).toBe(0);
  });

  it("skill files are valid markdown with content", async () => {
    await installSkills(tmpDir);
    for (const file of SKILL_FILES) {
      const content = await readFile(join(tmpDir, ".claude", "skills", file), "utf-8");
      expect(content.length).toBeGreaterThan(100);
      expect(content).toContain("---"); // frontmatter
    }
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm --filter @sdx/skills test`
Expected: FAIL — `installSkills` not found

- [x] **Step 3: Create skill markdown files**

`packages/skills/skills/sdx-start-task.md`:

```markdown
---
name: sdx:start-task
description: Load spec context for a coding task. Packs relevant specs into your session so the LLM references them during implementation.
---

# sdx:start-task

Load spec context at the start of a coding session so the LLM has structured requirements, constraints, and acceptance criteria.

## When to Use

Use this skill when you're about to start implementing a feature, fixing a bug, or doing any work that should align with project specs. It ensures the LLM has the right context before writing code.

## How It Works

1. The developer describes their task
2. This skill runs `sdx pack --task "<description>" --format xml` to find and pack relevant specs
3. The packed spec context is loaded into the conversation
4. The LLM uses spec context throughout the session

## Instructions

When the user invokes this skill or describes a task they want to start:

1. **Extract the task description** from the user's message.

2. **Run the pack command** to get relevant spec context:
   ```bash
   sdx pack --task "<task description>" --format xml
   ```
   If this fails (e.g., no spec.config.yaml), inform the user and suggest running `sdx init`.

3. **Read the packed output** and present a brief summary:
   - Which specs were included and their relevance scores
   - Total tokens used vs budget
   - Any sections that were compressed

4. **Set session guardrails** for the remainder of the conversation:
   - Reference the loaded specs when making implementation decisions
   - Flag if the implementation appears to drift from spec intent
   - Note any gaps in the specs discovered during work (missing edge cases, ambiguous requirements)
   - Do NOT hallucinate spec content — only reference what was actually packed

5. **Proceed with the task**, keeping the spec context active.

## Example

User: "I need to implement the user authentication flow"

→ Run: `sdx pack --task "implement user authentication flow" --format xml`
→ Summary: "Loaded 3 specs (PRD, Technical Design, Auth Story) — 4,200 tokens"
→ Begin implementation with spec context active

## Troubleshooting

- **No specs found**: The task description may not match any spec content. Try broader terms or use `sdx pack --dry-run --task "..."` to see relevance scores.
- **Too many tokens**: Reduce budget with `--budget` flag or be more specific in the task description.
- **Missing sdx**: Ensure `specdx` is installed (`npm install -g specdx` or `npx specdx`).
```

`packages/skills/skills/sdx-author-spec.md`:

```markdown
---
name: sdx:author-spec
description: Guided spec authoring with iterative linting. Walk through sections, validate as you go, and produce a spec that passes sdx lint.
---

# sdx:author-spec

Interactively author a new spec or update an existing one, with iterative validation using `sdx lint`.

## When to Use

Use this skill when you need to create a new spec (PRD, technical design, user story, test plan, ADR, or API contract) or significantly update an existing one. It guides you through the required sections and validates as you go.

## Supported Spec Types

| Type | Required Sections |
|---|---|
| `prd` | Problem Statement, Goals, Non-Goals, Features, Success Criteria |
| `technical-design` | Overview, Architecture, Data Model, API Design, Dependencies, Risks, Open Questions |
| `user-story` | Description, Acceptance Criteria, Dependencies, Notes |
| `test-plan` | Scope, Test Cases, Coverage Matrix, Edge Cases |
| `adr` | Context, Decision, Status, Consequences |
| `api-contract` | Endpoints, Request/Response Schemas, Auth, Error Codes |

## Instructions

When the user invokes this skill or asks to write/create a spec:

1. **Determine the spec type.** If not obvious from the request, ask:
   > "What type of spec are you writing? Options: prd, technical-design, user-story, test-plan, adr, api-contract"

2. **Check for existing specs** in the project:
   ```bash
   sdx validate
   ```
   This confirms the project has a valid `spec.config.yaml` and shows existing specs.

3. **Create the spec file** with frontmatter scaffold. Generate an appropriate `id` based on the topic and create the file in the project's `specs/` directory:

   ```markdown
   ---
   id: "<generated-id>"
   type: "<spec-type>"
   title: "<title from user>"
   status: draft
   version: "0.1"
   created: "<today's date>"
   authors: ["<user>"]
   ---
   ```

4. **Walk through sections one at a time.** For each required section:
   - Explain what the section should contain
   - Ask the user for the content (or draft it based on their description)
   - Write the section to the file
   - After every 2-3 sections, run `sdx lint --path <file>` to catch issues early

5. **Handle references.** If the spec should reference other specs:
   - Check what specs exist in the suite
   - Add appropriate `references` to frontmatter
   - Validate with `sdx lint` that references point to valid specs

6. **Final validation.** After all sections are written:
   ```bash
   sdx lint --path <file> --preset strict
   ```
   Fix any remaining issues.

7. **Update spec.config.yaml** if the new spec needs to be registered (add it to the `specs` section with appropriate `type` and `requires` fields).

8. **Summary.** Report what was created, lint status, and any remaining TODOs.

## Authoring Tips

- **Be specific in Features sections** — avoid vague language like "handle edge cases" or "as appropriate" (the `no-vague-language` rule will catch these)
- **Use feature IDs** (e.g., **F1**, **F2**) in PRDs — the `story-coverage` rule checks that each feature has a corresponding user story
- **Set the `updated` field** when modifying existing specs — the `staleness-check` rule compares timestamps across the dependency chain
- **Quote dates** in frontmatter — unquoted YAML dates are parsed as Date objects and will fail validation

## Example

User: "I need to write a PRD for our new payments system"

→ Determine type: `prd`
→ Create `specs/payments-prd.md` with frontmatter
→ Walk through: Problem Statement → Goals → Non-Goals → Features → Success Criteria
→ Lint after Features section
→ Final lint with strict preset
→ Register in spec.config.yaml
→ "PRD created at specs/payments-prd.md — passing strict lint"
```

- [x] **Step 4: Implement install.ts**

`packages/skills/src/install.ts`:

```typescript
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const SKILL_FILES = ["sdx-start-task.md", "sdx-author-spec.md"];

export interface InstallResult {
  installed: string[];
  updated: string[];
}

function getSkillSourceDir(): string {
  // When bundled by tsup into dist/main.js, skill files are copied to dist/skills/
  // via the onSuccess hook. import.meta.url resolves to the bundle location.
  // So skills are at __dirname + "/skills" (sibling of the bundled JS file).
  // In development (src/install.ts), skills are at ../skills/ relative to src/.
  const bundledPath = join(__dirname, "skills");
  const devPath = join(__dirname, "..", "skills");
  // Try bundled path first, fall back to dev path
  try {
    statSync(bundledPath);
    return bundledPath;
  } catch {
    return devPath;
  }
}

export async function installSkills(targetDir: string): Promise<InstallResult> {
  const skillsDir = join(targetDir, ".claude", "skills");
  await mkdir(skillsDir, { recursive: true });

  const sourceDir = getSkillSourceDir();
  const installed: string[] = [];
  const updated: string[] = [];

  for (const file of SKILL_FILES) {
    const sourcePath = join(sourceDir, file);
    const targetPath = join(skillsDir, file);

    const content = await readFile(sourcePath, "utf-8");

    let exists = false;
    try {
      await stat(targetPath);
      exists = true;
    } catch {
      // File doesn't exist
    }

    await writeFile(targetPath, content, "utf-8");

    if (exists) {
      updated.push(file);
    } else {
      installed.push(file);
    }
  }

  return { installed, updated };
}
```

- [x] **Step 5: Update index.ts**

`packages/skills/src/index.ts`:

```typescript
export { installSkills, SKILL_FILES, type InstallResult } from "./install.js";
```

- [x] **Step 6: Update package.json and tsconfig.json**

`packages/skills/package.json` — add the `skills` directory to `files`:

```json
{
  "name": "@sdx/skills",
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist", "skills"],
  "scripts": {
    "build": "tsc --build",
    "typecheck": "tsc --build --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist *.tsbuildinfo"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

`packages/skills/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
```

Verify `packages/skills/vitest.config.ts` matches the existing pattern:

```typescript
import { mergeConfig } from "vitest/config";
import shared from "../../vitest.shared.js";

export default mergeConfig(shared, {});
```

- [x] **Step 7: Run tests**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm --filter @sdx/skills test`
Expected: All install tests PASS

- [x] **Step 8: Commit**

```bash
git add packages/skills/
git commit -m "feat(skills): add sdx:start-task and sdx:author-spec skill files with install logic"
```

---

## Task 13: CLI `sdx skills install` Command

**Files:**
- Create: `packages/cli/src/commands/skills.ts`
- Modify: `packages/cli/src/main.ts`
- Modify: `packages/cli/package.json`

- [x] **Step 1: Implement skills.ts command**

`packages/cli/src/commands/skills.ts`:

```typescript
import { defineCommand } from "citty";
import { installSkills } from "@sdx/skills";

export default defineCommand({
  meta: { name: "skills", description: "Manage sdx skills for AI coding tools" },
  subCommands: {
    install: defineCommand({
      meta: { name: "install", description: "Install Claude Code skill files" },
      args: {
        dir: {
          type: "string",
          description: "Target directory (default: current directory)",
          default: ".",
        },
      },
      async run({ args }) {
        try {
          const result = await installSkills(args.dir);

          if (result.installed.length === 0 && result.updated.length === 0) {
            console.log("  No skill files to install.");
            return;
          }

          for (const file of result.installed) {
            console.log(`  ✓ Installed ${file}`);
          }
          for (const file of result.updated) {
            console.log(`  ✓ Updated ${file}`);
          }

          console.log(`\n  Skills installed to .claude/skills/`);
        } catch (err) {
          console.error(`\n  ✗ ${(err as Error).message}\n`);
          process.exit(1);
        }
      },
    }),
  },
});
```

- [x] **Step 2: Register in main.ts**

Add to subCommands in `packages/cli/src/main.ts`:

```typescript
skills: () => import("./commands/skills.js").then((m) => m.default),
```

- [x] **Step 3: Add @sdx/skills dependency**

In `packages/cli/package.json`, add to devDependencies:

```json
"@sdx/skills": "workspace:*"
```

- [x] **Step 4: Run tests**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm --filter specdx test`
Expected: All CLI tests PASS

- [x] **Step 5: Commit**

```bash
git add packages/cli/src/commands/skills.ts packages/cli/src/main.ts packages/cli/package.json
git commit -m "feat(cli): add sdx skills install command for Claude Code skill files"
```

---

## Task 14: Update tsup Bundling + CLI Exports

**Files:**
- Modify: `packages/cli/tsup.config.ts`
- Modify: `packages/cli/src/index.ts`

The CLI package bundles workspace deps via tsup. Add `@sdx/pack` and `@sdx/skills` to `noExternal`.

- [x] **Step 1: Update tsup.config.ts**

In both entry configs in `packages/cli/tsup.config.ts`, update `noExternal`:

```typescript
noExternal: ["@sdx/schema", "@sdx/core", "@sdx/lint", "@sdx/pack", "@sdx/skills"],
```

The skills package reads markdown files from disk using `import.meta.url` — when bundled, the `skills/` directory must be available relative to the built output. Add a `copy` plugin or adjust the package.json `files` to include the skill markdown files.

Since tsup bundles the JS but not the markdown files, we need the `specdx` package to include them. In `packages/cli/package.json`, update `files`:

```json
"files": [
  "dist",
  "skills"
]
```

And add a postbuild script to copy skill files:

Actually, the simpler approach: have the `install.ts` in `@sdx/skills` resolve the skill files relative to the package, and when bundled into the CLI, the skill files will be at `../../packages/skills/skills/` relative to the bundle. This is fragile.

Better approach: embed the skill content as string constants during build, or use a simpler file resolution.

**Recommended approach:** In the CLI's `skills.ts` command, directly import the install function which uses `import.meta.url`. Since tsup bundles the source, `import.meta.url` will point to the bundled file. Instead, we should have the CLI copy the skills directory to its own dist at build time.

**Simplest approach:** In `packages/cli/package.json`, add the skill files to the package:

```json
"files": ["dist", "skills"]
```

And add a build step that copies them:

In `packages/cli/package.json`, update the build script:

```json
"scripts": {
  "build": "tsup && cp -r ../skills/skills ./skills",
  ...
}
```

Then in the CLI's skills command, resolve the skill source directory relative to the CLI package root, not `import.meta.url`.

Actually, the cleanest approach is to have the install function in `@sdx/skills` accept the skills source directory as a parameter, and let the CLI pass the correct path. But this leaks implementation details.

**Let's keep it simple:** The `installSkills` function in `@sdx/skills` uses `import.meta.url` to find its skill files. When bundled by tsup, `import.meta.url` resolves to the bundled file location. We need the skill markdown files to be at `../skills/` relative to the bundled output.

Update `packages/cli/tsup.config.ts` to copy skill files post-build:

```typescript
import { defineConfig } from "tsup";
import { cpSync } from "node:fs";

export default defineConfig([
  {
    entry: { main: "src/main.ts" },
    format: ["esm"],
    target: "node22",
    platform: "node",
    bundle: true,
    sourcemap: true,
    dts: false,
    clean: true,
    noExternal: ["@sdx/schema", "@sdx/core", "@sdx/lint", "@sdx/pack", "@sdx/skills"],
    external: [
      "ajv", "ajv-formats", "gray-matter", "yaml", "unified", "remark-parse",
      "unist-util-visit", "tinyglobby", "js-tiktoken", "consola", "citty",
    ],
    onSuccess: async () => {
      cpSync("../skills/skills", "./dist/skills", { recursive: true });
    },
  },
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    target: "node22",
    platform: "node",
    bundle: true,
    sourcemap: true,
    dts: false,
    noExternal: ["@sdx/schema", "@sdx/core", "@sdx/lint", "@sdx/pack", "@sdx/skills"],
    external: [
      "ajv", "ajv-formats", "gray-matter", "yaml", "unified", "remark-parse",
      "unist-util-visit", "tinyglobby", "js-tiktoken", "consola", "citty",
    ],
  },
]);
```

This copies `packages/skills/skills/` to `packages/cli/dist/skills/` during build. The `@sdx/skills` install.ts resolves skills via `import.meta.url` → `__dirname/../skills/` → `dist/skills/` when running from the bundled CLI. This works.

Update `packages/cli/package.json` files:

```json
"files": [
  "dist"
]
```

The `dist/skills/` directory is already inside `dist/`, so it's included.

- [x] **Step 2: Update CLI index.ts exports**

In `packages/cli/src/index.ts`:

```typescript
export { scaffoldProject } from "./commands/init.js";
export { runLint } from "./commands/lint.js";
export { runPack } from "./commands/pack.js";
```

- [x] **Step 3: Build and verify**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm build`
Expected: All packages build. `packages/cli/dist/skills/` contains skill markdown files.

- [x] **Step 4: Run full test suite**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm test`
Expected: All tests PASS

- [x] **Step 5: Commit**

```bash
git add packages/cli/tsup.config.ts packages/cli/src/index.ts packages/cli/package.json
git commit -m "feat(cli): bundle @sdx/pack and @sdx/skills into specdx, copy skill files to dist"
```

---

## Task 15: Integration Testing

**Files:**
- Test against a real project (like the existing templates or the sdx project itself)

- [x] **Step 1: Build everything**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm build`
Expected: Clean build across all packages

- [x] **Step 2: Run full test suite**

Run: `cd /Users/umar/Desktop/Work/sdx && pnpm test`
Expected: All tests PASS

- [x] **Step 3: Test `sdx pack` against sdx's own specs**

```bash
cd /Users/umar/Desktop/Work/sdx
node packages/cli/dist/main.js pack
```
Expected: XML output with sdx's own specs (prd.md, technical-design.md, test-plan.md)

- [x] **Step 4: Test task-based relevance**

```bash
node packages/cli/dist/main.js pack --task "implement context packing"
```
Expected: Relevant specs ranked by relevance, token report on stderr

- [x] **Step 5: Test format options**

```bash
node packages/cli/dist/main.js pack --format json
node packages/cli/dist/main.js pack --format markdown
```
Expected: Valid JSON and Markdown output respectively

- [x] **Step 6: Test dry-run**

```bash
node packages/cli/dist/main.js pack --dry-run
```
Expected: Spec list with relevance scores, no packed output

- [x] **Step 7: Test budget constraint**

```bash
node packages/cli/dist/main.js pack --budget 500
```
Expected: Output respects 500-token budget, may exclude specs

- [x] **Step 8: Test --full flag**

```bash
node packages/cli/dist/main.js pack --full
```
Expected: No compression applied, full section content

- [x] **Step 9: Test --out flag**

```bash
node packages/cli/dist/main.js pack --out /tmp/packed.xml
cat /tmp/packed.xml
```
Expected: File written with XML content

- [x] **Step 10: Test skills install**

```bash
cd /tmp && mkdir sdx-test && cd sdx-test
node /Users/umar/Desktop/Work/sdx/packages/cli/dist/main.js skills install
ls -la .claude/skills/
cat .claude/skills/sdx-start-task.md
```
Expected: Two skill files installed in `.claude/skills/`

- [x] **Step 11: Test against shopify-store project**

```bash
cd /Users/umar/Desktop/Projects/shopify-store
node /Users/umar/Desktop/Work/sdx/packages/cli/dist/main.js pack
node /Users/umar/Desktop/Work/sdx/packages/cli/dist/main.js pack --task "implement product listing"
node /Users/umar/Desktop/Work/sdx/packages/cli/dist/main.js pack --dry-run
```
Expected: Works against real project specs

- [x] **Step 12: Commit any test fixes**

```bash
git add -A
git commit -m "fix: address integration testing feedback"
```

---

## Task 16: Publish Alpha

**Files:**
- Modify: `packages/cli/package.json` (version bump)

- [x] **Step 1: Bump version**

Update version in `packages/cli/package.json` to `0.2.0-alpha.1`.

- [x] **Step 2: Build**

```bash
cd /Users/umar/Desktop/Work/sdx && pnpm build
```

- [x] **Step 3: Verify dist contents**

```bash
ls packages/cli/dist/
ls packages/cli/dist/skills/
```
Expected: `main.js`, `index.js`, `skills/sdx-start-task.md`, `skills/sdx-author-spec.md`

- [x] **Step 4: Publish**

```bash
cd packages/cli && npm publish --tag alpha --access public
```

- [x] **Step 5: Verify install**

```bash
npx specdx@alpha pack --help
npx specdx@alpha skills install --help
```
Expected: Help output for both commands

- [x] **Step 6: Commit version bump**

```bash
git add packages/cli/package.json
git commit -m "chore: bump specdx to 0.2.0-alpha.1"
```
