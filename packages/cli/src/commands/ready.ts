import { defineCommand } from "citty";
import { loadConfig, parseSpec, resolveGlob, buildGraph, createLogger } from "@specdx/core";
import { createLintEngine, getPreset } from "@specdx/lint";
import type { ParsedSpec } from "@specdx/core";
import { DEFAULT_DIFF_CONFIG } from "@specdx/diff";
import { sharedArgs } from "../shared-args.js";

export interface ReadyCheck {
  name: string;
  passed: boolean;
  /** True when the check had nothing to verify — reported as skipped, not as a pass. */
  skipped?: boolean;
  details: string;
}

export interface ReadyResult {
  project: string;
  ready: boolean;
  checks: ReadyCheck[];
}

export async function runReady(): Promise<ReadyResult> {
  const configDir = process.cwd();
  const config = await loadConfig(undefined, configDir);

  const checks: ReadyCheck[] = [];

  // Resolve and parse all specs
  const specs: {
    spec: ParsedSpec;
    key: string;
    entry: { path: string; required?: boolean; owner?: string };
  }[] = [];
  for (const [key, entry] of Object.entries(config.specs)) {
    const paths = await resolveGlob(entry.path, configDir);
    for (const p of paths) {
      const spec = await parseSpec(p);
      specs.push({
        spec,
        key,
        entry: entry as { path: string; required?: boolean; owner?: string },
      });
    }
  }

  // Check 0: The suite has specs at all. Without this, every check below
  // ticks over an empty set and READY means nothing (vacuous-pass audit).
  checks.push({
    name: "Spec suite non-empty",
    passed: specs.length > 0,
    details:
      specs.length > 0
        ? `${specs.length} specs resolved`
        : "no spec files resolved — check the spec paths in spec.config.yaml",
  });

  // Check 1: Required specs exist
  const requiredEntries = Object.entries(config.specs).filter(
    ([, entry]) => (entry as { required?: boolean }).required,
  );
  const missingRequired: string[] = [];
  for (const [key, entry] of requiredEntries) {
    const paths = await resolveGlob(entry.path, configDir);
    if (paths.length === 0) {
      missingRequired.push(key);
    }
  }
  if (requiredEntries.length === 0) {
    checks.push({
      name: "Required specs present",
      passed: true,
      skipped: true,
      details: "skipped (no specs marked required in config)",
    });
  } else {
    checks.push({
      name: "Required specs present",
      passed: missingRequired.length === 0,
      details:
        missingRequired.length === 0
          ? `All ${requiredEntries.length} required specs found`
          : `Missing: ${missingRequired.join(", ")}`,
    });
  }

  // Check 2: Lint health (no errors)
  const presetName = config.lint?.extends ?? "recommended";
  const rules = getPreset(presetName);

  let graph;
  let graphError: string | undefined;
  try {
    graph = buildGraph(config);
  } catch (err) {
    graphError = (err as Error).message;
  }

  const engine = createLintEngine({ rules, config, graph });
  const lintResults = engine.lint(specs.map((s) => s.spec));

  if (graphError) {
    lintResults.diagnostics.push({
      ruleId: "structure/no-circular-deps",
      severity: "error",
      message: graphError,
      filePath: "spec.config.yaml",
    });
    lintResults.hasErrors = true;
  }

  const errors = lintResults.diagnostics.filter((d) => d.severity === "error").length;
  const warnings = lintResults.diagnostics.filter((d) => d.severity === "warn").length;
  if (specs.length === 0) {
    checks.push({
      name: "Lint health",
      passed: true,
      skipped: true,
      details: "skipped (no specs to lint)",
    });
  } else {
    checks.push({
      name: "Lint health",
      passed: errors === 0,
      details: `${errors} errors, ${warnings} warnings`,
    });
  }

  // Check 3: No integrity issues (broken refs, circular deps)
  const integrityIssues: string[] = [];
  if (graphError) {
    integrityIssues.push(graphError);
  }
  const refErrors = lintResults.diagnostics.filter(
    (d) => d.ruleId === "structure/valid-references",
  );
  for (const d of refErrors) {
    integrityIssues.push(d.message);
  }
  const hasDeclaredRelations =
    specs.some((s) => {
      const refs = s.spec.frontmatter.references;
      return Array.isArray(refs) && refs.length > 0;
    }) ||
    Object.values(config.specs).some(
      (entry) => ((entry as { requires?: string[] }).requires?.length ?? 0) > 0,
    );
  if (integrityIssues.length === 0 && !hasDeclaredRelations) {
    checks.push({
      name: "No integrity issues",
      passed: true,
      skipped: true,
      details: "skipped (no references or dependencies declared)",
    });
  } else {
    checks.push({
      name: "No integrity issues",
      passed: integrityIssues.length === 0,
      details:
        integrityIssues.length === 0
          ? "References and dependencies valid"
          : integrityIssues.join("; "),
    });
  }

  // Check 4: No stale specs
  const thresholdDays =
    config.diff?.staleness_threshold_days ?? DEFAULT_DIFF_CONFIG.staleness_threshold_days;
  const now = Date.now();
  const staleSpecs: { specId: string; days: number }[] = [];
  for (const { spec } of specs) {
    const dateStr =
      (spec.frontmatter.updated as string | undefined) ||
      (spec.frontmatter.created as string | undefined);
    if (dateStr) {
      const days = Math.floor((now - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
      if (days > thresholdDays) {
        staleSpecs.push({ specId: spec.frontmatter.id as string, days });
      }
    }
  }
  if (specs.length === 0) {
    checks.push({
      name: "No stale specs",
      passed: true,
      skipped: true,
      details: "skipped (no specs to date-check)",
    });
  } else {
    checks.push({
      name: "No stale specs",
      passed: staleSpecs.length === 0,
      details:
        staleSpecs.length === 0
          ? `All specs within ${thresholdDays}-day threshold`
          : staleSpecs.map((s) => `${s.specId} (${s.days}d)`).join(", "),
    });
  }

  // Check 5: Story coverage — every PRD feature has a user story
  const hasPrd = specs.some((s) => s.spec.frontmatter.type === "prd");
  const storyCoverageErrors = lintResults.diagnostics.filter(
    (d) => d.ruleId === "completeness/story-coverage",
  );
  if (!hasPrd) {
    checks.push({
      name: "Story coverage",
      passed: true,
      skipped: true,
      details: "skipped (no PRD in suite)",
    });
  } else {
    checks.push({
      name: "Story coverage",
      passed: storyCoverageErrors.length === 0,
      details:
        storyCoverageErrors.length === 0
          ? "All PRD features have corresponding stories"
          : storyCoverageErrors.map((d) => d.message).join("; "),
    });
  }

  const ready = checks.every((c) => c.passed);
  return { project: config.project?.name ?? "project", ready, checks };
}

export default defineCommand({
  meta: { name: "ready", description: "Check if spec suite is ready for implementation" },
  args: {
    ...sharedArgs,
  },
  async run({ args }) {
    try {
      const logger = createLogger({ quiet: args.quiet, verbose: args.verbose });
      logger.debug("Running readiness checks...");

      const result = await runReady();

      if (args.format === "json") {
        console.log(JSON.stringify(result, null, 2));
        if (!result.ready) process.exit(1);
        return;
      }

      // Pretty format
      const icon = result.ready ? "✓" : "✗";
      const label = result.ready ? "ready for implementation" : "not ready for implementation";

      console.log(`\n  ${icon} ${result.project} — ${label}\n`);

      for (const check of result.checks) {
        const checkIcon = check.skipped ? "–" : check.passed ? "✓" : "✗";
        console.log(`    ${checkIcon} ${check.name}: ${check.details}`);
      }

      const failCount = result.checks.filter((c) => !c.passed).length;
      if (failCount > 0) {
        console.log(
          `\n  Verdict: NOT READY — ${failCount} issue${failCount > 1 ? "s" : ""} to resolve\n`,
        );
      } else {
        console.log(`\n  Verdict: READY\n`);
      }

      if (!result.ready) process.exit(1);
    } catch (err) {
      console.error(`\n  ✗ ${(err as Error).message}\n`);
      process.exit(1);
    }
  },
});
