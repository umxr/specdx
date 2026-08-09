import { describe, it, expect } from "vitest";
import { formatChangelog } from "./changelog.js";
import type { DiffResult } from "@specdx/diff";

function resultWith(partial: Partial<DiffResult>): DiffResult {
  return {
    diffs: [],
    added: [],
    removed: [],
    impact: [],
    summary: "",
    uncommittedSpecFiles: [],
    ...partial,
  };
}

describe("formatChangelog", () => {
  it("titles the range it compared", () => {
    const out = formatChangelog(resultWith({}), "v1.0", "HEAD");
    expect(out).toContain("## Spec Changes (v1.0..HEAD)");
  });

  it("says so when nothing changed", () => {
    expect(formatChangelog(resultWith({}), "main", "HEAD")).toContain("No spec changes detected.");
  });

  it("lists modified specs with their version change and sections", () => {
    const out = formatChangelog(
      resultWith({
        diffs: [
          {
            specId: "prd",
            filePath: "specs/prd.md",
            frontmatter: [{ field: "version", type: "modified", before: "1.0", after: "1.1" }],
            sections: [{ heading: "Goals", type: "modified" }],
            summary: "",
          },
        ],
      }),
      "main",
      "HEAD",
    );
    expect(out).toContain("### Modified");
    expect(out).toContain("- **prd** (1.0 → 1.1) — Goals");
  });

  it("falls back to 'frontmatter only' when no section changed", () => {
    const out = formatChangelog(
      resultWith({
        diffs: [
          { specId: "prd", filePath: "specs/prd.md", frontmatter: [], sections: [], summary: "" },
        ],
      }),
      "main",
      "HEAD",
    );
    expect(out).toContain("frontmatter only");
  });

  it("lists added and removed specs", () => {
    const out = formatChangelog(
      resultWith({ added: ["story-2"], removed: ["story-1"] }),
      "main",
      "HEAD",
    );
    expect(out).toContain("### Added");
    expect(out).toContain("- **story-2**");
    expect(out).toContain("### Removed");
    expect(out).toContain("- **story-1**");
  });

  it("warns about working-tree specs the range does not cover", () => {
    const out = formatChangelog(
      resultWith({ uncommittedSpecFiles: ["specs/prd.md"] }),
      "main",
      "HEAD",
    );
    expect(out).toMatch(/1 spec file\(s\) changed in the working tree/);
  });
});
