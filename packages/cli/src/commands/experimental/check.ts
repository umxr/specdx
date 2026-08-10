import { defineCommand } from "citty";
import { loadConfig, parseSpec, resolveGlob, createLogger } from "@specdx/core";
import { runCheck } from "@specdx/check";
import type { ParsedSpec } from "@specdx/core";
import type { CheckConfig } from "@specdx/check";
import { sharedArgs, resolveFormat } from "../../shared-args.js";
import { createOutput } from "../../output.js";

const FORMATS = ["pretty", "json", "github"] as const;

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

    // AI analysis (opt-in)
    if (args.ai) {
      const { analyzeWithAi } = await import("@specdx/check");
      // A missing key is a user error, not a crash. It used to surface as an
      // uncaught Error with the full Node trace through citty, where every
      // other user-error path in the CLI prints "✗ …" (audit run 5, F7).
      let aiResult;
      try {
        aiResult = await analyzeWithAi(result.findings, args.spec ?? "full suite check");
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
          const finding = result.findings[assessment.findingIndex];
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

    if (format.format === "json") {
      console.log(JSON.stringify(result, null, 2));
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
      for (const f of result.findings) {
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

      for (const [category, stats] of Object.entries(result.score.byCategory)) {
        if (stats.total === 0) continue;
        const categoryFindings = result.findings.filter(
          (f) => f.category === category.replace(/s$/, ""),
        );
        const header = `  ${category} (${stats.matched}/${stats.total}):`;
        if (categoryFindings.length === 0) {
          output.info(header);
          output.info("    ✓ all matched");
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

      const errors = result.findings.filter((f) => f.severity === "error").length;
      const warnings = result.findings.filter((f) => f.severity === "warn").length;
      const info = result.findings.filter((f) => f.severity === "info").length;
      output.info(`\n  ${errors} errors, ${warnings} warnings, ${info} info\n`);
    }

    if (result.findings.some((f) => f.severity === "error")) {
      process.exit(1);
    }
    // Distinct exit code so CI cannot mistake "nothing was checkable" for a pass
    if (!result.score.assessed) {
      process.exit(3);
    }
  },
});
