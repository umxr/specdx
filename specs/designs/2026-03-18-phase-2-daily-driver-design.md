# Phase 2 — Daily Driver: Design Spec

> **Goal:** Add `sdx pack` so developers get daily value from the tool every time they context-switch to an LLM. Ship Claude Code skills that make sdx the default starting point for spec-aware coding sessions.

---

## 1. @sdx/pack — Context Packing Engine

### Architecture

Three-stage pipeline: **Resolve → Allocate → Format**

```
Task string ──→ RelevanceResolver ──→ TokenAllocator ──→ OutputFormatter ──→ packed output
                     │                      │                    │
              keyword matching +      proportional budget    XML/Markdown/JSON
              graph propagation       with compression
```

All stages are deterministic — no LLM calls, no external I/O beyond reading spec files.

### Prerequisite: Section-Level Content Extraction

The current `ParsedSpec` interface returns `sections: string[]` (heading names only) and `content: string` (full body). The pack engine needs per-section content for compression and formatting. `parseSpec` in `@sdx/core` will be extended to return a new field:

```typescript
interface ParsedSection {
  heading: string;      // H2 heading text
  content: string;      // Markdown content under this heading
  tokens: number;       // Token count for this section
}

// Added to ParsedSpec:
interface ParsedSpec {
  // ...existing fields...
  parsedSections: ParsedSection[];  // Section-level content extraction
}
```

The existing `sections: string[]` field is preserved for backward compatibility. `parsedSections` is populated by splitting the markdown body on H2 boundaries using the existing remark AST. Content before the first H2 is included as a section with heading `""` (empty string).

### Stage 1 — Relevance Resolver

Given a task description (free text), score each spec in the suite by relevance.

**Scoring algorithm:**

1. Tokenize task string: split on whitespace/punctuation, lowercase, drop stopwords (a, the, is, etc.)
2. For each spec, count keyword hits across weighted fields:
   - Frontmatter `tags`: **3x** weight
   - Frontmatter `title`: **3x** weight
   - Section headings (H2s): **2x** weight
   - Body content: **1x** weight
3. Raw score = weighted sum of hits / total keywords
4. Graph propagation: for each spec with score > 0, propagate **0.5x** of its score to **immediate** upstream and downstream neighbors in the dependency graph (using the `edges` array, not the transitive `getUpstream`/`getDownstream` methods). This ensures directly related specs get included even if they don't contain the keywords.
5. Normalize all scores to 0–1 range (divide by max score).
6. Threshold: specs with score < 0.1 are excluded.

**When no task string is provided:** all specs get score 1.0 (pack everything).

**When `--specs` is provided:** named specs get score 1.0, their upstream dependencies get score 0.5. No keyword scoring.

### Stage 2 — Token Allocator

Given ranked specs and a token budget, allocate tokens and apply compression.

**Allocation:**

