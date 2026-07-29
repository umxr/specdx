import { countTokens } from "@specdx/core";
import type { ParsedSpec } from "@specdx/core";
import { compressSpec } from "./compressor.js";
import type {
  CompressedSpec,
  CompressionOptions,
  PackStats,
  RelevanceScore,
  SpecAllocation,
} from "./types.js";

/** Options for the token allocator. */
export interface AllocatorOptions {
  /** Maximum token budget. */
  budget: number;
  /** When true, include full spec content without compression. */
  full: boolean;
  /** Compression settings (used when `full` is false). */
  compression: CompressionOptions;
}

/** Result of the allocation pass. */
export interface AllocationResult {
  /** Compressed specs that fit within the budget. */
  specs: CompressedSpec[];
  /** Statistics about how the budget was spent. */
  stats: PackStats;
}

/** Relevance at or above which a spec is trimmed to fit rather than excluded. */
const HIGH_RELEVANCE = 0.75;

/** Minimum remaining budget worth trimming into. */
const MIN_TRIM_BUDGET = 150;

const OMITTED_MARKER = "[section omitted to fit token budget]";

/**
 * Produce a variant of `compressed` that fits within `budget` by keeping
 * sections in order while they fit and replacing the rest with one-line
 * omission markers. Returns null when not even one real section fits.
 */
function trimToBudget(
  compressed: CompressedSpec,
  budget: number,
): { spec: CompressedSpec; tokens: number } | null {
  const markerTokens = countTokens(OMITTED_MARKER);
  const kept: CompressedSpec["sections"] = [];
  let used = 0;
  let keptReal = false;

  for (const section of compressed.sections) {
    if (used + section.tokens <= budget) {
      kept.push(section);
      used += section.tokens;
      keptReal = true;
    } else if (used + markerTokens <= budget) {
      kept.push({
        heading: section.heading,
        content: OMITTED_MARKER,
        tokens: markerTokens,
        compressed: true,
        originalTokens: section.tokens,
      });
      used += markerTokens;
    }
  }

  if (!keptReal) return null;
  return { spec: { ...compressed, sections: kept }, tokens: used };
}

/**
 * Allocate a token budget across specs, sorted by relevance.
 *
 * 1. Build specId -> ParsedSpec map
 * 2. Compress each spec (or pass through in full mode)
 * 3. Calculate token counts
 * 4. Sort by relevance descending
 * 5. Greedily include specs until budget is exhausted
 * 6. Build stats
 */
export function allocate(
  specs: ParsedSpec[],
  scores: RelevanceScore[],
  options: AllocatorOptions,
): AllocationResult {
  // 1. Build specId -> ParsedSpec map
  const specMap = new Map<string, ParsedSpec>();
  for (const spec of specs) {
    specMap.set(spec.frontmatter.id, spec);
  }

  // 2. Compress each scored spec and compute token counts
  interface ScoredCompressed {
    compressed: CompressedSpec;
    relevance: number;
    tokens: number;
    idMatched: boolean;
  }

  const items: ScoredCompressed[] = [];

  for (const score of scores) {
    const spec = specMap.get(score.specId);
    if (!spec) continue;

    let compressed: CompressedSpec;

    if (options.full) {
      // No compression: pass through sections unchanged
      compressed = {
        specId: score.specId,
        type: String(spec.frontmatter.type),
        title: String(spec.frontmatter.title),
        sections: spec.parsedSections.map((s) => ({
          heading: s.heading,
          content: s.content,
          tokens: s.tokens,
          compressed: false,
          originalTokens: s.tokens,
        })),
        collapsed: false,
      };
    } else {
      compressed = compressSpec(
        score.specId,
        String(spec.frontmatter.type),
        String(spec.frontmatter.title),
        spec.frontmatter.status as string | undefined,
        spec.frontmatter.updated as string | undefined,
        spec.parsedSections,
        options.compression,
      );
    }

    // 3. Calculate token count
    let tokens: number;
    if (compressed.collapsed) {
      tokens = countTokens(compressed.collapsedSummary ?? "");
    } else {
      tokens = 0;
      for (const section of compressed.sections) {
        tokens += section.tokens;
      }
    }

    items.push({ compressed, relevance: score.score, tokens, idMatched: score.idMatched ?? false });
  }

  // 4. Sort by relevance descending; ties prefer specs the task named explicitly
  items.sort((a, b) => b.relevance - a.relevance || Number(b.idMatched) - Number(a.idMatched));

  // 5. Greedy selection within budget
  const totalTokens = items.reduce((sum, item) => sum + item.tokens, 0);
  const withinBudget = totalTokens <= options.budget;

  const included: ScoredCompressed[] = [];
  const excluded: ScoredCompressed[] = [];
  let usedTokens = 0;

  if (withinBudget) {
    // Everything fits
    for (const item of items) {
      included.push(item);
      usedTokens += item.tokens;
    }
  } else {
    // Greedy: include from highest to lowest relevance. High-relevance specs
    // that don't fit are trimmed into the remaining budget before being
    // excluded — a task-named spec should never silently drop out.
    for (const item of items) {
      if (usedTokens + item.tokens <= options.budget) {
        included.push(item);
        usedTokens += item.tokens;
        continue;
      }
      const remaining = options.budget - usedTokens;
      if (
        (item.idMatched || item.relevance >= HIGH_RELEVANCE) &&
        remaining >= MIN_TRIM_BUDGET &&
        !item.compressed.collapsed
      ) {
        const trimmed = trimToBudget(item.compressed, remaining);
        if (trimmed) {
          included.push({ ...item, compressed: trimmed.spec, tokens: trimmed.tokens });
          usedTokens += trimmed.tokens;
          continue;
        }
      }
      excluded.push(item);
    }
  }

  // 6. Build stats
  let sectionsCompressed = 0;
  for (const item of included) {
    for (const section of item.compressed.sections) {
      if (section.compressed) {
        sectionsCompressed++;
      }
    }
  }

  const allocations: SpecAllocation[] = [];

  // Add included specs
  for (const item of included) {
    allocations.push({
      specId: item.compressed.specId,
      type: item.compressed.type,
      relevance: item.relevance,
      tokens: item.tokens,
      compressed: item.compressed.collapsed || item.compressed.sections.some((s) => s.compressed),
      included: true,
    });
  }

  // Add excluded specs
  for (const item of excluded) {
    allocations.push({
      specId: item.compressed.specId,
      type: item.compressed.type,
      relevance: item.relevance,
      tokens: item.tokens,
      compressed: item.compressed.collapsed || item.compressed.sections.some((s) => s.compressed),
      included: false,
    });
  }

  const stats: PackStats = {
    budget: options.budget,
    used: usedTokens,
    specsIncluded: included.length,
    specsExcluded: excluded.length,
    sectionsCompressed,
    allocations,
  };

  return {
    specs: included.map((item) => item.compressed),
    stats,
  };
}
