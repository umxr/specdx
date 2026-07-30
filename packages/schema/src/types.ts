export const SPEC_TYPES = [
  "prd",
  "technical-design",
  "user-story",
  "test-plan",
  "adr",
  "api-contract",
  "epic",
  "quick-spec",
  "project-context",
] as const;
export type SpecType = (typeof SPEC_TYPES)[number];

export const SPEC_STATUSES = ["draft", "review", "approved", "superseded"] as const;
export type SpecStatus = (typeof SPEC_STATUSES)[number];

export interface SpecReference {
  id: string;
  relationship: "implemented-by" | "decomposed-into" | "depends-on" | "supersedes" | "related-to";
}

/** A checkable implementation artifact declared by a spec (issue #15). */
export interface SpecArtifact {
  /** Project-root-relative file path that must exist. */
  path: string;
  /** Names that must be exported from the file. */
  exports?: string[];
}

export interface BaseSpec {
  id: string;
  type: SpecType;
  title: string;
  status: SpecStatus;
  version: string;
  created: string;
  updated?: string;
  authors: string[];
  tags?: string[];
  references?: SpecReference[];
  artifacts?: SpecArtifact[];
}

export interface PrdSpec extends BaseSpec {
  type: "prd";
}
export interface TechnicalDesignSpec extends BaseSpec {
  type: "technical-design";
}
export interface UserStorySpec extends BaseSpec {
  type: "user-story";
  story_id: string;
  priority: "critical" | "high" | "medium" | "low";
  estimate: string;
}
export interface TestPlanSpec extends BaseSpec {
  type: "test-plan";
}
export interface AdrSpec extends BaseSpec {
  type: "adr";
}
export interface ApiContractSpec extends BaseSpec {
  type: "api-contract";
}

export interface EpicSpec extends BaseSpec {
  type: "epic";
  epic_id: string;
  priority: "critical" | "high" | "medium" | "low";
}

export interface QuickSpecSpec extends BaseSpec {
  type: "quick-spec";
}

export interface ProjectContextSpec extends BaseSpec {
  type: "project-context";
}

export type Spec =
  | PrdSpec
  | TechnicalDesignSpec
  | UserStorySpec
  | TestPlanSpec
  | AdrSpec
  | ApiContractSpec
  | EpicSpec
  | QuickSpecSpec
  | ProjectContextSpec;

export interface SpecEntry {
  path: string;
  type: SpecType;
  required?: boolean;
  requires?: string[];
  owner?: string;
}

export interface PackCompressionConfig {
  strip_boilerplate?: boolean;
  stable_days?: number;
  collapse_resolved_adrs?: boolean;
}

export interface PackConfig {
  max_tokens?: number;
  format?: "xml" | "markdown" | "json";
  compression?: PackCompressionConfig;
  boilerplate_sections?: string[];
}

export interface SdxConfig {
  version: string;
  project?: { name?: string; description?: string };
  specs: Record<string, SpecEntry>;
  lint?: {
    extends?: string;
    rules?: Record<string, unknown>;
    ignore?: string[];
  };
  pack?: PackConfig;
  diff?: {
    baseline_ref?: string;
    staleness_threshold_days?: number;
    ignore_paths?: string[];
  };
  ci?: {
    block_on?: ("error" | "warn" | "info")[];
    post_comment?: boolean;
    update_badge?: boolean;
    trigger_paths?: string[];
  };
  check?: {
    framework?: "auto" | "express" | "hono" | "nextjs";
    routes_dir?: string;
    app_dir?: string;
    types_dir?: string;
    tests_dir?: string;
    ignore?: string[];
  };
}
