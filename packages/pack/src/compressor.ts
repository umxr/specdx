import { countTokens } from "@specdx/core";
import type { ParsedSection } from "@specdx/core";
import type { CompressedSpec, CompressedSection, CompressionOptions } from "./types.js";

/**
 * Returns true when `dateStr` is more than `days` days before now.
 * Returns false for invalid / missing dates (treat as fresh).
 */
function isOlderThanDays(dateStr: string | undefined, days: number): boolean {
  if (!dateStr) return false;
  const ms = Date.parse(dateStr);
  if (Number.isNaN(ms)) return false;
  const diffMs = Date.now() - ms;
  return diffMs > days * 24 * 60 * 60 * 1000;
}

/**
 * Compress a single spec according to the provided options.
 */
export function compressSpec(
  specId: string,
  type: string,
  title: string,
  status: string | undefined,
  updatedDate: string | undefined,
  parsedSections: ParsedSection[],
  options: CompressionOptions,
): CompressedSpec {
  // 1. Collapse superseded ADRs
  if (
    type === "adr" &&
    status === "superseded" &&
    options.collapseResolvedAdrs
  ) {
    return {
      specId,
      type,
      title,
      sections: [],
      collapsed: true,
      collapsedSummary: `[ADR] ${title} — superseded`,
    };
  }

  // 2. Determine staleness
  const stale =
    options.stableDays > 0 && isOlderThanDays(updatedDate, options.stableDays);

  // 3. Process sections
  const boilerplateSet = new Set(
    options.boilerplateSections.map((s) => s.toLowerCase()),
  );

  const sections: CompressedSection[] = [];

  for (const section of parsedSections) {
    // 3a. Strip boilerplate
    if (
      options.stripBoilerplate &&
      section.heading &&
      boilerplateSet.has(section.heading.toLowerCase())
    ) {
      continue;
    }

    // 3b. Collapse stale headed sections (preserve preamble)
    if (stale && section.heading) {
      const stub = `[Unchanged since ${updatedDate} — ${section.tokens} tokens omitted]`;
      sections.push({
        heading: section.heading,
        content: stub,
        tokens: countTokens(stub),
        compressed: true,
        originalTokens: section.tokens,
      });
      continue;
    }

    // 3c. Pass through unchanged
    sections.push({
      heading: section.heading,
      content: section.content,
      tokens: section.tokens,
      compressed: false,
      originalTokens: section.tokens,
    });
  }

  return {
    specId,
    type,
    title,
    sections,
    collapsed: false,
  };
}
