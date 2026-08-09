import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { scaffoldProject, defaultProjectName } from "./init.js";

describe("scaffoldProject", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "sdx-test-"));
  });
  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it("scaffolds a lightweight project", async () => {
    await scaffoldProject({
      projectName: "test-project",
      template: "lightweight",
      targetDir: tempDir,
    });
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
    await scaffoldProject({
      projectName: "api-project",
      template: "api-first",
      targetDir: tempDir,
    });
    const files = await readdir(join(tempDir, "specs"));
    expect(files).toContain("api-contract.md");
  });

  it("scaffolds a quick-spec project", async () => {
    await scaffoldProject({ projectName: "quick-project", template: "quick", targetDir: tempDir });
    const files = await readdir(join(tempDir, "specs"));
    expect(files).toContain("quick-spec.md");
    const content = await readFile(join(tempDir, "specs/quick-spec.md"), "utf-8");
    expect(content).toContain("type: quick-spec");
    expect(content).toContain("## Intent");
    expect(content).toContain("## Boundaries");
    expect(content).toContain("## Tasks");
  });

  it("scaffolds a context project", async () => {
    await scaffoldProject({ projectName: "ctx-project", template: "context", targetDir: tempDir });
    const files = await readdir(join(tempDir, "specs"));
    expect(files).toContain("project-context.md");
    const content = await readFile(join(tempDir, "specs/project-context.md"), "utf-8");
    expect(content).toContain("type: project-context");
    expect(content).toContain("## Technology Stack");
  });
});

describe("defaultProjectName", () => {
  // `npx specdx init` -- the literal first command anyone runs -- failed with
  // "Missing required argument: --name". The answer was in the path.
  it("uses the target directory's name", () => {
    expect(defaultProjectName("/home/dev/billing-api")).toBe("billing-api");
  });

  it("resolves '.' to the current directory rather than a dot", () => {
    expect(defaultProjectName(".")).toBe(basename(process.cwd()));
  });

  it("falls back rather than returning an empty name at the filesystem root", () => {
    expect(defaultProjectName("/")).toBe("my-project");
  });
});
