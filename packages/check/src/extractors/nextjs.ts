import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ExtractedRoute, HttpMethod } from "../types.js";

const HTTP_METHODS = new Set<string>(["GET", "POST", "PUT", "PATCH", "DELETE"]);

/**
 * Convert a Next.js App Router directory segment to a route path segment.
 *
 * - Route groups  `(group)`  → empty string (omitted from path)
 * - Catch-all     `[...slug]` → `:slug*`
 * - Dynamic       `[param]`   → `:param`
 * - Static        `foo`       → `foo`
 */
function segmentToPath(segment: string): string {
  // Route group — skip in path
  if (segment.startsWith("(") && segment.endsWith(")")) {
    return "";
  }
  // Catch-all segment: [...slug]
  const catchAll = segment.match(/^\[\.\.\.([^\]]+)\]$/);
  if (catchAll) {
    return `:${catchAll[1]}*`;
  }
  // Dynamic segment: [param]
  const dynamic = segment.match(/^\[([^\]]+)\]$/);
  if (dynamic) {
    return `:${dynamic[1]}`;
  }
  return segment;
}

/**
 * Recursively walk a directory, yielding route files with their corresponding
 * URL path prefix.
 */
async function walkAppDir(
  dir: string,
  pathPrefix: string,
  results: Array<{ file: string; routePath: string }>,
): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    let entryStat;
    try {
      entryStat = await stat(fullPath);
    } catch {
      continue;
    }

    if (entryStat.isDirectory()) {
      const pathSegment = segmentToPath(entry);
      // Route groups are transparent — continue with the same prefix
      const childPrefix = pathSegment === "" ? pathPrefix : `${pathPrefix}/${pathSegment}`;
      await walkAppDir(fullPath, childPrefix, results);
    } else if (entry === "route.ts" || entry === "route.js") {
      results.push({ file: fullPath, routePath: pathPrefix || "/" });
    }
  }
}

/**
 * Extract routes from a Next.js App Router project by scanning the file system
 * and using ts-morph to detect exported HTTP method functions in route files.
 *
 * @param projectDir - Root directory (or fixtures dir in tests)
 * @param appDir     - Sub-directory to scan, relative to projectDir. Defaults to "app"
 */
export async function extractNextjsRoutes(
  projectDir: string,
  appDir?: string,
): Promise<ExtractedRoute[]> {
  // `src/app` is as official a layout as `app`, and defaulting to `app` alone
  // meant half of all App Router projects scanned an absent directory and
  // reported no routes — the same shape as reading only the project root for a
  // Prisma schema. An explicit `app_dir` is still honoured exactly as given.
  const candidates = appDir !== undefined ? [appDir] : ["app", "src/app"];
  const scanDir = candidates.map((dir) => join(projectDir, dir)).find((dir) => existsSync(dir));

  if (!scanDir) {
    return [];
  }

  // Lazy-load ts-morph so the package works without it installed.
  let tsMorph: typeof import("ts-morph");
  try {
    tsMorph = await import("ts-morph");
  } catch {
    throw new Error("ts-morph is required for route extraction. Install it: pnpm add -D ts-morph");
  }

  const { Project, SyntaxKind } = tsMorph;

  // Discover all route files and their URL paths
  const routeFiles: Array<{ file: string; routePath: string }> = [];
  await walkAppDir(scanDir, "", routeFiles);

  if (routeFiles.length === 0) {
    return [];
  }

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: true },
  });

  // Add only the discovered route files
  for (const { file } of routeFiles) {
    project.addSourceFileAtPath(file);
  }

  const routes: ExtractedRoute[] = [];

  for (const { file, routePath } of routeFiles) {
    const sourceFile = project.getSourceFile(file);
    if (!sourceFile) continue;

    // Extract params from route path segments (e.g. `:id` → "id", `:slug*` → "slug")
    const params = (routePath.match(/:[a-zA-Z_][a-zA-Z0-9_]*\*?/g) ?? []).map((p) =>
      p.replace(/^:/, "").replace(/\*$/, ""),
    );

    // Find all exported function declarations named after HTTP methods
    const exportedFunctions = sourceFile.getFunctions().filter((fn) => {
      const name = fn.getName();
      return name !== undefined && HTTP_METHODS.has(name) && fn.isExported();
    });

    for (const fn of exportedFunctions) {
      const name = fn.getName()!;
      const lineNumber = sourceFile.getLineAndColumnAtPos(fn.getStart()).line;

      routes.push({
        method: name as HttpMethod,
        path: routePath || "/",
        params,
        file,
        line: lineNumber,
      });
    }

    // Also handle variable exported functions: export const GET = async () => { ... }
    const exportedVarDecls = sourceFile
      .getDescendantsOfKind(SyntaxKind.VariableDeclaration)
      .filter((decl) => {
        const name = decl.getName();
        if (!HTTP_METHODS.has(name)) return false;
        // Check if the variable statement is exported
        const varStatement = decl.getVariableStatement();
        return varStatement !== undefined && varStatement.isExported();
      });

    for (const decl of exportedVarDecls) {
      const name = decl.getName();
      const lineNumber = sourceFile.getLineAndColumnAtPos(decl.getStart()).line;

      routes.push({
        method: name as HttpMethod,
        path: routePath || "/",
        params,
        file,
        line: lineNumber,
      });
    }
  }

  return routes;
}
