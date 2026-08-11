#!/usr/bin/env node
// Copies the authored skills into packages/cli/skills, which is committed.
//
// The Claude Code plugin manifest may only name a skills path inside the plugin
// root, and rejects any path containing "..". The plugin root has to stay
// packages/cli, because hooks.json resolves ${CLAUDE_PLUGIN_ROOT}/hooks. So the
// marketplace channel needs the skills committed under packages/cli, while they
// are authored — and conformance-tested — under packages/skills.
//
// The copy is generated, never edited: `skills tree is out of date` in
// packages/skills/src/conformance.test.ts fails when the two diverge.
import { cpSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(repo, "packages", "skills", "skills");
const target = join(repo, "packages", "cli", "skills");

if (!existsSync(source)) {
  console.error(`No skills at ${source}`);
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });

console.log(`packages/skills/skills -> packages/cli/skills`);
