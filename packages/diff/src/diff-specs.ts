import type { ParsedSpec, ParsedSection } from "@specdx/core";
import { createPatch } from "diff";
import type { SpecDiff, FieldChange, SectionChange } from "./types.js";

export function diffSpecs(before: ParsedSpec, after: ParsedSpec): SpecDiff {
  const frontmatter = diffFrontmatter(before.frontmatter, after.frontmatter);
  const sections = diffSections(before.parsedSections, after.parsedSections);
  const specId = after.frontmatter.id as string;

  const parts: string[] = [];
  if (frontmatter.length > 0) parts.push(`${frontmatter.length} field(s) changed`);
  if (sections.length > 0) parts.push(`${sections.length} section(s) changed`);
  const summary = parts.length > 0 ? `${specId}: ${parts.join(", ")}` : `${specId}: no changes`;

  return { specId, filePath: after.filePath, frontmatter, sections, summary };
}

function diffFrontmatter(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): FieldChange[] {
  const changes: FieldChange[] = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const inBefore = Object.prototype.hasOwnProperty.call(before, key);
    const inAfter = Object.prototype.hasOwnProperty.call(after, key);

    if (inBefore && !inAfter) {
      changes.push({ field: key, type: "removed", before: before[key] });
    } else if (!inBefore && inAfter) {
      changes.push({ field: key, type: "added", after: after[key] });
    } else if (inBefore && inAfter) {
      const bVal = before[key];
      const aVal = after[key];
      if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
        changes.push({ field: key, type: "modified", before: bVal, after: aVal });
      }
    }
  }

  return changes;
}

function diffSections(before: ParsedSection[], after: ParsedSection[]): SectionChange[] {
  const changes: SectionChange[] = [];

  const beforeMap = new Map<string, ParsedSection>();
  for (const section of before) {
    beforeMap.set(section.heading, section);
  }

  const afterMap = new Map<string, ParsedSection>();
  for (const section of after) {
    afterMap.set(section.heading, section);
  }

  // Removed sections: in before but not in after
  for (const [heading] of beforeMap) {
    if (!afterMap.has(heading)) {
      changes.push({ heading, type: "removed" });
    }
  }

  // Added or modified sections
  for (const [heading, afterSection] of afterMap) {
    const beforeSection = beforeMap.get(heading);
    if (!beforeSection) {
      changes.push({ heading, type: "added" });
    } else if (beforeSection.content !== afterSection.content) {
      const contentDiff = createPatch(
        heading,
        beforeSection.content,
        afterSection.content,
        "before",
        "after",
      );
      changes.push({ heading, type: "modified", contentDiff });
    }
  }

  return changes;
}
