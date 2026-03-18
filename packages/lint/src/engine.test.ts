import { describe, it, expect } from "vitest";
import { createLintEngine } from "./engine.js";
import type { LintRule, LintContext, Diagnostic } from "./types.js";
import type { ParsedSpec } from "@sdx/core";

const mockSpec: ParsedSpec = {
  filePath: "specs/prd.md",
  frontmatter: {
    id: "prd-001", type: "prd", title: "Test", status: "draft",
    version: "1.0", created: "2026-01-01", authors: ["dev"],
  },
  content: "## Problem Statement\n\nSome content.",
  sections: ["Problem Statement"],
  valid: true,
  validationErrors: null,
};

const alwaysWarnRule: LintRule = {
  id: "test/always-warn",
  description: "Always produces a warning",
  severity: "warn",
  run(context: LintContext): Diagnostic[] {
    return [{ ruleId: "test/always-warn", severity: "warn", message: "This is a test warning", filePath: context.spec.filePath }];
  },
};

const alwaysPassRule: LintRule = {
  id: "test/always-pass",
  description: "Never produces diagnostics",
  severity: "error",
  run(): Diagnostic[] { return []; },
};

describe("createLintEngine", () => {
  it("runs rules and collects diagnostics", () => {
    const engine = createLintEngine({ rules: [alwaysWarnRule] });
    const results = engine.lint([mockSpec]);
    expect(results.diagnostics).toHaveLength(1);
    expect(results.diagnostics[0]!.ruleId).toBe("test/always-warn");
    expect(results.diagnostics[0]!.severity).toBe("warn");
  });

  it("returns empty diagnostics when all rules pass", () => {
    const engine = createLintEngine({ rules: [alwaysPassRule] });
    const results = engine.lint([mockSpec]);
    expect(results.diagnostics).toHaveLength(0);
  });

  it("reports hasErrors correctly", () => {
    const errorRule: LintRule = {
      id: "test/error", description: "Error rule", severity: "error",
      run(ctx): Diagnostic[] { return [{ ruleId: "test/error", severity: "error", message: "fail", filePath: ctx.spec.filePath }]; },
    };
    const engine = createLintEngine({ rules: [errorRule] });
    const results = engine.lint([mockSpec]);
    expect(results.hasErrors).toBe(true);
  });

  it("passes context with config and all specs to each rule", () => {
    let receivedContext: LintContext | undefined;
    const spyRule: LintRule = {
      id: "test/spy", description: "Captures context", severity: "warn",
      run(ctx): Diagnostic[] { receivedContext = ctx; return []; },
    };
    const engine = createLintEngine({ rules: [spyRule] });
    engine.lint([mockSpec]);
    expect(receivedContext).toBeDefined();
    expect(receivedContext!.spec).toEqual(mockSpec);
    expect(receivedContext!.allSpecs).toEqual([mockSpec]);
  });
});
