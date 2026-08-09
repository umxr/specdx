import { describe, it, expect } from "vitest";
import { COMMAND_NAMES, subCommands } from "./registry.js";

describe("CLI command surface", () => {
  it("registers exactly the declared commands", () => {
    expect(Object.keys(subCommands).sort()).toEqual([...COMMAND_NAMES].sort());
  });

  it("no longer registers explain", () => {
    // Dropped before 0.4.0 stable. On a fresh scaffold it printed
    // `<!-- placeholder -->` as each spec's description, and `status` plus
    // `pack --full` already cover onboarding. 0.x is the last cheap moment to
    // remove a command: after a stable release it breaks users.
    expect([...COMMAND_NAMES]).not.toContain("explain");
  });
});
