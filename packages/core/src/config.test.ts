import { describe, it, expect } from "vitest";
import { loadConfig, ConfigError } from "./config.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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
