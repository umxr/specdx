import { defineCommand } from "citty";

export default defineCommand({
  meta: { name: "generate", description: "Generate spec stubs from existing specs" },
  subCommands: {
    story: () => import("./generate-story.js").then((m) => m.default),
    "test-plan": () => import("./generate-test-plan.js").then((m) => m.default),
  },
});
