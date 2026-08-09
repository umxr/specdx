#!/usr/bin/env node
// Copies packages/cli/package.json's version into the plugin manifests.
// Runs as part of `pnpm version`, immediately after `changeset version`.
// With --check it changes nothing and exits 1 if any version differs.
//
// The version was previously hand-maintained and silently fell 13 releases
// behind. `claude plugin validate --strict` warns when it is absent, so
// removing it is not the fix -- keeping it in sync automatically is.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const cliRoot = join(repo, "packages", "cli");

const manifests = [
  join(cliRoot, ".claude-plugin", "plugin.json"),
  join(cliRoot, ".cursor-plugin", "plugin.json"),
];

const { version } = JSON.parse(readFileSync(join(cliRoot, "package.json"), "utf8"));
const check = process.argv.includes("--check");

let failed = false;

for (const manifestPath of manifests) {
  const shown = relative(repo, manifestPath);
  let source;
  try {
    source = readFileSync(manifestPath, "utf8");
  } catch {
    continue;
  }

  const manifest = JSON.parse(source);
  if (manifest.version === version) {
    console.log(`${shown} is ${version} — already in sync`);
    continue;
  }

  if (check) {
    console.error(
      `${shown} is ${manifest.version}, packages/cli/package.json is ${version}. Run \`node scripts/sync-plugin-version.mjs\`.`,
    );
    failed = true;
    continue;
  }

  // Rewrite only the version line, to keep key order and formatting.
  const updated = source.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`);
  if (JSON.parse(updated).version !== version) {
    console.error(`Could not find a version field to replace in ${shown}.`);
    process.exitCode = 1;
    continue;
  }

  writeFileSync(manifestPath, updated);
  console.log(`${shown} ${manifest.version} -> ${version}`);
}

if (failed) process.exitCode = 1;
