import { safeTrim } from "../../utils/text";

function extractJson(text) {
  const trimmed = safeTrim(text);
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export function parseAiResponse(response = {}, fallback = {}) {
  const outputText =
    response.output_text ||
    response.text ||
    response.content ||
    response.choices?.[0]?.message?.content ||
    "";
  const parsed = extractJson(outputText);
  const data = parsed || {
    summary: safeTrim(outputText) || fallback.summary || "AI response unavailable.",
  };

  return {
    summary: data.summary || fallback.summary || "AI response unavailable.",
    priority: data.priority || fallback.priority || "Medium",
    confidence: data.confidence || fallback.confidence || "Medium",
    recommendation:
      data.recommendation || fallback.recommendation || "Review deal context.",
    reasoning: data.reasoning || fallback.reasoning || "Generated from available context.",
    source: data.source || "openAiProvider",
    category: data.category || fallback.category || "AI Copilot",
    insights: Array.isArray(data.insights) ? data.insights : [],
    drafts: data.drafts || {},
    risks: Array.isArray(data.risks) ? data.risks : [],
    opportunities: Array.isArray(data.opportunities) ? data.opportunities : [],
    missingData: Array.isArray(data.missingData) ? data.missingData : [],
    nextSteps: Array.isArray(data.nextSteps) ? data.nextSteps : [],
    raw: data,
    generatedAt: new Date().toISOString(),
  };
}
