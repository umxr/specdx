export type {
  CheckResult,
  Finding,
  ImplementationScore,
  HttpMethod,
  ExtractedRoute,
  ExtractedType,
  ExtractedTest,
  SpecEndpoint,
  SpecTypeDefinition,
  SpecTestCase,
  CheckConfig,
} from "./types.js";

export { runCheck } from "./check.js";
export {
  checkArtifacts,
  parseArtifacts,
  type ArtifactDecl,
  type ArtifactCheckResult,
} from "./artifacts.js";
export {
  applyBaseline,
  createBaseline,
  fingerprint,
  parseBaseline,
  serializeBaseline,
  type Baseline,
  type BaselineEntry,
  type BaselineApplication,
} from "./baseline.js";
export { detectFramework } from "./detect-framework.js";
export { analyzeWithAi } from "./ai.js";
export type { AiAssessment, AiCheckResult } from "./types.js";
