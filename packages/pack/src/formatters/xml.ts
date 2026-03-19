import type { CompressedSpec, PackStats } from "../types.js";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Format compressed specs as XML.
 *
 * @param specs - Compressed specs to render.
 * @param stats - Pack statistics with allocation details.
 * @returns An XML string representing the packed context.
 */
export function formatXml(specs: CompressedSpec[], stats: PackStats): string {
  const lines: string[] = [];

  lines.push(
    `<context budget="${stats.budget}" used="${stats.used}" specs="${stats.specsIncluded}" compressed="${stats.sectionsCompressed}">`,
  );

  for (const spec of specs) {
    const alloc = stats.allocations.find((a) => a.specId === spec.specId);
    const relevance = alloc?.relevance ?? 0;
    const tokens = alloc?.tokens ?? 0;

    if (spec.collapsed) {
      lines.push(
        `  <spec id="${escapeXml(spec.specId)}" type="${escapeXml(spec.type)}" relevance="${relevance}" tokens="${tokens}" collapsed="true">`,
      );
      lines.push(`    ${escapeXml(spec.collapsedSummary ?? "")}`);
      lines.push("  </spec>");
    } else {
      lines.push(
        `  <spec id="${escapeXml(spec.specId)}" type="${escapeXml(spec.type)}" relevance="${relevance}" tokens="${tokens}">`,
      );
      for (const section of spec.sections) {
        const compressedAttr = section.compressed ? ' compressed="true"' : "";
        lines.push(`    <section name="${escapeXml(section.heading)}"${compressedAttr}>`);
        lines.push(`      ${escapeXml(section.content)}`);
        lines.push("    </section>");
      }
      lines.push("  </spec>");
    }
  }

  lines.push("</context>");

  return lines.join("\n");
}
