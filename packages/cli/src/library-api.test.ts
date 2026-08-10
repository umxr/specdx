import { describe, it, expect } from "vitest";
import { runLint } from "./commands/core/lint.js";
import { runPack } from "./commands/core/pack.js";
import { scaffoldProject } from "./commands/core/init.js";

// Audit run 4, N4: the published types require these options, but a JS caller
// who omits one got ERR_INVALID_ARG_TYPE from inside path.join — a stack trace
// with no mention of what was missing. The guard must name the option.
describe("library entry points name their missing required option", () => {
  it("runLint without configDir", async () => {
    await expect(runLint({} as Parameters<typeof runLint>[0])).rejects.toThrow(/configDir/);
  });

  it("runPack without configDir", async () => {
    await expect(runPack({} as Parameters<typeof runPack>[0])).rejects.toThrow(/configDir/);
  });

  it("scaffoldProject without targetDir", async () => {
    await expect(
      scaffoldProject({ projectName: "x", template: "lightweight" } as Parameters<
        typeof scaffoldProject
      >[0]),
    ).rejects.toThrow(/targetDir/);
  });
});
