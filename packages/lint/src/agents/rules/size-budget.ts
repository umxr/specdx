import type { AgentRule, AgentLintContext, AgentRuleResult } from "../types.js";

/**
 * An agent instruction file competes for the context window it exists to protect.
 *
 * These files only grow. Every incident adds a rule, nothing is ever removed,
 * and eventually the instructions consume the budget that should have gone to
 * the code and specs. The count uses the same tokenizer as `pack`, so the
 * number here and the number in a pack budget mean the same thing.
 *
 * This rule always applies — every file has a token count — so it can never be
 * vacuous the way a reference check over a file naming no paths can be.
 */
export const sizeBudgetRule: AgentRule = {
  id: "agents/size-budget",
  description: "Agent instruction files should fit a token budget",
  severity: "warn",

  run(context: AgentLintContext): AgentRuleResult {
    const { file, maxTokens } = context;
    if (file.tokens <= maxTokens) return { diagnostics: [] };

    const over = file.tokens - maxTokens;
    const percent = Math.round((over / maxTokens) * 100);
    return {
      diagnostics: [
        {
          ruleId: "agents/size-budget",
          severity: this.severity,
          message: `${file.relativePath} is ${file.tokens} tokens, ${over} over the ${maxTokens} budget (${percent}% over). It is spending the context window it exists to protect.`,
          filePath: file.filePath,
        },
      ],
    };
  },
};
