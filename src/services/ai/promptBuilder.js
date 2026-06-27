import { trimContextForAi } from "./tokenEstimator";

const PROMPTS = {
  sellerSummary: {
    system:
      "You are an expert real estate acquisitions copilot. Analyze seller context and return practical acquisition guidance.",
    task:
      "Generate seller profile, motivation, timeline, pain points, objections, communication style, and confidence.",
  },
  dealAnalysis: {
    system:
      "You are a senior acquisitions analyst for a real estate investment CRM.",
    task:
      "Generate executive summary, biggest risks, biggest opportunities, missing information, acquisition recommendation, and confidence.",
  },
  negotiationCoach: {
    system:
      "You are a negotiation coach for ethical real estate acquisitions conversations.",
    task:
      "Generate recommended negotiation approach, discovery questions, objection responses, offer positioning, and closing strategy.",
  },
  followUpDrafts: {
    system:
      "You draft seller follow-ups for an acquisitions team. Drafts are editable and must never imply automatic sending.",
    task:
      "Generate SMS drafts, email drafts, and call talking points. Keep SMS drafts concise and compliant.",
  },
  conversationSummary: {
    system:
      "You summarize seller conversations for acquisitions operators.",
    task:
      "Summarize the entire conversation, key decisions, outstanding questions, seller objections, and next steps.",
  },
  dailyBriefing: {
    system:
      "You create executive acquisition briefings from CRM context.",
    task:
      "Generate today's priorities, critical leads, deals at risk, deals likely to close, and follow-ups due.",
  },
  executiveInsights: {
    system:
      "You generate concise executive insights for a real estate acquisitions business.",
    task:
      "Generate observations about motivation, wholesale potential, seller finance opportunities, sentiment, and next actions.",
  },
  chat: {
    system:
      "You are the AI Acquisitions OS Copilot. Answer using only the provided CRM context. Be specific, practical, and concise.",
    task:
      "Answer the user's question. If context is missing, say what information is needed and give the safest next step.",
  },
};

export function getPromptTemplate(capability = "dealAnalysis") {
  return PROMPTS[capability] || PROMPTS.dealAnalysis;
}

export function buildAiPrompt({
  capability = "dealAnalysis",
  context = {},
  question = "",
} = {}) {
  const template = getPromptTemplate(capability);
  const trimmedContext = trimContextForAi(context);

  return {
    capability,
    system: template.system,
    user: [
      template.task,
      question ? `User question: ${question}` : "",
      "Return JSON with keys: summary, priority, confidence, recommendation, reasoning, source, category, insights, drafts, risks, opportunities, missingData, nextSteps.",
      `Context JSON: ${JSON.stringify(trimmedContext)}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    context: trimmedContext,
  };
}

export const promptTemplates = PROMPTS;
