import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scaffoldProject } from "./init.js";

describe("scaffoldProject", () => {
  let tempDir: string;

  beforeEach(async () => { tempDir = await mkdtemp(join(tmpdir(), "sdx-test-")); });
  afterEach(async () => { await rm(tempDir, { recursive: true }); });

  it("scaffolds a lightweight project", async () => {
    await scaffoldProject({ projectName: "test-project", template: "lightweight", targetDir: tempDir });
    const config = await readFile(join(tempDir, "spec.config.yaml"), "utf-8");
    expect(config).toContain("version:");
    expect(config).toContain("test-project");
    const files = await readdir(join(tempDir, "specs"));
    expect(files).toContain("prd.md");
    expect(files).toContain("technical-design.md");
  });

  it("scaffolds a bmad project", async () => {
    await scaffoldProject({ projectName: "bmad-project", template: "bmad", targetDir: tempDir });
    const config = await readFile(join(tempDir, "spec.config.yaml"), "utf-8");
    expect(config).toContain("bmad-project");
  });

  it("scaffolds an api-first project", async () => {
    await scaffoldProject({ projectName: "api-project", template: "api-first", targetDir: tempDir });
    const files = await readdir(join(tempDir, "specs"));
    expect(files).toContain("api-contract.md");
  });
});
