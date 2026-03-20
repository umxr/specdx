import { defineCommand } from "citty";
import { loadConfig, parseSpec, resolveGlob, createLogger } from "@specdx/core";
import { runCheck } from "@specdx/check";
import type { ParsedSpec } from "@specdx/core";
import type { CheckConfig } from "@specdx/check";
import { sharedArgs } from "../shared-args.js";

export default defineCommand({
  meta: { name: "check", description: "Check spec-to-implementation drift" },
  args: {
    ...sharedArgs,
    spec: { type: "string", description: "Check a specific spec by ID" },
    framework: { type: "string", description: "Framework override: express, hono, nextjs" },
    ai: { type: "boolean", description: "Use AI to assess findings (requires ANTHROPIC_API_KEY)" },
  },
  async run({ args }) {
    const logger = createLogger({ quiet: args.quiet, verbose: args.verbose });
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
      const aiResult = await analyzeWithAi(result.findings, args.spec ?? "full suite check");

      if (args.format === "json") {
        console.log(JSON.stringify({ ...result, ai: aiResult }, null, 2));
      } else {
        console.log(`\n  sdx check --ai — ${result.score.overall}% coverage\n`);
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

    if (args.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      // Pretty format
      console.log(`\n  sdx check — ${result.score.overall}% implementation coverage\n`);

      for (const [category, stats] of Object.entries(result.score.byCategory)) {
        if (stats.total === 0) continue;
        console.log(`  ${category} (${stats.matched}/${stats.total}):`);
        const categoryFindings = result.findings.filter((f) => f.category === category.replace(/s$/, ""));
        for (const f of categoryFindings) {
          const icon = f.type === "extra" ? "ℹ" : f.severity === "error" ? "✗" : "⚠";
          const detail = f.actual ? ` — ${f.actual}` : "";
          const suggestion = f.suggestion ? ` (${f.suggestion})` : "";
          console.log(`    ${icon} ${f.expected}${detail}${suggestion}`);
        }
        if (categoryFindings.length === 0) {
          console.log("    ✓ all matched");
        }
      }

      const errors = result.findings.filter((f) => f.severity === "error").length;
      const warnings = result.findings.filter((f) => f.severity === "warn").length;
      const info = result.findings.filter((f) => f.severity === "info").length;
      console.log(`\n  ${errors} errors, ${warnings} warnings, ${info} info\n`);
    }

    if (result.findings.some((f) => f.severity === "error")) {
      process.exit(1);
    }
  },
});
