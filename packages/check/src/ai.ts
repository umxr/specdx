import type { Finding, AiAssessment, AiCheckResult } from "./types.js";

export async function analyzeWithAi(
  findings: Finding[],
  context: string,
): Promise<AiCheckResult> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY environment variable is required for --ai mode. " +
        "Set it or use the sdx:verify skill instead (no API key needed).",
    );
  }

  if (findings.length === 0) {
    return { findings, assessments: [], summary: "No findings to analyze." };
  }

  let Anthropic: typeof import("@anthropic-ai/sdk").default;
  try {
    const mod = await import("@anthropic-ai/sdk");
    Anthropic = mod.default;
  } catch {
    throw new Error(
      "@anthropic-ai/sdk is required for --ai mode. Install it: pnpm add -D @anthropic-ai/sdk",
    );
  }

  const client = new Anthropic({ apiKey });

  const findingsSummary = findings
    .map(
      (f, i) =>
        `[${i}] ${f.type} (${f.severity}): ${f.expected}${f.actual ? ` — actual: ${f.actual}` : ""}${f.suggestion ? ` — suggestion: ${f.suggestion}` : ""}`,
    )
    .join("\n");

  const prompt = `You are reviewing static analysis findings from a spec-to-implementation check.

Context: ${context}

Findings:
${findingsSummary}

For each finding (by index), assess:
1. Is this a real issue or a false positive?
2. How confident are you? (high/medium/low)
3. Brief reasoning (1-2 sentences)
4. Suggested fix if it's a real issue

Respond with a JSON array of objects:
[{ "findingIndex": 0, "isRealIssue": true, "confidence": "high", "reasoning": "...", "suggestedFix": "..." }]

Only output the JSON array, no other text.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "";

  let assessments: AiAssessment[];
  try {
    assessments = JSON.parse(text);
  } catch {
    assessments = [];
  }

  const realIssues = assessments.filter((a) => a.isRealIssue).length;
  const falsePositives = assessments.filter((a) => !a.isRealIssue).length;
  const summary = `AI analysis: ${realIssues} real issues, ${falsePositives} false positives out of ${findings.length} findings`;

  return { findings, assessments, summary };
}
