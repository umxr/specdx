import type { ParsedSpec, DependencyGraph } from "@specdx/core";
import type { PackConfig } from "@specdx/schema";
import type { PackOptions, PackResult, CompressionOptions } from "./types.js";
import { scoreSpecs, scoreSpecsByIds } from "./resolver.js";
import { allocate } from "./allocator.js";
import { formatXml } from "./formatters/xml.js";
import { formatMarkdown } from "./formatters/markdown.js";
import { formatJson } from "./formatters/json.js";

export type {
  PackOptions,
  PackResult,
  PackStats,
  SpecAllocation,
  RelevanceScore,
  CompressedSpec,
  CompressedSection,
  CompressionOptions,
} from "./types.js";

export { scoreSpecs, scoreSpecsByIds } from "./resolver.js";
export { allocate, type AllocatorOptions, type AllocationResult } from "./allocator.js";
export { compressSpec } from "./compressor.js";
export { formatXml } from "./formatters/xml.js";
export { formatMarkdown } from "./formatters/markdown.js";
export { formatJson } from "./formatters/json.js";

/**
 * Default empty dependency graph used when none is provided.
 */
function emptyGraph(): DependencyGraph {
  return {
    nodes: [],
    edges: [],
    topologicalSort: () => [],
    getDownstream: () => [],
    getUpstream: () => [],
  };
}

/**
 * Build CompressionOptions from PackConfig with sensible defaults.
 */
function buildCompressionOptions(packConfig: PackConfig | undefined): CompressionOptions {
  const compression = packConfig?.compression;
  return {
    stripBoilerplate: compression?.strip_boilerplate ?? true,
    stableDays: compression?.stable_days ?? 7,
    collapseResolvedAdrs: compression?.collapse_resolved_adrs ?? true,
    boilerplateSections: packConfig?.boilerplate_sections ?? [
      "Changelog",
      "Revision History",
      "Document History",
    ],
  };
}

/**
 * Pack specs into a formatted context string within a token budget.
 *
 * Pipeline:
 * 1. Resolve relevance scores
 * 2. Allocate token budget across specs
 * 3. Format output in the requested format
 */
export function pack(
  specs: ParsedSpec[],
  options: PackOptions,
  packConfig: PackConfig | undefined,
  graph: DependencyGraph | undefined,
): PackResult {
  // 1. Resolve defaults
  const budget = options.budget ?? packConfig?.max_tokens ?? 12000;
  const format = options.format ?? packConfig?.format ?? "xml";
  const full = options.full ?? false;
  const compression = buildCompressionOptions(packConfig);
  const resolvedGraph = graph ?? emptyGraph();

  // 2. Build spec map for resolver
  const specMap = new Map<string, ParsedSpec>();
  for (const spec of specs) {
    specMap.set(spec.frontmatter.id, spec);
  }

  // 3. Stage 1 - Resolve
  const scores = options.specs
    ? scoreSpecsByIds(specMap, options.specs, resolvedGraph)
    : scoreSpecs(specMap, options.task, resolvedGraph);

  // 4. Stage 2 - Allocate
  const { specs: compressedSpecs, stats } = allocate(specs, scores, {
    budget,
    full,
    compression,
  });

  // 5. Dry run: return stats without output
  if (options.dryRun) {
    return { output: "", stats };
  }

  // 6. Stage 3 - Format
  let output: string;
  switch (format) {
    case "markdown":
      output = formatMarkdown(compressedSpecs, stats);
      break;
    case "json":
      output = formatJson(compressedSpecs, stats);
      break;
    default:
      output = formatXml(compressedSpecs, stats);
      break;
  }

  return { output, stats };
}
