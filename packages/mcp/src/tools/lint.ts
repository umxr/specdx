import { loadConfig, findConfig, parseSpec, resolveGlob, buildGraph } from "@specdx/core";
import {
  createLintEngine,
  resolveLintConfig,
  lintAgentFiles,
  lintAgentFilesWithoutConfig,
} from "@specdx/lint";
import type { ParsedSpec } from "@specdx/core";
import type { Diagnostic } from "@specdx/lint";

/**
 * `sdx_lint` is a near-copy of `runLint`, not a caller of it — the CLI depends
 * on this package, so the dependency cannot run the other way. See
 * `packages/cli/src/lint-parity.test.ts`, which pins the two together.
 *
 * Two divergences were fixed here, both found while dogfooding on 2026-08-11:
 *
 * 1. `specPath` filtered the specs *before* linting, so a single-file lint had
 *    no sight of the rest of the suite and cross-reference rules could not
 *    fire. The CLI has always linted the whole suite and filtered the
 *    resulting diagnostics; that is the correct behaviour and this now matches.
 * 2. A `specPath` matching no spec returned `hasErrors: false` with no signal
 *    that nothing had been assessed, which reads to a caller as a clean pass.
 */
export async function handleLint(params: { preset?: string; specPath?: string }): Promise<string> {
  const configDir = process.cwd();

  // No spec suite: lint the agent instruction files alone, through the same
  // shared helper the CLI uses. Only genuine absence degrades — a malformed
  // config still throws, or a YAML typo would read as a narrower pass.
  if (!(await findConfig(configDir))) {
    const agentResults = await lintAgentFilesWithoutConfig(configDir);
    if (agentResults) {
      return JSON.stringify({
        diagnostics: agentResults.diagnostics,
        hasErrors: agentResults.diagnostics.some((d) => d.severity === "error"),
        hasWarnings: agentResults.diagnostics.some((d) => d.severity === "warn"),
        specsChecked: 0,
        assessed: false,
        specSuite: false,
        agentFilesChecked: agentResults.filesLinted,
      });
    }
  }

  const config = await loadConfig(undefined, configDir);
  const preset = params.preset ?? config.lint?.extends ?? "recommended";
  const { rules, ignore } = await resolveLintConfig({
    config,
    preset: preset,
    configDir,
  });

  // Always parse the full suite so cross-reference rules have complete
  // context; a single-file lint filters the *diagnostics*, not the suite.
  const specs: ParsedSpec[] = [];
  for (const [, entry] of Object.entries(config.specs)) {
    const files = await resolveGlob(entry.path, configDir);
    for (const file of files) {
      specs.push(await parseSpec(file));
    }
  }

  let graph;
  try {
    graph = buildGraph(config);
  } catch {
    // non-fatal
  }

  const engine = createLintEngine({ rules, config, graph, ignore });
  const results = engine.lint(specs);

  // One definition of "does specPath select this file", shared by the
  // diagnostic filter, the agent diagnostics below, and the assessed count, so
  // none of the three can disagree.
  const { specPath } = params;
  const selects = (filePath: string) => specPath === undefined || filePath.includes(specPath);

  let diagnostics: Diagnostic[] = results.diagnostics;
  let { hasErrors, hasWarnings } = results;
  if (specPath !== undefined) {
    diagnostics = diagnostics.filter((d) => selects(d.filePath));
    hasErrors = diagnostics.some((d) => d.severity === "error");
    hasWarnings = diagnostics.some((d) => d.severity === "warn");
  }

  // Agent instruction files, opt-in via the `agents` key. Kept in step with the
  // CLI deliberately: this tool duplicates `runLint` rather than calling it, and
  // that duplication has already shipped a divergence twice.
  //
  // Runs after the spec filter above, because it appends to the already-filtered
  // diagnostics — appending first and filtering after would drop agent findings
  // whenever `specPath` names a spec.
  let agentFiles = 0;
  if (config.agents) {
    const agentResults = await lintAgentFiles({ config, configDir });
    agentFiles = agentResults.filesLinted;
    diagnostics = [...diagnostics];

    if (!agentResults.assessed) {
      const patterns = config.agents.paths ?? ["AGENTS.md", "CLAUDE.md"];
      diagnostics.push({
        ruleId: "agents/paths-match-nothing",
        severity: "error",
        message: `agents.paths matched no files (${patterns.join(", ")}), so no agent instruction file was linted. Remove the \`agents\` key or fix the paths.`,
        filePath: "spec.config.yaml",
      });
      hasErrors = true;
    }

    for (const diagnostic of agentResults.diagnostics) {
      if (!selects(diagnostic.filePath)) continue;
      diagnostics.push(diagnostic);
      if (diagnostic.severity === "error") hasErrors = true;
      if (diagnostic.severity === "warn") hasWarnings = true;
    }
  }

  const ignored = new Set(ignore);
  const linted = specs.filter((spec) => !ignored.has(spec.filePath) && selects(spec.filePath));

  return JSON.stringify({
    diagnostics,
    hasErrors,
    hasWarnings,
    specsChecked: linted.length,
    // False when nothing was selected — "no diagnostics" is then not a pass.
    assessed: linted.length > 0,
    specSuite: true,
    agentFilesChecked: agentFiles,
  });
}
