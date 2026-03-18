import { describe, it, expect } from "vitest";
import { createLogger } from "./logger.js";

describe("createLogger", () => {
  it("creates a logger with default level", () => {
    const logger = createLogger();
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("respects quiet mode", () => {
    const logger = createLogger({ quiet: true });
    expect(logger.level).toBeLessThan(3);
  });

  it("respects verbose mode", () => {
    const logger = createLogger({ verbose: true });
    expect(logger.level).toBeGreaterThanOrEqual(4);
  });
});
