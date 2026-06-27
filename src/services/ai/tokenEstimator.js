const MAX_CONTEXT_TOKENS = 7000;

export function estimateTokens(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value || {});
  return Math.ceil(text.length / 4);
}

export function trimMessagesForTokenBudget(messages = [], maxTokens = 2200) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const selected = [];
  let tokenCount = 0;

  for (let index = safeMessages.length - 1; index >= 0; index -= 1) {
    const message = safeMessages[index];
    const messageTokens = estimateTokens(message);

    if (tokenCount + messageTokens > maxTokens) break;

    selected.unshift(message);
    tokenCount += messageTokens;
  }

  return selected;
}

export function trimContextForAi(context = {}, maxTokens = MAX_CONTEXT_TOKENS) {
  const trimmedContext = {
    ...context,
    conversation: {
      ...context.conversation,
      messages: trimMessagesForTokenBudget(context.conversation?.messages || []),
    },
  };

  if (estimateTokens(trimmedContext) <= maxTokens) {
    return trimmedContext;
  }

  return {
    deal: context.deal,
    seller: context.seller,
    conversation: {
      analysis: context.conversation?.analysis,
      messages: trimMessagesForTokenBudget(context.conversation?.messages || [], 1200),
    },
    tasks: (context.tasks || []).slice(0, 20),
    dealAnalysis: context.dealAnalysis,
    offerAnalysis: context.offerAnalysis,
    propertyAnalysis: context.propertyAnalysis,
    buyerAnalysis: context.buyerAnalysis,
    transactionAnalysis: context.transactionAnalysis,
    followUpPlan: context.followUpPlan,
    aiIntelligence: context.aiIntelligence,
    automationPlan: context.automationPlan,
  };
}
