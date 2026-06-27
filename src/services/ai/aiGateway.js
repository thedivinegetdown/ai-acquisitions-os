import { createFailure, createSuccess } from "../api/serviceResult";
import {
  analyzeWithOpenAi,
  chatWithOpenAi,
  summarizeWithOpenAi,
} from "./openAiProvider";

export const AI_PROVIDER_MODES = {
  RULE_BASED: "rule-based",
  OPENAI: "openai",
  HYBRID: "hybrid",
};

function withFallback(aiResult, fallback, fallbackSource = "ruleBasedFallback") {
  if (aiResult.success) {
    return {
      ...aiResult,
      data: {
        ...fallback,
        ...aiResult.data,
        fallbackUsed: false,
      },
    };
  }

  return createSuccess({
    ...fallback,
    source: fallback.source || fallbackSource,
    fallbackUsed: true,
    providerError: aiResult.error?.message || "AI provider unavailable.",
    generatedAt: new Date().toISOString(),
  });
}

export async function analyzeAi({
  capability = "dealAnalysis",
  context = {},
  fallback = {},
  providerMode = AI_PROVIDER_MODES.HYBRID,
} = {}) {
  if (providerMode === AI_PROVIDER_MODES.RULE_BASED) {
    return createSuccess({
      ...fallback,
      fallbackUsed: true,
      source: fallback.source || "ruleBasedProvider",
    });
  }

  const aiResult =
    capability === "conversationSummary"
      ? await summarizeWithOpenAi({ capability, context, fallback })
      : await analyzeWithOpenAi({ capability, context, fallback });

  if (providerMode === AI_PROVIDER_MODES.OPENAI) {
    return aiResult;
  }

  return withFallback(aiResult, fallback);
}

export async function chatWithAi({
  context = {},
  question = "",
  memory = [],
  fallback = {},
  providerMode = AI_PROVIDER_MODES.HYBRID,
} = {}) {
  if (providerMode === AI_PROVIDER_MODES.RULE_BASED) {
    return createSuccess({
      ...fallback,
      summary:
        fallback.summary ||
        "Rule-based mode is active. Review the current recommendations and next best action.",
      fallbackUsed: true,
      source: fallback.source || "ruleBasedProvider",
    });
  }

  const aiResult = await chatWithOpenAi({
    context,
    question,
    memory,
    fallback,
  });

  if (providerMode === AI_PROVIDER_MODES.OPENAI) {
    return aiResult;
  }

  return withFallback(aiResult, fallback);
}

export function createMissingContextResult(message = "Missing deal context.") {
  return createFailure(message, message);
}
