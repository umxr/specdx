import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ParsedSpec } from "@specdx/core";
import type { Finding } from "./types.js";

/** A checkable artifact declared in a spec's `artifacts` frontmatter (issue #15). */
export interface ArtifactDecl {
  /** Project-root-relative file path that must exist. */
  path: string;
  /** Names that must be exported from the file. */
  exports?: string[];
}

/** Result of verifying declared artifacts against the project. */
export interface ArtifactCheckResult {
  findings: Finding[];
  /** Total artifact assertions considered (each path, plus each checkable export). */
  total: number;
  /** Assertions actually verified — equals `total`; skipped assertions are excluded, not passed. */
  checked: number;
  /** Declared-but-absent artifacts of specs not yet approved — planned, not missing (issue #17). */
  pending: number;
  notes: string[];
}

/**
 * Spec statuses at which declared artifacts must already exist.
 *
 * A spec is the plan for work that has not happened yet, so its artifacts are
 * enforceable only once it is approved. Before then a declared-but-absent file
 * is the expected state, not a defect (issue #17) — otherwise spec-first
 * authoring would fail the very gate the artifacts exist to feed.
 */
const ENFORCED_STATUSES = new Set(["approved"]);

/** True when a spec's declared artifacts must exist for the check to pass. */
export function artifactsEnforced(status: unknown): boolean {
  return typeof status === "string" && ENFORCED_STATUSES.has(status);
}

/**
 * Read the `artifacts` frontmatter field defensively. Schema validation
 * reports malformed entries; here we simply skip anything unusable.
 */
export function parseArtifacts(spec: ParsedSpec): ArtifactDecl[] {
  const raw = spec.frontmatter.artifacts;
  if (!Array.isArray(raw)) return [];

  const out: ArtifactDecl[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const decl = item as { path?: unknown; exports?: unknown };
    if (typeof decl.path !== "string" || decl.path.length === 0) continue;
    const exports = Array.isArray(decl.exports)
      ? decl.exports.filter((e): e is string => typeof e === "string" && e.length > 0)
      : undefined;
    out.push({ path: decl.path, exports });
  }
  return out;
}

/** Return the set of exported names from a source file, or null when ts-morph fails to parse. */
async function getExportedNames(filePath: string): Promise<Set<string> | null> {
  try {
    const { Project } = await import("ts-morph");
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: { allowJs: true },
    });
    const sourceFile = project.addSourceFileAtPath(filePath);
    return new Set(sourceFile.getExportedDeclarations().keys());
  } catch {
    return null;
  }
}

/**
 * Verify each spec's declared artifacts: files must exist, and named exports
 * must be present. Export checks need ts-morph; without it they are skipped
 * with a note and excluded from the totals — never counted as passed.
 */
export async function checkArtifacts(
  specs: ParsedSpec[],
  projectDir: string,
  tsMorphAvailable: boolean,
): Promise<ArtifactCheckResult> {
  const findings: Finding[] = [];
  const notes: string[] = [];
  let total = 0;
  let pending = 0;
  let skippedExports = 0;

  for (const spec of specs) {
    const specId = String(spec.frontmatter.id);
    const status = spec.frontmatter.status;
    const enforced = artifactsEnforced(status);

    for (const artifact of parseArtifacts(spec)) {
      const absolute = join(projectDir, artifact.path);

      if (!existsSync(absolute)) {
        if (enforced) {
          total += 1;
          findings.push({
            type: "missing",
            category: "artifact",
            specId,
            expected: `file "${artifact.path}"`,
            severity: "error",
            suggestion: `Create ${artifact.path} or update the artifacts list in ${specId}.`,
          });
        } else {
          // Planned, not missing: excluded from the score rather than passed.
          pending += 1;
          findings.push({
            type: "pending",
            category: "artifact",
            specId,
            expected: `file "${artifact.path}"`,
            severity: "info",
            suggestion: `planned by ${specId} (status: ${String(status)}) — not yet implemented; enforced once the spec is approved.`,
          });
        }
        // Export assertions for an absent file are not separately counted.
        continue;
      }

      // The file exists, so it is a real assertion regardless of spec status.
      total += 1;

      if (!artifact.exports || artifact.exports.length === 0) continue;

      if (!tsMorphAvailable) {
        skippedExports += artifact.exports.length;
        continue;
      }

      const exported = await getExportedNames(absolute);
      if (exported === null) {
        skippedExports += artifact.exports.length;
        continue;
      }

      for (const name of artifact.exports) {
        // An export that exists is a verified assertion whatever the status.
        if (exported.has(name)) {
          total += 1;
          continue;
        }

        // An absent export follows the same status rule as an absent file: a
        // spec that is not yet approved is planning it, not missing it (#19).
        if (enforced) {
          total += 1;
          findings.push({
            type: "missing",
            category: "artifact",
            specId,
            codeLocation: { file: artifact.path, line: 1 },
            expected: `export "${name}" from ${artifact.path}`,
            severity: "error",
            suggestion: `Export ${name} from ${artifact.path} or update the artifacts list in ${specId}.`,
          });
        } else {
          pending += 1;
          findings.push({
            type: "pending",
            category: "artifact",
            specId,
            codeLocation: { file: artifact.path, line: 1 },
            expected: `export "${name}" from ${artifact.path}`,
            severity: "info",
            suggestion: `planned by ${specId} (status: ${String(status)}) — not yet implemented; enforced once the spec is approved.`,
          });
        }
      }
    }
  }

  if (skippedExports > 0) {
    notes.push(
      `artifact export checks skipped for ${skippedExports} export(s): ts-morph is not available or the file could not be parsed.`,
    );
  }

  if (pending > 0) {
    notes.push(
      `${pending} declared artifact assertion(s) pending: files or exports planned by specs that are not yet approved. They are excluded from the score and become enforceable when the spec status changes to approved.`,
    );
  }

  return { findings, total, checked: total, pending, notes };
}
