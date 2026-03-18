import { pathToFileURL } from "node:url";
import type { LintRule } from "./types.js";

export async function loadCustomRule(filePath: string): Promise<LintRule> {
  const module = await import(pathToFileURL(filePath).href);
  const rule = module.default ?? module.rule;
  if (!rule || !rule.id || !rule.run) {
    throw new Error(
      `Custom rule at ${filePath} must export a default LintRule with id and run function`,
    );
  }
  return rule as LintRule;
}
