import { defineCommand } from "citty";
import { labelled } from "../registry.js";

export default defineCommand({
  meta: { name: "generate", description: "Generate spec stubs from existing specs" },
  subCommands: {
    story: () => import("./generate-story.js").then((m) => labelled("generate story", m.default)),
    "test-plan": () =>
      import("../experimental/generate-test-plan.js").then((m) =>
        labelled("generate test-plan", m.default),
      ),
  },
});
