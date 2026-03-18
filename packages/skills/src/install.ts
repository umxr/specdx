import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const SKILL_FILES = ["specdx-start-task.md", "specdx-author-spec.md"];

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

export async function installSkills(
  projectDir: string,
): Promise<InstallResult> {
  const sourceDir = getSkillSourceDir();
  const skillsDir = join(projectDir, ".claude", "skills");
  const installed: string[] = [];
  const updated: string[] = [];

  // Ensure .claude/skills/ directory exists
  await mkdir(skillsDir, { recursive: true });

  for (const file of SKILL_FILES) {
    const sourcePath = join(sourceDir, file);
    const targetPath = join(skillsDir, file);

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
      updated.push(file);
    } else {
      installed.push(file);
    }
  }

  return { installed, updated };
}
