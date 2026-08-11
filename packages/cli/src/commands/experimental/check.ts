import { defineCommand } from "citty";
import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { loadConfig, parseSpec, resolveGlob, createLogger } from "@specdx/core";
import {
  runCheck,
  applyBaseline,
  createBaseline,
  parseBaseline,
  serializeBaseline,
} from "@specdx/check";
import type { ParsedSpec } from "@specdx/core";
import type { CheckConfig, BaselineApplication } from "@specdx/check";
import { sharedArgs, resolveFormat } from "../../shared-args.js";
import { createOutput } from "../../output.js";

const FORMATS = ["pretty", "json", "github"] as const;

/** Where a baseline lives when the flag names no path. */
const DEFAULT_BASELINE = ".specdx-baseline.json";

export default defineCommand({
  meta: {
    name: "check",
    description:
      "Check spec-to-implementation drift. Exit codes: 0 ok, 1 errors found, 3 nothing checkable (coverage not assessed)",
  },
  args: {
    ...sharedArgs(FORMATS),
    spec: { type: "string", description: "Check a specific spec by ID" },
    framework: { type: "string", description: "Framework override: express, hono, nextjs" },
    ai: {
      type: "boolean",
      description: "Use AI to assess findings (requires ANTHROPIC_API_KEY)",
    },
    baseline: {
      type: "string",
      description: `Accept the findings recorded in this file; gate only on new ones (default ${DEFAULT_BASELINE})`,
    },
    "update-baseline": {
      type: "boolean",
      description: "Record the current findings as accepted and write the baseline file",
    },
  },
  async run({ args }) {
    const format = resolveFormat(args.format, FORMATS);
    if (!format.ok) {
      console.error(`\n  ✗ ${format.message}\n`);
      process.exit(1);
    }

    const logger = createLogger({ quiet: args.quiet, verbose: args.verbose });
    const output = createOutput({ quiet: args.quiet });
    const configDir = process.cwd();
    const config = await loadConfig(undefined, configDir);

    logger.debug("Loading specs...");

    // Resolve and parse all specs
    const specs: ParsedSpec[] = [];
    for (const [, entry] of Object.entries(config.specs)) {
      const paths = await resolveGlob(entry.path, configDir);
      for (const p of paths) {
        const spec = await parseSpec(p);
        if (args.spec && spec.frontmatter.id !== args.spec) continue;
        specs.push(spec);
      }
    }

    const checkConfig: CheckConfig = {
      ...config.check,
      ...(args.framework ? { framework: args.framework as CheckConfig["framework"] } : {}),
    };

    logger.debug(`Checking ${specs.length} specs...`);
    const result = await runCheck(specs, configDir, checkConfig);

    // Baseline. Only ever narrows what *gates* the build — the score above is
    // computed over every finding, baselined or not, so adopting a baseline on
    // an existing project cannot report it as suddenly complete.
    const baselineFlag = args.baseline;
    const updateBaseline = Boolean(args["update-baseline"]);
    // `--baseline` with no value arrives as boolean true, not "", so a string
    // check alone crashed in path.isAbsolute.
    const baselinePath =
      typeof baselineFlag === "string" && baselineFlag !== "" ? baselineFlag : DEFAULT_BASELINE;
    const baselineFile = isAbsolute(baselinePath) ? baselinePath : resolve(configDir, baselinePath);

    if (updateBaseline) {
      const baseline = createBaseline(result.findings);
      await writeFile(baselineFile, serializeBaseline(baseline), "utf-8");
      output.info(
        `\n  ✓ recorded ${baseline.entries.length} accepted finding${
          baseline.entries.length === 1 ? "" : "s"
        } to ${baselinePath}\n`,
      );
      output.info(
        "  The coverage score still counts them. Only new findings will fail the build.\n",
      );
      return;
    }

    let application: BaselineApplication | null = null;
    if (baselineFlag !== undefined) {
      let source: string;
      try {
        source = await readFile(baselineFile, "utf-8");
      } catch {
        // Silently continuing with no baseline would gate every pre-existing
        // finding and read as a wall of new drift.
        console.error(
          `\n  ✗ baseline file not found: ${baselinePath}\n` +
            "    Create it with: specdx check --update-baseline\n",
        );
        process.exit(1);
      }
      try {
        application = applyBaseline(result.findings, parseBaseline(source));
      } catch (err) {
        console.error(`\n  ✗ ${(err as Error).message} (${baselinePath})\n`);
        process.exit(1);
      }
    }

    // What gates, and what the report lists. The score stays on every finding.
    const gating = application ? application.remaining : result.findings;

    // AI analysis (opt-in)
    if (args.ai) {
      const { analyzeWithAi } = await import("@specdx/check");
      // A missing key is a user error, not a crash. It used to surface as an
      // uncaught Error with the full Node trace through citty, where every
      // other user-error path in the CLI prints "✗ …" (audit run 5, F7).
      let aiResult;
      try {
        aiResult = await analyzeWithAi(gating, args.spec ?? "full suite check");
      } catch (err) {
        console.error(`\n  ✗ ${(err as Error).message}\n`);
        process.exit(1);
      }

      if (format.format === "json") {
        console.log(JSON.stringify({ ...result, ai: aiResult }, null, 2));
      } else {
        console.log(`\n  specdx check --ai — ${result.score.overall}% coverage\n`);
        console.log(`  AI Assessment: ${aiResult.summary}\n`);

        for (const assessment of aiResult.assessments) {
          // `findingIndex` indexes what was handed to the assessor, which is
          // the gating set — indexing the full list would mislabel findings
          // whenever a baseline suppressed anything.
          const finding = gating[assessment.findingIndex];
          if (!finding) continue;
          const icon = assessment.isRealIssue ? "✗" : "✓";
          const label = assessment.isRealIssue ? "REAL" : "FALSE POSITIVE";
          console.log(`    ${icon} [${label}] ${finding.expected}`);
          console.log(`      ${assessment.reasoning}`);
          if (assessment.suggestedFix) {
            console.log(`      Fix: ${assessment.suggestedFix}`);
          }
        }
        console.log();
      }

      if (aiResult.assessments.some((a) => a.isRealIssue)) {
        process.exit(1);
      }
      return;
    }

    const baselineReport = application
      ? {
          path: baselinePath,
          accepted: application.suppressed.length,
          obsolete: application.obsolete,
        }
      : null;

    if (format.format === "json") {
      console.log(JSON.stringify({ ...result, gating, baseline: baselineReport }, null, 2));
    } else if (format.format === "github") {
      // Annotations for CI. A finding about missing code has no file to point
      // at, so the spec ID carries the location instead. The headline always
      // prints: a clean or unassessable run must still say something, or the
      // format is silent for exactly the projects that most need telling.
      console.log(
        `::notice::specdx check — ${
          result.score.assessed
            ? `${result.score.overall}% implementation coverage`
            : "coverage not assessed — no checkable surfaces found"
        }`,
      );
      for (const note of result.notes) {
        console.log(`::notice::${note}`);
      }
      if (baselineReport) {
        console.log(
          `::notice::${baselineReport.accepted} finding(s) accepted by ${baselineReport.path} — still counted in coverage, not gating`,
        );
        if (baselineReport.obsolete.length > 0) {
          console.log(
            `::notice::${baselineReport.obsolete.length} baseline entr(ies) no longer occur — re-record with --update-baseline`,
          );
        }
      }
      for (const f of gating) {
        const level =
          f.severity === "error" ? "error" : f.severity === "warn" ? "warning" : "notice";
        const location = f.codeLocation
          ? ` file=${f.codeLocation.file},line=${f.codeLocation.line}`
          : "";
        const detail = f.actual ? ` — ${f.actual}` : "";
        console.log(`::${level}${location}::[${f.specId}] ${f.expected}${detail}`);
      }
    } else {
      // Pretty format
      const headline = result.score.assessed
        ? `${result.score.overall}% implementation coverage`
        : "coverage not assessed — no checkable surfaces found";
      output.info(`\n  specdx check — ${headline}\n`);

      for (const note of result.notes) {
        output.out(`  ⚠ ${note}`);
      }
      if (result.notes.length > 0) output.out();

      if (args.verbose) {
        const fmt = (n: number | null) => (n === null ? "not scanned" : `${n} found`);
        output.out(`  Scanned: framework=${result.scanned.framework ?? "none detected"}`);
        output.out(`    routes: ${fmt(result.scanned.codeRoutes)}`);
        output.out(`    types: ${fmt(result.scanned.codeTypes)}`);
        output.out(`    tests: ${fmt(result.scanned.codeTests)}`);
        // "assessed", not "verified": this counts the assertions considered,
        // and a failed one is reported below. Calling six verified while the
        // next line says 5/6 made the output contradict itself (F6).
        const artifacts =
          result.scanned.artifacts === null
            ? "none declared"
            : `${result.scanned.artifacts} assessed`;
        const pending =
          result.scanned.artifactsPending > 0 ? `, ${result.scanned.artifactsPending} pending` : "";
        output.out(`    artifacts: ${artifacts}${pending}\n`);
      }

      if (baselineReport) {
        output.info(
          `  ${baselineReport.accepted} finding${
            baselineReport.accepted === 1 ? "" : "s"
          } accepted by ${baselineReport.path} — counted in coverage above, not gating`,
        );
        const stale = baselineReport.obsolete.length;
        if (stale > 0) {
          output.info(
            `  ${stale} baseline ${stale === 1 ? "entry no longer occurs" : "entries no longer occur"} — re-record with --update-baseline`,
          );
        }
        output.info("");
      }

      for (const [category, stats] of Object.entries(result.score.byCategory)) {
        if (stats.total === 0) continue;
        const categoryFindings = gating.filter((f) => f.category === category.replace(/s$/, ""));
        const header = `  ${category} (${stats.matched}/${stats.total}):`;
        if (categoryFindings.length === 0) {
          output.info(header);
          // "all matched" under a 2/3 header contradicts itself. When a baseline
          // is what emptied the list, the honest line names it.
          const acceptedHere = application
            ? application.suppressed.filter((f) => f.category === category.replace(/s$/, "")).length
            : 0;
          output.info(
            acceptedHere > 0
              ? `    ✓ no new findings (${acceptedHere} accepted by baseline)`
              : "    ✓ all matched",
          );
          continue;
        }
        output.out(header);
        for (const f of categoryFindings) {
          const icon = f.severity === "error" ? "✗" : f.severity === "warn" ? "⚠" : "ℹ";
          const detail = f.actual ? ` — ${f.actual}` : "";
          const suggestion = f.suggestion ? ` (${f.suggestion})` : "";
          output.out(`    ${icon} ${f.expected}${detail}${suggestion}`);
        }
      }

      const errors = gating.filter((f) => f.severity === "error").length;
      const warnings = gating.filter((f) => f.severity === "warn").length;
      const info = gating.filter((f) => f.severity === "info").length;
      output.info(`\n  ${errors} errors, ${warnings} warnings, ${info} info\n`);
    }

    if (gating.some((f) => f.severity === "error")) {
      process.exit(1);
    }
    // Distinct exit code so CI cannot mistake "nothing was checkable" for a pass
    if (!result.score.assessed) {
      process.exit(3);
    }
  },
});
