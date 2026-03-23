import { validFrontmatterRule } from "./valid-frontmatter.js";
import { requiredSectionsRule } from "./required-sections.js";
import { validReferencesRule } from "./valid-references.js";
import { noCircularDepsRule } from "./no-circular-deps.js";
import { storyCoverageRule } from "./story-coverage.js";
import { stalenessCheckRule } from "./staleness-check.js";
import { noVagueLanguageRule } from "./no-vague-language.js";
import { singleProjectContextRule } from "./single-project-context.js";
import { terminologyRule } from "./terminology.js";
import { edgeCaseCoverageRule } from "./edge-case-coverage.js";
import { namingConventionsRule } from "./naming-conventions.js";
import { threatCoverageRule } from "./threat-coverage.js";
import { ambiguityScoreAiRule } from "./ambiguity-score-ai.js";
import type { LintRule } from "../types.js";

export const structureRules: LintRule[] = [
  validFrontmatterRule,
  requiredSectionsRule,
  validReferencesRule,
  noCircularDepsRule,
  singleProjectContextRule,
];

export const contentRules: LintRule[] = [
  storyCoverageRule,
  stalenessCheckRule,
  noVagueLanguageRule,
  terminologyRule,
  edgeCaseCoverageRule,
  namingConventionsRule,
  threatCoverageRule,
  ambiguityScoreAiRule,
];

export const allBuiltinRules: LintRule[] = [...structureRules, ...contentRules];

export {
  validFrontmatterRule,
  requiredSectionsRule,
  validReferencesRule,
  noCircularDepsRule,
  storyCoverageRule,
  stalenessCheckRule,
  noVagueLanguageRule,
  singleProjectContextRule,
  terminologyRule,
  edgeCaseCoverageRule,
  namingConventionsRule,
  threatCoverageRule,
  ambiguityScoreAiRule,
};
