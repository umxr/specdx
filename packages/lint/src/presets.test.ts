import { describe, it, expect } from "vitest";
import { getPreset } from "./presets.js";

describe("presets", () => {
  it("minimal preset includes only structure rules", () => {
    const rules = getPreset("minimal");
    expect(rules.every((r) => r.id.startsWith("structure/"))).toBe(true);
  });

  it("recommended preset includes structure + content rules", () => {
    const rules = getPreset("recommended");
    expect(rules.some((r) => r.id.startsWith("structure/"))).toBe(true);
    expect(rules.some((r) => r.id.startsWith("completeness/"))).toBe(true);
    expect(rules.some((r) => r.id.startsWith("clarity/"))).toBe(true);
  });

  it("strict preset includes all rules with error severity", () => {
    const rules = getPreset("strict");
    expect(rules.length).toBeGreaterThanOrEqual(7);
    expect(rules.every((r) => r.severity === "error")).toBe(true);
  });
});
