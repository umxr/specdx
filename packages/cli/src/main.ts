#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import pkg from "../package.json" with { type: "json" };
import { subCommands } from "./commands/registry.js";

const main = defineCommand({
  meta: { name: "specdx", version: pkg.version, description: "specdx — Spec Developer Experience" },
  subCommands,
});

runMain(main).catch((err: Error) => {
  console.error(`\n  ✗ ${err.message}\n`);
  process.exit(1);
});
