import { describe, it, expect } from "vitest";
import { edgeCaseCoverageRule } from "./edge-case-coverage.js";
import type { ParsedSpec } from "@specdx/core";

/**
 * Split on H2 the way `extractParsedSections` does, so a fixture cannot claim a
 * heading in its content and an empty `parsedSections` at the same time — the
 * inconsistency that let the test-plan half of this rule look covered.
 */
const splitSections = (content: string): ParsedSpec["parsedSections"] => {
  const sections: ParsedSpec["parsedSections"] = [];
  let heading = "";
  let body: string[] = [];
  const flush = () => {
    const text = body.join("\n").trim();
    if (heading !== "" || text !== "") sections.push({ heading, content: text, tokens: 0 });
  };
  for (const line of content.split("\n")) {
    const match = /^##\s+(.*)$/.exec(line);
    if (match) {
      flush();
      heading = match[1]!.trim();
      body = [];
    } else {
      body.push(line);
    }
  }
  flush();
  return sections;
};

const makeSpec = (type: string, content: string): ParsedSpec => {
  const parsedSections = splitSections(content);
  return {
    filePath: "specs/test.md",
    frontmatter: {
      id: "test",
      type,
      title: "Test",
      status: "draft",
      version: "1.0",
      created: "2026-01-01",
      authors: ["dev"],
    },
    content,
    sections: parsedSections.map((s) => s.heading).filter(Boolean),
    parsedSections,
    valid: true,
    validationErrors: null,
  };
};

describe("edgeCaseCoverageRule", () => {
  it("warns when user-story has no error/edge case keywords", () => {
    const spec = makeSpec(
      "user-story",
      "## Description\n\nUser can log in.\n\n## Acceptance Criteria\n\n- User enters credentials\n- User sees dashboard",
    );
    const result = edgeCaseCoverageRule.run({ spec, allSpecs: [spec] });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]!.message).toContain("edge case");
  });

  it("passes when user-story mentions error handling", () => {
    const spec = makeSpec(
      "user-story",
      "## Description\n\nUser can log in.\n\n## Acceptance Criteria\n\n- Invalid credentials show error message\n- Empty email field shows validation error",
    );
    const result = edgeCaseCoverageRule.run({ spec, allSpecs: [spec] });
    expect(result).toHaveLength(0);
  });

  it("passes when user-story describes graceful degradation without classic error keywords", () => {
    const spec = makeSpec(
      "user-story",
      "## Description\n\nSkill loads spec context.\n\n## Acceptance Criteria\n\n- Skills fall back gracefully with a clear message when no config exists\n- The process does not crash on unexpected input",
    );
    const result = edgeCaseCoverageRule.run({ spec, allSpecs: [spec] });
    expect(result).toHaveLength(0);
  });

  it("warns when test-plan has no edge case coverage", () => {
    const spec = makeSpec("test-plan", "## Test Cases\n\n- User can log in\n- User can sign up");
    const result = edgeCaseCoverageRule.run({ spec, allSpecs: [spec] });
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("passes for test-plan with edge cases", () => {
    const spec = makeSpec(
      "test-plan",
      "## Test Cases\n\n- User can log in\n- Invalid password returns 401\n- Empty input shows boundary error",
    );
    const result = edgeCaseCoverageRule.run({ spec, allSpecs: [spec] });
    expect(result).toHaveLength(0);
  });

  it("skips non-applicable spec types", () => {
    const spec = makeSpec("prd", "## Features\n\n- **F1**: Login");
    const result = edgeCaseCoverageRule.run({ spec, allSpecs: [spec] });
    expect(result).toHaveLength(0);
  });
});

