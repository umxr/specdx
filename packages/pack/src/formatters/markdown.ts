import type { CompressedSpec, PackStats } from "../types.js";

/**
 * Format compressed specs as Markdown.
 *
 * @param specs - Compressed specs to render.
 * @param stats - Pack statistics with allocation details.
 * @returns A Markdown string representing the packed context.
 */
export function formatMarkdown(
  specs: CompressedSpec[],
  stats: PackStats,
): string {
  const parts: string[] = [];

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i]!;
    const alloc = stats.allocations.find((a) => a.specId === spec.specId);
    const relevance = alloc?.relevance ?? 0;

    if (i > 0) {
      parts.push("---");
      parts.push("");
    }

    parts.push(`# ${spec.specId} (${spec.type}) [relevance: ${relevance}]`);
    parts.push("");

    if (spec.collapsed) {
      parts.push(spec.collapsedSummary ?? "");
      parts.push("");
    } else {
      for (const section of spec.sections) {
        if (section.heading) {
          parts.push(`## ${section.heading}`);
          parts.push("");
        }
        parts.push(section.content);
        parts.push("");
      }
    }
  }

  return parts.join("\n");
}
