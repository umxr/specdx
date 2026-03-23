import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ExtractedTest } from "../types.js";

/**
 * Extract test descriptions from test files using ts-morph AST parsing.
 *
 * Scans all `.ts` and `.js` files in the given directory and extracts the first
 * string literal argument from `it()` and `test()` call expressions.
 *
 * @param projectDir - Root directory to scan (or fixtures dir in tests)
 * @param testsDir   - Sub-directory to scan, relative to projectDir. Defaults to "."
 */
export async function extractTestDescriptions(
  projectDir: string,
  testsDir?: string,
): Promise<ExtractedTest[]> {
  const scanDir = testsDir ? join(projectDir, testsDir) : projectDir;

  if (!existsSync(scanDir)) {
    return [];
  }

  // Lazy-load ts-morph so the package works without it installed.
  let tsMorph: typeof import("ts-morph");
  try {
    tsMorph = await import("ts-morph");
  } catch {
    throw new Error("ts-morph is required for test extraction. Install it: pnpm add -D ts-morph");
  }

  const { Project, SyntaxKind } = tsMorph;

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: true },
  });

  // Scan all .ts and .js files in the directory (caller is responsible for pointing
  // this at a tests directory, so all files are candidates).
  project.addSourceFilesAtPaths([
    join(scanDir, "**/*.ts"),
    join(scanDir, "**/*.js"),
    `!${join(scanDir, "**/node_modules/**")}`,
  ]);

  const tests: ExtractedTest[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();

    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const callExpr of callExpressions) {
      const expr = callExpr.getExpression();

      // We want bare `it(...)` and `test(...)` — identifiers only.
      if (expr.getKind() !== SyntaxKind.Identifier) continue;

      const calleeName = expr.asKindOrThrow(SyntaxKind.Identifier).getText();
      if (calleeName !== "it" && calleeName !== "test") continue;

      const args = callExpr.getArguments();
      if (args.length < 1) continue;

      const firstArg = args[0];
      if (!firstArg) continue;

      // First argument must be a string literal (the test description).
      if (firstArg.getKind() !== SyntaxKind.StringLiteral) continue;

      const description = firstArg.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue();
      const lineNumber = sourceFile.getLineAndColumnAtPos(callExpr.getStart()).line;

      tests.push({
        description,
        file: filePath,
        line: lineNumber,
      });
    }
  }

  return tests;
}
