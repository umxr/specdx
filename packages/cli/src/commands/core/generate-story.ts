import { defineCommand } from "citty";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig, parseSpec, resolveGlob, createLogger } from "@specdx/core";
import type { ParsedSpec } from "@specdx/core";
import { REQUIRED_SECTIONS } from "@specdx/schema";
import { uncoveredFeatures, parseFeatureEntries } from "@specdx/lint";

export interface GenerateStoriesOptions {
  configDir: string;
  from: string;
  outDir?: string;
}

export interface GenerateStoriesResult {
  generated: string[];
  /** Features left alone because an existing story already covers them. */
  skipped: string[];
}

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= 40) return slug;
  // Truncate on a word boundary so filenames don't end mid-word
  const cut = slug.slice(0, 40);
  const lastHyphen = cut.lastIndexOf("-");
  return lastHyphen > 0 ? cut.slice(0, lastHyphen) : cut;
}

function detectStoriesDir(
  configDir: string,
  config: Awaited<ReturnType<typeof loadConfig>>,
): string {
  for (const entry of Object.values(config.specs)) {
    if (entry.type === "user-story") {
      // Use the directory portion of the glob path
      const dirPart = entry.path.replace(/\/[^/]*\*.*$/, "").replace(/\/[^/]*$/, "");
      // If path ends with *.md at a directory level, take that dir
      const match = entry.path.match(/^(.+?)\/\*/);
      if (match) {
        return join(configDir, match[1]!);
      }
      return join(configDir, dirPart);
    }
  }
  return join(configDir, "specs/stories");
}

function buildStoryFile(options: {
  featureNum: string;
  featureText: string;
  prdId: string;
  prdAuthors: string[];
  today: string;
  sections: string[];
}): string {
  const { featureNum, featureText, prdId, prdAuthors, today, sections } = options;
  const storyId = `story-f${featureNum}`;
  const title = featureText.trim();
  const authorsYaml = JSON.stringify(prdAuthors);

  const frontmatter = [
    "---",
    `id: "${storyId}"`,
    `type: "user-story"`,
    `title: "${title}"`,
    `status: "draft"`,
    `version: "0.1"`,
    `created: "${today}"`,
    `authors: ${authorsYaml}`,
    `story_id: "${storyId}"`,
    `priority: "medium"`,
    `estimate: "TBD"`,
    `references:`,
    `  - id: "${prdId}"`,
    `    relationship: "decomposed-into"`,
    "---",
  ].join("\n");

  const bodyParts = sections.map((section) => {
    if (section === "Description") {
      return `\n## ${section}\n\n${featureText.trim()}`;
    }
    if (section === "Acceptance Criteria") {
      return `\n## ${section}\n\n- [ ] <!-- acceptance criterion -->`;
    }
    if (section === "Dependencies") {
      return `\n## ${section}\n\nF${featureNum} from ${prdId}`;
    }
    return `\n## ${section}\n\n<!-- placeholder -->`;
  });

  return `${frontmatter}\n${bodyParts.join("\n")}\n`;
}

export async function generateStories(
  options: GenerateStoriesOptions,
): Promise<GenerateStoriesResult> {
  const { configDir, from, outDir } = options;
  const config = await loadConfig(undefined, configDir);

  // Find the PRD spec file by ID
  let prdFilePath: string | undefined;
  for (const entry of Object.values(config.specs)) {
    const files = await resolveGlob(entry.path, configDir);
    for (const file of files) {
      const parsed = await parseSpec(file);
      if (parsed.frontmatter.id === from) {
        prdFilePath = file;
        break;
      }
    }
    if (prdFilePath) break;
  }

  if (!prdFilePath) {
    throw new Error(`No spec with id "${from}" found in config.`);
  }

  const prd = await parseSpec(prdFilePath);

  // The same parser the lint rule and `ready` use. Carrying a second one here
  // meant this command reported "no features found" for a PRD that lint was
  // simultaneously reporting three features in.
  const entries = parseFeatureEntries(prd.content);
  const features = entries.map((entry, i) => ({
    // Un-numbered features still need a stable filename, so fall back to
    // position. Authors who do use `**F<N>**:` keep their numbering.
    num: entry.num ?? String(i + 1),
    text: entry.text,
  }));

  if (features.length === 0) {
    return { generated: [], skipped: [] };
  }

  const storiesDir = outDir ?? detectStoriesDir(configDir, config);
  await mkdir(storiesDir, { recursive: true });

  const today = new Date().toISOString().slice(0, 10);
  const prdAuthors = (prd.frontmatter.authors as string[] | undefined) ?? [];
  const sections = REQUIRED_SECTIONS["user-story"];

  // Features an existing story already covers are left alone -- regenerating
  // them produces a second stub for the same feature to reconcile by hand.
  const existingStories: ParsedSpec[] = [];
  for (const entry of Object.values(config.specs)) {
    if (entry.type !== "user-story") continue;
    for (const p of await resolveGlob(entry.path, configDir)) {
      existingStories.push(await parseSpec(p));
    }
  }
  const uncovered = new Set(
    uncoveredFeatures(
      features.map((f) => f.text),
      existingStories,
      from,
    ),
  );
  const skipped = features.filter((f) => !uncovered.has(f.text)).map((f) => f.text);

  const generated: string[] = [];

  for (const feature of features.filter((f) => uncovered.has(f.text))) {
    const slug = slugify(feature.text);
    const filename = `story-f${feature.num}-${slug}.md`;
    const filePath = join(storiesDir, filename);

    const content = buildStoryFile({
      featureNum: feature.num,
      featureText: feature.text,
      prdId: from,
      prdAuthors,
      today,
      sections,
    });

    await writeFile(filePath, content, "utf-8");
    generated.push(filePath);
  }

  return { generated, skipped };
}

export const defineCommandExport = defineCommand({
  meta: {
    name: "story",
    description: "Generate user story stub files from a PRD's Features section",
  },
  args: {
    from: {
      type: "string",
      description: "Spec ID of the PRD to generate stories from",
      required: true,
    },
    out: {
      type: "string",
      description: "Output directory for story files (default: auto-detected from config)",
    },
    quiet: {
      type: "boolean",
      description: "Suppress output",
      default: false,
    },
    verbose: {
      type: "boolean",
      description: "Verbose output",
      default: false,
    },
  },
  async run({ args }) {
    const logger = createLogger({ quiet: args.quiet, verbose: args.verbose });

    try {
      const result = await generateStories({
        configDir: process.cwd(),
        from: args.from,
        outDir: args.out,
      });

      if (result.generated.length === 0 && result.skipped.length > 0) {
        logger.info(
          `Every feature already has a story — ${result.skipped.length} feature(s) skipped, nothing generated.`,
        );
      } else if (result.generated.length === 0) {
        logger.info("No features found in PRD — no story stubs generated.");
      } else {
        logger.info(`Generated ${result.generated.length} story stub(s):`);
        for (const filePath of result.generated) {
          logger.info(`  ${filePath}`);
        }
        if (result.skipped.length > 0) {
          logger.info(`Skipped ${result.skipped.length} feature(s) an existing story covers.`);
        }
      }
    } catch (err) {
      console.error(`\n  ✗ ${(err as Error).message}\n`);
      process.exit(1);
    }
  },
});

export default defineCommandExport;
