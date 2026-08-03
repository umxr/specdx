import { execSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { loadConfig, parseSpecFromString, buildRelationResolver } from "@specdx/core";
import type { ParsedSpec } from "@specdx/core";
import { diffSpecs } from "./diff-specs.js";
import { analyzeImpact } from "./impact.js";
import { checkCrossReferences } from "./cross-refs.js";
import { DiffError } from "./types.js";
import type { DiffResult, SpecDiff, ImpactAnalysis } from "./types.js";

/**
 * Get the real (symlink-resolved) git repo root for the given directory.
 */
function getRepoRoot(cwd: string): string {
  const root = execSync("git rev-parse --show-toplevel", {
    cwd,
    encoding: "utf-8",
    stdio: "pipe",
  }).trim();
  return realpathSync(root);
}

/**
 * Validate that a git ref exists in the repository.
 */
function validateRef(ref: string, cwd: string): void {
  try {
    execSync(`git rev-parse --verify ${ref}`, { cwd, encoding: "utf-8", stdio: "pipe" });
  } catch {
    throw new DiffError(`Invalid git ref: "${ref}"`);
  }
}

/**
 * Get file content at a specific git ref.
 * filePath should be relative to projectRoot.
 */
function gitShow(ref: string, filePath: string, projectRoot: string, repoRoot: string): string {
  const relPath = relative(repoRoot, resolve(projectRoot, filePath));
  try {
    return execSync(`git show ${ref}:${relPath}`, {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: "pipe",
    });
  } catch {
    throw new DiffError(`Cannot read "${filePath}" at ref "${ref}"`);
  }
}

interface ChangedFiles {
  modified: string[];
  added: string[];
  deleted: string[];
}

/**
 * Get list of changed files between two refs, filtered to the given spec paths.
 */
function getChangedSpecFiles(
  baseRef: string,
  headRef: string,
  specPaths: string[],
  projectRoot: string,
  repoRoot: string,
): ChangedFiles {
  // Build a map from repo-relative path to project-relative path
  const repoRelToProjectRel = new Map<string, string>();
  for (const p of specPaths) {
    const repoRel = relative(repoRoot, resolve(projectRoot, p));
    repoRelToProjectRel.set(repoRel, p);
  }

  let diffOutput: string;
  try {
    diffOutput = execSync(`git diff --name-status ${baseRef} ${headRef}`, {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: "pipe",
    });
  } catch {
    throw new DiffError(`Failed to run git diff between "${baseRef}" and "${headRef}"`);
  }

  const result: ChangedFiles = { modified: [], added: [], deleted: [] };

  for (const line of diffOutput.trim().split("\n")) {
    if (!line) continue;
    const parts = line.split("\t");
    const status = parts[0];
    const filePath = parts[1];
    if (!status || !filePath) continue;

    const projectRelPath = repoRelToProjectRel.get(filePath);
    if (projectRelPath === undefined) continue;

    if (status === "M") {
      result.modified.push(projectRelPath);
    } else if (status === "A") {
      result.added.push(projectRelPath);
    } else if (status === "D") {
      result.deleted.push(projectRelPath);
    }
  }

  return result;
}

/**
 * Compare specs between two git refs, producing a full DiffResult with
 * structural diffs, impact analysis, and cross-reference checks.
 */
export async function diffBetweenRefs(
  configPath: string,
  baseRef: string,
  headRef: string,
): Promise<DiffResult> {
  const projectRoot = realpathSync(dirname(resolve(configPath)));
  const repoRoot = getRepoRoot(projectRoot);

  // Validate refs
  validateRef(baseRef, projectRoot);
  validateRef(headRef, projectRoot);

  // Load config from filesystem (current version)
  const config = await loadConfig(configPath);

  // Collect all spec file paths from config
  const specPaths: string[] = [];
  const specIdByPath = new Map<string, string>();

  for (const [specId, entry] of Object.entries(config.specs)) {
    specPaths.push(entry.path);
    specIdByPath.set(entry.path, specId);
  }

  // Determine which spec files changed
  const changed = getChangedSpecFiles(baseRef, headRef, specPaths, projectRoot, repoRoot);

  // Build diffs for modified specs
  const diffs: SpecDiff[] = [];

  for (const filePath of changed.modified) {
    const beforeContent = gitShow(baseRef, filePath, projectRoot, repoRoot);
    const afterContent = gitShow(headRef, filePath, projectRoot, repoRoot);

    const beforeSpec = await parseSpecFromString(beforeContent, filePath);
    const afterSpec = await parseSpecFromString(afterContent, filePath);

    const diff = diffSpecs(beforeSpec, afterSpec);
    diffs.push(diff);
  }

  // Added and removed spec IDs
  const added = changed.added
    .map((p) => specIdByPath.get(p))
    .filter((id): id is string => id !== undefined);

  const removed = changed.deleted
    .map((p) => specIdByPath.get(p))
    .filter((id): id is string => id !== undefined);

  const impact: ImpactAnalysis[] = [];

  // Parse all current specs from head ref for impact analysis, keeping the
  // config entry each came from so requires edges can be mapped to spec ids.
  const allSpecs: ParsedSpec[] = [];
  const specsByEntry = new Map<string, ParsedSpec[]>();
  for (const [key, entry] of Object.entries(config.specs)) {
    const forEntry: ParsedSpec[] = [];
    try {
      const content = gitShow(headRef, entry.path, projectRoot, repoRoot);
      const parsed = await parseSpecFromString(content, entry.path);
      forEntry.push(parsed);
      allSpecs.push(parsed);
    } catch {
      // Spec may have been deleted at head ref -- skip
    }
    specsByEntry.set(key, forEntry);
  }

  // Impact works in spec id space: config requires and frontmatter references
  // unioned, so downstream is found whether entry keys match spec ids or not
  // (ADR: references/requires unification).
  const relations = buildRelationResolver(config, specsByEntry);

  const thresholdDays = config.diff?.staleness_threshold_days ?? 14;

  for (const diff of diffs) {
    const analysis = analyzeImpact(diff.specId, diff, relations, allSpecs, thresholdDays);
    if (analysis.totalAffected > 0) {
      impact.push(analysis);
    }
  }

  // Check cross-references for removed specs
  const _brokenRefs = checkCrossReferences(allSpecs, removed);

  // Generate summary
  const summaryParts: string[] = [];
  if (diffs.length > 0) {
    summaryParts.push(`${diffs.length} spec(s) modified`);
  }
  if (added.length > 0) {
    summaryParts.push(`${added.length} spec(s) added`);
  }
  if (removed.length > 0) {
    summaryParts.push(`${removed.length} spec(s) removed`);
  }
  if (impact.length > 0) {
    const totalDownstream = impact.reduce((sum, i) => sum + i.totalAffected, 0);
    summaryParts.push(`${totalDownstream} downstream spec(s) potentially affected`);
  }
  if (_brokenRefs.length > 0) {
    summaryParts.push(`${_brokenRefs.length} broken reference(s)`);
  }
  const summary = summaryParts.length > 0 ? summaryParts.join("; ") : "No changes detected";

  return { diffs, added, removed, impact, summary };
}
