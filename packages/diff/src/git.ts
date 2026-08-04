import { execSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import picomatch from "picomatch";
import { loadConfig, parseSpecFromString, buildRelationResolver } from "@specdx/core";
import type { ParsedSpec } from "@specdx/core";
import { diffSpecs } from "./diff-specs.js";
import { analyzeImpact } from "./impact.js";
import { checkCrossReferences } from "./cross-refs.js";
import { DiffError } from "./types.js";
import type { DiffResult, DiffOptions, SpecDiff, ImpactAnalysis } from "./types.js";

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

/** Git reports paths with forward slashes regardless of platform. */
function toPosix(p: string): string {
  return sep === "/" ? p : p.split(sep).join("/");
}

interface EntryMatcher {
  /** Config entry key (may cover many spec files when the path is a glob). */
  key: string;
  /** Matches repo-relative, posix-separated paths against the entry's path. */
  isMatch: (repoRelPath: string) => boolean;
}

/**
 * Build one matcher per config entry.
 *
 * A config entry's `path` may be a glob (`specs/stories/*.md`), so it cannot be
 * compared to git's output by string equality -- the literal pattern is never
 * itself a changed path. Matching by pattern is what makes globbed specs
 * visible to diff at all.
 */
function buildEntryMatchers(
  specPathsByKey: Map<string, string>,
  projectRoot: string,
  repoRoot: string,
): EntryMatcher[] {
  return [...specPathsByKey].map(([key, specPath]) => ({
    key,
    isMatch: picomatch(toPosix(relative(repoRoot, resolve(projectRoot, specPath)))),
  }));
}

/** A spec file that changed between two refs, with the entry it belongs to. */
interface ChangedSpecFile {
  /** Project-relative path, as the rest of the pipeline expects. */
  path: string;
  entryKey: string;
}

interface ChangedFiles {
  modified: ChangedSpecFile[];
  added: ChangedSpecFile[];
  deleted: ChangedSpecFile[];
}

/**
 * Get list of changed files between two refs, filtered to files that belong to
 * a configured spec entry.
 */
function getChangedSpecFiles(
  baseRef: string,
  headRef: string,
  matchers: EntryMatcher[],
  projectRoot: string,
  repoRoot: string,
): ChangedFiles {
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

    const entry = matchers.find((m) => m.isMatch(filePath));
    if (!entry) continue;

    const changed: ChangedSpecFile = {
      path: relative(projectRoot, resolve(repoRoot, filePath)),
      entryKey: entry.key,
    };

    if (status === "M") {
      result.modified.push(changed);
    } else if (status === "A") {
      result.added.push(changed);
    } else if (status === "D") {
      result.deleted.push(changed);
    }
  }

  return result;
}

/**
 * List every spec file present at a ref, grouped by config entry key.
 *
 * Expanding globs against the ref rather than the working tree keeps impact
 * analysis accurate for specs that were added or deleted in the range.
 */
function listSpecFilesAtRef(
  ref: string,
  matchers: EntryMatcher[],
  projectRoot: string,
  repoRoot: string,
): Map<string, string[]> {
  const byEntry = new Map<string, string[]>(matchers.map((m) => [m.key, []]));

  let listing: string;
  try {
    listing = execSync(`git ls-tree -r --name-only ${ref}`, {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: "pipe",
    });
  } catch {
    throw new DiffError(`Failed to list files at ref "${ref}"`);
  }

  for (const filePath of listing.trim().split("\n")) {
    if (!filePath) continue;
    const entry = matchers.find((m) => m.isMatch(filePath));
    if (!entry) continue;
    byEntry.get(entry.key)?.push(relative(projectRoot, resolve(repoRoot, filePath)));
  }

  return byEntry;
}

/**
 * List every spec file in the working tree, grouped by config entry key.
 *
 * Uses git rather than a filesystem glob so ignored files are excluded the same
 * way they are on the ref side -- a file git cannot see is not a spec that can
 * be committed.
 */
