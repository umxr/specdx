import type { CheckResult, CheckConfig, ExtractedRoute, Finding } from "./types.js";
import type { ParsedSpec } from "@specdx/core";
import { parseEndpoints, parseTypeDefinitions, parseTestCases } from "./spec-parsers.js";
import { extractExpressRoutes } from "./extractors/express.js";
import { extractHonoRoutes } from "./extractors/hono.js";
import { extractNextjsRoutes } from "./extractors/nextjs.js";
import { extractTypeScriptTypes } from "./extractors/typescript.js";
import { extractZodSchemas } from "./extractors/zod.js";
import { extractPrismaModels } from "./extractors/prisma.js";
import { extractTestDescriptions } from "./extractors/test-extractor.js";
import { matchRoutes } from "./matchers/routes.js";
import { matchTypes } from "./matchers/types.js";
import { matchTests } from "./matchers/tests.js";
import { checkArtifacts } from "./artifacts.js";
import { computeScore } from "./score.js";
import { detectFramework } from "./detect-framework.js";

/**
 * Run implementation checks across all specs and return findings, score, and summary.
 *
 * - `api-contract` specs → route extraction + matching
 * - `technical-design` specs → type extraction + matching
 * - `test-plan` specs → test extraction + matching
 */
export async function runCheck(
  specs: ParsedSpec[],
  projectDir: string,
  config: CheckConfig = {},
): Promise<CheckResult> {
  const findings: Finding[] = [];
  const notes: string[] = [];
  let routeTotal = 0;
  let typeTotal = 0;
  let testTotal = 0;
  let codeRouteCount: number | null = null;
  let codeTypeCount: number | null = null;
  let codeTestCount: number | null = null;

  // ts-morph is an optional peer dependency; without it (e.g. under pnpm dlx,
  // where installing into the ephemeral cache is impossible) route and TS/Zod
  // type extraction degrade to skipped-with-a-note instead of throwing (issue #7).
  const tsMorphAvailable = await import("ts-morph").then(
    () => true,
    () => false,
  );
  if (!tsMorphAvailable) {
    notes.push(
      "route and type extraction skipped: ts-morph is not installed. " +
        "Install specdx and ts-morph as devDependencies (pnpm add -D specdx ts-morph) — " +
        "an ephemeral runner like pnpm dlx cannot provide it.",
    );
  }

  // Resolve the framework once so reporting can say what was scanned
  const framework =
    config.framework && config.framework !== "auto"
      ? config.framework
      : await detectFramework(projectDir);

  // 1. Route checking: find api-contract specs
  const apiContractSpecs = specs.filter((s) => s.frontmatter.type === "api-contract");
  if (apiContractSpecs.length > 0 && tsMorphAvailable) {
    const codeRoutes = await extractRoutes(projectDir, config, framework);
    codeRouteCount = codeRoutes.length;

    for (const spec of apiContractSpecs) {
      const specEndpoints = parseEndpoints(spec.content);
      routeTotal += specEndpoints.length;
      findings.push(...matchRoutes(specEndpoints, codeRoutes, spec.frontmatter.id as string));
    }
    if (framework === null) {
      notes.push(
        "no supported framework detected (express, hono, nextjs) — route extraction ran in fallback mode across all extractors.",
      );
    }
  }

  // 2. Type checking: find technical-design specs with Data Model sections
  const designSpecs = specs.filter((s) => s.frontmatter.type === "technical-design");
  if (designSpecs.length > 0) {
    const codeTypes = [
      ...(tsMorphAvailable ? await extractTypeScriptTypes(projectDir, config.types_dir) : []),
      ...(tsMorphAvailable ? await extractZodSchemas(projectDir, config.types_dir) : []),
      ...(await extractPrismaModels(projectDir)),
    ];
    codeTypeCount = codeTypes.length;

    for (const spec of designSpecs) {
      const specTypes = parseTypeDefinitions(spec.content);
      const fieldCount = specTypes.reduce((sum, t) => sum + t.fields.length, 0);
      typeTotal += fieldCount;
      findings.push(...matchTypes(specTypes, codeTypes, spec.frontmatter.id as string));

      // A Data Model that yields no fields contributes nothing to the score.
      // Reporting the resulting percentage without saying so presents partial
      // coverage as whole coverage.
      if (fieldCount === 0 && /^##\s+Data Model\s*$/im.test(spec.content)) {
        notes.push(
          `${spec.frontmatter.id as string}: no fields recognised in its Data Model, so types were not assessed. ` +
            "Write fields as `- name: type` (one per line, under a `### TypeName` heading).",
        );
      }
    }
  }

  // 3. Test checking: find test-plan specs
  const testPlanSpecs = specs.filter((s) => s.frontmatter.type === "test-plan");
  if (testPlanSpecs.length > 0) {
    const codeTests = await extractTestDescriptions(projectDir, config.tests_dir);
    codeTestCount = codeTests.length;

    for (const spec of testPlanSpecs) {
      const specCases = parseTestCases(spec.content);
      testTotal += specCases.length;
      findings.push(...matchTests(specCases, codeTests, spec.frontmatter.id as string));
    }
  }

  // 4. Declared artifacts: framework-agnostic checkable surfaces (issue #15)
  const artifactResult = await checkArtifacts(specs, projectDir, tsMorphAvailable);
  findings.push(...artifactResult.findings);
  notes.push(...artifactResult.notes);

  // 5. Score
  const score = computeScore(findings, {
    routes: routeTotal,
    types: typeTotal,
    tests: testTotal,
    artifacts: artifactResult.total,
  });

  // 6. Summary — never present "nothing was checkable" as coverage (issue #6)
  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.filter((f) => f.severity === "warn").length;
  const summary = score.assessed
    ? `${score.overall}% implementation coverage — ${errors} errors, ${warnings} warnings`
    : "coverage not assessed — no checkable surfaces found (no spec'd routes, types, test cases, or declared artifacts)";

  const scanned = {
    framework: framework ?? null,
    codeRoutes: codeRouteCount,
    codeTypes: codeTypeCount,
    codeTests: codeTestCount,
    artifacts: artifactResult.total > 0 ? artifactResult.checked : null,
    artifactsPending: artifactResult.pending,
  };

  return { findings, score, summary, scanned, notes };
}

/**
 * Extract routes from the project based on framework config.
 *
 * In "auto" mode, reads package.json to detect the framework first.
 * If a framework is detected, only that extractor is used.
 * If no framework is detected, falls back to trying all extractors and merging results.
 */
async function extractRoutes(
  projectDir: string,
  config: CheckConfig,
  framework: string | null,
): Promise<ExtractedRoute[]> {
  if (framework === "express") {
    return extractExpressRoutes(projectDir, config.routes_dir);
  }
  if (framework === "hono") {
    return extractHonoRoutes(projectDir, config.routes_dir);
  }
  if (framework === "nextjs") {
    return extractNextjsRoutes(projectDir, config.app_dir);
  }

  // fallback: try all extractors and merge results
  const [express, hono, nextjs] = await Promise.all([
    extractExpressRoutes(projectDir, config.routes_dir),
    extractHonoRoutes(projectDir, config.routes_dir),
    extractNextjsRoutes(projectDir, config.app_dir),
  ]);

  return [...express, ...hono, ...nextjs];
}
