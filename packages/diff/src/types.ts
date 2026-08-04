export type FieldChangeType = "added" | "removed" | "modified" | "broken-reference";

export interface FieldChange {
  field: string;
  type: FieldChangeType;
  before?: unknown;
  after?: unknown;
}

export interface SectionChange {
  heading: string;
  type: "added" | "removed" | "modified";
  contentDiff?: string;
}

export interface SpecDiff {
  specId: string;
  filePath: string;
  frontmatter: FieldChange[];
  sections: SectionChange[];
  summary: string;
}

export interface DownstreamImpact {
  specId: string;
  filePath: string;
  distance: number;
  lastUpdated: string | null;
  staleness: number;
  reason: string;
}

export interface ImpactAnalysis {
  changedSpec: string;
  downstream: DownstreamImpact[];
  totalAffected: number;
}

export interface DiffResult {
  diffs: SpecDiff[];
  added: string[];
  removed: string[];
  impact: ImpactAnalysis[];
  summary: string;
  /**
   * Spec files changed in the working tree but not covered by the comparison.
   *
   * A ref-to-ref diff cannot see uncommitted work, so reporting "no changes"
   * without this would be a false all-clear. Always empty in working mode,
   * where those changes are part of the comparison.
   */
  uncommittedSpecFiles: string[];
}

export interface DiffOptions {
  /**
   * Compare the base ref against the working tree instead of a head ref.
   * Includes staged, unstaged, and untracked spec files.
   */
  working?: boolean;
}

export interface StatusResult {
  project: string;
  specCount: number;
  byStatus: Record<string, number>;
  lintHealth: { errors: number; warnings: number; passing: number };
  staleSpecs: { specId: string; daysSinceUpdate: number; owner?: string }[];
  integrityIssues: string[];
  /** "unassessed" when the suite resolved to zero specs — never a vacuous "healthy". */
  verdict: "healthy" | "warnings" | "errors" | "unassessed";
}

export interface DiffConfig {
  baseline_ref: string;
  staleness_threshold_days: number;
  ignore_paths?: string[];
}

export const DEFAULT_DIFF_CONFIG: DiffConfig = {
  baseline_ref: "main",
  staleness_threshold_days: 14,
};

export class DiffError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiffError";
  }
}
