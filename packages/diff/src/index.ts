export type {
  SpecDiff,
  FieldChange,
  FieldChangeType,
  SectionChange,
  ImpactAnalysis,
  DownstreamImpact,
  DiffResult,
  StatusResult,
  DiffConfig,
} from "./types.js";
export { DEFAULT_DIFF_CONFIG, DiffError } from "./types.js";
export { diffSpecs } from "./diff-specs.js";
export { analyzeImpact } from "./impact.js";
export { checkCrossReferences } from "./cross-refs.js";
export type { BrokenReference } from "./cross-refs.js";
export { diffBetweenRefs } from "./git.js";
