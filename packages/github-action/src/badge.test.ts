import { generateBadge } from "./badge.js";

describe("generateBadge", () => {
  it("generates valid SVG for passing", () => {
    const svg = generateBadge("passing");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("passing");
    expect(svg).toContain("spec health");
    expect(svg).toContain("#4c1"); // green
  });

  it("generates valid SVG for warnings", () => {
    const svg = generateBadge("warnings");
    expect(svg).toContain("warnings");
    expect(svg).toContain("#dfb317"); // yellow
  });

  it("generates valid SVG for failing", () => {
    const svg = generateBadge("failing");
    expect(svg).toContain("failing");
    expect(svg).toContain("#e05d44"); // red
  });

  it("produces different SVGs for different statuses", () => {
    const passing = generateBadge("passing");
    const failing = generateBadge("failing");
    expect(passing).not.toBe(failing);
  });
});
