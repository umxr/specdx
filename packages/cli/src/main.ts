#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import initCommand from "./commands/init.js";

const main = defineCommand({
  meta: { name: "sdx", version: "0.0.0", description: "SDX — Spec Developer Experience" },
  subCommands: {
    init: initCommand,
    lint: () => import("./commands/lint.js").then((m) => m.default),
    validate: () => import("./commands/validate.js").then((m) => m.default),
    graph: () => import("./commands/graph.js").then((m) => m.default),
    skills: () => import("./commands/skills.js").then((m) => m.default),
  },
});

runMain(main).catch((err: Error) => {
  console.error(`\n  ✗ ${err.message}\n`);
  process.exit(1);
});
