import { analyzeConversation } from "../../../services/conversationAnalysis";
import { prioritizeLead } from "../../../services/leadPriority";
import { analyzeOfferReadiness } from "../../../services/offers";
import { daysSince } from "../../../utils/dates";

function condition(label, passed, detail) {
  return { label, passed, detail };
}

export function evaluateWorkflowRules({ deal, messages = [] } = {}) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const leadPriority = prioritizeLead({ deal, messages: safeMessages });
  const offerReadiness = analyzeOfferReadiness(deal);
  const conversation = analyzeConversation(safeMessages);
  const lastMessage = safeMessages[safeMessages.length - 1];
  const inactiveDays = daysSince(lastMessage?.created_at);
  const stage = deal?.stage || "New Lead";
  const rules = [];

  rules.push({
    templateId: "new-seller-intake",
    priority: "Medium",
    conditions: [
      condition("Lead exists", Boolean(deal), "Seller workspace has a deal context."),
    ],
    shouldRecommend: Boolean(deal),
  });

  rules.push({
    templateId: "initial-contact",
    priority: "High",
    conditions: [
      condition("No conversation history", safeMessages.length === 0, "No messages are logged yet."),
    ],
    shouldRecommend: safeMessages.length === 0,
  });

  rules.push({
    templateId: "warm-lead-nurture",
    priority: leadPriority.priorityLabel === "Critical" ? "Critical" : "High",
    conditions: [
      condition("Seller engaged", ["Warm", "Hot"].includes(conversation.engagement), conversation.engagement),
      condition("Not offer-ready", offerReadiness.status !== "Ready to Offer", offerReadiness.status),
    ],
    shouldRecommend:
      ["Warm", "Hot"].includes(conversation.engagement) &&
      offerReadiness.status !== "Ready to Offer",
  });

  rules.push({
    templateId: "offer-preparation",
    priority: "High",
    conditions: [
      condition("Offer readiness strong", offerReadiness.status === "Ready to Offer", offerReadiness.status),
    ],
    shouldRecommend: offerReadiness.status === "Ready to Offer",
  });

  rules.push({
    templateId: "contract-preparation",
    priority: "High",
    conditions: [
      condition("Offer/contract stage", ["Offer Sent", "Under Contract"].includes(stage), stage),
    ],
    shouldRecommend: ["Offer Sent", "Under Contract"].includes(stage),
  });

  rules.push({
    templateId: "buyer-matching",
    priority: "Medium",
    conditions: [
      condition("Disposition likely", ["Offer Sent", "Under Contract"].includes(stage), stage),
    ],
    shouldRecommend: ["Offer Sent", "Under Contract"].includes(stage),
  });

  rules.push({
    templateId: "closing-process",
    priority: "Critical",
    conditions: [
      condition("Under contract", stage === "Under Contract", stage),
    ],
    shouldRecommend: stage === "Under Contract",
  });

  rules.push({
    templateId: "dead-lead-reactivation",
    priority: "Medium",
    conditions: [
      condition("Inactive 7+ days", inactiveDays !== null && inactiveDays >= 7, `${inactiveDays ?? "Unknown"} days`),
    ],
    shouldRecommend: inactiveDays !== null && inactiveDays >= 7,
  });

  rules.push({
    templateId: "follow-up-sequence",
    priority: leadPriority.priorityLabel === "Critical" ? "Critical" : "Medium",
    conditions: [
      condition("Follow-up recommended", Boolean(leadPriority.suggestedAction), leadPriority.suggestedAction),
    ],
    shouldRecommend: Boolean(leadPriority.suggestedAction),
  });

  return rules;
}
