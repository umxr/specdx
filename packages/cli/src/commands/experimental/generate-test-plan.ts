import { defineCommand } from "citty";
import { loadConfig, parseSpec, resolveGlob, createLogger } from "@specdx/core";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface GenerateTestPlanOptions {
  configDir: string;
  outPath?: string;
}

export interface GenerateTestPlanResult {
  /** Undefined when there was nothing to generate, so no file was written. */
  filePath?: string;
  testCases: number;
}

interface StoryTestCases {
  storyId: string;
  title: string;
  authors: string[];
  cases: string[];
}

/**
 * Extracts the content of a `## Heading` section from a markdown string.
 * Returns the text between that heading and the next `## ` heading (or end of string).
 */
function extractSection(content: string, heading: string): string | null {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headingPattern = new RegExp(`^##\\s+${escapedHeading}\\s*$`, "im");
  const match = headingPattern.exec(content);
  if (!match) return null;

  const start = match.index + match[0].length;
  const rest = content.slice(start);

  const nextSection = /^##\s+/m.exec(rest);
  return nextSection ? rest.slice(0, nextSection.index) : rest;
}

/**
 * Parses acceptance criteria bullet points from a section string.
 * Handles `- [ ] text`, `- [x] text`, and plain `- text` formats.
 */
function parseAcceptanceCriteria(section: string): string[] {
  const cases: string[] = [];
  for (const rawLine of section.split("\n")) {
    const line = rawLine.trim();
    // Match bullet lines: `- [ ] text`, `- [x] text`, `- text`
    const bulletMatch = /^-\s+(?:\[[ xX]\]\s+)?(.+)/.exec(line);
    if (bulletMatch) {
      const text = bulletMatch[1]!.trim();
      if (text) {
        cases.push(text);
      }
    }
  }
  return cases;
}

export async function generateTestPlan(
  options: GenerateTestPlanOptions,
): Promise<GenerateTestPlanResult> {
  const { configDir, outPath } = options;
  const config = await loadConfig(undefined, configDir);

  const storiesBySpec: StoryTestCases[] = [];

  for (const [, entry] of Object.entries(config.specs)) {
    if (entry.type !== "user-story") continue;

    const files = await resolveGlob(entry.path, configDir);
    for (const file of files) {
      const parsed = await parseSpec(file);
      const frontmatter = parsed.frontmatter;
      const storyId = (frontmatter["id"] as string | undefined) ?? file;
      const title = (frontmatter["title"] as string | undefined) ?? storyId;
      const authors = (frontmatter["authors"] as string[] | undefined) ?? [];

      const acSection = extractSection(parsed.content, "Acceptance Criteria");
      const cases = acSection ? parseAcceptanceCriteria(acSection) : [];

      storiesBySpec.push({ storyId, title, authors, cases });
    }
  }

  // Sort stories by ID for deterministic output
  storiesBySpec.sort((a, b) => a.storyId.localeCompare(b.storyId));

  const today = new Date().toISOString().slice(0, 10);

  // Aggregate authors from all stories (deduplicated)
  const allAuthors = Array.from(new Set(storiesBySpec.flatMap((s) => s.authors)));

  // Build references to all stories
  const storyRefs = storiesBySpec.map(
    (s) => `  - id: "${s.storyId}"\n    relationship: "related-to"`,
  );

  const totalTestCases = storiesBySpec.reduce((sum, s) => sum + s.cases.length, 0);

  // Build frontmatter
  const authorsYaml =
    allAuthors.length > 0 ? `[${allAuthors.map((a) => `"${a}"`).join(", ")}]` : '["generated"]';

  const refsYaml = storyRefs.length > 0 ? `\nreferences:\n${storyRefs.join("\n")}` : "";

  const frontmatter = [
    "---",
    'id: "generated-test-plan"',
    'type: "test-plan"',
    'title: "Generated Test Plan"',
    'status: "draft"',
    'version: "0.1"',
    `created: "${today}"`,
    `authors: ${authorsYaml}`,
    refsYaml.length > 0 ? refsYaml.trimStart() : null,
    "---",
  ]
    .filter((line) => line !== null)
    .join("\n");

  // ## Scope
  const scopeLines =
    storiesBySpec.length > 0
      ? storiesBySpec.map((s) => `- ${s.storyId}: ${s.title}`).join("\n")
      : "_No user stories found._";

  // ## Test Cases — grouped by story
  const testCaseBlocks = storiesBySpec
    .map((s) => {
      const caseBullets =
        s.cases.length > 0
          ? s.cases.map((c) => `- [ ] ${c}`).join("\n")
          : "_No acceptance criteria found._";
      return `### ${s.storyId}\n\n${caseBullets}`;
    })
    .join("\n\n");

  const testCasesBody = storiesBySpec.length > 0 ? testCaseBlocks : "_No user stories found._";

  // ## Coverage Matrix
  const matrixHeader = "| Story | Test Cases |";
  const matrixSep = "| ----- | ---------- |";
  const matrixRows = storiesBySpec.map((s) => `| ${s.storyId} | ${s.cases.length} |`);
  const coverageMatrix = [matrixHeader, matrixSep, ...matrixRows].join("\n");

  // ## Edge Cases
  const edgeCasesPlaceholder = "<!-- Add edge cases and boundary conditions here -->";

  const body = [
    `## Scope`,
    "",
    scopeLines,
    "",
    `## Test Cases`,
    "",
    testCasesBody,
    "",
    `## Coverage Matrix`,
    "",
    coverageMatrix,
    "",
    `## Edge Cases`,
    "",
    edgeCasesPlaceholder,
    "",
  ].join("\n");

  const fileContent = `${frontmatter}\n\n${body}`;

  // Nothing to build a plan from. Writing a spec whose every section reads
  // "_No user stories found._" would add a file the linter then flags and the
  // suite has to carry -- `generate story` already declines in this case.
  if (storiesBySpec.length === 0) {
    return { testCases: 0 };
  }

  const targetPath = outPath ?? join(configDir, "specs", "test-plan.md");
  await writeFile(targetPath, fileContent, "utf-8");

  return { filePath: targetPath, testCases: totalTestCases };
}

export default defineCommand({
  meta: {
    name: "generate-test-plan",
    description: "Generate a test plan stub from user stories",
  },
  args: {
    from: {
      type: "string",
      description: "Source to generate from (currently only 'stories' is supported)",
      default: "stories",
    },
    out: {
      type: "string",
      description: "Output file path (default: specs/test-plan.md)",
    },
  },
  async run({ args }) {
    const logger = createLogger({ quiet: false, verbose: false });

    if (args.from !== "stories") {
      console.error(`\n  ✗ --from must be 'stories' (got: ${args.from})\n`);
      process.exit(1);
    }

    try {
      const result = await generateTestPlan({
        configDir: process.cwd(),
        outPath: args.out,
      });

      if (!result.filePath) {
        logger.info("No user stories found — no test plan generated.");
        return;
      }

      logger.info(`Generated test plan with ${result.testCases} test cases → ${result.filePath}`);
      logger.info(
        "Add it to spec.config.yaml so lint, status and pack can see it:\n" +
          "  test-plan:\n    path: specs/test-plan.md\n    type: test-plan",
      );
    } catch (err) {
      console.error(`\n  ✗ ${(err as Error).message}\n`);
      process.exit(1);
    }
  },
});
