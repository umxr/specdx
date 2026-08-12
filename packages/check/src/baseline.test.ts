import { applyBaseline, createBaseline, fingerprint } from "./baseline.js";
import type { Finding } from "./types.js";

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    type: "missing",
    category: "route",
    specId: "api-001",
    expected: "GET /invoices",
    severity: "error",
    ...overrides,
  };
}

describe("applyBaseline", () => {
  it("suppresses a finding recorded in the baseline", () => {
    const known = finding();
    const baseline = createBaseline([known]);

    const result = applyBaseline([known], baseline);

    expect(result.remaining).toEqual([]);
    expect(result.suppressed).toEqual([known]);
  });

  it("surfaces a finding the baseline does not record", () => {
    const baseline = createBaseline([finding({ expected: "GET /invoices" })]);
    const fresh = finding({ expected: "POST /invoices" });

    const result = applyBaseline([fresh], baseline);

    expect(result.remaining).toEqual([fresh]);
    expect(result.suppressed).toEqual([]);
  });

  it("still suppresses when the code moved to a different line", () => {
    const before = finding({ codeLocation: { file: "src/routes.ts", line: 12 } });
    const baseline = createBaseline([before]);
    const after = finding({ codeLocation: { file: "src/routes.ts", line: 87 } });

    const result = applyBaseline([after], baseline);

    expect(result.remaining).toEqual([]);
  });

  it("keeps two extra findings distinct, though both expect '(not in spec)'", () => {
    const emailField = finding({
      type: "extra",
      category: "type",
      severity: "info",
      expected: "(not in spec)",
      actual: "Field User.email (string)",
    });
    const ageField = finding({
      type: "extra",
      category: "type",
      severity: "info",
      expected: "(not in spec)",
      actual: "Field User.age (number)",
    });
    const baseline = createBaseline([emailField]);

    const result = applyBaseline([emailField, ageField], baseline);

    expect(result.suppressed).toEqual([emailField]);
    expect(result.remaining).toEqual([ageField]);
  });

  it("surfaces a second occurrence when the baseline recorded only one", () => {
    const dupe = finding();
    const baseline = createBaseline([dupe]);

    const result = applyBaseline([dupe, dupe], baseline);

    expect(result.suppressed).toEqual([dupe]);
    expect(result.remaining).toEqual([dupe]);
  });

  it("does not confuse two findings whose fields differ only in where a space falls", () => {
    // Finding fields hold spaces, so a space-joined fingerprint lets one
    // finding's `expected` run into another's `actual`. Suppressing a real
    // finding because it collided with a baselined one is missed drift.
    const baselined = finding({ expected: "GET /x", actual: "y z" });
    const distinct = finding({ expected: "GET /x y", actual: "z" });
    const baseline = createBaseline([baselined]);

    const result = applyBaseline([distinct], baseline);

    expect(result.remaining).toEqual([distinct]);
    expect(result.suppressed).toEqual([]);
  });

  it("reports a baseline entry whose finding is now fixed as obsolete", () => {
    const fixed = finding({ expected: "GET /invoices" });
    const stillBroken = finding({ expected: "POST /invoices" });
    const baseline = createBaseline([fixed, stillBroken]);

    const result = applyBaseline([stillBroken], baseline);

    expect(result.obsolete).toEqual([
      {
        type: "missing",
        category: "route",
        specId: "api-001",
        expected: "GET /invoices",
        count: 1,
      },
    ]);
    expect(fingerprint(result.obsolete[0]!)).toBe(fingerprint(fixed));
  });
});
