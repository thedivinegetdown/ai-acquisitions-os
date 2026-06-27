import { callNetlifyFunction } from "../api";
import { createFailure, createSuccess } from "../api/serviceResult";
import { buildAiPrompt } from "./promptBuilder";
import { parseAiResponse } from "./responseParser";

async function requestAiFunction(functionName, payload, fallback) {
  const result = await callNetlifyFunction(functionName, {
    body: payload,
    retries: 0,
  });

  if (!result.success) {
    return result;
  }

  return createSuccess(parseAiResponse(result.data, fallback));
}

export async function analyzeWithOpenAi({
  capability = "dealAnalysis",
  context = {},
  fallback = {},
} = {}) {
  const prompt = buildAiPrompt({ capability, context });
  return requestAiFunction("ai-analysis", prompt, fallback);
}

export async function summarizeWithOpenAi({
  capability = "conversationSummary",
  context = {},
  fallback = {},
} = {}) {
  const prompt = buildAiPrompt({ capability, context });
  return requestAiFunction("ai-summary", prompt, fallback);
}

export async function chatWithOpenAi({
  context = {},
  question = "",
  memory = [],
  fallback = {},
} = {}) {
  if (!question.trim()) {
    return createFailure("Question is required.", "Question is required.");
  }

  const prompt = buildAiPrompt({
    capability: "chat",
    context: {
      ...context,
      memory,
    },
    question,
  });

  return requestAiFunction("ai-chat", prompt, fallback);
}
