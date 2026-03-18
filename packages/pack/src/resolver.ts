import type { ParsedSpec, DependencyGraph } from "@sdx/core";
import type { RelevanceScore } from "./types.js";

/**
 * Common English stopwords to filter from task tokenization.
 */
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "do", "for",
  "from", "had", "has", "have", "he", "her", "his", "how", "i", "if",
  "in", "into", "is", "it", "its", "just", "me", "my", "no", "nor",
  "not", "of", "on", "or", "our", "out", "own", "say", "she", "so",
  "some", "such", "than", "that", "the", "their", "them", "then",
  "there", "these", "they", "this", "to", "too", "up", "us", "very",
  "was", "we", "were", "what", "when", "where", "which", "while",
  "who", "whom", "why", "will", "with", "would", "you", "your",
]);

/** Tokenize a task string into lowercase keywords, dropping stopwords and short tokens. */
function tokenize(task: string): string[] {
  return task
    .split(/[\s\-_/.,;:!?()[\]{}'"]+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Field weights for keyword matching. */
const WEIGHT_TAGS = 3;
const WEIGHT_TITLE = 3;
const WEIGHT_SECTIONS = 2;
const WEIGHT_BODY = 1;

/** Graph propagation factor for immediate neighbors. */
const GRAPH_BOOST_FACTOR = 0.5;

/** Minimum normalized score to include a spec. */
const SCORE_THRESHOLD = 0.1;

/**
 * Score specs by keyword relevance to a task string with graph propagation.
 *
 * - If no task or empty keywords after stopword removal, all specs get score 1.0.
 * - Keywords are matched with substring includes across weighted fields.
 * - Immediate graph neighbors of matching specs receive a boost.
 * - Results are normalized 0-1 and filtered by threshold.
 */
export function scoreSpecs(
  specs: Map<string, ParsedSpec>,
  task: string | undefined,
  graph: DependencyGraph,
): RelevanceScore[] {
  const keywords = task ? tokenize(task) : [];

  // No keywords: all specs equally relevant
  if (keywords.length === 0) {
    const results: RelevanceScore[] = [];
    for (const specId of specs.keys()) {
      results.push({
        specId,
        score: 1.0,
        rawScore: 1.0,
        matchedKeywords: [],
        graphBoosted: false,
      });
    }
    return results;
  }

  // Score each spec by keyword hits across weighted fields
  const rawScores = new Map<string, number>();
  const matchedMap = new Map<string, Set<string>>();

  for (const [specId, spec] of specs) {
    let weightedHits = 0;
    const matched = new Set<string>();

    for (const keyword of keywords) {
      let hit = false;

      // Tags (3x)
      const tags: unknown[] = (spec.frontmatter.tags as unknown[] | undefined) ?? [];
      for (const tag of tags) {
        if (typeof tag === "string" && tag.toLowerCase().includes(keyword)) {
          weightedHits += WEIGHT_TAGS;
          hit = true;
          break;
        }
      }

      // Title (3x)
      const title = spec.frontmatter.title;
      if (typeof title === "string" && title.toLowerCase().includes(keyword)) {
        weightedHits += WEIGHT_TITLE;
        hit = true;
      }

      // Sections (2x)
      for (const heading of spec.sections) {
        if (heading.toLowerCase().includes(keyword)) {
          weightedHits += WEIGHT_SECTIONS;
          hit = true;
          break;
        }
      }

      // Body content (1x)
      if (spec.content.toLowerCase().includes(keyword)) {
        weightedHits += WEIGHT_BODY;
        hit = true;
      }

      if (hit) {
        matched.add(keyword);
      }
    }

    const raw = weightedHits / keywords.length;
    rawScores.set(specId, raw);
    matchedMap.set(specId, matched);
  }

  // Graph propagation: boost immediate neighbors
  const boostScores = new Map<string, number>();
  const boostedSet = new Set<string>();

  for (const [specId, rawScore] of rawScores) {
    if (rawScore <= 0) continue;

    const boostAmount = rawScore * GRAPH_BOOST_FACTOR;

    // Find immediate neighbors from graph edges
    for (const edge of graph.edges) {
      let neighborId: string | undefined;
      if (edge.from === specId) {
        neighborId = edge.to;
      } else if (edge.to === specId) {
        neighborId = edge.from;
      }

      if (neighborId !== undefined && specs.has(neighborId)) {
        const existing = boostScores.get(neighborId) ?? 0;
        boostScores.set(neighborId, Math.max(existing, boostAmount));
      }
    }
  }

  // Combine raw + boost scores
  const finalRawScores = new Map<string, number>();
  for (const specId of specs.keys()) {
    const raw = rawScores.get(specId) ?? 0;
    const boost = boostScores.get(specId) ?? 0;
    const combined = raw + boost;
    finalRawScores.set(specId, combined);
    if (boost > 0 && raw === 0) {
      boostedSet.add(specId);
    }
  }

  // Find max for normalization
  let maxScore = 0;
  for (const score of finalRawScores.values()) {
    if (score > maxScore) maxScore = score;
  }

  // Build results, normalize, and filter
  const results: RelevanceScore[] = [];
  for (const [specId] of specs) {
    const combined = finalRawScores.get(specId) ?? 0;
    const normalized = maxScore > 0 ? combined / maxScore : 0;

    if (normalized < SCORE_THRESHOLD) continue;

    results.push({
      specId,
      score: normalized,
      rawScore: rawScores.get(specId) ?? 0,
      matchedKeywords: [...(matchedMap.get(specId) ?? [])],
      graphBoosted: boostedSet.has(specId),
    });
  }

  // Sort descending by score
  results.sort((a, b) => b.score - a.score);

  return results;
}

/**
 * Score specs by explicit IDs. Named specs get 1.0, their transitive
 * upstream dependencies get 0.5.
 *
 * Throws if any specId is not found in the specs map.
 */
export function scoreSpecsByIds(
  specs: Map<string, ParsedSpec>,
  specIds: string[],
  graph: DependencyGraph,
): RelevanceScore[] {
  // Validate all IDs exist
  for (const id of specIds) {
    if (!specs.has(id)) {
      const available = [...specs.keys()].join(", ");
      throw new Error(`Unknown spec: "${id}". Available specs: ${available}`);
    }
  }

  const scoreMap = new Map<string, number>();

  // Named specs get 1.0
  for (const id of specIds) {
    scoreMap.set(id, 1.0);
  }

  // Upstream deps get 0.5 (unless already named at 1.0)
  for (const id of specIds) {
    const upstream = graph.getUpstream(id);
    for (const depId of upstream) {
      if (!scoreMap.has(depId) && specs.has(depId)) {
        scoreMap.set(depId, 0.5);
      }
    }
  }

  const results: RelevanceScore[] = [];
  for (const [specId, score] of scoreMap) {
    results.push({
      specId,
      score,
      rawScore: score,
      matchedKeywords: [],
      graphBoosted: score < 1.0,
    });
  }

  // Sort descending by score
  results.sort((a, b) => b.score - a.score);

  return results;
}
