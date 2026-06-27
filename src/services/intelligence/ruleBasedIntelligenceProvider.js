import { analyzeConversation } from "../conversationAnalysis";
import { analyzeDeal } from "../dealAnalysis";
import { planFollowUp } from "../followUpPlanner";
import { prioritizeLead } from "../leadPriority";
import {
  analyzeOfferRange,
  analyzeOfferReadiness,
  analyzeOfferStrategy,
} from "../offers";
import { clampScore } from "../../utils/numbers";
import { hasText, uniqueStrings } from "../../utils/text";

const SOURCE = "rules";

function getSafeMessages(messages) {
  return Array.isArray(messages) ? messages : [];
}

function getSafeTasks(tasks) {
  return Array.isArray(tasks) ? tasks : [];
}

function getIncompleteReadinessLabels(offerReadiness) {
  return (offerReadiness?.checklist || [])
    .filter((item) => !item.complete)
    .map((item) => item.label);
}

function buildRecommendations({
  leadPriority,
  followUpPlan,
  offerReadiness,
  offerStrategy,
  tasks,
}) {
  const openTasks = getSafeTasks(tasks).filter(
    (task) => (task.status || "open") !== "completed"
  );
  const recommendations = [
    leadPriority?.suggestedAction,
    offerReadiness?.recommendedNextStep,
    followUpPlan?.suggestedMessage,
  ];

  if (offerStrategy?.posture) {
    recommendations.push(`Negotiation posture: ${offerStrategy.posture}.`);
  }

  if (openTasks.length > 0) {
    recommendations.push(`Review ${openTasks.length} open seller task(s).`);
  }

  return uniqueStrings(recommendations).filter(hasText);
}

function buildMissingData({
  dealAnalysis,
  leadPriority,
  followUpPlan,
  offerReadiness,
  offerStrategy,
}) {
  return uniqueStrings([
    ...(dealAnalysis?.missingInformation || []),
    ...(leadPriority?.missingData || []),
    ...(followUpPlan?.missingData || []),
    ...(offerStrategy?.missing || []),
    ...getIncompleteReadinessLabels(offerReadiness),
  ]);
}

function buildRisks({ dealAnalysis, conversationAnalysis }) {
  return uniqueStrings([
    ...(dealAnalysis?.risks || []),
    ...(conversationAnalysis?.redFlags || []).map(
      (flag) => `Conversation red flag detected: ${flag}.`
    ),
  ]);
}

function buildReasoning({
  dealAnalysis,
  leadPriority,
  followUpPlan,
  offerStrategy,
  conversationAnalysis,
}) {
  return uniqueStrings([
    dealAnalysis?.summary,
    leadPriority?.whyThisLeadMatters,
    ...(leadPriority?.factors || []),
    ...(followUpPlan?.reasoning || []),
    ...(offerStrategy?.factors || []),
    conversationAnalysis?.suggestedTone
      ? `Suggested tone: ${conversationAnalysis.suggestedTone}`
      : "",
  ]);
}

function buildScore({ dealAnalysis, leadPriority, offerReadiness }) {
  const scores = [
    dealAnalysis?.score,
    leadPriority?.priorityScore,
    offerReadiness?.score,
  ].filter((score) => Number.isFinite(score));

  if (scores.length === 0) return 0;

  const total = scores.reduce((sum, score) => sum + score, 0);

  return clampScore(total / scores.length);
}

function buildConfidence({ score, missingData, offerRange, conversationAnalysis }) {
  if (offerRange?.confidence === "High" && score >= 70 && missingData.length <= 3) {
    return "High";
  }

  if (
    offerRange?.confidence === "Low" ||
    !conversationAnalysis?.hasData ||
    missingData.length >= 6
  ) {
    return "Low";
  }

  return "Medium";
}

export function analyzeRuleBasedDealIntelligence(input = {}) {
  const deal = input.deal || null;
  const messages = getSafeMessages(input.messages);
  const tasks = getSafeTasks(input.tasks);
  const dealAnalysis = input.dealAnalysis || analyzeDeal(deal);
  const conversationAnalysis =
    input.conversationAnalysis || analyzeConversation(messages);
  const leadPriority =
    input.leadPriority || prioritizeLead({ deal, messages });
  const followUpPlan =
    input.followUpPlan || planFollowUp({ deal, messages });
  const offerReadiness =
    input.offerReadiness || analyzeOfferReadiness(deal);
  const offerRange = input.offerRange || analyzeOfferRange(deal);
  const offerStrategy =
    input.offerStrategy || analyzeOfferStrategy({ deal, messages });
  const missingData = buildMissingData({
    dealAnalysis,
    leadPriority,
    followUpPlan,
    offerReadiness,
    offerStrategy,
  });
  const score = buildScore({
    dealAnalysis,
    leadPriority,
    offerReadiness,
  });
  const confidence = buildConfidence({
    score,
    missingData,
    offerRange,
    conversationAnalysis,
  });

  return {
    summary:
      dealAnalysis?.summary ||
      "More deal and conversation data is needed before confidence can improve.",
    score,
    confidence,
    recommendations: buildRecommendations({
      leadPriority,
      followUpPlan,
      offerReadiness,
      offerStrategy,
      tasks,
    }),
    missingData,
    risks: buildRisks({ dealAnalysis, conversationAnalysis }),
    reasoning: buildReasoning({
      dealAnalysis,
      leadPriority,
      followUpPlan,
      offerStrategy,
      conversationAnalysis,
    }),
    source: SOURCE,
    generatedAt: new Date().toISOString(),
  };
}
