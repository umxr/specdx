import * as core from "@actions/core";
import * as github from "@actions/github";
import { loadConfig, parseSpec, buildGraph, resolveGlob } from "@specdx/core";
import { createLintEngine, getPreset } from "@specdx/lint";
import { diffBetweenRefs, DiffError } from "@specdx/diff";
import type { DiffResult } from "@specdx/diff";
import type { Diagnostic } from "@specdx/lint";
import { join, dirname } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { formatComment, postComment } from "./comment.js";
import { generateBadge, type BadgeStatus } from "./badge.js";

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

    // Report before deciding. Both surfaces are opt-in and neither can fail
    // the job: absent input means the feature is off, and an error inside
    // either is a warning. They run ahead of the verdict below so a vacuous
    // suite still gets a comment saying so -- that is the case a reader most
    // needs explained.
    const status: BadgeStatus =
      specs.length === 0 || errors > 0 ? "failing" : warnings > 0 ? "warnings" : "passing";

    const badgePath = core.getInput("badge-path");
    if (badgePath) {
      try {
        const target = join(workingDir, badgePath);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, generateBadge(status), "utf-8");
        core.info(`Spec health badge written to ${badgePath} (${status}).`);
      } catch (err) {
        core.warning(`Spec health badge skipped: ${(err as Error).message}`);
      }
    }

    await postComment({
      token: core.getInput("github-token"),
      enabled: config.ci?.post_comment ?? true,
      body: formatComment(lintResults.diagnostics, specs.length, diffResult),
    });

    // Zero specs checked is not a pass (vacuous-pass audit).
    //
    // The job's verdict below reads the diagnostics array alone, and a suite
    // whose paths resolve to no files produces no diagnostics -- so a renamed
    // spec directory, a typo'd path or a sparse checkout reported success
    // while enforcing nothing. `comment.ts` already guarded the rendered
    // comment; this is the path that decides whether CI goes red, and it is
    // the one that matters. Every CLI command refuses the same case.
    if (specs.length === 0) {
      core.setFailed(
        "Spec health check failed: no specs were checked — spec paths in spec.config.yaml resolved to no files. Check the spec paths, or the working-directory input.",
      );
      return;
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
