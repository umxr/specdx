#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import pkg from "../package.json" with { type: "json" };
import initCommand from "./commands/init.js";

const main = defineCommand({
  meta: { name: "specdx", version: pkg.version, description: "specdx — Spec Developer Experience" },
  subCommands: {
    init: initCommand,
    lint: () => import("./commands/lint.js").then((m) => m.default),
    validate: () => import("./commands/validate.js").then((m) => m.default),
    graph: () => import("./commands/graph.js").then((m) => m.default),
    skills: () => import("./commands/skills.js").then((m) => m.default),
    pack: () => import("./commands/pack.js").then((m) => m.default),
    diff: () => import("./commands/diff.js").then((m) => m.default),
    status: () => import("./commands/status.js").then((m) => m.default),
    explain: () => import("./commands/explain.js").then((m) => m.default),
    changelog: () => import("./commands/changelog.js").then((m) => m.default),
    check: () => import("./commands/check.js").then((m) => m.default),
    ready: () => import("./commands/ready.js").then((m) => m.default),
    update: () => import("./commands/update.js").then((m) => m.default),
    generate: () => import("./commands/generate.js").then((m) => m.default),
    migrate: () => import("./commands/migrate.js").then((m) => m.default),
    mcp: () => import("./commands/mcp.js").then((m) => m.default),
  },
});

runMain(main).catch((err: Error) => {
  console.error(`\n  ✗ ${err.message}\n`);
  process.exit(1);
});
