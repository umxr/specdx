export {
  type BaseSpec,
  type PrdSpec,
  type TechnicalDesignSpec,
  type UserStorySpec,
  type TestPlanSpec,
  type AdrSpec,
  type ApiContractSpec,
  type EpicSpec,
  type QuickSpecSpec,
  type ProjectContextSpec,
  type Spec,
  type SpecType,
  type SpecStatus,
  type SpecReference,
  type SdxConfig,
  type SpecEntry,
  type PackConfig,
  type PackCompressionConfig,
  SPEC_TYPES,
  SPEC_STATUSES,
} from "./types.js";

export { REQUIRED_SECTIONS } from "./sections.js";
export { validateSpec, validateConfig, type ValidationResult } from "./validator.js";
