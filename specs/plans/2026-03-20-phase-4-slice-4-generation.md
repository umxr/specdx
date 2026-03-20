# Phase 4 Slice 4 — Spec Generation & Maintenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `sdx generate story --from prd`, `sdx generate test-plan --from stories`, `sdx update --from-code`, and `sdx migrate` — commands that help create and maintain specs over time.

**Architecture:** All 4 commands live in the CLI package. Generation logic uses the existing spec parsers from `@specdx/core` and the feature/acceptance-criteria patterns already established by `@specdx/lint` rules. No new packages needed. `sdx generate` is a parent command with `story` and `test-plan` subcommands.

**Tech Stack:** TypeScript (ESM only), citty (CLI), Vitest

**Design spec:** `specs/designs/2026-03-20-phase-4-spec-intelligence-design.md` (Slice 4 section)

---

## File Structure

```
packages/cli/src/commands/generate.ts             # CREATE: parent generate command
packages/cli/src/commands/generate-story.ts        # CREATE: sdx generate story --from prd
packages/cli/src/commands/generate-story.test.ts   # CREATE: tests
packages/cli/src/commands/generate-test-plan.ts    # CREATE: sdx generate test-plan --from stories
packages/cli/src/commands/generate-test-plan.test.ts # CREATE: tests
packages/cli/src/commands/update.ts                # CREATE: sdx update --from-code
packages/cli/src/commands/update.test.ts           # CREATE: tests
packages/cli/src/commands/migrate.ts               # CREATE: sdx migrate
packages/cli/src/main.ts                           # MODIFY: register generate, update, migrate
```

---

## Task 1: Generate Story Command

Generate user story stubs from a PRD's Features section.

**Files:**
- Create: `packages/cli/src/commands/generate-story.ts`
- Create: `packages/cli/src/commands/generate-story.test.ts`

- [ ] **Step 1: Write failing test**

`packages/cli/src/commands/generate-story.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateStories } from "./generate-story.js";

describe("generateStories", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "sdx-gen-story-"));
    await mkdir(join(tempDir, "specs"), { recursive: true });
    await mkdir(join(tempDir, "specs/stories"), { recursive: true });
  });
  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it("generates story stubs from PRD features", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      [
        'version: "1.0"',
        "specs:",
        "  prd:",
        "    path: specs/prd.md",
        "    type: prd",
        "  stories:",
        "    path: specs/stories/*.md",
        "    type: user-story",
        '    requires: ["prd"]',
      ].join("\n"),
    );
    await writeFile(
      join(tempDir, "specs/prd.md"),
      [
        "---",
        'id: "prd-001"',
        'type: "prd"',
        'title: "Test PRD"',
        'status: "approved"',
        'version: "1.0"',
        'created: "2026-01-01"',
        'authors: ["dev"]',
        "---",
        "",
        "# Test PRD",
        "",
        "## Features",
        "",
        "- **F1**: User authentication with email and password",
        "- **F2**: OAuth support for Google and GitHub",
        "- **F3**: Multi-factor authentication via email OTP",
      ].join("\n"),
    );

    const result = await generateStories({ configDir: tempDir, from: "prd-001" });

    expect(result.generated).toHaveLength(3);
    expect(result.generated[0]).toContain("story-user-authentication");

    const files = await readdir(join(tempDir, "specs/stories"));
    expect(files).toHaveLength(3);

    const content = await readFile(join(tempDir, "specs/stories", files[0]!), "utf-8");
    expect(content).toContain('type: "user-story"');
    expect(content).toContain("## Description");
    expect(content).toContain("## Acceptance Criteria");
    expect(content).toContain("prd-001");
  });

  it("returns empty when PRD has no features", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      'version: "1.0"\nspecs:\n  prd:\n    path: specs/prd.md\n    type: prd\n',
    );
    await writeFile(
      join(tempDir, "specs/prd.md"),
      [
        "---",
        'id: "prd-001"',
        'type: "prd"',
        'title: "Empty PRD"',
        'status: "draft"',
        'version: "1.0"',
        'created: "2026-01-01"',
        'authors: ["dev"]',
        "---",
        "",
        "# Empty PRD",
        "",
        "## Features",
        "",
        "No features yet.",
      ].join("\n"),
    );

    const result = await generateStories({ configDir: tempDir, from: "prd-001" });
    expect(result.generated).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm build && pnpm --filter specdx test
```

