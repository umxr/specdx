import { createBaseline, parseBaseline, serializeBaseline } from "./baseline.js";
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

describe("serializeBaseline", () => {
  it("writes entries a reviewer can read in a pull request diff", () => {
    // The baseline is committed and reviewed. An opaque joined blob with
    // control characters in it cannot be judged by the person approving it.
    const json = serializeBaseline(createBaseline([finding()]));

    expect(JSON.parse(json).entries[0]).toEqual({
      type: "missing",
      category: "route",
      specId: "api-001",
      expected: "GET /invoices",
      count: 1,
    });
    expect(json.includes(String.fromCharCode(31))).toBe(false);
  });

  it("round-trips through parseBaseline", () => {
    const baseline = createBaseline([finding(), finding({ expected: "POST /invoices" })]);

    const parsed = parseBaseline(serializeBaseline(baseline));

    expect(parsed).toEqual(baseline);
  });

  it("writes a trailing newline so the file is a well-formed text file", () => {
    expect(serializeBaseline(createBaseline([finding()]))).toMatch(/\n$/);
  });
});

describe("parseBaseline", () => {
  it("rejects malformed JSON rather than reporting an empty baseline", () => {
    // An empty baseline would gate every pre-existing finding, turning a typo
    // in the file into a wall of failures that looks like real drift.
    expect(() => parseBaseline("{not json")).toThrow(/could not be parsed/i);
  });

  it("rejects a version it does not understand", () => {
    const future = JSON.stringify({ version: 99, entries: [] });

    expect(() => parseBaseline(future)).toThrow(/version 99/);
  });

  it("rejects entries that are not shaped like baseline entries", () => {
    const wrong = JSON.stringify({ version: 1, entries: [{ nope: true }] });

    expect(() => parseBaseline(wrong)).toThrow(/entries/i);
  });
});
