import type { Finding } from "./types.js";

/**
 * A finding the baseline accepts, recorded as the fields that identify it.
 *
 * Stored as fields rather than a joined string because a baseline is committed
 * and reviewed: the person approving the diff has to be able to read what is
 * being accepted.
 *
 * `count` is part of the record because a fingerprint is not unique — the same
 * drift can occur several times, and recording only presence would let a second
 * occurrence hide behind the first.
 */
export interface BaselineEntry {
  type: Finding["type"];
  category: Finding["category"];
  specId: string;
  expected: string;
  actual?: string;
  count: number;
}

export interface Baseline {
  version: 1;
  entries: BaselineEntry[];
}

/** Field separator for the internal matching key: ASCII Unit Separator. */
const SEP = String.fromCharCode(31);

/**
 * Internal identity of a finding, stable across code movement.
 *
 * Line numbers are deliberately absent: a baseline invalidated by an added
 * import is a baseline nobody keeps.
 *
 * `actual` is present because an `extra` finding's `expected` is the literal
 * string "(not in spec)" — without `actual`, every extra finding in a spec
 * would share one key and suppress its neighbours.
 *
 * The separator is not a space. Finding fields hold spaces, so a space-joined
 * key lets one finding's `expected` run into another's `actual`, and a
 * collision here suppresses a real finding under a baselined one.
 */
export function fingerprint(f: Finding | BaselineEntry): string {
  return [f.type, f.category, f.specId, f.expected, f.actual ?? ""].join(SEP);
}

function toEntry(f: Finding, count: number): BaselineEntry {
  return {
    type: f.type,
    category: f.category,
    specId: f.specId,
    expected: f.expected,
    // Omitted rather than written as undefined, so the JSON stays clean.
    ...(f.actual === undefined ? {} : { actual: f.actual }),
    count,
  };
}

/**
 * Record the current findings as accepted. Entries are sorted so the written
 * file diffs cleanly when only one finding changes.
 */
export function createBaseline(findings: Finding[]): Baseline {
  const counts = new Map<string, number>();
  const first = new Map<string, Finding>();
  for (const f of findings) {
    const key = fingerprint(f);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!first.has(key)) first.set(key, f);
  }

  const entries = [...counts]
    .map(([key, count]) => toEntry(first.get(key)!, count))
    .sort((a, b) => fingerprint(a).localeCompare(fingerprint(b)));

  return { version: 1, entries };
}

/** The baseline as it is written to disk: stable order, trailing newline. */
export function serializeBaseline(baseline: Baseline): string {
  return JSON.stringify(baseline, null, 2) + "\n";
}

/**
 * Read a baseline, refusing anything it cannot vouch for.
 *
 * A baseline that degrades to "no entries" on a malformed file would gate every
 * pre-existing finding at once, and one that degrades to "suppress everything"
 * would hide real drift. Neither is recoverable by the reader, so both are
 * refused loudly instead.
 */
export function parseBaseline(source: string): Baseline {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    throw new Error("baseline file could not be parsed as JSON");
  }

  if (typeof raw !== "object" || raw === null) {
    throw new Error("baseline file could not be parsed: expected a JSON object");
  }

  const { version, entries } = raw as { version?: unknown; entries?: unknown };

  if (version !== 1) {
    throw new Error(
      `baseline file declares version ${String(version)}, which this version of specdx cannot read`,
    );
  }

  if (!Array.isArray(entries)) {
    throw new Error("baseline file has no entries array");
  }

  for (const entry of entries) {
    const e = entry as Partial<BaselineEntry>;
    const ok =
      typeof entry === "object" &&
      entry !== null &&
      typeof e.type === "string" &&
      typeof e.category === "string" &&
      typeof e.specId === "string" &&
      typeof e.expected === "string" &&
      (e.actual === undefined || typeof e.actual === "string") &&
      Number.isInteger(e.count);
    if (!ok) {
      throw new Error(
        "baseline file has entries missing type, category, specId, expected or count",
      );
    }
  }

  return { version: 1, entries: entries as BaselineEntry[] };
}

export interface BaselineApplication {
  /** Findings not covered by the baseline — these gate the build. */
  remaining: Finding[];
  /** Findings the baseline accepted. Still scored, never gating. */
  suppressed: Finding[];
  /** Recorded entries that no longer occur, so the baseline can be tightened. */
  obsolete: BaselineEntry[];
}

/**
 * Split findings into those the baseline already accepted and those it did not.
 *
 * Suppression governs the gate alone. The caller scores every finding, baselined
 * or not: a baseline that moved the coverage number would report an existing
 * project as complete on the day it was adopted.
 */
export function applyBaseline(findings: Finding[], baseline: Baseline): BaselineApplication {
  const budget = new Map<string, number>();
  for (const entry of baseline.entries) {
    const key = fingerprint(entry);
    budget.set(key, (budget.get(key) ?? 0) + entry.count);
  }

  const remaining: Finding[] = [];
  const suppressed: Finding[] = [];
  for (const f of findings) {
    const key = fingerprint(f);
    const left = budget.get(key) ?? 0;
    if (left > 0) {
      budget.set(key, left - 1);
      suppressed.push(f);
    } else {
      remaining.push(f);
    }
  }

  const obsolete = baseline.entries
    .filter((entry) => (budget.get(fingerprint(entry)) ?? 0) > 0)
    .sort((a, b) => fingerprint(a).localeCompare(fingerprint(b)));

  return { remaining, suppressed, obsolete };
}