- [ ] **Step 3: Implement generate-story.ts**

`packages/cli/src/commands/generate-story.ts`:

```typescript
import { defineCommand } from "citty";
import { loadConfig, parseSpec, resolveGlob, createLogger } from "@specdx/core";
import { REQUIRED_SECTIONS } from "@specdx/schema";
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

interface GenerateStoriesOptions {
  configDir: string;
  from: string;
  outDir?: string;
}

interface GenerateStoriesResult {
  generated: string[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function generateStories(options: GenerateStoriesOptions): Promise<GenerateStoriesResult> {
  const config = await loadConfig(undefined, options.configDir);

  // Find the source PRD spec
  let prdSpec;
  for (const [, entry] of Object.entries(config.specs)) {
    const paths = await resolveGlob(entry.path, options.configDir);
    for (const p of paths) {
      const spec = await parseSpec(p);
      if (spec.frontmatter.id === options.from) {
        prdSpec = spec;
        break;
      }
    }
    if (prdSpec) break;
  }

  if (!prdSpec) {
    throw new Error(`Spec "${options.from}" not found`);
  }

  // Parse features from PRD
  const features: { id: string; text: string }[] = [];
  const featureRe = /\*\*F(\d+)\*\*:\s*(.+)/g;
  let match;
  while ((match = featureRe.exec(prdSpec.content)) !== null) {
    features.push({ id: `F${match[1]}`, text: match[2]!.trim() });
  }

  if (features.length === 0) {
    return { generated: [] };
  }

  // Determine output directory
  const storiesEntry = Object.entries(config.specs).find(([, e]) => e.type === "user-story");
  const outDir = options.outDir
    ?? (storiesEntry ? join(options.configDir, dirname(storiesEntry[1].path.replace(/\*.*$/, ""))) : join(options.configDir, "specs/stories"));

  await mkdir(outDir, { recursive: true });

  const today = new Date().toISOString().slice(0, 10);
  const prdId = prdSpec.frontmatter.id as string;
  const authors = (prdSpec.frontmatter.authors as string[]) ?? ["author"];
  const sections = REQUIRED_SECTIONS["user-story"];
  const generated: string[] = [];

  for (const feature of features) {
    const slug = slugify(feature.text);
    const storyId = `story-${slug}`;
    const filename = `${storyId}.md`;

    const frontmatter = [
      "---",
      `id: "${storyId}"`,
      `type: "user-story"`,
      `title: "${feature.text}"`,
      `status: "draft"`,
      `version: "0.1"`,
      `created: "${today}"`,
      `authors: ${JSON.stringify(authors)}`,
      `story_id: "${storyId}"`,
      `priority: "medium"`,
      `estimate: "TBD"`,
      "references:",
      `  - id: "${prdId}"`,
      `    relationship: "decomposed-into"`,
      "---",
    ].join("\n");

    const sectionContent: Record<string, string> = {
      Description: `Generated from PRD feature **${feature.id}**: ${feature.text}`,
      "Acceptance Criteria": `- [ ] ${feature.text} is implemented and working`,
      Dependencies: `- Implements PRD feature **${feature.id}**`,
      Notes: "<!-- To be filled in -->",
    };

    const body = sections
      .map((s) => `\n## ${s}\n\n${sectionContent[s] ?? "<!-- placeholder -->"}`)
      .join("\n");

    await writeFile(join(outDir, filename), `${frontmatter}\n${body}\n`, "utf-8");
    generated.push(storyId);
  }

  return { generated };
}

