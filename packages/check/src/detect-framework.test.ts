import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { detectFramework } from "./detect-framework.js";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("detectFramework", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "sdx-detect-"));
  });
  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it("detects express from dependencies", async () => {
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({ dependencies: { express: "^4.18.0" } }),
    );
    expect(await detectFramework(tempDir)).toBe("express");
  });

  it("detects hono from dependencies", async () => {
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({ dependencies: { hono: "^4.0.0" } }),
    );
    expect(await detectFramework(tempDir)).toBe("hono");
  });

  it("detects next from dependencies", async () => {
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({ dependencies: { next: "^14.0.0" } }),
    );
    expect(await detectFramework(tempDir)).toBe("nextjs");
  });

  it("detects from devDependencies too", async () => {
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({ devDependencies: { express: "^4.18.0" } }),
    );
    expect(await detectFramework(tempDir)).toBe("express");
  });

  it("returns null when no framework found", async () => {
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({ dependencies: { lodash: "^4.0.0" } }),
    );
    expect(await detectFramework(tempDir)).toBeNull();
  });

  it("returns null when no package.json exists", async () => {
    expect(await detectFramework(tempDir)).toBeNull();
  });
});
