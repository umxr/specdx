import { describe, it, expect } from "vitest";
import type { Diagnostic } from "@specdx/lint";
import { formatGithub } from "./github.js";

const diagnostic = (severity: Diagnostic["severity"]): Diagnostic => ({
  ruleId: "clarity/ambiguity-score-ai",
  severity,
  message: "AI ambiguity analysis available",
  filePath: "specs/prd.md",
});

describe("formatGithub", () => {
  it("renders an info diagnostic as ::notice, not ::warning", () => {
    // Info exists so a diagnostic cannot fail a build. Rendering it as a
    // warning put five warnings in the Actions log for a clean suite that
    // exited 0 (audit run 5, F5).
    expect(formatGithub([diagnostic("info")])).toContain("::notice ");
    expect(formatGithub([diagnostic("info")])).not.toContain("::warning");
  });

  it("still renders warn as ::warning and error as ::error", () => {
    expect(formatGithub([diagnostic("warn")])).toContain("::warning ");
    expect(formatGithub([diagnostic("error")])).toContain("::error ");
  });

  it("keeps the file, line and rule id", () => {
    const line = formatGithub([{ ...diagnostic("error"), line: 12 }]);
    expect(line).toContain("file=specs/prd.md");
    expect(line).toContain("line=12");
    expect(line).toContain("(clarity/ambiguity-score-ai)");
  });
});
