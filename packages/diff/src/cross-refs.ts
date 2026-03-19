import type { ParsedSpec } from "@specdx/core";

export interface BrokenReference {
  specId: string;
  field: string;
  type: "broken-reference";
  referencedId: string;
}

export function checkCrossReferences(
  allSpecs: ParsedSpec[],
  removedIds: string[],
): BrokenReference[] {
  // Build set of all valid spec IDs, then remove any that were deleted
  const validIds = new Set(allSpecs.map((s) => s.frontmatter.id));
  for (const id of removedIds) {
    validIds.delete(id);
  }

  const broken: BrokenReference[] = [];

  for (const spec of allSpecs) {
    const references = spec.frontmatter.references;
    if (!references || references.length === 0) {
      continue;
    }

    for (const ref of references) {
      if (!validIds.has(ref.id)) {
        broken.push({
          specId: spec.frontmatter.id,
          field: "references",
          type: "broken-reference",
          referencedId: ref.id,
        });
      }
    }
  }

  return broken;
}