function listSpecFilesInWorktree(
  matchers: EntryMatcher[],
  projectRoot: string,
  repoRoot: string,
): Map<string, string[]> {
  const byEntry = new Map<string, string[]>(matchers.map((m) => [m.key, []]));

  let listing: string;
  try {
    listing = execSync("git ls-files --cached --others --exclude-standard", {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: "pipe",
    });
  } catch {
    throw new DiffError("Failed to list files in the working tree");
  }

  for (const filePath of listing.trim().split("\n")) {
    if (!filePath) continue;
    const entry = matchers.find((m) => m.isMatch(filePath));
    if (!entry) continue;
    byEntry.get(entry.key)?.push(relative(projectRoot, resolve(repoRoot, filePath)));
  }

  return byEntry;
}

/** One side of a comparison: either a git ref or the working tree. */
interface ComparisonSide {
  /** Read a spec file's content on this side. Throws if absent. */
  read: (path: string) => string;
  /** Spec files present on this side, grouped by config entry key. */
  list: () => Map<string, string[]>;
}

function refSide(
  ref: string,
  matchers: EntryMatcher[],
  projectRoot: string,
  repoRoot: string,
): ComparisonSide {
  return {
    read: (path) => gitShow(ref, path, projectRoot, repoRoot),
    list: () => listSpecFilesAtRef(ref, matchers, projectRoot, repoRoot),
  };
}

function worktreeSide(
  matchers: EntryMatcher[],
  projectRoot: string,
  repoRoot: string,
): ComparisonSide {
  return {
    read: (path) => {
      try {
        return readFileSync(resolve(projectRoot, path), "utf-8");
      } catch {
        throw new DiffError(`Cannot read "${path}" in the working tree`);
      }
    },
    list: () => listSpecFilesInWorktree(matchers, projectRoot, repoRoot),
  };
}

/**
 * Get spec files that differ between a ref and the working tree.
 *
 * `git diff --name-status <ref>` covers tracked files, staged or not, but says
 * nothing about untracked ones -- and a brand new spec is untracked until the
 * commit this comparison exists to inform. Untracked spec files are therefore
 * folded in as additions.
 */
function getChangedSpecFilesInWorktree(
  baseRef: string,
  matchers: EntryMatcher[],
  projectRoot: string,
  repoRoot: string,
): ChangedFiles {
  let diffOutput: string;
  try {
    diffOutput = execSync(`git diff --name-status ${baseRef}`, {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: "pipe",
    });
  } catch {
    throw new DiffError(`Failed to diff "${baseRef}" against the working tree`);
  }

  const result: ChangedFiles = { modified: [], added: [], deleted: [] };
  const seen = new Set<string>();

  const record = (status: string, filePath: string): void => {
    const entry = matchers.find((m) => m.isMatch(filePath));
    if (!entry) return;
    if (seen.has(filePath)) return;
    seen.add(filePath);

    const changed: ChangedSpecFile = {
      path: relative(projectRoot, resolve(repoRoot, filePath)),
      entryKey: entry.key,
    };
    if (status === "M") result.modified.push(changed);
    else if (status === "A") result.added.push(changed);
    else if (status === "D") result.deleted.push(changed);
  };

  for (const line of diffOutput.trim().split("\n")) {
    if (!line) continue;
    const parts = line.split("\t");
    const status = parts[0];
    const filePath = parts[1];
    if (!status || !filePath) continue;
    record(status, filePath);
  }

  let untracked: string;
  try {
    untracked = execSync("git ls-files --others --exclude-standard", {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: "pipe",
    });
  } catch {
    throw new DiffError("Failed to list untracked files");
  }

  for (const filePath of untracked.trim().split("\n")) {
    if (!filePath) continue;
    record("A", filePath);
  }

  return result;
}

/**
 * Spec files with uncommitted changes in the working tree.
 *
 * Reported alongside a ref-to-ref comparison so "no spec changes" is never
 * mistaken for "nothing is about to change".
 */
function listUncommittedSpecFiles(
  matchers: EntryMatcher[],
  projectRoot: string,
  repoRoot: string,
): string[] {
  let statusOutput: string;
  try {
    statusOutput = execSync("git status --porcelain", {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: "pipe",
    });
  } catch {
    // Status is advisory -- never fail the diff over it.
    return [];
  }

  const files: string[] = [];
  for (const line of statusOutput.split("\n")) {
    if (!line.trim()) continue;
    // Porcelain v1: two status columns, a space, then the path. A rename reads
    // "old -> new"; the new path is the one that exists now.
    const rawPath = line.slice(3);
    const filePath = rawPath.includes(" -> ")
      ? (rawPath.split(" -> ")[1] ?? rawPath)
      : rawPath.replace(/^"|"$/g, "");
    if (!matchers.some((m) => m.isMatch(filePath))) continue;
    files.push(relative(projectRoot, resolve(repoRoot, filePath)));
  }

  return files;
}

