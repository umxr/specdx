/**
 * Spec statuses at which the surfaces a spec declares — its `artifacts` and the
 * types in its Data Model — must already exist in code.
 *
 * A spec is the plan for work that has not happened yet, so what it declares is
 * enforceable only once it is approved. Before then a declared-but-absent file,
 * export or type is the expected state, not a defect (issue #17) — otherwise
 * spec-first authoring would fail the very gate the declarations exist to feed.
 *
 * One rule, one place: artifacts had it and types did not, so the same draft
 * spec deferred its four planned files and hard-failed on its two planned types
 * (issue #52).
 */
const ENFORCED_STATUSES = new Set(["approved"]);

/** True when what a spec declares must exist for the check to pass. */
export function enforcedByStatus(status: unknown): boolean {
  return typeof status === "string" && ENFORCED_STATUSES.has(status);
}

/**
 * The suggestion attached to a declaration that is planned rather than missing.
 * Shared so artifacts and types cannot drift into two wordings for one rule.
 */
export function plannedSuggestion(specId: string, status: unknown): string {
  return `planned by ${specId} (status: ${String(status)}) — not yet implemented; enforced once the spec is approved.`;
}
