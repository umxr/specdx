/** Options for the pack command. */
export interface PackOptions {
  /** Specific task or context to optimise relevance for. */
  task?: string;
  /** Glob patterns or spec IDs to include. */
  specs?: string[];
  /** Maximum token budget for the output. */
  budget?: number;
  /** Output format (e.g. "xml", "json", "markdown"). */
  format?: string;
  /** Include all specs without budget trimming. */
  full?: boolean;
  /** Preview what would be packed without writing output. */
  dryRun?: boolean;
}

/** Statistics about how the budget was allocated. */
export interface PackStats {
  /** Total token budget. */
  budget: number;
  /** Tokens actually used. */
  used: number;
  /** Number of specs included in the output. */
  specsIncluded: number;
  /** Number of specs excluded due to budget or relevance. */
  specsExcluded: number;
  /** Number of sections that were compressed. */
  sectionsCompressed: number;
  /** Number of sections omitted entirely to fit the budget. */
  sectionsOmitted: number;
  /** Per-spec allocation details. */
  allocations: SpecAllocation[];
}

/** Result returned by the pack operation. */
export interface PackResult {
  /** The formatted output string. */
  output: string;
  /** Statistics about the pack run. */
  stats: PackStats;
}

/** Token allocation detail for a single spec. */
export interface SpecAllocation {
  /** Identifier of the spec. */
  specId: string;
  /** Spec type (e.g. "adr", "rfc", "runbook"). */
  type: string;
  /** Computed relevance score (0-1). */
  relevance: number;
  /** Tokens allocated to this spec. */
  tokens: number;
  /** Whether this spec was compressed. */
  compressed: boolean;
  /** Whether this spec was included in the output. */
  included: boolean;
}

/** Relevance score computed for a spec. */
export interface RelevanceScore {
  /** Identifier of the spec. */
  specId: string;
  /** Final relevance score (0-1), after any boosting. */
  score: number;
  /** Raw relevance score before graph boosting. */
  rawScore: number;
  /** Keywords from the task that matched this spec. */
  matchedKeywords: string[];
  /** Whether this score was boosted by the spec graph. */
  graphBoosted: boolean;
  /** Whether the task string contains this spec's id verbatim. */
  idMatched?: boolean;
}

/** A spec that has been compressed to fit a budget. */
export interface CompressedSpec {
  /** Identifier of the spec. */
  specId: string;
  /** Spec type. */
  type: string;
  /** Spec title. */
  title: string;
  /** Sections after compression. */
  sections: CompressedSection[];
  /** Whether the entire spec was collapsed to a summary. */
  collapsed: boolean;
  /** One-line summary used when fully collapsed. */
  collapsedSummary?: string;
}

/** A single section within a compressed spec. */
export interface CompressedSection {
  /** Section heading. */
  heading: string;
  /** Section content (may be truncated). */
  content: string;
  /** Tokens in the compressed content. */
  tokens: number;
  /** Whether this section was compressed. */
  compressed: boolean;
  /** Token count of the original, uncompressed content. */
  originalTokens: number;
  /** For omission markers: how many original sections this marker replaces. */
  omittedSections?: number;
}

/** Options that control compression behaviour. */
export interface CompressionOptions {
  /** Remove common boilerplate sections. */
  stripBoilerplate: boolean;
  /** Number of days after which a spec is considered stable. */
  stableDays: number;
  /** Collapse ADRs whose status is "accepted" or "superseded". */
  collapseResolvedAdrs: boolean;
  /** Section headings considered boilerplate. */
  boilerplateSections: string[];
}
