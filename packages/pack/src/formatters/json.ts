import type { CompressedSpec, PackStats } from "../types.js";

interface JsonSection {
  name: string;
  content: string;
  compressed: boolean;
}

interface JsonSpec {
  id: string;
  type: string;
  relevance: number;
  tokens: number;
  collapsed: boolean;
  summary?: string;
  sections: JsonSection[];
}

interface JsonOutput {
  budget: number;
  used: number;
  specs: JsonSpec[];
}

/**
 * Format compressed specs as a JSON string.
 *
 * @param specs - Compressed specs to render.
 * @param stats - Pack statistics with allocation details.
 * @returns A pretty-printed JSON string representing the packed context.
 */
export function formatJson(
  specs: CompressedSpec[],
  stats: PackStats,
): string {
  const output: JsonOutput = {
    budget: stats.budget,
    used: stats.used,
    specs: specs.map((spec) => {
      const alloc = stats.allocations.find((a) => a.specId === spec.specId);
      const relevance = alloc?.relevance ?? 0;
      const tokens = alloc?.tokens ?? 0;

      const jsonSpec: JsonSpec = {
        id: spec.specId,
        type: spec.type,
        relevance,
        tokens,
        collapsed: spec.collapsed,
        sections: spec.sections.map((s) => ({
          name: s.heading,
          content: s.content,
          compressed: s.compressed,
        })),
      };

      if (spec.collapsed) {
        jsonSpec.summary = spec.collapsedSummary ?? "";
      }

      return jsonSpec;
    }),
  };

  return JSON.stringify(output, null, 2);
}
