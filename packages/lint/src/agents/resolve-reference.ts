import { readdirSync } from "node:fs";
import { join, sep } from "node:path";

/**
 * Directories never worth indexing. Vendored trees contain other people's
 * files, and a reference resolving against `node_modules` would be a false
 * *negative* — the worse direction for a rule whose job is finding rot.
 */
const SKIP_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
  ".cache",
  "out",
]);

/** Bail out rather than walk a pathological tree. */
const MAX_INDEXED_FILES = 20_000;

/**
 * Every file path in the project, relative to the config directory, with `/`
 * separators regardless of platform.
 */
export function indexProjectFiles(configDir: string): string[] {
  const found: string[] = [];

  const walk = (dir: string, prefix: string) => {
    if (found.length >= MAX_INDEXED_FILES) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // unreadable directory is not a reason to fail a lint run
    }
    for (const entry of entries) {
      if (found.length >= MAX_INDEXED_FILES) return;
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) continue;
        // Directories are indexed too: an agent file can legitimately point at
        // one ("skills live in `packages/skills/skills/core`").
        found.push(relative);
        walk(join(dir, entry.name), relative);
      } else {
        found.push(relative);
      }
    }
  };

  walk(configDir, "");
  return found;
}

/**
 * Stems that are universally placeholders rather than claims about this repo.
 *
 * Documentation says "tests live alongside source — `src/foo.test.ts` next to
 * `src/foo.ts`" and means the *pattern*, not those files. Flagging them is the
 * kind of false positive that teaches people to ignore the rule, and the ADR
 * is explicit that a miss is cheaper than that.
 */
const PLACEHOLDER_STEMS = new Set([
  "foo",
  "bar",
  "baz",
  "qux",
  "example",
  "your-app",
  "my-app",
  "some-file",
  "path",
]);

export function isPlaceholder(reference: string): boolean {
  const base = reference.split("/").pop() ?? reference;
  // `foo.test.ts` -> `foo`; `foo` -> `foo`
  const stem = base.split(".")[0] ?? base;
  return PLACEHOLDER_STEMS.has(stem.toLowerCase());
}

/**
 * Does a reference in an agent file point at something real?
 *
 * Exact match first, then **suffix** match against the project index. Suffix
 * matching is what makes shorthand work: prose says "`resolver.ts` scores spec
 * relevance" having already named the package, and `core/specdx-router` means
 * the one under `packages/skills/skills/`. Requiring full paths would flag
 * almost every real instruction file, which is a rule nobody would keep on.
 *
 * A path that was renamed or deleted still matches nothing, which is the case
 * the rule exists for.
 */
export function createReferenceResolver(files: string[]): (reference: string) => boolean {
  const exact = new Set(files);
  // Bucket by basename so a lookup is not a scan of the whole index per
  // reference. Directory references are keyed by their own last segment.
  const byLastSegment = new Map<string, string[]>();
  for (const file of files) {
    const last = file.split("/").pop()!;
    const bucket = byLastSegment.get(last);
    if (bucket) bucket.push(file);
    else byLastSegment.set(last, [file]);
  }

  return (reference: string): boolean => {
    const normalised = reference.split(sep).join("/");
    if (exact.has(normalised)) return true;
    if (isPlaceholder(normalised)) return true;

    const last = normalised.split("/").pop();
    if (!last) return false;
    const candidates = byLastSegment.get(last);
    if (!candidates) return false;

    // Suffix must land on a path boundary: `b.ts` must not satisfy `sub/b.ts`
    // by matching `other/sub-thing/b.ts`.
    return candidates.some(
      (candidate) => candidate === normalised || candidate.endsWith(`/${normalised}`),
    );
  };
}
