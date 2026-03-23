import type { ParsedSpec, DependencyGraph } from "@specdx/core";
import type { PackConfig } from "@specdx/schema";
import type {
  PackOptions,
  PackResult,
  CompressionOptions,
  CompressedSpec,
  RelevanceScore,
} from "./types.js";
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

  // 2. Extract project-context specs and reserve budget
  const projectContextSpecs: ParsedSpec[] = [];
  const regularSpecs: ParsedSpec[] = [];
  for (const spec of specs) {
    if (spec.frontmatter.type === "project-context") {
      projectContextSpecs.push(spec);
    } else {
      regularSpecs.push(spec);
    }
  }

  let reservedTokens = 0;
  let reservedCompressed: CompressedSpec[] = [];
  if (projectContextSpecs.length > 0) {
    const maxReserved = Math.min(budget, 2000);
    const ctxScores: RelevanceScore[] = projectContextSpecs.map((s) => ({
      specId: s.frontmatter.id,
      score: 1.0,
      rawScore: 1.0,
      matchedKeywords: [],
      graphBoosted: false,
    }));
    const ctxResult = allocate(projectContextSpecs, ctxScores, {
      budget: maxReserved,
      full: true,
      compression,
    });
    reservedCompressed = ctxResult.specs;
    reservedTokens = ctxResult.stats.used;
  }

  const regularBudget = Math.max(0, budget - reservedTokens);

  // 3. Build spec map for resolver (regular specs only)
  const specMap = new Map<string, ParsedSpec>();
  for (const spec of regularSpecs) {
    specMap.set(spec.frontmatter.id, spec);
  }

  // 4. Stage 1 - Resolve
  const scores = options.specs
    ? scoreSpecsByIds(specMap, options.specs, resolvedGraph)
    : scoreSpecs(specMap, options.task, resolvedGraph);

  // 5. Stage 2 - Allocate
  const { specs: compressedSpecs, stats } = allocate(regularSpecs, scores, {
    budget: regularBudget,
    full,
    compression,
  });

  // 6. Combine project-context and regular specs
  const allCompressed = [...reservedCompressed, ...compressedSpecs];

  // Update stats to include reserved specs
  stats.budget = budget;
  stats.used += reservedTokens;
  stats.specsIncluded += reservedCompressed.length;
  for (const ctx of reservedCompressed) {
    stats.allocations.unshift({
      specId: ctx.specId,
      type: ctx.type,
      relevance: 1.0,
      tokens: reservedTokens,
      compressed: false,
      included: true,
    });
  }

  // 7. Dry run: return stats without output
  if (options.dryRun) {
    return { output: "", stats };
  }

  // 8. Stage 3 - Format
  let output: string;
  switch (format) {
    case "markdown":
      output = formatMarkdown(allCompressed, stats);
      break;
    case "json":
      output = formatJson(allCompressed, stats);
      break;
    default:
      output = formatXml(allCompressed, stats);
      break;
  }

  return { output, stats };
}
