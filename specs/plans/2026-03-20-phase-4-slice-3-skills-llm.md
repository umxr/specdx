# Phase 4 Slice 3 — Skills + LLM-Assisted Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three new Claude Code skills (`sdx:verify`, `sdx:review-spec`, `sdx:check-drift`) and the `sdx check --ai` fallback using the Anthropic API. These make `sdx check` output actionable in AI coding workflows.

**Architecture:** Skills are markdown files in `packages/skills/skills/` — no compiled code. Templates are in `packages/skills/templates/`. The `--ai` flag adds an optional `analyzeWithAi()` function to `@specdx/check` that sends findings to the Anthropic API. The CLI wires the flag in. Skills are the recommended path (zero config, uses host LLM); `--ai` is the fallback for non-AI-tool users.

**Tech Stack:** Markdown (skills), `@anthropic-ai/sdk` (optional peer dep for `--ai`), TypeScript, Vitest

**Design spec:** `specs/designs/2026-03-20-phase-4-spec-intelligence-design.md` (Slice 3 section)

---

## File Structure

```
packages/skills/skills/specdx-verify.md                 # CREATE: verify skill
packages/skills/skills/specdx-review-spec.md             # CREATE: review-spec skill
packages/skills/skills/specdx-check-drift.md             # CREATE: check-drift skill
packages/skills/templates/consistency-reviewer.md         # CREATE: subagent template
packages/skills/templates/adversarial-reviewer.md         # CREATE: subagent template

packages/check/src/ai.ts                                 # CREATE: Anthropic API integration
packages/check/src/ai.test.ts                            # CREATE: tests (mocked)
packages/check/src/types.ts                              # MODIFY: add AiAssessment type
packages/check/src/index.ts                              # MODIFY: export analyzeWithAi
packages/check/package.json                              # MODIFY: add @anthropic-ai/sdk peer dep

packages/cli/src/commands/check.ts                       # MODIFY: add --ai flag
packages/cli/tsup.config.ts                              # MODIFY: add @anthropic-ai/sdk to external
```

---

## Task 1: Verify Skill

**Files:**
- Create: `packages/skills/skills/specdx-verify.md`

- [x] **Step 1: Create the skill file**

`packages/skills/skills/specdx-verify.md`:

```markdown
---
name: specdx-verify
description: "Use when the user says 'verify', 'check against spec', 'does this match the spec', 'review implementation', or after completing a feature. Runs spec-to-implementation analysis and reviews findings."
allowed-tools: Bash(npx specdx *), Read
---

# Verify Implementation Against Specs

Run static analysis to check if the implementation matches the specs, then review each finding.

## Workflow

### Step 1: Run spec-to-implementation check

```bash
npx specdx check --format json
```

If the command fails with "ts-morph is required", tell the user to install it: `pnpm add -D ts-morph`.

If it fails with "No spec.config.yaml found", the project isn't set up with specdx. Stop and inform the user.

### Step 2: Load spec context

```bash
npx specdx pack --task "$ARGUMENTS" --format xml
```

This gives you the spec content to compare findings against.

### Step 3: Review each finding

For each finding in the check output:

| Finding Type | Action |
|---|---|
| `missing` (error) | Check if the spec requirement is genuinely unimplemented, or if the static analysis missed it (different naming, different file location). Report your assessment. |
| `extra` (info) | Check if the code addition is intentional (feature beyond spec) or accidental scope creep. Note it but don't flag as an issue unless it contradicts a Non-Goal. |
| `mismatch` (warn) | Compare the spec expectation against the code. Determine if the deviation is intentional (spec needs updating) or a bug (code needs fixing). |

### Step 4: Present structured report

```
## Verification Report

**Score:** X% implementation coverage

