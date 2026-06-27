import { daysSince } from "../../../utils/dates";
import { clampScore } from "../../../utils/numbers";

function createRecommendation({
  summary,
  priority = "Medium",
  confidence = "Medium",
  recommendation,
  reasoning,
  source,
  category,
  relatedDealSection,
}) {
  return {
    summary,
    priority,
    confidence,
    recommendation,
    reasoning,
    source,
    category,
    relatedDealSection,
    generatedAt: new Date().toISOString(),
  };
}

function getPriorityWeight(priority) {
  if (priority === "Critical") return 4;
  if (priority === "High") return 3;
  if (priority === "Medium") return 2;
  return 1;
}

export function generateCopilotRecommendations(context) {
  const recommendations = [];
  const messages = context.conversation.messages || [];
  const lastMessage = messages[messages.length - 1];
  const inactiveDays = daysSince(lastMessage?.created_at);

  if (context.leadPriority?.priorityLabel === "Critical") {
    recommendations.push(
      createRecommendation({
        summary: "Critical seller requires immediate follow-up.",
        priority: "Critical",
        confidence: "High",
        recommendation: "Call seller today",
        reasoning: context.leadPriority.whyThisLeadMatters,
        source: "leadPriority",
        category: "Follow-up",
        relatedDealSection: "Lead Priority",
      })
    );
  }

  if (context.offerAnalysis.readiness.missingData?.length || context.offerAnalysis.readiness.score < 65) {
    const nextMissing = context.offerAnalysis.readiness.checklist.find(
      (item) => !item.complete
    );

    recommendations.push(
      createRecommendation({
        summary: "Offer readiness is incomplete.",
        priority: "High",
        confidence: "High",
        recommendation:
          nextMissing?.label === "Property condition"
            ? "Ask about repairs"
            : context.offerAnalysis.readiness.recommendedNextStep,
        reasoning: "Offer readiness service identified missing offer inputs.",
        source: "offerReadinessService",
        category: "Offer",
        relatedDealSection: "Offer Readiness",
      })
    );
  }

  if (context.propertyAnalysis.arvConfidence === "Low") {
    recommendations.push(
      createRecommendation({
        summary: "Property valuation confidence is low.",
        priority: "High",
        confidence: "Medium",
        recommendation: "Run comps",
        reasoning: "ARV is missing or not supported by manual inputs.",
        source: "propertyIntelligenceService",
        category: "Property",
        relatedDealSection: "Property Intelligence",
      })
    );
  }

  if (context.offerAnalysis.readiness.status === "Ready to Offer") {
    recommendations.push(
      createRecommendation({
        summary: "Deal has enough information for internal offer planning.",
        priority: "High",
        confidence: context.offerAnalysis.range.confidence,
        recommendation: "Prepare an offer",
        reasoning: context.offerAnalysis.readiness.recommendedNextStep,
        source: "offerReadinessService",
        category: "Offer",
        relatedDealSection: "Offer Builder",
      })
    );
  }

  if (inactiveDays !== null && inactiveDays >= 3) {
    recommendations.push(
      createRecommendation({
        summary: `Seller has not responded in ${inactiveDays} days.`,
        priority: inactiveDays >= 7 ? "High" : "Medium",
        confidence: "Medium",
        recommendation: inactiveDays >= 7 ? "Follow up tomorrow" : "Follow up today",
        reasoning: "Conversation activity has gone quiet.",
        source: "conversationRepository",
        category: "Conversation",
        relatedDealSection: "Conversation Thread",
      })
    );
  }

  if (context.deal?.stage === "Under Contract") {
    recommendations.push(
      createRecommendation({
        summary: "Deal is under contract and needs transaction oversight.",
        priority: "High",
        confidence: context.transactionAnalysis.confidence,
        recommendation: "Move to contract checklist",
        reasoning: context.transactionAnalysis.recommendedNextAction,
        source: "transactionService",
        category: "Transaction",
        relatedDealSection: "Transaction Management",
      })
    );
  }

  if (context.transactionAnalysis.missingItems?.includes("Escrow deposit")) {
    recommendations.push(
      createRecommendation({
        summary: "Funding details are incomplete.",
        priority: "Medium",
        confidence: "Medium",
        recommendation: "Request mortgage payoff",
        reasoning: "Transaction risk service identified funding/title risk indicators.",
        source: "transactionRiskService",
        category: "Transaction",
        relatedDealSection: "Transaction Management",
      })
    );
  }

  if (context.buyerAnalysis.buyerDemandLevel === "Low") {
    recommendations.push(
      createRecommendation({
        summary: "Buyer demand has not been validated.",
        priority: "Medium",
        confidence: "Medium",
        recommendation: "Find buyers",
        reasoning: context.buyerAnalysis.summary,
        source: "dispositionService",
        category: "Disposition",
        relatedDealSection: "Buyer CRM",
      })
    );
  }

  if (context.propertyAnalysis.repairRisk === "High") {
    recommendations.push(
      createRecommendation({
        summary: "Repair risk is elevated.",
        priority: "Medium",
        confidence: "Medium",
        recommendation: "Schedule inspection",
        reasoning: "Property intelligence service detected elevated repair exposure.",
        source: "propertyIntelligenceService",
        category: "Property",
        relatedDealSection: "Property Intelligence",
      })
    );
  }

  return recommendations.sort(
    (left, right) =>
      getPriorityWeight(right.priority) - getPriorityWeight(left.priority)
  );
}

