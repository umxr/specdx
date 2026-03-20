import { defineCommand } from "citty";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig, parseSpec, resolveGlob, createLogger } from "@specdx/core";
import { REQUIRED_SECTIONS } from "@specdx/schema";

export interface GenerateStoriesOptions {
  configDir: string;
  from: string;
  outDir?: string;
}

export interface GenerateStoriesResult {
  generated: string[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function detectStoriesDir(configDir: string, config: Awaited<ReturnType<typeof loadConfig>>): string {
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

  // Find the Features section content
  const featuresSection = prd.parsedSections.find((s) => s.heading === "Features");
  if (!featuresSection) {
    return { generated: [] };
  }

  // Parse features using the required regex pattern
  const featureRegex = /\*\*F(\d+)\*\*:\s*(.+)/g;
  const features: Array<{ num: string; text: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = featureRegex.exec(featuresSection.content)) !== null) {
    features.push({ num: match[1]!, text: match[2]! });
  }

  if (features.length === 0) {
    return { generated: [] };
  }

  const storiesDir = outDir ?? detectStoriesDir(configDir, config);
  await mkdir(storiesDir, { recursive: true });

  const today = new Date().toISOString().slice(0, 10);
  const prdAuthors = (prd.frontmatter.authors as string[] | undefined) ?? [];
  const sections = REQUIRED_SECTIONS["user-story"];

  const generated: string[] = [];

  for (const feature of features) {
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

  return { generated };
}

export const defineCommandExport = defineCommand({
  meta: {
    name: "generate story",
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

      if (result.generated.length === 0) {
        logger.info("No features found in PRD — no story stubs generated.");
      } else {
        logger.info(`Generated ${result.generated.length} story stub(s):`);
        for (const filePath of result.generated) {
          logger.info(`  ${filePath}`);
        }
      }
    } catch (err) {
      console.error(`\n  ✗ ${(err as Error).message}\n`);
      process.exit(1);
    }
  },
});

export default defineCommandExport;
