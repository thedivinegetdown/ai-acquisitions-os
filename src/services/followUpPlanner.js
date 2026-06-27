import { analyzeConversation } from "./conversationAnalysis";
import { analyzeDeal } from "./dealAnalysis";
import { prioritizeLead } from "./leadPriority";

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

function getReadinessStatus(score) {
if (score >= 88) return "Ready to Offer";
if (score >= 65) return "Ready to Analyze";
if (score >= 35) return "Needs Info";

return "Not Ready";
}

function getMissingDiscoveryQuestion(missingData) {
if (missingData.includes("Seller timeline")) {
  return "What would be your ideal timeline if we were able to make the numbers work?";
}

if (missingData.includes("Property condition")) {
  return "Can you tell me a little more about the current condition and any repairs needed?";
}

if (missingData.includes("Asking price")) {
  return "Do you have a number in mind that would make sense for you?";
}

return "What is the most important thing for you in deciding whether to sell?";
}

export function planFollowUp({ deal, messages }) {
const conversation = analyzeConversation(messages);
const dealAnalysis = analyzeDeal(deal);
const priority = prioritizeLead({ deal, messages });
const motivation = getNumber(deal, ["motivation_score", "motivation"]);
const timeline = getText(deal, [
"seller_timeline",
"timeline",
"timeline_to_sell",
]);
const lastActivity = messages?.[messages.length - 1]?.created_at || null;
const hoursSinceLastActivity = getHoursSince(lastActivity);
const readinessStatus = getReadinessStatus(dealAnalysis.offerReadinessScore);
let urgency = "Low";
let followUpTime = "Next week";
let channel = "SMS";
let suggestedMessage =
  "Just following up to see if you had a chance to think about the property. Happy to answer any questions.";
const reasoning = [];
const missingData = [...priority.missingData];

if (
  priority.priorityLabel === "Critical" &&
  conversation.engagement === "Hot"
) {
  urgency = "Critical";
  followUpTime = "Today";
  channel = "Call";
  suggestedMessage =
    "I wanted to connect today while this is fresh and make sure we understand your timeline and what would make an offer work.";
  reasoning.push("Critical priority with hot engagement deserves immediate human follow-up.");
} else if (
  conversation.urgency === "High" &&
  conversation.sentiment === "Positive"
) {
  urgency = "High";
  followUpTime = "Today";
  channel = "SMS";
  suggestedMessage =
    "Thanks for the quick response. What would be a good time today to talk through your goals and next steps?";
  reasoning.push("High urgency and positive seller tone support a same-day SMS follow-up.");
} else if (conversation.sentiment === "Negative") {
  urgency = "Medium";
  followUpTime = "In 3 days";
  channel = "SMS";
  suggestedMessage =
    "I understand. I do not want to pressure you. If it is helpful, I can answer any questions or simply check back later.";
  reasoning.push("Negative sentiment calls for a softer message and more space.");
} else if (readinessStatus === "Ready to Offer") {
  urgency = "High";
  followUpTime = "Today";
  channel = "Call";
  suggestedMessage =
    "I think we have enough information to talk through a realistic offer range. Would today be a good time?";
  reasoning.push("Offer readiness is high enough to prepare an offer conversation.");
} else if (hoursSinceLastActivity !== null && hoursSinceLastActivity >= 72) {
  urgency = priority.priorityLabel === "High" ? "High" : "Medium";
  followUpTime = "In 3 days";
  channel = "SMS";
  suggestedMessage =
    "Just checking in. Are you still open to talking through options for the property?";
  reasoning.push("No recent activity means this lead needs a structured follow-up.");
} else if (priority.missingData.length > 0) {
  urgency = priority.priorityLabel === "Low" ? "Low" : "Medium";
  followUpTime = "Tomorrow";
  channel = "SMS";
  suggestedMessage = getMissingDiscoveryQuestion(priority.missingData);
  reasoning.push("Missing data should be resolved with one simple discovery question.");
}

if (motivation && motivation >= 8 && urgency !== "Critical") {
  urgency = urgency === "Low" ? "Medium" : urgency;
  reasoning.push("High seller motivation increases follow-up importance.");
}

if (timeline) {
  const normalizedTimeline = timeline.toLowerCase();

  if (
    normalizedTimeline.includes("asap") ||
    normalizedTimeline.includes("soon") ||
    normalizedTimeline.includes("week")
  ) {
    followUpTime = "Today";
    urgency = urgency === "Critical" ? "Critical" : "High";
    reasoning.push("Seller timeline suggests urgency.");
  }
}

return {
urgency,
followUpTime,
channel,
suggestedMessage,
reasoning: reasoning.length
  ? reasoning
  : ["Lead is stable; use a normal follow-up cadence."],
missingData,
readinessStatus,
};
}
