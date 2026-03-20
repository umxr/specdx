import { Ajv as AjvClass, type ErrorObject } from "ajv";
import type { SpecType } from "./types.js";

import baseSpecSchema from "./schemas/base-spec.json" with { type: "json" };
import configSchema from "./schemas/config.json" with { type: "json" };
import prdSchema from "./schemas/prd.json" with { type: "json" };
import technicalDesignSchema from "./schemas/technical-design.json" with { type: "json" };
import userStorySchema from "./schemas/user-story.json" with { type: "json" };
import testPlanSchema from "./schemas/test-plan.json" with { type: "json" };
import adrSchema from "./schemas/adr.json" with { type: "json" };
import apiContractSchema from "./schemas/api-contract.json" with { type: "json" };
import epicSchema from "./schemas/epic.json" with { type: "json" };
import quickSpecSchema from "./schemas/quick-spec.json" with { type: "json" };
import projectContextSchema from "./schemas/project-context.json" with { type: "json" };

// addFormats is CJS-only; access via the namespace default at runtime
// The type cast is needed because TypeScript's NodeNext resolution exposes
// the CJS module as a namespace without a callable default signature.
import * as addFormatsNs from "ajv-formats";
type AddFormatsPlugin = (ajv: AjvClass, formats?: unknown) => AjvClass;
const addFormats = ((addFormatsNs as unknown as { default?: AddFormatsPlugin }).default ??
  (addFormatsNs as unknown as AddFormatsPlugin)) as AddFormatsPlugin;

export interface ValidationResult {
  valid: boolean;
  errors: ErrorObject[] | null;
}

const ajv = new AjvClass({ allErrors: true, strict: true });
addFormats(ajv, ["date"]);
ajv.addSchema(baseSpecSchema);

const specValidators: Record<string, ReturnType<typeof ajv.compile>> = {
  prd: ajv.compile(prdSchema),
  "technical-design": ajv.compile(technicalDesignSchema),
  "user-story": ajv.compile(userStorySchema),
  "test-plan": ajv.compile(testPlanSchema),
  adr: ajv.compile(adrSchema),
  "api-contract": ajv.compile(apiContractSchema),
  epic: ajv.compile(epicSchema),
  "quick-spec": ajv.compile(quickSpecSchema),
  "project-context": ajv.compile(projectContextSchema),
};

const configValidator = ajv.compile(configSchema);

export function validateSpec(type: SpecType, data: Record<string, unknown>): ValidationResult {
  const validate = specValidators[type];
  if (!validate) {
    return { valid: false, errors: [{ message: `Unknown spec type: "${type}"` } as ErrorObject] };
  }
  const valid = validate(data);
  return { valid: !!valid, errors: valid ? null : (validate.errors ?? null) };
}

export function validateConfig(data: Record<string, unknown>): ValidationResult {
  const valid = configValidator(data);
  return { valid: !!valid, errors: valid ? null : (configValidator.errors ?? null) };
}