### Real Issues
- [finding] — [why it's a real issue] — [suggested fix]

### False Positives
- [finding] — [why it's not actually an issue]

### Recommendations
- [any spec updates needed]
- [any additional tests suggested]
```

<HARD-GATE>
Do NOT skip Step 1. Always run `npx specdx check` before reviewing. Do not rely on your knowledge of the code alone — the static analysis catches things you might miss.
</HARD-GATE>

## Rationalizations to Resist

| Thought | Reality |
|---------|---------|
| "I already know the code matches the spec" | Static analysis catches structural mismatches you can't see. Run the check. |
| "There are too many findings to review" | Group by category, prioritize errors over warnings. Review all errors. |
| "The check failed, so skip it" | Report the failure. Partial results are still valuable. |
| "The user didn't ask for verification" | If you just finished implementing, verify. It's part of the job. |
```

- [x] **Step 2: Verify skill has correct frontmatter**

Check: `name`, `description` (starts with "Use when"), `allowed-tools` are set.

- [x] **Step 3: Commit**

```bash
git add packages/skills/skills/specdx-verify.md
git commit -m "feat(skills): add specdx-verify skill for spec-to-implementation review"
```

---

## Task 2: Review-Spec Skill + Templates

**Files:**
- Create: `packages/skills/skills/specdx-review-spec.md`
- Create: `packages/skills/templates/consistency-reviewer.md`
- Create: `packages/skills/templates/adversarial-reviewer.md`

- [x] **Step 1: Create consistency-reviewer template**

`packages/skills/templates/consistency-reviewer.md`:

```markdown
---
name: consistency-reviewer
description: Prompt template for a subagent that reviews spec consistency across the suite
---

# Spec Consistency Review

You are reviewing a spec for consistency with the rest of the spec suite.

## Inputs
- **Spec file**: {{spec_path}}
- **All spec summaries**: {{spec_summaries}}

## Instructions
1. Read the target spec file
2. Check terminology consistency:
   - Are the same concepts referred to by the same names across specs?
   - Are feature IDs (F1, F2) referenced consistently?
   - Do endpoint paths match between api-contract and technical-design?
3. Check naming alignment:
   - Do type/model names in technical-design match api-contract schemas?
   - Do story titles reference the correct PRD features?
4. Check version and status coherence:
   - Are upstream specs at the same or higher version as downstream?
   - Are status transitions logical (draft specs shouldn't reference approved specs that don't exist)?

## Output Format
- **Terminology**: pass | issues (list with "X in spec A" vs "Y in spec B")
- **Naming**: pass | issues (list)
- **Coherence**: pass | issues (list)
- **Recommendations**: Prioritized list of consistency fixes
```

- [x] **Step 2: Create adversarial-reviewer template**

`packages/skills/templates/adversarial-reviewer.md`:

```markdown
---
name: adversarial-reviewer
description: Prompt template for a subagent that adversarially reviews a spec for gaps and weaknesses
---

# Adversarial Spec Review

You are an adversarial reviewer. Your job is to find problems, gaps, and weaknesses in this spec. Be thorough and skeptical.

## Inputs
- **Spec file**: {{spec_path}}
- **Spec type**: {{spec_type}}
- **Related specs**: {{related_specs}}

## Instructions

Approach this spec assuming it has problems. Your job is to find them.

1. **Missing edge cases**: What scenarios are not addressed? What happens when inputs are empty, null, extremely large, or in unexpected formats?
2. **Ambiguous requirements**: Which statements could be interpreted multiple ways? Where would two developers implement different things from the same spec?
3. **Missing error handling**: What failure modes are not specified? What happens when dependencies fail, networks timeout, or data is corrupt?
4. **Security gaps**: Are there auth/authz holes? Injection vectors? Data exposure risks?
5. **Scalability concerns**: Will this approach work at 10x or 100x the expected load?
6. **Missing dependencies**: What external systems, APIs, or libraries are assumed but not listed?
7. **Contradictions**: Does any part of this spec contradict another part, or contradict related specs?

## Output Format
- **Critical gaps** (would cause bugs or outages): list
- **Ambiguities** (would cause inconsistent implementations): list
- **Missing considerations** (should be addressed before implementation): list
- **Minor observations** (nice to have, not blocking): list
```

- [x] **Step 3: Create review-spec skill**

`packages/skills/skills/specdx-review-spec.md`:

```markdown
---
name: specdx-review-spec
description: "Use when the user asks to review a spec, says 'is this spec good enough', 'review my spec', 'check spec quality', or 'audit this spec'. Runs multi-layer spec quality review."
allowed-tools: Bash(npx specdx *), Read, Agent
---

# Review Spec Quality

Run a three-layer review of a spec: completeness, consistency, and adversarial analysis. Each layer uses a specialized subagent.

## Workflow

### Step 1: Identify the spec to review

Ask the user which spec to review if not clear from context. Get the file path.

### Step 2: Gather context

```bash
npx specdx lint --path <spec-file> --preset strict
npx specdx graph
npx specdx status --format json
```

### Step 3: Run three review passes

Dispatch three subagents using the templates in the `templates/` directory next to this file's parent directory. Each subagent gets the spec path and related context.

**Pass 1 — Completeness** (use `templates/spec-reviewer.md`):
- Are all required sections present and non-empty?
- Is the frontmatter valid?
- Are cross-references intact?

**Pass 2 — Consistency** (use `templates/consistency-reviewer.md`):
- Is terminology consistent across specs?
- Do names and IDs align?
- Are versions and statuses coherent?

**Pass 3 — Adversarial** (use `templates/adversarial-reviewer.md`):
- What edge cases are missing?
- What's ambiguous?
- What could go wrong?

### Step 4: Aggregate results

Present a combined report:

```
## Spec Review: <spec-title>

### Completeness
[pass 1 results]

### Consistency
[pass 2 results]

### Adversarial Analysis
[pass 3 results]

### Summary
- X critical issues
- Y improvements recommended
- Overall: ready for implementation | needs revision | needs major rework
```

<HARD-GATE>
Do NOT skip any of the three review passes. Each catches different classes of problems. A spec that passes completeness review may still have critical adversarial gaps.
</HARD-GATE>

## Rationalizations to Resist

| Thought | Reality |
|---------|---------|
| "The spec looks fine to me" | You're not adversarial enough. Run all three passes. |
| "Three passes is overkill for a small spec" | Small specs have the most gaps. Run all three. |
| "The completeness pass already found issues, so skip the rest" | Consistency and adversarial reviews find different issues. |
| "I can combine the passes into one review" | Separate passes with different prompts catch more. |
```

- [x] **Step 4: Commit**

```bash
git add packages/skills/skills/specdx-review-spec.md packages/skills/templates/consistency-reviewer.md packages/skills/templates/adversarial-reviewer.md
git commit -m "feat(skills): add specdx-review-spec skill with multi-layer review templates"
```

---

## Task 3: Check-Drift Skill

**Files:**
- Create: `packages/skills/skills/specdx-check-drift.md`

- [x] **Step 1: Create the skill file**

`packages/skills/skills/specdx-check-drift.md`:

```markdown
---
name: specdx-check-drift
description: "Use when the user says 'check drift', 'did I drift from spec', 'am I still aligned', or as part of a pre-commit check. Compares recent code changes against spec definitions."
allowed-tools: Bash(npx specdx *), Read
---

# Check Spec Drift

Compare recent code changes against spec definitions to detect drift.

## Workflow

### Step 1: Check for spec changes

```bash
npx specdx diff
```

This shows which specs changed since the last commit. Note any upstream spec changes.

### Step 2: Check implementation alignment

```bash
npx specdx check --format json
```

This compares specs against code. Note any missing implementations or mismatches.

### Step 3: Cross-reference changes

Compare the two results:

| Situation | Meaning |
|---|---|
| Spec changed, code matches | Spec was updated to reflect reality. Good. |
| Spec changed, code doesn't match | Spec was updated but code wasn't. Needs code update. |
| Spec unchanged, code diverges | Code drifted from spec. Either update code or update spec. |
| Both changed in alignment | Normal development. Verify alignment. |

### Step 4: Present drift report

```
## Drift Report

### Spec Changes (since last commit)
[diff results — which specs changed and how]

### Implementation Alignment
[check results — score, findings]

### Drift Detected
- [list of drifts with suggested resolution: "update code" or "update spec"]

### Verdict
[aligned | minor drift | significant drift]
```

### Step 5: Suggest resolution

For each drift:
- If spec is the source of truth → suggest code changes
- If code is intentionally ahead → suggest spec updates
- If unclear → ask the user which direction to go

## Rationalizations to Resist

| Thought | Reality |
|---------|---------|
| "No specs changed, so no drift" | Code can drift even when specs don't change. Run the check. |
| "The check score is high enough" | Even 95% means 5% drift. Review the findings. |
| "I'll check drift later" | Drift compounds. Check now. |
```

- [x] **Step 2: Commit**

```bash
git add packages/skills/skills/specdx-check-drift.md
git commit -m "feat(skills): add specdx-check-drift skill for drift detection"
```

---

## Task 4: Update Skills Package

**Files:**
- Modify: `packages/skills/src/install.ts` (if it has a SKILL_NAMES constant)
- Modify: `packages/skills/src/install.test.ts` (update skill count)

- [x] **Step 1: Check if SKILL_NAMES needs updating**

Read `packages/skills/src/install.ts` to see if there's a hardcoded list of skill names or if skills are discovered from the filesystem.

- [x] **Step 2: Update skill count in tests**

Read `packages/skills/src/install.test.ts`. If tests assert a specific number of installed skills (e.g., `expect(first.installed).toHaveLength(6)`), update the count to include the 3 new skills (6 → 9). Note: `spec-type-reference.md` is a reference file, not a skill — check if it's counted.

- [x] **Step 3: Run tests**

```bash
pnpm --filter @specdx/skills test
```

- [x] **Step 4: Commit**

```bash
git add packages/skills/
git commit -m "feat(skills): register verify, review-spec, check-drift skills"
```

---

## Task 5: AI Analysis Module

**Files:**
- Create: `packages/check/src/ai.ts`
- Create: `packages/check/src/ai.test.ts`
- Modify: `packages/check/src/types.ts`
- Modify: `packages/check/src/index.ts`
- Modify: `packages/check/package.json`

- [x] **Step 1: Add AiAssessment type**

In `packages/check/src/types.ts`, add after the existing `CheckConfig` interface:

```typescript
export interface AiAssessment {
  findingIndex: number;
  isRealIssue: boolean;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  suggestedFix?: string;
}

export interface AiCheckResult {
  findings: Finding[];
  assessments: AiAssessment[];
  summary: string;
}
```

- [x] **Step 2: Add @anthropic-ai/sdk as optional peer dependency**

In `packages/check/package.json`, add to `peerDependencies`:

```json
"@anthropic-ai/sdk": ">=0.30.0"
```

And to `peerDependenciesMeta`:

```json
"@anthropic-ai/sdk": {
  "optional": true
}
```

- [x] **Step 3: Write failing test**

`packages/check/src/ai.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import type { Finding } from "./types.js";

// Mock the Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify([
              { findingIndex: 0, isRealIssue: true, confidence: "high", reasoning: "Route is missing", suggestedFix: "Add GET /api/users/:id handler" },
              { findingIndex: 1, isRealIssue: false, confidence: "medium", reasoning: "Extra route is intentional" },
            ]),
          },
        ],
      }),
    };
  },
}));

describe("analyzeWithAi", () => {
  it("sends findings to Anthropic and returns assessments", async () => {
    // Set API key for test
    process.env["ANTHROPIC_API_KEY"] = "test-key";

    const { analyzeWithAi } = await import("./ai.js");

    const findings: Finding[] = [
      { type: "missing", category: "route", specId: "api", expected: "GET /api/users/:id", severity: "error" },
      { type: "extra", category: "route", specId: "api", expected: "(not in spec)", actual: "PATCH /api/users/:id", severity: "info" },
    ];

    const result = await analyzeWithAi(findings, "Check API routes");
    expect(result.assessments).toHaveLength(2);
    expect(result.assessments[0]!.isRealIssue).toBe(true);
    expect(result.assessments[1]!.isRealIssue).toBe(false);

    delete process.env["ANTHROPIC_API_KEY"];
  });

  it("throws when ANTHROPIC_API_KEY is not set", async () => {
    delete process.env["ANTHROPIC_API_KEY"];

    const { analyzeWithAi } = await import("./ai.js");

    await expect(analyzeWithAi([], "test")).rejects.toThrow("ANTHROPIC_API_KEY");
  });
});
```

- [x] **Step 4: Run test to verify it fails**

```bash
pnpm --filter @specdx/check test
```

- [x] **Step 5: Implement AI analysis module**

`packages/check/src/ai.ts`:

```typescript
import type { Finding, AiAssessment, AiCheckResult } from "./types.js";

export async function analyzeWithAi(
  findings: Finding[],
  context: string,
): Promise<AiCheckResult> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY environment variable is required for --ai mode. " +
      "Set it or use the sdx:verify skill instead (no API key needed).",
    );
  }

  if (findings.length === 0) {
    return { findings, assessments: [], summary: "No findings to analyze." };
  }

  let Anthropic: typeof import("@anthropic-ai/sdk").default;
  try {
    const mod = await import("@anthropic-ai/sdk");
    Anthropic = mod.default;
  } catch {
    throw new Error(
      "@anthropic-ai/sdk is required for --ai mode. Install it: pnpm add -D @anthropic-ai/sdk",
    );
  }

  const client = new Anthropic({ apiKey });

  const findingsSummary = findings
    .map((f, i) => `[${i}] ${f.type} (${f.severity}): ${f.expected}${f.actual ? ` — actual: ${f.actual}` : ""}${f.suggestion ? ` — suggestion: ${f.suggestion}` : ""}`)
    .join("\n");

  const prompt = `You are reviewing static analysis findings from a spec-to-implementation check.

Context: ${context}

Findings:
${findingsSummary}

For each finding (by index), assess:
1. Is this a real issue or a false positive?
2. How confident are you? (high/medium/low)
3. Brief reasoning (1-2 sentences)
4. Suggested fix if it's a real issue

Respond with a JSON array of objects:
[{ "findingIndex": 0, "isRealIssue": true, "confidence": "high", "reasoning": "...", "suggestedFix": "..." }]

Only output the JSON array, no other text.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "";

  let assessments: AiAssessment[];
  try {
    assessments = JSON.parse(text);
  } catch {
    assessments = [];
  }

  const realIssues = assessments.filter((a) => a.isRealIssue).length;
  const falsePositives = assessments.filter((a) => !a.isRealIssue).length;
  const summary = `AI analysis: ${realIssues} real issues, ${falsePositives} false positives out of ${findings.length} findings`;

  return { findings, assessments, summary };
}
```

- [x] **Step 6: Export from index.ts**

Add to `packages/check/src/index.ts`:

```typescript
export { analyzeWithAi } from "./ai.js";
export type { AiAssessment, AiCheckResult } from "./types.js";
```

- [x] **Step 7: Run tests**

```bash
pnpm --filter @specdx/check test
```

- [x] **Step 8: Commit**

```bash
git add packages/check/
git commit -m "feat(check): add AI-assisted analysis with Anthropic API"
```

---

## Task 6: CLI --ai Flag

**Files:**
- Modify: `packages/cli/src/commands/check.ts`
- Modify: `packages/cli/tsup.config.ts`

- [x] **Step 1: Add @anthropic-ai/sdk to tsup external**

In `packages/cli/tsup.config.ts`, add `"@anthropic-ai/sdk"` to both `external` arrays (alongside `ts-morph`, `ajv`, etc.). This ensures the SDK is not bundled — it's lazy-loaded.

- [x] **Step 2: Add --ai flag to check command**

In `packages/cli/src/commands/check.ts`, add the `ai` arg:

```typescript
  args: {
    ...sharedArgs,
    spec: { type: "string", description: "Check a specific spec by ID" },
    framework: { type: "string", description: "Framework override: express, hono, nextjs" },
    ai: { type: "boolean", description: "Use AI to assess findings (requires ANTHROPIC_API_KEY)" },
  },
```

After the `runCheck()` call and before the format output, add:

```typescript
    // AI analysis (opt-in)
    if (args.ai) {
      const { analyzeWithAi } = await import("@specdx/check");
      const aiResult = await analyzeWithAi(result.findings, args.spec ?? "full suite check");

      if (args.format === "json") {
        console.log(JSON.stringify({ ...result, ai: aiResult }, null, 2));
        return;
      }

      // Pretty AI output
      console.log(`\n  sdx check --ai — ${result.score.overall}% coverage\n`);
      console.log(`  AI Assessment: ${aiResult.summary}\n`);

      for (const assessment of aiResult.assessments) {
        const finding = result.findings[assessment.findingIndex];
        if (!finding) continue;
        const icon = assessment.isRealIssue ? "✗" : "✓";
        const label = assessment.isRealIssue ? "REAL" : "FALSE POSITIVE";
        console.log(`    ${icon} [${label}] ${finding.expected}`);
        console.log(`      ${assessment.reasoning}`);
        if (assessment.suggestedFix) {
          console.log(`      Fix: ${assessment.suggestedFix}`);
        }
      }
      console.log();

      if (aiResult.assessments.some((a) => a.isRealIssue)) {
        process.exit(1);
      }
      return;
    }
```

Place this block right after `const result = await runCheck(...)` and before the existing `if (args.format === "json")` block.

- [x] **Step 3: Build and test**

```bash
pnpm build && pnpm --filter specdx test
```

- [x] **Step 4: Smoke test**

```bash
node packages/cli/dist/main.js check --help
```

Verify `--ai` flag appears in help output.

- [x] **Step 5: Commit**

```bash
git add packages/cli/src/commands/check.ts packages/cli/tsup.config.ts
git commit -m "feat(cli): add --ai flag to sdx check for LLM-assisted analysis"
```

---

## Task 7: Final Integration

- [x] **Step 1: Build all packages**

```bash
pnpm build
```

- [x] **Step 2: Run full test suite**

```bash
pnpm test
```

- [x] **Step 3: Typecheck and lint**

```bash
pnpm typecheck && pnpm lint:code
```

- [x] **Step 4: Verify skills are bundled into CLI dist**

```bash
ls packages/cli/dist/skills/specdx-verify.md
ls packages/cli/dist/skills/specdx-review-spec.md
ls packages/cli/dist/skills/specdx-check-drift.md
```

All three should exist.

- [x] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "feat: complete Phase 4 Slice 3 — skills + LLM-assisted analysis"
```
