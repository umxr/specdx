import type { LintRule } from "../types.js";

/**
 * The shape of an ajv error, described structurally.
 *
 * Typed here rather than imported so the lint package does not take a
 * dependency on ajv for a single type.
 */
interface ValidationError {
  instancePath?: string;
  message?: string;
  params?: Record<string, unknown>;
}

/** `/references/0/relationship` -> `references[0].relationship`. */
function readablePath(instancePath: string): string {
  return instancePath
    .split("/")
    .filter(Boolean)
    .map((segment) => (/^\d+$/.test(segment) ? `[${segment}]` : `.${segment}`))
    .join("")
    .replace(/^\./, "");
}

/**
 * Turn one ajv error into something a spec author can act on.
 *
 * ajv only names the offending field inside `message` for `required`
 * violations. For `enum`, `const` and `type` the field lives in `instancePath`
 * and the acceptable values in `params`, so a bare `err.message` reads
 * "must be equal to one of the allowed values" and identifies nothing -- which
 * is what every `references:` entry produced.
 */
export function describeValidationError(err: ValidationError): string {
  const path = readablePath(err.instancePath ?? "");
  const allowed = (err.params as { allowedValues?: unknown[] } | undefined)?.allowedValues;

  let detail = err.message ?? JSON.stringify(err);
  if (Array.isArray(allowed) && allowed.length > 0) {
    detail += `: ${allowed.map((v) => JSON.stringify(v)).join(", ")}`;
  }

  return path ? `${path} ${detail}` : detail;
}

export const validFrontmatterRule: LintRule = {
  id: "structure/valid-frontmatter",
  description: "Frontmatter matches the schema for the declared spec type",
  severity: "error",
  run(context) {
    if (context.spec.valid) return [];
    const errors = context.spec.validationErrors ?? [];
    return errors.map((err) => ({
      ruleId: "structure/valid-frontmatter",
      severity: "error" as const,
      message: `Invalid frontmatter: ${describeValidationError(err)}`,
      filePath: context.spec.filePath,
    }));
  },
};
