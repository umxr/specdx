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
  let routeTotal = 0;
  let typeTotal = 0;
  let testTotal = 0;

  // 1. Route checking: find api-contract specs
  const apiContractSpecs = specs.filter((s) => s.frontmatter.type === "api-contract");
  if (apiContractSpecs.length > 0) {
    const codeRoutes = await extractRoutes(projectDir, config);

    for (const spec of apiContractSpecs) {
      const specEndpoints = parseEndpoints(spec.content);
      routeTotal += specEndpoints.length;
      findings.push(...matchRoutes(specEndpoints, codeRoutes, spec.frontmatter.id as string));
    }
  }

  // 2. Type checking: find technical-design specs with Data Model sections
  const designSpecs = specs.filter((s) => s.frontmatter.type === "technical-design");
  if (designSpecs.length > 0) {
    const codeTypes = [
      ...(await extractTypeScriptTypes(projectDir, config.types_dir)),
      ...(await extractZodSchemas(projectDir, config.types_dir)),
      ...(await extractPrismaModels(projectDir)),
    ];

    for (const spec of designSpecs) {
      const specTypes = parseTypeDefinitions(spec.content);
      typeTotal += specTypes.reduce((sum, t) => sum + t.fields.length, 0);
      findings.push(...matchTypes(specTypes, codeTypes, spec.frontmatter.id as string));
    }
  }

  // 3. Test checking: find test-plan specs
  const testPlanSpecs = specs.filter((s) => s.frontmatter.type === "test-plan");
  if (testPlanSpecs.length > 0) {
    const codeTests = await extractTestDescriptions(projectDir, config.tests_dir);

    for (const spec of testPlanSpecs) {
      const specCases = parseTestCases(spec.content);
      testTotal += specCases.length;
      findings.push(...matchTests(specCases, codeTests, spec.frontmatter.id as string));
    }
  }

  // 4. Score
  const score = computeScore(findings, { routes: routeTotal, types: typeTotal, tests: testTotal });

  // 5. Summary
  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.filter((f) => f.severity === "warn").length;
  const summary = `${score.overall}% implementation coverage — ${errors} errors, ${warnings} warnings`;

  return { findings, score, summary };
}

/**
 * Extract routes from the project based on framework config.
 *
 * In "auto" mode, reads package.json to detect the framework first.
 * If a framework is detected, only that extractor is used.
 * If no framework is detected, falls back to trying all extractors and merging results.
 */
async function extractRoutes(projectDir: string, config: CheckConfig): Promise<ExtractedRoute[]> {
  const framework = config.framework ?? "auto";

  if (framework === "express") {
    return extractExpressRoutes(projectDir, config.routes_dir);
  }
  if (framework === "hono") {
    return extractHonoRoutes(projectDir, config.routes_dir);
  }
  if (framework === "nextjs") {
    return extractNextjsRoutes(projectDir, config.app_dir);
  }

  // auto: detect from package.json first
  const detected = await detectFramework(projectDir);
  if (detected === "express") {
    return extractExpressRoutes(projectDir, config.routes_dir);
  }
  if (detected === "hono") {
    return extractHonoRoutes(projectDir, config.routes_dir);
  }
  if (detected === "nextjs") {
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
