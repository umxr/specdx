import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { SdxConfig } from "@specdx/schema";
import { resolveLintConfig } from "./resolve-lint-config.js";

/**
 * `lint.rules` and `lint.ignore` were declared in the config schema, documented
 * in the README and CONTRIBUTING, and accepted by `validate` — while nothing
 * read them. `naming-conventions: off` left the rule firing, a custom rule
 * never loaded, and `ignore` excluded nothing. Silent, on every surface.
 */
describe("resolveLintConfig", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "sdx-resolve-lint-"));
    await mkdir(join(dir, "specs"), { recursive: true });
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const base = (lint: SdxConfig["lint"]): SdxConfig =>
    ({ version: "1.0", specs: {}, lint }) as SdxConfig;

  const ids = (rules: { id: string }[]) => rules.map((r) => r.id);

  it("defaults to the recommended preset", async () => {
    const { rules, ignore } = await resolveLintConfig({ configDir: dir });
    expect(rules.length).toBeGreaterThan(5);
    expect(ignore).toEqual([]);
  });

  it.each([["off"], [false], [null]])("removes a rule set to %s", async (value) => {
    const config = base({ rules: { "consistency/naming-conventions": value } as never });
    const { rules } = await resolveLintConfig({ config, configDir: dir });
    expect(ids(rules)).not.toContain("consistency/naming-conventions");
    // Everything else survives — `off` disables one rule, not the preset.
    expect(ids(rules)).toContain("structure/required-sections");
  });

  it("overrides a rule's severity", async () => {
    const config = base({ rules: { "consistency/naming-conventions": "error" } });
    const { rules } = await resolveLintConfig({ config, configDir: dir });
    const rule = rules.find((r) => r.id === "consistency/naming-conventions");
    expect(rule?.severity).toBe("error");
  });

  it("re-enables a rule the preset left out", async () => {
    // The other half of being able to turn one off: `minimal` is structure-only,
    // so an override has to be able to add a content rule back.
    const config = base({ extends: "minimal", rules: { "completeness/story-coverage": "warn" } });
    const { rules } = await resolveLintConfig({ config, configDir: dir });
    expect(ids(rules)).toContain("completeness/story-coverage");
  });

  it("lets an override beat the preset it extends", async () => {
    const config = base({ extends: "strict", rules: { "clarity/no-vague-language": "warn" } });
    const { rules } = await resolveLintConfig({ config, configDir: dir });
    expect(rules.find((r) => r.id === "clarity/no-vague-language")?.severity).toBe("warn");
    // strict still promoted everything it was not asked to leave alone
    expect(rules.find((r) => r.id === "structure/required-sections")?.severity).toBe("error");
  });

  it("loads a custom rule from a path, at the declared severity", async () => {
    await writeFile(
      join(dir, "rule.js"),
      [
        "export default {",
        '  id: "myorg/require-jira-ticket",',
        '  description: "PRDs need a Jira ticket",',
        '  severity: "warn",',
        "  run(context) {",
        "    if (context.spec.frontmatter.jira_ticket) return [];",
        '    return [{ ruleId: "myorg/require-jira-ticket", severity: "warn",',
        '      message: "missing jira_ticket", filePath: context.spec.filePath }];',
        "  },",
        "};",
      ].join("\n"),
    );
    const config = base({
      rules: { "myorg/require-jira-ticket": ["error", { path: "./rule.js" }] as never },
    });
    const { rules } = await resolveLintConfig({ config, configDir: dir });
    const rule = rules.find((r) => r.id === "myorg/require-jira-ticket");
    expect(rule).toBeDefined();
    // The severity in the config wins over the one the rule file declares.
    expect(rule?.severity).toBe("error");
  });

  it("resolves a relative custom rule path against the config directory, not the cwd", async () => {
    await mkdir(join(dir, "rules"), { recursive: true });
    await writeFile(
      join(dir, "rules", "r.js"),
      'export default { id: "myorg/r", description: "d", severity: "warn", run: () => [] };',
    );
    const config = base({ rules: { "myorg/r": ["warn", { path: "./rules/r.js" }] as never } });
    const { rules } = await resolveLintConfig({ config, configDir: dir });
    expect(ids(rules)).toContain("myorg/r");
  });

  it("refuses an unknown rule id with no path, instead of ignoring it", async () => {
    // Silence here is what the whole defect was: a typo'd id looked configured.
    const config = base({ rules: { "myorg/typo": "error" } });
    await expect(resolveLintConfig({ config, configDir: dir })).rejects.toThrow(
      /no built-in rule with that id/,
    );
  });

  it("refuses a value that is not a severity", async () => {
    const config = base({ rules: { "consistency/naming-conventions": "loud" } });
    await expect(resolveLintConfig({ config, configDir: dir })).rejects.toThrow(
      /is not a severity/,
    );
  });

  it("resolves ignore globs to absolute spec paths", async () => {
    await writeFile(join(dir, "specs", "a.md"), "# a");
    await writeFile(join(dir, "specs", "b.md"), "# b");
    const config = base({ ignore: ["specs/*.md"] });
    const { ignore } = await resolveLintConfig({ config, configDir: dir });
    expect(ignore.sort()).toEqual([join(dir, "specs", "a.md"), join(dir, "specs", "b.md")].sort());
  });

  it("returns no ignores for a pattern that matches nothing", async () => {
    const config = base({ ignore: ["specs/nope/*.md"] });
    const { ignore } = await resolveLintConfig({ config, configDir: dir });
    expect(ignore).toEqual([]);
  });
});
