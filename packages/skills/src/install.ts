import { mkdir, writeFile, readFile, stat, readdir } from "node:fs/promises";
import { statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Promoted skills — the set the Claude Code plugin ships and `skills install`
 * writes by default.
 *
 * Promotion is the directory a skill lives in, not an adjective in its
 * description. A string is easy to drift past; a folder is not.
 */
export const CORE_SKILL_NAMES = [
  "specdx-router",
  "specdx-start-task",
  "specdx-author-spec",
  "specdx-pre-commit",
  "specdx-sprint-review",
  "specdx-plan-from-spec",
  "specdx-onboard",
  "specdx-review-spec",
];

/** Skills built on `sdx check`, whose static analysis is noisy on prose specs. */
export const EXPERIMENTAL_SKILL_NAMES = ["specdx-verify", "specdx-check-drift"];

/** Every skill that ships, promoted or not. */
export const SKILL_NAMES = [...CORE_SKILL_NAMES, ...EXPERIMENTAL_SKILL_NAMES];

/** Bucket directory a skill lives in, under the skills root. */
export function bucketOf(skillName: string): "core" | "experimental" {
  return EXPERIMENTAL_SKILL_NAMES.includes(skillName) ? "experimental" : "core";
}

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
export interface InstallOptions {
  /** Include experimental skills. Off by default: only promoted skills ship. */
  experimental?: boolean;
}

export async function installSkills(
  projectDir: string,
  options: InstallOptions = {},
): Promise<InstallResult> {
  const sourceDir = getSkillSourceDir();
  const skillsDir = join(projectDir, ".claude", "skills");
  const installed: string[] = [];
  const updated: string[] = [];

  await mkdir(skillsDir, { recursive: true });

  const names = options.experimental ? SKILL_NAMES : CORE_SKILL_NAMES;

  for (const skillName of names) {
    const sourcePath = join(sourceDir, bucketOf(skillName), skillName);
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
