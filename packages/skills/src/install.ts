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
  targetDir: string,
): Promise<InstallResult> {
  const sourceDir = getSkillSourceDir();
  const installed: string[] = [];
  const updated: string[] = [];

  // Ensure target directory exists (recursive creates parent dirs too)
  await mkdir(targetDir, { recursive: true });

  for (const file of SKILL_FILES) {
    const sourcePath = join(sourceDir, file);
    const targetPath = join(targetDir, file);

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
