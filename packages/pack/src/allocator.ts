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

/** Build the marker text for a contiguous run of omitted sections. */
function omissionMarker(sections: CompressedSpec["sections"]): string {
  const names = sections.map((s) => s.heading || "(untitled)");
  const noun = names.length === 1 ? "section" : "sections";
  return `[${names.length} ${noun} omitted to fit token budget: ${names.join(", ")}]`;
}

/**
 * Produce a variant of `compressed` that fits within `budget` by keeping
 * sections in order while they fit and replacing each contiguous run of
 * omitted sections with an explicit marker naming them. Marker cost is
 * reserved out of the budget before sections are kept, so markers are always
 * emitted — a trimmed spec must never read as complete (issue #12).
 * Returns null when not even one real section fits.
 */
function trimToBudget(
  compressed: CompressedSpec,
  budget: number,
): { spec: CompressedSpec; tokens: number } | null {
  const sections = compressed.sections;
  let reserve = 0;

  // The kept set only shrinks as the reserve grows, so this converges.
  for (;;) {
    const effective = budget - reserve;
    const keep: boolean[] = new Array(sections.length).fill(false);
    let used = 0;
    let keptReal = false;

    for (let i = 0; i < sections.length; i++) {
      if (used + sections[i]!.tokens <= effective) {
        keep[i] = true;
        used += sections[i]!.tokens;
        keptReal = true;
      }
    }

    if (!keptReal) return null;

    // Group omitted sections into contiguous runs and price their markers.
    interface OmittedRun {
      start: number;
      sections: CompressedSpec["sections"];
      marker: string;
      markerTokens: number;
    }
    const runs: OmittedRun[] = [];
    for (let i = 0; i < sections.length; i++) {
      if (keep[i]) continue;
      const start = i;
      const run: CompressedSpec["sections"] = [];
      while (i < sections.length && !keep[i]) {
        run.push(sections[i]!);
        i++;
      }
      i--;
      const marker = omissionMarker(run);
      runs.push({ start, sections: run, marker, markerTokens: countTokens(marker) });
    }

    const markerTokens = runs.reduce((sum, r) => sum + r.markerTokens, 0);
    if (markerTokens > reserve) {
      reserve = markerTokens;
      continue;
    }

    // Assemble output: kept sections in order, markers at each cut.
    const out: CompressedSpec["sections"] = [];
    for (let i = 0; i < sections.length; i++) {
      const run = runs.find((r) => r.start === i);
      if (run) {
        out.push({
          heading: "",
          content: run.marker,
          tokens: run.markerTokens,
          compressed: true,
          originalTokens: run.sections.reduce((sum, s) => sum + s.tokens, 0),
          omittedSections: run.sections.length,
        });
        i += run.sections.length - 1;
        continue;
      }
      out.push(sections[i]!);
    }

    return { spec: { ...compressed, sections: out }, tokens: used + markerTokens };
  }
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
    /**
     * Staleness-collapsed variant, spent only under budget pressure (issue #33).
     * Undefined when there is nothing to collapse, or in full mode.
     */
    stale?: { spec: CompressedSpec; tokens: number };
  }

  function tokensOf(compressed: CompressedSpec): number {
    if (compressed.collapsed) return countTokens(compressed.collapsedSummary ?? "");
    return compressed.sections.reduce((sum, section) => sum + section.tokens, 0);
  }

  const items: ScoredCompressed[] = [];

  for (const score of scores) {
    const spec = specMap.get(score.specId);
    if (!spec) continue;

    let compressed: CompressedSpec;
    let stale: ScoredCompressed["stale"];

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
      const compress = (compression: CompressionOptions): CompressedSpec =>
        compressSpec(
          score.specId,
          String(spec.frontmatter.type),
          String(spec.frontmatter.title),
          spec.frontmatter.status as string | undefined,
          spec.frontmatter.updated as string | undefined,
          spec.parsedSections,
          compression,
        );

      // Boilerplate stripping and superseded-ADR collapse are hygiene, not
      // budget management -- they apply either way. Only the staleness collapse
      // is held back until the budget actually needs it.
      compressed = compress({ ...options.compression, stableDays: 0 });

      if (options.compression.stableDays > 0) {
        const collapsed = compress(options.compression);
        const collapsedTokens = tokensOf(collapsed);
        if (collapsedTokens < tokensOf(compressed)) {
          stale = { spec: collapsed, tokens: collapsedTokens };
        }
      }
    }

    items.push({
      compressed,
      relevance: score.score,
      tokens: tokensOf(compressed),
      idMatched: score.idMatched ?? false,
      stale,
    });
  }

  // 4. Sort by relevance descending; ties prefer specs the task named explicitly
  items.sort((a, b) => b.relevance - a.relevance || Number(b.idMatched) - Number(a.idMatched));

  // 4b. Collapse stale specs only while the budget is short, least relevant
  // first. Compression is a response to pressure: applied without it, the
  // caller asked for context and got stubs against a barely-touched budget.
  let projected = items.reduce((sum, item) => sum + item.tokens, 0);
  for (let i = items.length - 1; i >= 0 && projected > options.budget; i--) {
    const item = items[i]!;
    if (!item.stale) continue;
    projected -= item.tokens - item.stale.tokens;
    item.compressed = item.stale.spec;
    item.tokens = item.stale.tokens;
  }

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
  let sectionsOmitted = 0;
  for (const item of included) {
    for (const section of item.compressed.sections) {
      if (section.compressed) {
        sectionsCompressed++;
      }
      sectionsOmitted += section.omittedSections ?? 0;
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
    sectionsOmitted,
    allocations,
  };

  return {
    specs: included.map((item) => item.compressed),
    stats,
  };
}