1. Calculate raw token count for each spec (using `countTokens` from `@sdx/core`)
2. If total tokens fit within budget without compression, include everything
3. If over budget, apply compression strategies in order:
   a. **Boilerplate stripping** — remove sections matching `boilerplate_sections` config
   b. **Stable section collapsing** — for specs where the **spec-level** `updated` frontmatter date is older than `stable_days` threshold, all sections get replaced with stubs (per-section timestamps don't exist in the schema, so staleness is determined at the spec level):
      ```
      ## Data Model

      [Unchanged since 2026-02-15 — 342 tokens omitted]
      ```
   c. **Resolved ADR collapsing** — specs with `type: adr` and `status: superseded` get collapsed to: `[ADR] <title> — superseded`
4. After compression, if still over budget, drop specs in ascending relevance order until budget fits
5. Return allocation map with per-spec details

**`--full` flag:** disables all compression (steps 3a-3c). Specs are still dropped if over budget.

### Stage 3 — Output Formatters

**XML (default):**

```xml
<context budget="12000" used="8432" specs="4" compressed="2">
  <spec id="prd-001" type="prd" relevance="0.92" tokens="3200">
    <section name="Problem Statement">
      ...content...
    </section>
    <section name="Features">
      ...content...
    </section>
    <section name="Data Model" compressed="true">
      [Unchanged since 2026-02-15 — 342 tokens omitted]
    </section>
  </spec>
  <spec id="tech-001" type="technical-design" relevance="0.78" tokens="2800">
    ...
  </spec>
</context>
```

**Markdown:**

```markdown
# prd-001 (prd) [relevance: 0.92]

## Problem Statement
...content...

## Features
...content...

## Data Model
[Unchanged since 2026-02-15 — 342 tokens omitted]

---

# tech-001 (technical-design) [relevance: 0.78]
...
```

**JSON:**

```json
{
  "budget": 12000,
  "used": 8432,
  "specs": [
    {
      "id": "prd-001",
      "type": "prd",
      "relevance": 0.92,
      "tokens": 3200,
      "sections": [
        { "name": "Problem Statement", "content": "...", "compressed": false },
        { "name": "Data Model", "content": "[Unchanged since ...]", "compressed": true }
      ]
    }
  ]
}
```

### Types

```typescript
interface PackOptions {
  task?: string;              // Free-text task description
  specs?: string[];           // Explicit spec IDs to pack
  budget?: number;            // Token budget override
  format?: "xml" | "markdown" | "json";
  full?: boolean;             // Disable compression
  dryRun?: boolean;           // Return plan without packing
}

interface PackResult {
  output: string;             // Formatted packed output
  stats: PackStats;
}

interface PackStats {
  budget: number;
  used: number;
  specsIncluded: number;
  specsExcluded: number;
  sectionsCompressed: number;
  allocations: SpecAllocation[];
}

interface SpecAllocation {
  specId: string;
  type: string;
  relevance: number;
  tokens: number;
  compressed: boolean;
  included: boolean;
}

interface RelevanceScore {
  specId: string;
  score: number;              // 0–1 normalized
  rawScore: number;           // Pre-normalization
  matchedKeywords: string[];
  graphBoosted: boolean;      // true if score came from graph propagation
}
```

---

## 2. CLI Integration — `sdx pack`

### Command

```
sdx pack [--task "..."] [--specs prd,technical] [--budget 12000] [--format xml|markdown|json] [--out context.xml] [--full] [--dry-run] [--quiet] [--verbose]
```

| Flag | Type | Default | Description |
|---|---|---|---|
| `--task` | string | — | Free-text task description for relevance filtering |
| `--specs` | string | — | Comma-separated spec IDs to pack explicitly |
| `--budget` | number | config or 12000 | Token budget |
| `--format` | string | config or "xml" | Output format: xml, markdown, json (note: this is separate from the shared `--format` arg used by lint/validate which accepts pretty/json/github) |
| `--out` | string | — | Write output to file instead of stdout |
| `--full` | boolean | false | Disable all compression |
| `--dry-run` | boolean | false | Show plan without producing output |

### Behavior

- **Output goes to stdout** by default. Pipes cleanly (`sdx pack | pbcopy`).
- **Token report goes to stderr** so it doesn't pollute packed output:
  ```
  Packed 4/6 specs • 8,432 / 12,000 tokens • 2 sections compressed
  ```
- **`--specs` resolves dependencies:** `--specs technical` auto-includes `prd` if technical requires it. Upstream deps get lower priority (relevance 0.5 vs 1.0).
- **`--dry-run` output** shows spec list, relevance scores, estimated tokens, compression plan. No packed output generated.
- **`--task` and `--specs` are mutually exclusive.** If both provided, error with clear message.
- **`--format` is command-specific.** The pack command defines its own `format` arg (`xml | markdown | json`) and does NOT reuse `sharedArgs.format` (`pretty | json | github`). The pack command still imports `quiet` and `verbose` from `sharedArgs`.

### `sdx skills install`

New CLI command to install Claude Code skill files.

```
sdx skills install [--dir .]
```

Copies skill markdown files from the `specdx` package into `.claude/skills/` in the target directory. Creates the directory if needed. Reports what was installed.

**Behavior:**
- If skill files already exist, overwrite them (ensures latest version). Print "Updated sdx-start-task.md" vs "Installed sdx-start-task.md".
- `--dir` defaults to `.` (current directory).
- Skill files are located via `import.meta.url` resolution within the bundled `specdx` package.

---

## 3. Pack Config Schema

Addition to `spec.config.yaml`:

```yaml
pack:
  max_tokens: 12000                # Default token budget
  format: "xml"                    # Default output format: xml | markdown | json
  compression:
    strip_boilerplate: true        # Remove changelog/history sections
    stable_days: 7                 # Sections unchanged >N days get collapsed
    collapse_resolved_adrs: true   # Superseded ADRs → one-liner
  boilerplate_sections:            # Section headings treated as boilerplate
    - "Changelog"
    - "Revision History"
    - "Document History"
```

All fields optional with sensible defaults:
- `max_tokens`: 12000
- `format`: "xml"
- `compression.strip_boilerplate`: true
- `compression.stable_days`: 7
- `compression.collapse_resolved_adrs`: true
- `boilerplate_sections`: ["Changelog", "Revision History", "Document History"]

Schema validation added to `config.json` so `sdx validate` catches invalid pack config. A corresponding `PackConfig` TypeScript interface will be added to `@sdx/schema/src/types.ts`, replacing the current `pack?: Record<string, unknown>` with a properly typed `pack?: PackConfig`.

```typescript
interface PackConfig {
  max_tokens?: number;
  format?: "xml" | "markdown" | "json";
  compression?: {
    strip_boilerplate?: boolean;
    stable_days?: number;
    collapse_resolved_adrs?: boolean;
  };
  boilerplate_sections?: string[];
}
```

---

## 4. Claude Code Skills

### Skill 1: `sdx:start-task`

**Purpose:** Load spec context at the start of a coding session.

**Trigger:** Developer describes what they're about to work on.

**Flow:**
1. Developer invokes skill: "I'm implementing the login flow"
2. Skill extracts the task description
3. Runs `sdx pack --task "<description>" --format xml`
4. Packed context is injected into the conversation
5. LLM is instructed to: reference specs during implementation, flag drift from spec intent, note any spec gaps discovered during work

**Skill file (`sdx-start-task.md`):**
- Metadata: name, description, trigger patterns
- Instructions for the LLM on how to run the pack command
- Prompt framing for spec-aware development
- Guardrails: don't hallucinate spec content, flag conflicts between specs

### Skill 2: `sdx:author-spec`

**Purpose:** Guided, interactive spec authoring with iterative validation.

**Trigger:** Developer wants to create or update a spec.

**Flow:**
1. Developer invokes skill: "I need to write a PRD for payments"
2. Skill determines spec type (asks if ambiguous)
3. Creates spec file with frontmatter scaffold
4. Walks through required sections one at a time, asking questions
5. After each major section, runs `sdx lint --path <file>` to validate
6. Validates references against existing suite
7. Final `sdx lint` pass before declaring done

**Skill file (`sdx-author-spec.md`):**
- Metadata: name, description, trigger patterns
- Section-by-section authoring instructions per spec type
- Lint integration points (when to run, how to interpret results)
- Reference validation guidance

### Installation

```bash
npx specdx skills install
```

Copies skill files into `.claude/skills/` in the current project. Files are self-contained markdown — no runtime dependency on the skills package beyond needing `sdx` CLI available.

### Package Structure

Skills source lives in `packages/skills/` as a workspace package:
- `skills/sdx-start-task.md` — skill markdown file
- `skills/sdx-author-spec.md` — skill markdown file
- `src/install.ts` — copy logic
- `src/index.ts` — exports install function + skill file paths

Bundled into `specdx` CLI package via tsup (same pattern as schema/core/lint).

---

## 5. File Map

### New Files

```
packages/pack/
├── src/
│   ├── index.ts              # Public exports: pack(), PackOptions, PackResult, PackStats
│   ├── resolver.ts           # RelevanceResolver — keyword scoring + graph propagation
│   ├── allocator.ts          # TokenAllocator — budget distribution + compression dispatch
│   ├── compressor.ts         # Compression strategies (boilerplate, stable, ADR)
│   ├── formatters/
│   │   ├── xml.ts            # XML output
│   │   ├── markdown.ts       # Markdown output
│   │   └── json.ts           # JSON output
│   └── types.ts              # All pack-related types
├── test/
│   ├── resolver.test.ts
│   ├── allocator.test.ts
│   ├── compressor.test.ts
│   └── formatters.test.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts

packages/skills/
├── src/
│   ├── index.ts              # Exports install function + skill paths
│   └── install.ts            # Copy skill files to target directory
├── skills/
│   ├── sdx-start-task.md
│   └── sdx-author-spec.md
├── test/
│   └── install.test.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts

packages/cli/src/commands/
├── pack.ts                   # NEW: sdx pack command
└── skills.ts                 # NEW: sdx skills install command
```

### Modified Files

```
packages/schema/src/schemas/config.json    # Add pack config schema properties
packages/schema/src/types.ts               # Add PackConfig type, update SdxConfig.pack
packages/core/src/parser.ts                # Add parsedSections to ParsedSpec
packages/core/src/index.ts                 # Export ParsedSection type
packages/cli/src/main.ts                   # Register pack + skills commands
packages/cli/package.json                  # Add @sdx/pack, @sdx/skills deps
packages/cli/tsup.config.ts               # Add pack + skills to noExternal
```

---

## 6. Error Handling

Follow the existing pattern of named error classes (`ConfigError`, `ParseError`, `GraphError`).

| Scenario | Behavior |
|---|---|
| Missing `spec.config.yaml` | `ConfigError` — same as existing commands |
| `--specs` references unknown spec ID | Error: `Unknown spec: "foo". Available specs: prd, technical, ...` |
| Token budget too small for any spec | Warning to stderr, pack the highest-relevance spec truncated to budget |
| Suite has no specs | Warning to stderr, empty output |
| `--task` and `--specs` both provided | Error: `--task and --specs are mutually exclusive` |
| Spec file referenced in config doesn't exist | Warning per missing file, continue packing remaining specs |
| `sdx skills install` with no skill files found | Error: `No skill files found in specdx package` |

---

## 7. What's Deferred

| Feature | Reason | When |
|---|---|---|
| `--copy` (clipboard) | `sdx pack \| pbcopy` works. Skills pipe programmatically. | Phase 3+ if demanded |
| Editor integrations (2.3) | Skills cover Claude Code. Cursor/VS Code adapters later. | Phase 3–4 |
| Embedding-based relevance | Keyword + graph is the right starting point. Embeddings add dependency + complexity. | Phase 4 if keyword scoring proves insufficient |
| `sdx pack --cursor` | Cursor rules generation is a different integration surface. | Phase 3–4 adapter architecture |
