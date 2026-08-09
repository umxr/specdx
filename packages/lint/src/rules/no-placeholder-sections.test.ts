import { noPlaceholderSectionsRule } from "./no-placeholder-sections.js";
import type { LintContext } from "../types.js";

function contextFor(parsedSections: Array<{ heading: string; content: string }>): LintContext {
  return {
    spec: {
      filePath: "specs/prd.md",
      frontmatter: { id: "prd", type: "prd" },
      content: "",
      sections: parsedSections.map((s) => s.heading),
      parsedSections: parsedSections.map((s) => ({ ...s, tokens: 0 })),
      valid: true,
      validationErrors: [],
    },
    allSpecs: [],
  } as unknown as LintContext;
}

describe("completeness/no-placeholder-sections", () => {
  it("flags a section holding only an HTML comment placeholder", () => {
    const diagnostics = noPlaceholderSectionsRule.run(
      contextFor([{ heading: "Goals", content: "<!-- placeholder -->" }]),
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.section).toBe("Goals");
    expect(diagnostics[0]!.severity).toBe("warn");
  });

  it("flags an empty section", () => {
    const diagnostics = noPlaceholderSectionsRule.run(
      contextFor([{ heading: "Goals", content: "   \n\n  " }]),
    );
    expect(diagnostics).toHaveLength(1);
  });

  it.each(["TODO", "TBD", "FIXME", "N/A", "...", "- TODO"])("flags %j as a placeholder", (body) => {
    const diagnostics = noPlaceholderSectionsRule.run(
      contextFor([{ heading: "Goals", content: body }]),
    );
    expect(diagnostics).toHaveLength(1);
  });

  it("accepts a section with real prose", () => {
    const diagnostics = noPlaceholderSectionsRule.run(
      contextFor([
        { heading: "Goals", content: "Ship a context engine that keeps sessions grounded." },
      ]),
    );
    expect(diagnostics).toHaveLength(0);
  });

  it("accepts prose that merely mentions a TODO", () => {
    const diagnostics = noPlaceholderSectionsRule.run(
      contextFor([
        {
          heading: "Goals",
          content: "Replace the TODO tracker with a spec-driven flow that developers trust.",
        },
      ]),
    );
    expect(diagnostics).toHaveLength(0);
  });

  it("ignores the preamble before the first heading", () => {
    const diagnostics = noPlaceholderSectionsRule.run(
      contextFor([{ heading: "", content: "<!-- placeholder -->" }]),
    );
    expect(diagnostics).toHaveLength(0);
  });

  it("reports every placeholder section, not just the first", () => {
    const diagnostics = noPlaceholderSectionsRule.run(
      contextFor([
        { heading: "Goals", content: "<!-- placeholder -->" },
        { heading: "Features", content: "TBD" },
        { heading: "Success Criteria", content: "Measured by adoption." },
      ]),
    );
    expect(diagnostics.map((d) => d.section)).toEqual(["Goals", "Features"]);
  });
});
