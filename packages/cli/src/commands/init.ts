import { defineCommand } from "citty";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { REQUIRED_SECTIONS } from "@specdx/schema";

export type Template = "lightweight" | "bmad" | "api-first";

interface ScaffoldOptions {
  projectName: string;
  template: Template;
  targetDir: string;
}

const TEMPLATE_SPECS: Record<
  Template,
  Array<{ filename: string; type: keyof typeof REQUIRED_SECTIONS }>
> = {
  lightweight: [
    { filename: "prd.md", type: "prd" },
    { filename: "technical-design.md", type: "technical-design" },
  ],
  bmad: [
    { filename: "prd.md", type: "prd" },
    { filename: "technical-design.md", type: "technical-design" },
    { filename: "test-plan.md", type: "test-plan" },
  ],
  "api-first": [
    { filename: "technical-design.md", type: "technical-design" },
    { filename: "api-contract.md", type: "api-contract" },
    { filename: "test-plan.md", type: "test-plan" },
  ],
};

const TEMPLATE_EXTRA_DIRS: Record<Template, string[]> = {
  lightweight: [],
  bmad: ["specs/stories", "specs/adr"],
  "api-first": [],
};

function specIdFromFilename(filename: string): string {
  return filename.replace(/\.md$/, "");
}

function specTitleFromType(type: string): string {
  return type
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function buildSpecFile(
  filename: string,
  type: keyof typeof REQUIRED_SECTIONS,
  projectName: string,
  today: string,
): string {
  const id = specIdFromFilename(filename);
  const title = `${specTitleFromType(type)} — ${projectName}`;
  const sections = REQUIRED_SECTIONS[type];

  const frontmatter = [
    "---",
    `id: ${id}`,
    `type: ${type}`,
    `title: "${title}"`,
    `status: draft`,
    `version: "0.1"`,
    `created: "${today}"`,
    `authors: ["author"]`,
    "---",
  ].join("\n");

  const body = sections.map((section) => `\n## ${section}\n\n<!-- placeholder -->`).join("\n");

  return `${frontmatter}\n${body}\n`;
}

function buildConfigYaml(
  projectName: string,
  specs: Array<{ filename: string; type: string }>,
): string {
  const specEntries = specs
    .map(({ filename, type }) => {
      const key = specIdFromFilename(filename);
      return `  ${key}:\n    path: specs/${filename}\n    type: ${type}`;
    })
    .join("\n");

  return (
    [`version: "1.0"`, `project:`, `  name: "${projectName}"`, `specs:`, specEntries].join("\n") +
    "\n"
  );
}

export async function scaffoldProject({
  projectName,
  template,
  targetDir,
}: ScaffoldOptions): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const specsDir = join(targetDir, "specs");

  // Create specs/ directory
  await mkdir(specsDir, { recursive: true });

  // Create extra template dirs (e.g., bmad needs stories/ and adr/)
  for (const extraDir of TEMPLATE_EXTRA_DIRS[template]) {
    await mkdir(join(targetDir, extraDir), { recursive: true });
  }

  const specs = TEMPLATE_SPECS[template];

  // Write spec files
  for (const { filename, type } of specs) {
    const content = buildSpecFile(filename, type, projectName, today);
    await writeFile(join(specsDir, filename), content, "utf-8");
  }

  // Write spec.config.yaml
  const configContent = buildConfigYaml(projectName, specs);
  await writeFile(join(targetDir, "spec.config.yaml"), configContent, "utf-8");
}

export default defineCommand({
  meta: {
    name: "init",
    description: "Initialize a new specdx project with spec scaffolding",
  },
  args: {
    name: {
      type: "string",
      description: "Project name",
      required: true,
    },
    template: {
      type: "string",
      description: "Template to use (lightweight, bmad, api-first)",
      default: "lightweight",
    },
    dir: {
      type: "string",
      description: "Target directory",
      default: ".",
    },
  },
  async run({ args }) {
    const { name, template, dir } = args;
    const validTemplates: Template[] = ["lightweight", "bmad", "api-first"];
    if (!validTemplates.includes(template as Template)) {
      console.error(`Unknown template: ${template}. Choose from: ${validTemplates.join(", ")}`);
      process.exit(1);
    }
    console.log(`Scaffolding "${name}" with template "${template}" in ${dir}...`);
    await scaffoldProject({ projectName: name, template: template as Template, targetDir: dir });
    console.log(`Done! Project "${name}" scaffolded successfully.`);
  },
});
