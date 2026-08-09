import * as core from "@actions/core";
import * as github from "@actions/github";
import { loadConfig, parseSpec, buildGraph, resolveGlob } from "@specdx/core";
import { createLintEngine, getPreset } from "@specdx/lint";
import { diffBetweenRefs, DiffError } from "@specdx/diff";
import type { DiffResult } from "@specdx/diff";
import type { Diagnostic } from "@specdx/lint";
import { join } from "node:path";

async function run(): Promise<void> {
  try {
    const workingDir = core.getInput("working-directory") || ".";
    const configPath = join(workingDir, "spec.config.yaml");

    // Load config
    const config = await loadConfig(configPath);

    // Check trigger paths — if configured, only run when relevant files changed
    // For now, always run (trigger path filtering requires PR file list from GitHub API)

    // Run lint
    // An explicit `preset` input wins over the config, so a workflow can run a
    // stricter gate on pull requests than the project's default.
    const presetInput = core.getInput("preset");
    if (presetInput && !["minimal", "recommended", "strict"].includes(presetInput)) {
      core.setFailed(`preset must be one of minimal, recommended, strict (got: ${presetInput})`);
      return;
    }
    const presetName = presetInput || config.lint?.extends || "recommended";
    const rules = getPreset(presetName as "minimal" | "recommended" | "strict");
    const engine = createLintEngine({ rules, config, graph: buildGraph(config) });

    // Resolve and parse all specs
    // resolveGlob returns absolute paths, so no need to join with workingDir again
    const specs = [];
    for (const [, entry] of Object.entries(config.specs)) {
      const paths = await resolveGlob(entry.path, workingDir);
      for (const p of paths) {
        specs.push(await parseSpec(p));
      }
    }

    const lintResults = engine.lint(specs);

    // Emit annotations for lint diagnostics
    for (const d of lintResults.diagnostics) {
      const msg = `[${d.ruleId}] ${d.message}`;
      if (d.severity === "error") {
        core.error(msg, { file: d.filePath, startLine: d.line });
      } else if (d.severity === "warn") {
        core.warning(msg, { file: d.filePath, startLine: d.line });
      }
    }

    // Run diff
    let diffResult: DiffResult | null = null;
    try {
      const pr = github.context.payload.pull_request;
      if (pr) {
        const baseRef = pr.base?.sha || pr.base?.ref || "main";
        const headRef = pr.head?.sha || pr.head?.ref || "HEAD";
        diffResult = await diffBetweenRefs(configPath, baseRef, headRef);
      }
    } catch (err) {
      if (err instanceof DiffError) {
        core.warning(`Diff skipped: ${err.message}`);
      } else {
        throw err;
      }
    }

    // Summary output
    const errors = lintResults.diagnostics.filter((d: Diagnostic) => d.severity === "error").length;
    const warnings = lintResults.diagnostics.filter(
      (d: Diagnostic) => d.severity === "warn",
    ).length;
    core.info(`Lint: ${errors} errors, ${warnings} warnings, ${specs.length} specs checked`);

    if (diffResult) {
      core.info(
        `Diff: ${diffResult.diffs.length} specs changed, ${diffResult.added.length} added, ${diffResult.removed.length} removed`,
      );
    }

    // Check if we should fail
    const blockOn = config.ci?.block_on ?? ["error"];
    const shouldFail = lintResults.diagnostics.some((d: Diagnostic) =>
      blockOn.includes(d.severity),
    );

    if (shouldFail) {
      core.setFailed(`Spec health check failed: ${errors} error(s), ${warnings} warning(s)`);
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

run();
