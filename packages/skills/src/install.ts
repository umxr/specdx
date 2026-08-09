import { mkdir, writeFile, readFile, stat, readdir } from "node:fs/promises";
import { statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Skill directory names. Each holds a SKILL.md plus optional bundled resources. */
export const SKILL_NAMES = [
  "specdx-start-task",
  "specdx-author-spec",
  "specdx-pre-commit",
  "specdx-sprint-review",
  "specdx-plan-from-spec",
  "specdx-onboard",
  "specdx-verify",
  "specdx-review-spec",
  "specdx-check-drift",
];

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

/** Every file under a directory, as paths relative to it. */
async function filesUnder(dir: string, base = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await filesUnder(full, base)));
    } else {
      files.push(relative(base, full));
    }
  }
  return files;
}

/**
 * Install skills into a project's `.claude/skills/`.
 *
 * The Agent Skills specification defines a skill as a *directory* containing a
 * `SKILL.md`, so the whole directory is copied -- `references/` and any other
 * bundled resources included. Skills previously shipped as flat files under
 * `.claude/commands/`, which made them slash commands rather than skills.
 */
export async function installSkills(projectDir: string): Promise<InstallResult> {
  const sourceDir = getSkillSourceDir();
  const skillsDir = join(projectDir, ".claude", "skills");
  const installed: string[] = [];
  const updated: string[] = [];

  await mkdir(skillsDir, { recursive: true });

  for (const skillName of SKILL_NAMES) {
    const sourcePath = join(sourceDir, skillName);
    const targetPath = join(skillsDir, skillName);

    let exists = false;
    try {
      await stat(join(targetPath, "SKILL.md"));
      exists = true;
    } catch {
      // Not installed yet
    }

    for (const file of await filesUnder(sourcePath)) {
      const target = join(targetPath, file);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, await readFile(join(sourcePath, file), "utf-8"), "utf-8");
    }

    if (exists) {
      updated.push(skillName);
    } else {
      installed.push(skillName);
    }
  }

  return { installed, updated };
}
