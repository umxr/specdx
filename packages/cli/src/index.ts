export { scaffoldProject } from "./commands/core/init.js";
export { runLint } from "./commands/core/lint.js";
export { runPack } from "./commands/core/pack.js";
export { runDiff } from "./commands/core/diff.js";
export { runStatus } from "./commands/core/status.js";
export { runValidate } from "./commands/core/validate.js";

// The functions above were exported without any of the types they traffic in,
// so a consumer could call them and then not annotate what came back:
// `import type { PackResult } from "specdx"` failed with TS2459 (audit run 5,
// F3). Re-export the option and result shapes of every exported function,
// including the ones that originate in workspace packages a consumer of the
// published bundle cannot import directly.
export type { RunLintOptions, RunLintResults } from "./commands/core/lint.js";
export type { RunPackOptions } from "./commands/core/pack.js";
export type { RunDiffOptions } from "./commands/core/diff.js";
export type { RunStatusOptions } from "./commands/core/status.js";
export type { ValidateResult } from "./commands/core/validate.js";
export type { ScaffoldOptions, Template } from "./commands/core/init.js";
export type { Diagnostic, LintResults } from "@specdx/lint";
export type { PackOptions, PackResult } from "@specdx/pack";
export type { DiffResult, StatusResult } from "@specdx/diff";
export type { SdxConfig, SpecType } from "@specdx/schema";