describe("edge-case-coverage — test plans are genuinely assessed", () => {
  // `test-plan` requires an `## Edge Cases` heading (schema REQUIRED_SECTIONS),
  // and the rule matched the substring "edge case" against the whole document —
  // so the required heading satisfied the rule and no real test plan could ever
  // be flagged. Half the rule's stated scope was inert.
  const run = (body: string) => {
    const spec = makeSpec("test-plan", body);
    return edgeCaseCoverageRule.run({ spec, allSpecs: [spec] });
  };

  const scope = "## Scope\n\nBilling API.\n\n## Test Cases\n\n- TC1: a user lists invoices.\n\n";

  it("does not accept the required Edge Cases heading as coverage on its own", () => {
    expect(run(`${scope}## Edge Cases\n`)).toHaveLength(1);
  });

  it("flags an Edge Cases section holding only a placeholder", () => {
    for (const placeholder of ["<!-- placeholder -->", "TODO", "TBD", "N/A", "-"]) {
      expect(run(`${scope}## Edge Cases\n\n${placeholder}\n`), placeholder).toHaveLength(1);
    }
  });

  it("flags an Edge Cases section that says there are none", () => {
    for (const body of ["None", "None identified.", "No edge cases", "Nothing yet"]) {
      expect(run(`${scope}## Edge Cases\n\n${body}\n`), body).toHaveLength(1);
    }
  });

  it("names the section in the diagnostic so the fix is obvious", () => {
    const [diagnostic] = run(`${scope}## Edge Cases\n`);
    expect(diagnostic!.section).toBe("Edge Cases");
    expect(diagnostic!.severity).toBe("warn");
    expect(diagnostic!.message).toContain("Edge Cases");
  });

  it("accepts an Edge Cases section that lists real cases", () => {
    const body = `${scope}## Edge Cases\n\n- An invoice with zero line items renders an empty total.\n- A voided invoice cannot be voided twice.\n`;
    expect(run(body)).toHaveLength(0);
  });

  it("accepts listed cases that use no error vocabulary at all", () => {
    // A real edge case need not contain a keyword: the section being written is
    // the signal. Requiring keywords inside it would re-introduce the guessing.
    const body = `${scope}## Edge Cases\n\n- An invoice dated 29 February in a leap year.\n- A customer with 10,000 line items.\n`;
    expect(run(body)).toHaveLength(0);
  });

  it("falls back to scanning the document when the section is absent", () => {
    // `structure/required-sections` owns the missing heading; this rule still
    // judges the content, which is how the pre-existing test plans behaved.
    expect(run("## Test Cases\n\n- User can log in\n- User can sign up")).toHaveLength(1);
    expect(run("## Test Cases\n\n- User can log in\n- Invalid password returns 401")).toHaveLength(
      0,
    );
  });
});

describe("edge-case-coverage — error status codes", () => {
  // The keyword list held `404` and `500` and no other code, so a story whose
  // error path was a 409 read as having no error handling at all. Changing that
  // one token to 404, with nothing else altered, silenced the warning.
  const base =
    "## Description\n\nFinance voids an invoice.\n\n## Acceptance Criteria\n\n" +
    "- Given an open invoice, when I void it, then its status becomes void.\n" +
    "- Given a paid invoice, when I void it, then the response is ";

  const run = (body: string) => {
    const spec = makeSpec("user-story", body);
    return edgeCaseCoverageRule.run({ spec, allSpecs: [spec] });
  };

  it("accepts any 4xx as naming an error path", () => {
    for (const code of ["400", "401", "403", "409", "422", "429"]) {
      expect(run(`${base}${code}.`), `status ${code}`).toEqual([]);
    }
  });

  it("accepts any 5xx as naming an error path", () => {
    for (const code of ["500", "502", "503"]) {
      expect(run(`${base}${code}.`), `status ${code}`).toEqual([]);
    }
  });

  it("accepts vocabulary that names a failure without a status code", () => {
    for (const word of ["a conflict", "denied", "expired", "unavailable"]) {
      expect(run(`${base}${word}.`), word).toEqual([]);
    }
  });

  it("still warns when no failure path is described at all", () => {
    const body =
      "## Description\n\nFinance lists invoices.\n\n## Acceptance Criteria\n\n" +
      "- Given invoices exist, when I list them, then each one is returned.";
    expect(run(body)).toHaveLength(1);
  });

  it("does not treat an ordinary number as a status code", () => {
    const body =
      "## Description\n\nFinance lists invoices.\n\n## Acceptance Criteria\n\n" +
      "- The list returns up to 250 rows per page, sorted by due date.";
    expect(run(body)).toHaveLength(1);
  });
});