export function buildCopilotFeed(context, recommendations) {
  const feed = [];
  const messages = context.conversation.messages || [];
  const lastMessage = messages[messages.length - 1];
  const inactiveDays = daysSince(lastMessage?.created_at);

  if (inactiveDays !== null && inactiveDays > 0) {
    feed.push(`Seller has not responded in ${inactiveDays} days.`);
  }

  if (context.propertyAnalysis.recommendedExitStrategy === "Wholesale") {
    feed.push("High-confidence wholesale opportunity should be reviewed.");
  }

  if (context.propertyAnalysis.missingData.includes("Estimated repairs")) {
    feed.push("Repairs are still unknown.");
  }

  if (context.offerAnalysis.readiness.status === "Ready to Offer") {
    feed.push("Offer should be prepared.");
  }

  if (context.followUpPlan.urgency === "High" || context.followUpPlan.urgency === "Critical") {
    feed.push("Follow-up overdue or urgent.");
  }

  recommendations.slice(0, 3).forEach((item) => {
    feed.push(item.summary);
  });

  return [...new Set(feed)];
}

export function buildDailyAgenda(context, recommendations) {
  return {
    highestPriorityLeads: recommendations
      .filter((item) => ["Critical", "High"].includes(item.priority))
      .slice(0, 5),
    followUpsDue: recommendations.filter((item) => item.category === "Follow-up"),
    contractsNeedingAttention: recommendations.filter(
      (item) => item.category === "Transaction"
    ),
    buyersNeedingContact: recommendations.filter(
      (item) => item.category === "Disposition"
    ),
    transactionsAtRisk:
      context.transactionAnalysis.risks?.map((risk) =>
        createRecommendation({
          summary: risk,
          priority: "Medium",
          confidence: context.transactionAnalysis.confidence,
          recommendation: context.transactionAnalysis.recommendedNextAction,
          reasoning: risk,
          source: "transactionRiskService",
          category: "Transaction",
          relatedDealSection: "Transaction Management",
        })
      ) || [],
  };
}

export function buildDealTimeline(context, recommendations) {
  const messageEvents = (context.conversation.messages || []).map((message) => ({
    label: message.direction === "outbound" ? "Message sent" : "Seller contacted",
    date: message.created_at || "",
    detail: message.message || message.body || "Message logged",
  }));
  const taskEvents = (context.tasks || []).map((task) => ({
    label: task.status === "completed" ? "Task completed" : "Task open",
    date: task.created_at || task.due_at || "",
    detail: task.title || "Task",
  }));
  const milestoneEvents = [];

  if (context.offerAnalysis.readiness.status === "Ready to Offer") {
    milestoneEvents.push({
      label: "Offer prepared",
      date: context.generatedAt,
      detail: "Offer readiness indicates internal offer planning is ready.",
    });
  }

  if (context.transactionAnalysis.transactionStatus) {
    milestoneEvents.push({
      label: "Transaction milestone",
      date: context.generatedAt,
      detail: context.transactionAnalysis.transactionStatus,
    });
  }

  if (recommendations[0]) {
    milestoneEvents.push({
      label: "Recommended next milestone",
      date: context.generatedAt,
      detail: recommendations[0].recommendation,
    });
  }

  return [...messageEvents, ...taskEvents, ...milestoneEvents].sort(
    (left, right) => new Date(left.date || 0) - new Date(right.date || 0)
  );
}

export function buildCopilotScore(recommendations) {
  const weighted = recommendations.reduce((score, item) => {
    return score + getPriorityWeight(item.priority) * 10;
  }, 0);

  return clampScore(weighted);
}
