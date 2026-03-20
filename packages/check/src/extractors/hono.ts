import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ExtractedRoute, HttpMethod } from "../types.js";

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete"]);

/**
 * Extract Hono routes from TypeScript/JavaScript source files using ts-morph AST parsing.
 *
 * @param projectDir - Root directory of the project (or fixtures dir in tests)
 * @param routesDir  - Sub-directory to scan, relative to projectDir. Defaults to "."
 */
export async function extractHonoRoutes(
  projectDir: string,
  routesDir?: string,
): Promise<ExtractedRoute[]> {
  const scanDir = routesDir ? join(projectDir, routesDir) : projectDir;

  if (!existsSync(scanDir)) {
    return [];
  }

  // Lazy-load ts-morph so the package works without it installed.
  let tsMorph: typeof import("ts-morph");
  try {
    tsMorph = await import("ts-morph");
  } catch {
    throw new Error(
      "ts-morph is required for route extraction. Install it: pnpm add -D ts-morph",
    );
  }

  const { Project, SyntaxKind } = tsMorph;

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: true },
  });

  // Add all .ts and .js files from the scan directory, excluding tests and node_modules.
  project.addSourceFilesAtPaths([
    join(scanDir, "**/*.ts"),
    join(scanDir, "**/*.js"),
    `!${join(scanDir, "**/*.test.ts")}`,
    `!${join(scanDir, "**/*.test.js")}`,
    `!${join(scanDir, "**/*.spec.ts")}`,
    `!${join(scanDir, "**/*.spec.js")}`,
    `!${join(scanDir, "**/node_modules/**")}`,
  ]);

  const routes: ExtractedRoute[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();

    // Build a map of sub-app variable name → mount prefix from app.route() calls.
    // e.g. app.route("/api/users", users) → { users: "/api/users" }
    const mountPrefixes = new Map<string, string>();

    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    // First pass: collect app.route("/prefix", subAppVar) mounts.
    for (const callExpr of callExpressions) {
      const expr = callExpr.getExpression();
      if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) continue;

      const propAccess = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
      const methodName = propAccess.getName();
      if (methodName !== "route") continue;

      const args = callExpr.getArguments();
      if (args.length < 2) continue;

      const firstArg = args[0];
      if (!firstArg) continue;
      const secondArg = args[1];
      if (!secondArg) continue;

      // First arg must be a string literal (the prefix).
      if (firstArg.getKind() !== SyntaxKind.StringLiteral) continue;

      const prefix = firstArg.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue();

      // Second arg should be an identifier (the sub-app variable).
      if (secondArg.getKind() === SyntaxKind.Identifier) {
        const subAppVarName = secondArg.asKindOrThrow(SyntaxKind.Identifier).getText();
        mountPrefixes.set(subAppVarName, prefix);
      }
    }

    // Second pass: collect subApp.METHOD("/path", handler) calls.
    for (const callExpr of callExpressions) {
      const expr = callExpr.getExpression();
      if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) continue;

      const propAccess = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
      const methodName = propAccess.getName().toLowerCase();
      if (!HTTP_METHODS.has(methodName)) continue;

      const args = callExpr.getArguments();
      if (args.length < 1) continue;

      const firstArg = args[0];
      if (!firstArg) continue;

      // First arg must be a string literal (the path).
      if (firstArg.getKind() !== SyntaxKind.StringLiteral) continue;

      const routePath = firstArg.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue();

      // Determine if the receiver is a known sub-app variable, and look up its mount prefix.
      const receiverExpr = propAccess.getExpression();
      let prefix = "";
      if (receiverExpr.getKind() === SyntaxKind.Identifier) {
        const receiverName = receiverExpr.asKindOrThrow(SyntaxKind.Identifier).getText();
        prefix = mountPrefixes.get(receiverName) ?? "";
      }

      // Hono sub-app routes with path "/" resolve to just the prefix (no trailing slash).
      const normalizedPath = routePath === "/" ? prefix : prefix + routePath;

      // Extract :param names from path segments.
      const params = (normalizedPath.match(/:([^/]+)/g) ?? []).map((p) => p.slice(1));

      const lineNumber = sourceFile.getLineAndColumnAtPos(callExpr.getStart()).line;

      routes.push({
        method: methodName.toUpperCase() as HttpMethod,
        path: normalizedPath,
        params,
        file: filePath,
        line: lineNumber,
      });
    }
  }

  return routes;
}