export default defineCommand({
  meta: { name: "story", description: "Generate user story stubs from a PRD" },
  args: {
    from: { type: "string", description: "Source PRD spec ID", required: true },
    out: { type: "string", description: "Output directory for stories" },
    quiet: { type: "boolean", description: "Suppress output" },
  },
  async run({ args }) {
    const logger = createLogger({ quiet: args.quiet });
    const result = await generateStories({
      configDir: process.cwd(),
      from: args.from,
      outDir: args.out,
    });

    if (result.generated.length === 0) {
      logger.info("No features found in the PRD.");
      return;
    }

    logger.info(`Generated ${result.generated.length} user story stubs:`);
    for (const id of result.generated) {
      logger.info(`  - ${id}`);
    }
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/generate-story.*
git commit -m "feat(cli): add sdx generate story --from prd"
```

---

## Task 2: Generate Test-Plan Command

Generate test plan stubs from user stories' acceptance criteria.

**Files:**
- Create: `packages/cli/src/commands/generate-test-plan.ts`
- Create: `packages/cli/src/commands/generate-test-plan.test.ts`

- [ ] **Step 1: Write failing test**

`packages/cli/src/commands/generate-test-plan.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateTestPlan } from "./generate-test-plan.js";

describe("generateTestPlan", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "sdx-gen-tp-"));
    await mkdir(join(tempDir, "specs/stories"), { recursive: true });
  });
  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it("generates test plan from story acceptance criteria", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      [
        'version: "1.0"',
        "specs:",
        "  stories:",
        "    path: specs/stories/*.md",
        "    type: user-story",
      ].join("\n"),
    );
    await writeFile(
      join(tempDir, "specs/stories/auth.md"),
      [
        "---",
        'id: "story-auth"',
        'type: "user-story"',
        'title: "Auth"',
        'status: "draft"',
        'version: "1.0"',
        'created: "2026-01-01"',
        'authors: ["dev"]',
        'story_id: "story-auth"',
        'priority: "high"',
        'estimate: "3d"',
        "---",
        "",
        "# Auth",
        "",
        "## Acceptance Criteria",
        "",
        "- [ ] User can log in with email and password",
        "- [ ] Invalid credentials show error message",
        "- [ ] Session persists across page refreshes",
      ].join("\n"),
    );

    const result = await generateTestPlan({ configDir: tempDir });

    expect(result.filePath).toContain("test-plan.md");

    const content = await readFile(result.filePath, "utf-8");
    expect(content).toContain('type: "test-plan"');
    expect(content).toContain("## Test Cases");
    expect(content).toContain("User can log in with email and password");
    expect(content).toContain("story-auth");
  });

  it("groups test cases by story", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      [
        'version: "1.0"',
        "specs:",
        "  stories:",
        "    path: specs/stories/*.md",
        "    type: user-story",
      ].join("\n"),
    );
    await writeFile(
      join(tempDir, "specs/stories/auth.md"),
      [
        "---",
        'id: "story-auth"',
        'type: "user-story"',
        'title: "Auth"',
        'status: "draft"',
        'version: "1.0"',
        'created: "2026-01-01"',
        'authors: ["dev"]',
        'story_id: "story-auth"',
        'priority: "high"',
        'estimate: "3d"',
        "---",
        "",
        "## Acceptance Criteria",
        "",
        "- [ ] Login works",
      ].join("\n"),
    );
    await writeFile(
      join(tempDir, "specs/stories/profile.md"),
      [
        "---",
        'id: "story-profile"',
        'type: "user-story"',
        'title: "Profile"',
        'status: "draft"',
        'version: "1.0"',
        'created: "2026-01-01"',
        'authors: ["dev"]',
        'story_id: "story-profile"',
        'priority: "medium"',
        'estimate: "2d"',
        "---",
        "",
        "## Acceptance Criteria",
        "",
        "- [ ] User can update name",
        "- [ ] User can upload avatar",
      ].join("\n"),
    );

    const result = await generateTestPlan({ configDir: tempDir });
    const content = await readFile(result.filePath, "utf-8");
    expect(content).toContain("### story-auth");
    expect(content).toContain("### story-profile");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement generate-test-plan.ts**

