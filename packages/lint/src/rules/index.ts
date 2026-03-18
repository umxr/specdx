import { validFrontmatterRule } from "./valid-frontmatter.js";
import { requiredSectionsRule } from "./required-sections.js";
import { validReferencesRule } from "./valid-references.js";
import { noCircularDepsRule } from "./no-circular-deps.js";
import type { LintRule } from "../types.js";

export const structureRules: LintRule[] = [
  validFrontmatterRule, requiredSectionsRule, validReferencesRule, noCircularDepsRule,
];

export { validFrontmatterRule, requiredSectionsRule, validReferencesRule, noCircularDepsRule };