/**
 * Resolve the spec ids of files that only exist on one side of the range.
 *
 * The config entry key is not usable as a spec id: one glob entry covers many
 * specs, so the id has to come from each file's own frontmatter.
 */
async function specIdsFrom(
  files: ChangedSpecFile[],
  read: (path: string) => string,
): Promise<string[]> {
  const ids: string[] = [];
  for (const file of files) {
    try {
      const parsed = await parseSpecFromString(read(file.path), file.path);
      ids.push(parsed.frontmatter.id);
    } catch {
      // Unparseable or unreadable on that side -- fall back to the entry key so
      // the spec is still reported as added/removed rather than dropped.
      ids.push(file.entryKey);
    }
  }
  return ids;
}

/**
 * Compare specs between two git refs, producing a full DiffResult with
 * structural diffs, impact analysis, and cross-reference checks.
 */
export async function diffBetweenRefs(
  configPath: string,
  baseRef: string,
  headRef: string,
  options: DiffOptions = {},
): Promise<DiffResult> {
  const projectRoot = realpathSync(dirname(resolve(configPath)));
  const repoRoot = getRepoRoot(projectRoot);

  // Validate refs. In working mode the head side is the working tree, which is
  // not a ref and has nothing to validate.
  validateRef(baseRef, projectRoot);
  if (!options.working) validateRef(headRef, projectRoot);

  // Load config from filesystem (current version)
  const config = await loadConfig(configPath);

  // Collect all spec paths from config, keyed by entry. A path may be a glob,
  // so entries are matched by pattern rather than by string equality.
  const specPathsByKey = new Map<string, string>();
  for (const [key, entry] of Object.entries(config.specs)) {
    specPathsByKey.set(key, entry.path);
  }
  const matchers = buildEntryMatchers(specPathsByKey, projectRoot, repoRoot);

  const base = refSide(baseRef, matchers, projectRoot, repoRoot);
  const head = options.working
    ? worktreeSide(matchers, projectRoot, repoRoot)
    : refSide(headRef, matchers, projectRoot, repoRoot);

  // Determine which spec files changed
  const changed = options.working
    ? getChangedSpecFilesInWorktree(baseRef, matchers, projectRoot, repoRoot)
    : getChangedSpecFiles(baseRef, headRef, matchers, projectRoot, repoRoot);

  // Build diffs for modified specs
  const diffs: SpecDiff[] = [];

  for (const file of changed.modified) {
    const beforeSpec = await parseSpecFromString(base.read(file.path), file.path);
    const afterSpec = await parseSpecFromString(head.read(file.path), file.path);

    const diff = diffSpecs(beforeSpec, afterSpec);
    diffs.push(diff);
  }

  // Added and removed spec IDs, read from the frontmatter on the side of the
  // range where the file exists.
  const added = await specIdsFrom(changed.added, head.read);
  const removed = await specIdsFrom(changed.deleted, base.read);

  const impact: ImpactAnalysis[] = [];

  // Parse all specs present on the head side for impact analysis, keeping the
  // config entry each came from so requires edges can be mapped to spec ids.
  const allSpecs: ParsedSpec[] = [];
  const specsByEntry = new Map<string, ParsedSpec[]>();
  const filesAtHead = head.list();
  for (const [key, paths] of filesAtHead) {
    const forEntry: ParsedSpec[] = [];
    for (const path of paths) {
      try {
        const parsed = await parseSpecFromString(head.read(path), path);
        forEntry.push(parsed);
        allSpecs.push(parsed);
      } catch {
        // Unparseable on this side -- skip
      }
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

  // Working mode already covers the working tree, so nothing there is missed.
  const uncommittedSpecFiles = options.working
    ? []
    : listUncommittedSpecFiles(matchers, projectRoot, repoRoot);

  return { diffs, added, removed, impact, summary, uncommittedSpecFiles };
}
