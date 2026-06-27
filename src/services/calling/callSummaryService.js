import { analyzeAi } from "../ai/aiGateway";
import { findKeywordMatches, safeTrim, uniqueStrings } from "../../utils/text";

const OBJECTION_KEYWORDS = [
  "price",
  "too low",
  "agent",
  "realtor",
  "repairs",
  "tenant",
  "mortgage",
  "think about it",
  "not ready",
  "family",
];

function detectSentiment(notes = "") {
  const text = notes.toLowerCase();

  if (text.includes("interested") || text.includes("motivated")) return "Positive";
  if (text.includes("angry") || text.includes("upset") || text.includes("not interested")) {
    return "Negative";
  }

  return safeTrim(notes) ? "Neutral" : "Unknown";
}

export function summarizeCallNotes({ notes = "", outcome = "" } = {}) {
  const trimmedNotes = safeTrim(notes);
  const objections = findKeywordMatches(trimmedNotes, OBJECTION_KEYWORDS);
  const sentiment = detectSentiment(`${outcome} ${trimmedNotes}`);
  const talkingPoints = [
    "Confirm seller timeline and desired outcome.",
    "Clarify property condition and repair concerns.",
    "Ask what would make the next step comfortable.",
  ];

  return {
    summary: trimmedNotes
      ? `Call outcome: ${outcome || "Logged"}. ${trimmedNotes}`
      : `Call outcome: ${outcome || "Logged"}. Notes are still needed.`,
    objections: uniqueStrings(objections),
    sentiment,
    recommendedNextAction:
      objections.length > 0
        ? "Address seller objections before discussing offer terms."
        : "Schedule the next follow-up and confirm remaining missing information.",
    talkingPoints,
    generatedAt: new Date().toISOString(),
    source: "manual",
  };
}

export async function generateCallTalkingPoints({ deal = {}, messages = [] } = {}) {
  const fallback = {
    summary: "Use the call to confirm motivation, timeline, condition, and price expectations.",
    talkingPoints: [
      "What changed that has you considering selling?",
      "What repairs or issues should we know about?",
      "What timeline would be ideal for you?",
      "If we could make the process simple, what would you need to feel comfortable?",
    ],
    objections: [],
    sentiment: "Unknown",
    recommendedNextAction: "Call seller and update notes afterward.",
    source: "callSummaryFallback",
  };

  const result = await analyzeAi({
    capability: "negotiationCoach",
    context: { deal, messages, channel: "call" },
    fallback,
  });

  if (!result.success) return fallback;

  return {
    ...fallback,
    ...result.data,
    talkingPoints: result.data.talkingPoints || fallback.talkingPoints,
    generatedAt: new Date().toISOString(),
    source: result.data.source || "aiGateway",
  };
}

export async function summarizeCallNotesWithAi({ notes = "", outcome = "", deal = {} } = {}) {
  const fallback = summarizeCallNotes({ notes, outcome });
  const result = await analyzeAi({
    capability: "conversationSummary",
    context: { deal, callNotes: notes, outcome },
    fallback,
  });

  if (!result.success) return fallback;

  return {
    ...fallback,
    ...result.data,
    summary: result.data.summary || fallback.summary,
    generatedAt: new Date().toISOString(),
    source: result.data.source || "aiGateway",
  };
}
