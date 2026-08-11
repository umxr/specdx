import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, findConfig, ConfigError } from "./config.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtemp, mkdir, writeFile, rm, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "../test/fixtures");

describe("loadConfig", () => {
  it("loads and validates a correct config file", async () => {
    const config = await loadConfig(join(fixturesDir, "valid-config.yaml"));
    expect(config.version).toBe("1.0");
    expect(config.project?.name).toBe("test-project");
    expect(config.specs.prd.type).toBe("prd");
    expect(config.specs.technical.requires).toEqual(["prd"]);
  });

  it("throws ConfigError for invalid config", async () => {
    await expect(loadConfig(join(fixturesDir, "invalid-config.yaml"))).rejects.toThrow(ConfigError);
  });

  it("throws ConfigError for missing file", async () => {
    await expect(loadConfig("/nonexistent/spec.config.yaml")).rejects.toThrow(ConfigError);
  });
});

describe("findConfig tells absence apart from unusable", () => {
  // `findConfig` returning undefined is what makes `specdx lint` degrade to
  // linting agent files alone and report a pass. So "I could not read it" must
  // never come back as the same undefined as "it is not there" — that would
  // leave the whole spec suite unchecked, exit 0, and tell the user "no
  // spec.config.yaml here" about a file sitting in front of them.
  let dir: string;

  // Root ignores mode bits, so the two permission cases below would pass
  // without exercising anything. Skipping loudly beats a green test that
  // proves nothing.
  const asNonRoot = process.getuid?.() === 0 ? it.skip : it;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "sdx-findconfig-"));
  });
  afterEach(async () => {
    await chmod(join(dir, "locked"), 0o755).catch(() => {});
    await chmod(join(dir, "spec.config.yaml"), 0o644).catch(() => {});
    await rm(dir, { recursive: true, force: true });
  });

  it("returns undefined when there is genuinely no config anywhere above", async () => {
    expect(await findConfig(dir)).toBeUndefined();
  });

  it("returns the path when the config is there", async () => {
    await writeFile(join(dir, "spec.config.yaml"), 'version: "1.0"\nspecs: {}\n');
    expect(await findConfig(dir)).toBe(join(dir, "spec.config.yaml"));
  });

  it("throws rather than reporting absence when spec.config.yaml is a directory", async () => {
    await mkdir(join(dir, "spec.config.yaml"));
    await expect(findConfig(dir)).rejects.toThrow(ConfigError);
    await expect(findConfig(dir)).rejects.toThrow(/not a regular file/);
  });

  asNonRoot("does not report absence for a config it cannot read", async () => {
    // Mode 000 stats fine, so the path comes back and `loadConfig` reports
    // "Cannot read config file". The forbidden outcome is undefined.
    const configPath = join(dir, "spec.config.yaml");
    await writeFile(configPath, 'version: "1.0"\nspecs: {}\n');
    await chmod(configPath, 0o000);

    expect(await findConfig(dir)).toBe(configPath);
    await expect(loadConfig(undefined, dir)).rejects.toThrow(/Cannot read config file/);
  });

  asNonRoot(
    "throws rather than reporting absence when the directory cannot be traversed",
    async () => {
      const sub = join(dir, "locked");
      await mkdir(sub);
      await writeFile(join(sub, "spec.config.yaml"), 'version: "1.0"\nspecs: {}\n');
      await chmod(sub, 0o000);

      // EACCES from stat. Walking up from here would find nothing and answer
      // "no config", which is the degrade-to-a-pass path.
      const result = await findConfig(sub).catch((e: Error) => e);
      expect(result).toBeInstanceOf(ConfigError);
      expect((result as Error).message).toMatch(/Cannot read config file/);
    },
  );
});