Key logic:
1. Load config, find all user-story specs
2. For each story, extract `## Acceptance Criteria` section, parse bullet points
3. Generate a test-plan spec file with `## Test Cases` grouped by story (using `### story-id` subheadings)
4. Include all required test-plan sections (Scope, Test Cases, Coverage Matrix, Edge Cases)
5. Write to `specs/test-plan.md` (or configured path)

Function signature: `generateTestPlan({ configDir, outPath? }): Promise<{ filePath: string; testCases: number }>`

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/generate-test-plan.*
git commit -m "feat(cli): add sdx generate test-plan --from stories"
```

---

## Task 3: Generate Parent Command

Wire `generate story` and `generate test-plan` as subcommands under `sdx generate`.

**Files:**
- Create: `packages/cli/src/commands/generate.ts`
- Modify: `packages/cli/src/main.ts`

- [ ] **Step 1: Create generate parent command**

`packages/cli/src/commands/generate.ts`:

```typescript
import { defineCommand } from "citty";

export default defineCommand({
  meta: { name: "generate", description: "Generate spec stubs from existing specs" },
  subCommands: {
    story: () => import("./generate-story.js").then((m) => m.default),
    "test-plan": () => import("./generate-test-plan.js").then((m) => m.default),
  },
});
```

- [ ] **Step 2: Register in main.ts**

Add to subCommands in `packages/cli/src/main.ts`:

```typescript
    generate: () => import("./commands/generate.js").then((m) => m.default),
```

- [ ] **Step 3: Build and smoke test**

```bash
pnpm build
node packages/cli/dist/main.js generate --help
node packages/cli/dist/main.js generate story --help
node packages/cli/dist/main.js generate test-plan --help
```

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/commands/generate.ts packages/cli/src/main.ts
git commit -m "feat(cli): add sdx generate parent command with story and test-plan subcommands"
```

---

## Task 4: Update --from-code Command

Generate suggested spec updates based on `sdx check` findings.

**Files:**
- Create: `packages/cli/src/commands/update.ts`
- Create: `packages/cli/src/commands/update.test.ts`

- [ ] **Step 1: Write failing test**

`packages/cli/src/commands/update.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateUpdates } from "./update.js";

describe("generateUpdates", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "sdx-update-"));
    await mkdir(join(tempDir, "specs"), { recursive: true });
  });
  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it("generates suggested additions for extra routes found in code", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      [
        'version: "1.0"',
        "specs:",
        "  api:",
        "    path: specs/api-contract.md",
        "    type: api-contract",
      ].join("\n"),
    );
    await writeFile(
      join(tempDir, "specs/api-contract.md"),
      [
        "---",
        'id: "api-001"',
        'type: "api-contract"',
        'title: "API Contract"',
        'status: "draft"',
        'version: "1.0"',
        'created: "2026-01-01"',
        'authors: ["dev"]',
        "---",
        "",
        "## Endpoints",
        "",
        "### GET /api/users",
        "Returns users.",
      ].join("\n"),
    );

    const result = await generateUpdates({
      configDir: tempDir,
      findings: [
        {
          type: "extra",
          category: "route",
          specId: "api-001",
          expected: "(not in spec)",
          actual: "POST /api/users",
          severity: "info",
        },
      ],
    });

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]!.specId).toBe("api-001");
    expect(result.suggestions[0]!.addition).toContain("POST /api/users");
  });

  it("returns empty for no actionable findings", async () => {
    const result = await generateUpdates({
      configDir: tempDir,
      findings: [],
    });
    expect(result.suggestions).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement update.ts**

Key logic:
1. Accept check findings as input (from `sdx check --format json` piped or via programmatic API)
2. For `extra` route findings: suggest adding a `### METHOD /path` entry to the api-contract spec
3. For `missing` findings: note which spec requirements are unimplemented (these are code issues, not spec updates)
4. Return structured suggestions with the spec ID, section, and the text to add
5. CLI command runs `sdx check` internally, then generates suggestions

