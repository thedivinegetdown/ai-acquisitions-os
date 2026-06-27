const KEYWORDS = {
positive: [
"interested",
"yes",
"sounds good",
"okay",
"thanks",
"appreciate",
],
negative: [
"no",
"stop",
"not interested",
"leave me alone",
"too low",
],
urgency: [
"asap",
"quickly",
"soon",
"this week",
"need to sell",
"behind",
"foreclosure",
"moving",
],
intent: [
"sell",
"price",
"offer",
"cash",
"close",
"repairs",
"mortgage",
"tenants",
"inherited",
],
redFlags: [
"attorney",
"lawsuit",
"probate",
"lien",
"bankruptcy",
"code violation",
"eviction",
],
};

function normalizeMessages(messages) {
return (messages || [])
.map((message) => message.message || message.body || "")
.filter(Boolean);
}

function findMatches(text, keywords) {
return keywords.filter((keyword) => text.includes(keyword));
}

function getSellerMessages(messages) {
return (messages || []).filter(
  (message) => message.direction !== "outbound"
);
}

function getEngagementLevel(messages, sellerMessages) {
if (!messages.length) return "Unknown";
if (sellerMessages.length >= 3) return "Hot";
if (sellerMessages.length >= 1) return "Warm";

return "Cold";
}

function getSuggestedTone({ sentiment, urgency, engagement }) {
if (sentiment === "Negative") {
  return "Slow down, acknowledge concern, and avoid pressure.";
}

if (urgency === "High") {
  return "Be clear, direct, and helpful.";
}

if (engagement === "Warm" || engagement === "Hot") {
  return "Move toward offer readiness.";
}

return "Ask one simple discovery question.";
}

export function analyzeConversation(messages) {
const sellerMessages = getSellerMessages(messages);
const sellerText = normalizeMessages(sellerMessages)
.join(" ")
.toLowerCase();
const allText = normalizeMessages(messages)
.join(" ")
.toLowerCase();

if (!messages?.length) {
  return {
    hasData: false,
    sentiment: "Unknown",
    urgency: "Unknown",
    engagement: "Unknown",
    detectedIntent: ["No conversation data available yet."],
    keyPhrases: [],
    redFlags: [],
    suggestedTone: "Ask one simple discovery question.",
  };
}

const positiveMatches = findMatches(sellerText, KEYWORDS.positive);
const negativeMatches = findMatches(sellerText, KEYWORDS.negative);
const urgencyMatches = findMatches(sellerText, KEYWORDS.urgency);
const intentMatches = findMatches(allText, KEYWORDS.intent);
const redFlagMatches = findMatches(allText, KEYWORDS.redFlags);
let sentiment = "Neutral";

if (positiveMatches.length > negativeMatches.length) {
  sentiment = "Positive";
} else if (negativeMatches.length > positiveMatches.length) {
  sentiment = "Negative";
}

let urgency = "Low";
if (urgencyMatches.length >= 2) {
  urgency = "High";
} else if (urgencyMatches.length === 1) {
  urgency = "Medium";
}

const engagement = getEngagementLevel(messages, sellerMessages);
const detectedIntent = intentMatches.length
  ? intentMatches
  : ["No clear seller intent detected yet."];
const keyPhrases = [
...positiveMatches,
...negativeMatches,
...urgencyMatches,
...intentMatches,
];

return {
hasData: true,
sentiment,
urgency,
engagement,
detectedIntent: [...new Set(detectedIntent)],
keyPhrases: [...new Set(keyPhrases)],
redFlags: [...new Set(redFlagMatches)],
suggestedTone: getSuggestedTone({
  sentiment,
  urgency,
  engagement,
}),
};
}
