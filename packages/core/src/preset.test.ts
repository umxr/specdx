import { resolvePreset } from "./preset.js";
import { writeFile, rm, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("resolvePreset", () => {
  it("returns null for built-in presets", async () => {
    expect(await resolvePreset("minimal")).toBeNull();
    expect(await resolvePreset("recommended")).toBeNull();
    expect(await resolvePreset("strict")).toBeNull();
  });

  it("resolves a local YAML file", async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), "sdx-preset-"));
    const presetPath = join(tmpDir, "custom-preset.yaml");
    await writeFile(presetPath, 'extends: "strict"\nrules:\n  custom: "error"\n');

    try {
      const result = await resolvePreset(presetPath);
      expect(result).not.toBeNull();
      expect(result!.extends).toBe("strict");
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("throws ConfigError for non-existent preset", async () => {
    await expect(resolvePreset("@specdx/nonexistent-config-that-does-not-exist")).rejects.toThrow(
      "Could not resolve preset",
    );
  });
});
