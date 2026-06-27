import { analyzeConversation } from "./conversationAnalysis";
import { analyzeDeal } from "./dealAnalysis";

function getNumber(deal, keys) {
for (const key of keys) {
  const value = deal?.[key];
  const numberValue = Number(value);

  if (value !== null && value !== undefined && value !== "" && numberValue > 0) {
    return numberValue;
  }
}

return null;
}

function getText(deal, keys) {
for (const key of keys) {
  const value = deal?.[key];

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
}

return "";
}

function getHoursSince(value) {
if (!value) return null;

return (Date.now() - new Date(value).getTime()) / (1000 * 60 * 60);
}

function clampScore(score) {
return Math.max(0, Math.min(100, Math.round(score)));
}

function getPriorityLabel(score) {
if (score >= 85) return "Critical";
if (score >= 70) return "High";
if (score >= 45) return "Medium";

return "Low";
}

function getSuggestedAction({ score, missing, conversation, readinessScore, dealHealth }) {
if (conversation.urgency === "High" || score >= 85) {
  return "Call seller today";
}

if (conversation.engagement === "Warm" || conversation.engagement === "Hot") {
  return readinessScore >= 70
    ? "Prepare offer conversation"
    : "Ask one missing discovery question";
}

if (missing.includes("ARV / comps")) {
  return "Run comps before contacting";
}

if (dealHealth < 50 || readinessScore < 40) {
  return "Ask one missing discovery question";
}

return "Send follow-up SMS";
}

export function prioritizeLead({ deal, messages }) {
const conversation = analyzeConversation(messages);
const dealAnalysis = analyzeDeal(deal);
const motivation = getNumber(deal, ["motivation_score", "motivation"]);
const askingPrice = getNumber(deal, ["price", "asking_price", "askingPrice"]);
const arv = getNumber(deal, ["arv", "after_repair_value", "afterRepairValue"]);
const repairs = getNumber(deal, [
"repairs",
"estimated_repairs",
"repairs_needed",
"repair_estimate",
]);
const timeline = getText(deal, [
"seller_timeline",
"timeline",
"timeline_to_sell",
]);
const occupancy = getText(deal, ["occupancy_status", "occupancy"]);
const condition = getText(deal, ["property_condition", "condition"]);
const lastActivity = messages?.[messages.length - 1]?.created_at || null;
const hoursSinceLastActivity = getHoursSince(lastActivity);
const maxOffer = arv ? arv * 0.7 - (repairs ?? 0) : null;
const factors = [];
const missing = [];
let score = 20;

if (motivation && motivation >= 8) {
  score += 18;
  factors.push("High seller motivation.");
} else if (motivation && motivation >= 5) {
  score += 10;
  factors.push("Moderate seller motivation.");
} else if (!motivation) {
  missing.push("Seller motivation");
}

if (timeline) {
  const normalizedTimeline = timeline.toLowerCase();

  if (
    normalizedTimeline.includes("asap") ||
    normalizedTimeline.includes("soon") ||
    normalizedTimeline.includes("week") ||
    normalizedTimeline.includes("30")
  ) {
    score += 15;
    factors.push("Urgent seller timeline.");
  }
} else {
  missing.push("Seller timeline");
}

if (conversation.urgency === "High") {
  score += 15;
  factors.push("Conversation contains urgency signals.");
} else if (conversation.urgency === "Medium") {
  score += 8;
  factors.push("Conversation has some urgency.");
}

if (conversation.engagement === "Hot") {
  score += 16;
  factors.push("Hot seller engagement.");
} else if (conversation.engagement === "Warm") {
  score += 10;
  factors.push("Warm seller engagement.");
} else if (conversation.engagement === "Cold") {
  score -= 5;
}

if (dealAnalysis.offerReadinessScore >= 75) {
  score += 14;
  factors.push("Offer readiness is strong.");
} else if (dealAnalysis.offerReadinessScore < 40) {
  score -= 8;
  factors.push("Offer readiness is still low.");
}

if (dealAnalysis.score >= 75) {
  score += 12;
  factors.push("Deal health is good.");
} else if (dealAnalysis.score < 50) {
  score -= 8;
  factors.push("Deal health is weak.");
}

if (askingPrice && maxOffer) {
  if (askingPrice <= maxOffer) {
    score += 8;
    factors.push("Asking price fits the preliminary offer range.");
  } else if (askingPrice > maxOffer * 1.15) {
    score -= 8;
    factors.push("Asking price is high compared to offer range.");
  }
} else {
  if (!askingPrice) missing.push("Asking price");
  if (!arv) missing.push("ARV / comps");
}

if (occupancy) {
  if (occupancy.toLowerCase().includes("vacant")) {
    score += 6;
    factors.push("Vacant property may increase urgency.");
  }
} else {
  missing.push("Occupancy status");
}

if (condition) {
  score += 4;
} else {
  missing.push("Property condition");
}

if (hoursSinceLastActivity !== null) {
  if (hoursSinceLastActivity >= 72 && hoursSinceLastActivity < 168) {
    score += 6;
    factors.push("No recent activity; follow-up priority is rising.");
  } else if (hoursSinceLastActivity >= 168) {
    score += 4;
    factors.push("Lead has gone quiet for over a week.");
  }
}

const priorityScore = clampScore(score);
const uniqueMissing = [...new Set(missing)];
const suggestedAction = getSuggestedAction({
score: priorityScore,
missing: uniqueMissing,
conversation,
readinessScore: dealAnalysis.offerReadinessScore,
dealHealth: dealAnalysis.score,
});

return {
priorityScore,
priorityLabel: getPriorityLabel(priorityScore),
whyThisLeadMatters:
  factors.length > 0
    ? factors.slice(0, 3).join(" ")
    : "This lead needs more discovery before priority can be assessed confidently.",
suggestedAction,
factors: factors.length ? factors : ["Not enough priority signals yet."],
missingData: uniqueMissing,
};
}
