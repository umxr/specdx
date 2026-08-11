import type { Diagnostic } from "../../types.js";
import type { AgentRule, AgentLintContext, AgentRuleResult } from "../types.js";

/**
 * An agent instruction file has to be navigable.
 *
 * Two failures, both falsifiable and both real: a file with no content at all,
 * and a file that is one undifferentiated block of prose. The second matters
 * because an agent — and a human maintaining the file — can only be pointed at
 * a heading. A wall of text can be appended to forever and never revised,
 * which is how these files rot.
 *
 * This rule deliberately does not judge whether the *advice* is any good. That
 * is an opinion about content, and specdx's claim is determinism.
 */
export const structureRule: AgentRule = {
  id: "agents/structure",
  description: "Agent instruction files should have content and be organised under headings",
  severity: "warn",

  run(context: AgentLintContext): AgentRuleResult {
    const { file } = context;
    const diagnostics: Diagnostic[] = [];

    if (file.content.trim() === "") {
      diagnostics.push({
        ruleId: "agents/structure",
        severity: "warn",
        message: `${file.relativePath} is empty. An empty instruction file steers nothing — delete it or write it.`,
        filePath: file.filePath,
      });
      // Every later assertion is about content this file does not have.
      return { diagnostics };
    }

    // ATX headings only. Setext (`===` underlines) is vanishingly rare in
    // these files, and matching it would mean tracking the previous line for
    // no practical gain.
    const headings = file.lines.filter((line) => /^#{1,6}\s+\S/.test(line));

    if (headings.length === 0) {
      diagnostics.push({
        ruleId: "agents/structure",
        severity: "warn",
        message: `${file.relativePath} has no headings, so it is one undifferentiated block. Nothing can be referenced, revised, or removed in isolation.`,
        filePath: file.filePath,
      });
    }

    return { diagnostics };
  },
};
