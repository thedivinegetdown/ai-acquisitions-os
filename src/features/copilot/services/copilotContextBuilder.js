import { analyzeConversation } from "../../../services/conversationAnalysis";
import { analyzeDeal } from "../../../services/dealAnalysis";
import { planFollowUp } from "../../../services/followUpPlanner";
import { prioritizeLead } from "../../../services/leadPriority";
import { analyzeDealIntelligence } from "../../../services/intelligence";
import {
  analyzeOfferRange,
  analyzeOfferReadiness,
  analyzeOfferStrategy,
} from "../../../services/offers";
import { analyzePropertyIntelligence } from "../../../services/property";
import { analyzeDisposition } from "../../../services/buyers";
import { analyzeTransaction } from "../../../services/transactions";
import { analyzeAutomationPlan } from "../../../services/automation";

function getSafeMessages(messages) {
  return Array.isArray(messages) ? messages : [];
}

function getSafeTasks(tasks) {
  return Array.isArray(tasks) ? tasks : [];
}

export function buildCopilotContext({
  deal = null,
  seller = null,
  messages = [],
  tasks = [],
  propertyInputs,
  buyers = [],
  transaction,
  sequenceDraft,
} = {}) {
  const safeMessages = getSafeMessages(messages);
  const safeTasks = getSafeTasks(tasks);
  const dealAnalysis = analyzeDeal(deal);
  const conversationAnalysis = analyzeConversation(safeMessages);
  const leadPriority = prioritizeLead({ deal, messages: safeMessages });
  const followUpPlan = planFollowUp({ deal, messages: safeMessages });
  const offerReadiness = analyzeOfferReadiness(deal);
  const offerRange = analyzeOfferRange(deal);
  const offerStrategy = analyzeOfferStrategy({ deal, messages: safeMessages });
  const aiIntelligence = analyzeDealIntelligence({
    deal,
    messages: safeMessages,
    tasks: safeTasks,
    offerReadiness,
    offerRange,
    offerStrategy,
    conversationAnalysis,
    leadPriority,
    followUpPlan,
  });
  const propertyAnalysis = analyzePropertyIntelligence({
    deal,
    inputs: propertyInputs,
  });
  const buyerAnalysis = analyzeDisposition({
    deal,
    buyers,
    exitStrategy: propertyAnalysis.recommendedExitStrategy,
  });
  const transactionAnalysis = analyzeTransaction(transaction || {});
  const automationPlan = analyzeAutomationPlan({
    deal,
    messages: safeMessages,
    sequenceDraft,
  });

  return {
    deal,
    seller: seller || {
      name: deal?.owner_name || deal?.seller_name || "",
      phone: deal?.phone || "",
    },
    conversation: {
      messages: safeMessages,
      analysis: conversationAnalysis,
    },
    tasks: safeTasks,
    dealAnalysis,
    offerAnalysis: {
      readiness: offerReadiness,
      range: offerRange,
      strategy: offerStrategy,
    },
    propertyAnalysis,
    buyerAnalysis,
    transactionAnalysis,
    followUpPlan,
    aiIntelligence,
    automationPlan,
    generatedAt: new Date().toISOString(),
  };
}
