import { buildCopilotContext } from "../services/copilotContextBuilder";
import {
  buildCopilotFeed,
  buildCopilotScore,
  buildDailyAgenda,
  buildDealTimeline,
  generateCopilotRecommendations,
} from "../services/copilotRecommendationEngine";

export const ruleBasedCopilotProvider = {
  analyze(input = {}) {
    const context = buildCopilotContext(input);
    const recommendations = generateCopilotRecommendations(context);

    return {
      summary:
        recommendations[0]?.summary ||
        "Copilot is ready. Add more deal, conversation, and workflow data to improve guidance.",
      priority: recommendations[0]?.priority || "Low",
      confidence: recommendations[0]?.confidence || "Medium",
      recommendation:
        recommendations[0]?.recommendation || "Review deal workspace",
      reasoning:
        recommendations[0]?.reasoning ||
        "Rule-based copilot did not find a critical action.",
      source: "ruleBasedCopilotProvider",
      category: recommendations[0]?.category || "General",
      generatedAt: new Date().toISOString(),
      recommendations,
      feed: buildCopilotFeed(context, recommendations),
      agenda: buildDailyAgenda(context, recommendations),
      timeline: buildDealTimeline(context, recommendations),
      score: buildCopilotScore(recommendations),
      context,
      fallbackUsed: false,
    };
  },
};
