import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { REQUIRED_SECTIONS } from "@specdx/schema";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const readme = readFileSync(join(repoRoot, "README.md"), "utf-8");

/**
 * The README is the only place a user learns what a spec type requires, and it
 * described `epic`, `quick-spec` and `project-context` as "(flexible)" while
 * the linter hard-failed all three for missing sections. Documentation that
 * contradicts an error-severity rule costs a user their first hour.
 */
describe("README spec-type table matches the schema", () => {
  const rows = new Map<string, string>();
  for (const [, type, sections] of readme.matchAll(/^\|\s*`([a-z-]+)`\s*\|([^|]+)\|/gm)) {
    rows.set(type!, sections!.trim());
  }

  it("finds the table it is meant to check", () => {
    expect(rows.size).toBeGreaterThanOrEqual(Object.keys(REQUIRED_SECTIONS).length);
  });

  it.each(Object.keys(REQUIRED_SECTIONS))("documents %s's required sections", (type) => {
    const documented = rows.get(type);
    expect(documented, `no README row for spec type "${type}"`).toBeDefined();

    const expected = REQUIRED_SECTIONS[type as keyof typeof REQUIRED_SECTIONS];
    const listed = documented!
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    expect(listed).toEqual(expected);
  });
});

/**
 * The README's `uses:` line is copy-pasted into real workflows, so a wrong path
 * is a broken build for whoever trusts it. It pointed at `umxr/specdx-action`,
 * a repository that does not exist.
 */
describe("README GitHub Action usage", () => {
  const usesLine = /^\s*-?\s*uses:\s*(\S+)\s*$/m.exec(
    readme.slice(readme.indexOf("### CI Integration")),
  )?.[1];

  it("references the action by its real path in this repository", () => {
    expect(usesLine).toBeDefined();
    expect(usesLine).toMatch(/^umxr\/specdx\/packages\/github-action@/);
  });

  it("passes only inputs the action declares", () => {
    const actionYml = readFileSync(
      join(repoRoot, "packages", "github-action", "action.yml"),
      "utf-8",
    );
    const declared = new Set([...actionYml.matchAll(/^ {2}([A-Za-z][\w-]*):/gm)].map((m) => m[1]!));

    const ciSection = readme.slice(readme.indexOf("### CI Integration"));
    const withBlock = /with:\n((?: {4}\S[^\n]*\n)+)/.exec(ciSection)?.[1] ?? "";
    const passed = [...withBlock.matchAll(/^ {4}([A-Za-z][\w-]*):/gm)].map((m) => m[1]!);

    expect(passed.length).toBeGreaterThan(0);
    for (const input of passed) expect(declared).toContain(input);
  });
});
