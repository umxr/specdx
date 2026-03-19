export const SPEC_TYPES = [
  "prd",
  "technical-design",
  "user-story",
  "test-plan",
  "adr",
  "api-contract",
] as const;
export type SpecType = (typeof SPEC_TYPES)[number];

export const SPEC_STATUSES = ["draft", "review", "approved", "superseded"] as const;
export type SpecStatus = (typeof SPEC_STATUSES)[number];

export interface SpecReference {
  id: string;
  relationship: "implemented-by" | "decomposed-into" | "depends-on" | "supersedes" | "related-to";
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

export type Spec =
  | PrdSpec
  | TechnicalDesignSpec
  | UserStorySpec
  | TestPlanSpec
  | AdrSpec
  | ApiContractSpec;

export interface SpecEntry {
  path: string;
  type: SpecType;
  required?: boolean;
  requires?: string[];
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
    extends?: "minimal" | "recommended" | "strict";
    rules?: Record<string, unknown>;
    ignore?: string[];
  };
  pack?: PackConfig;
  diff?: {
    baseline_ref?: string;
    staleness_threshold_days?: number;
    ignore_paths?: string[];
  };
  ci?: Record<string, unknown>;
}