Function signature: `generateUpdates({ configDir, findings }): Promise<{ suggestions: UpdateSuggestion[] }>`

```typescript
interface UpdateSuggestion {
  specId: string;
  section: string;
  addition: string;
  reason: string;
}
```

The CLI command:
```
sdx update --from-code [--apply] [--format pretty|json]
```

Without `--apply`, just prints suggestions. With `--apply`, writes the additions to the spec files (append to the relevant section).

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Register in main.ts**

Add `update: () => import("./commands/update.js").then((m) => m.default)` to subCommands.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/commands/update.* packages/cli/src/main.ts
git commit -m "feat(cli): add sdx update --from-code for spec update suggestions"
```

---

## Task 5: Migrate Command

Minimal schema migration — for now just validates and reports current schema state.

**Files:**
- Create: `packages/cli/src/commands/migrate.ts`

- [ ] **Step 1: Create migrate command**

`packages/cli/src/commands/migrate.ts`:

```typescript
import { defineCommand } from "citty";
import { loadConfig, createLogger } from "@specdx/core";
import { SPEC_TYPES } from "@specdx/schema";

export default defineCommand({
  meta: { name: "migrate", description: "Check and migrate spec suite schema" },
  args: {
    quiet: { type: "boolean", description: "Suppress output" },
  },
  async run({ args }) {
    const logger = createLogger({ quiet: args.quiet });
    const configDir = process.cwd();

    try {
      const config = await loadConfig(undefined, configDir);
      logger.info(`\n  Config version: ${config.version}`);
      logger.info(`  Supported spec types: ${SPEC_TYPES.join(", ")}`);

      // Check for any spec types in config not in SPEC_TYPES
      const unknownTypes: string[] = [];
      for (const [key, entry] of Object.entries(config.specs)) {
        if (!SPEC_TYPES.includes(entry.type as (typeof SPEC_TYPES)[number])) {
          unknownTypes.push(`${key}: ${entry.type}`);
        }
      }

      if (unknownTypes.length > 0) {
        logger.info(`\n  Unknown spec types found:`);
        for (const ut of unknownTypes) {
          logger.info(`    - ${ut}`);
        }
        logger.info(`\n  Run \`sdx migrate\` after updating specdx to resolve.`);
      } else {
        logger.info(`\n  ✓ All spec types are recognized. No migration needed.\n`);
      }
    } catch (err) {
      console.error(`\n  ✗ ${(err as Error).message}\n`);
      process.exit(1);
    }
  },
});
```

- [ ] **Step 2: Register in main.ts**

Add `migrate: () => import("./commands/migrate.js").then((m) => m.default)` to subCommands.

- [ ] **Step 3: Build and smoke test**

```bash
pnpm build
node packages/cli/dist/main.js migrate
```

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/commands/migrate.ts packages/cli/src/main.ts
git commit -m "feat(cli): add sdx migrate command for schema migration checks"
```

---

## Task 6: Final Integration

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

- [ ] **Step 4: Smoke test generate commands**

```bash
node packages/cli/dist/main.js generate --help
node packages/cli/dist/main.js generate story --help
node packages/cli/dist/main.js generate test-plan --help
node packages/cli/dist/main.js update --help
node packages/cli/dist/main.js migrate
```

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "feat: complete Phase 4 Slice 4 — spec generation and maintenance"
```
