import type { DependencyGraph, ParsedSpec } from "@specdx/core";
import type { SpecDiff, ImpactAnalysis, DownstreamImpact } from "./types.js";

const STRUCTURAL_SECTIONS = new Set([
  "Goals",
  "Architecture",
  "Features",
  "Endpoints",
  "Data Model",
  "API Design",
  "Problem Statement",
]);

/**
 * Calculate BFS distances from a starting node using the graph's edges.
 * Returns a map of nodeId -> shortest distance from the start node.
 */
function bfsDistances(startId: string, graph: DependencyGraph): Map<string, number> {
  const distances = new Map<string, number>();
  const queue: Array<{ id: string; distance: number }> = [];

  // Seed queue with direct downstream neighbors (distance 1)
  for (const edge of graph.edges) {
    if (edge.from === startId) {
      if (!distances.has(edge.to)) {
        distances.set(edge.to, 1);
        queue.push({ id: edge.to, distance: 1 });
      }
    }
  }

  while (queue.length > 0) {
    const item = queue.shift()!;
    const currentDist = item.distance;

    for (const edge of graph.edges) {
      if (edge.from === item.id && !distances.has(edge.to)) {
        distances.set(edge.to, currentDist + 1);
        queue.push({ id: edge.to, distance: currentDist + 1 });
      }
    }
  }

  return distances;
}

function daysBetween(dateStr: string): number {
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.max(0, (now - then) / (1000 * 60 * 60 * 24));
}

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

export function analyzeImpact(
  changedSpecId: string,
  diff: SpecDiff,
  graph: DependencyGraph,
  allSpecs: ParsedSpec[],
  thresholdDays = 14,
): ImpactAnalysis {
  // 1. BFS to get downstream spec IDs with their distances
  const distanceMap = bfsDistances(changedSpecId, graph);

  if (distanceMap.size === 0) {
    return {
      changedSpec: changedSpecId,
      downstream: [],
      totalAffected: 0,
    };
  }

  // 2. Pre-compute diff section metrics (same for all downstream specs)
  const totalSections = Math.max(1, diff.sections.length);
  const structuralSectionsChanged = diff.sections.filter((s) =>
    STRUCTURAL_SECTIONS.has(s.heading),
  ).length;

  // 3. Build a lookup map for specs
  const specById = new Map<string, ParsedSpec>();
  for (const spec of allSpecs) {
    const id = spec.frontmatter.id as string | undefined;
    if (id) specById.set(id, spec);
  }

  // 4. Build downstream impacts
  const downstream: DownstreamImpact[] = [];

  for (const [specId, distance] of distanceMap) {
    const spec = specById.get(specId);

    // Determine lastUpdated: use `updated` field if present, fall back to `created`
    const lastUpdated =
      (spec?.frontmatter.updated as string | undefined) ??
      (spec?.frontmatter.created as string | undefined) ??
      null;

    const filePath = spec?.filePath ?? `specs/${specId}.md`;

    // 5. Staleness formula
    let staleness = 0;
    if (lastUpdated) {
      const daysSinceUpdate = daysBetween(lastUpdated);
      staleness = clamp(
        0,
        1,
        (daysSinceUpdate / thresholdDays) * 0.5 +
          (structuralSectionsChanged / totalSections) * 0.3 +
          (1 / distance) * 0.2,
      );
    } else {
      // No date info — use structural + distance terms only
      staleness = clamp(
        0,
        1,
        (structuralSectionsChanged / totalSections) * 0.3 + (1 / distance) * 0.2,
      );
    }

    // 6. Generate reason string
    const parts: string[] = [];
    parts.push(`depends on ${changedSpecId} (distance ${distance})`);
    if (structuralSectionsChanged > 0) {
      parts.push(`${structuralSectionsChanged} structural section(s) changed`);
    }
    if (lastUpdated) {
      const days = Math.round(daysBetween(lastUpdated));
      parts.push(`last updated ${days} day(s) ago`);
    }
    const reason = parts.join("; ");

    downstream.push({
      specId,
      filePath,
      distance,
      lastUpdated,
      staleness,
      reason,
    });
  }

  // Sort by distance ascending, then by staleness descending for stable output
  downstream.sort((a, b) => a.distance - b.distance || b.staleness - a.staleness);

  return {
    changedSpec: changedSpecId,
    downstream,
    totalAffected: downstream.length,
  };
}
