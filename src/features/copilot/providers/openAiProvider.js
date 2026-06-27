import { analyzeAi, chatWithAi } from "../../../services/ai";

export const openAiCopilotProvider = {
  async analyze(input = {}, fallback) {
    const result = await analyzeAi({
      capability: input.capability || "dealAnalysis",
      context: fallback.context,
      fallback,
      providerMode: input.providerMode,
    });

    return result.success ? result.data : fallback;
  },

  async chat({ context, question, memory, fallback, providerMode }) {
    const result = await chatWithAi({
      context,
      question,
      memory,
      fallback,
      providerMode,
    });

    return result.success ? result.data : fallback;
  },
};
