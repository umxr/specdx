import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Skill file names (without .md extension) */
export const SKILL_NAMES = ["specdx-start-task", "specdx-author-spec"];

export interface InstallResult {
  installed: string[];
  updated: string[];
}

function getSkillSourceDir(): string {
  // When bundled: skills at __dirname/skills (sibling of bundle)
  // In dev: skills at __dirname/../skills (sibling of src/)
  const bundledPath = join(__dirname, "skills");
  try {
    statSync(bundledPath);
    return bundledPath;
  } catch {
    return join(__dirname, "..", "skills");
  }
}

export async function installSkills(projectDir: string): Promise<InstallResult> {
  const sourceDir = getSkillSourceDir();
  const commandsDir = join(projectDir, ".claude", "commands");
  const installed: string[] = [];
  const updated: string[] = [];

  await mkdir(commandsDir, { recursive: true });

  for (const skillName of SKILL_NAMES) {
    const sourcePath = join(sourceDir, `${skillName}.md`);
    const targetPath = join(commandsDir, `${skillName}.md`);

    const content = await readFile(sourcePath, "utf-8");

    // Check if target already exists
    let exists = false;
    try {
      await stat(targetPath);
      exists = true;
    } catch {
      // File doesn't exist
    }

    await writeFile(targetPath, content, "utf-8");

    if (exists) {
      updated.push(skillName);
    } else {
      installed.push(skillName);
    }
  }

  return { installed, updated };
}
