import { useMemo } from "react";
import { analyzeDealIntelligence } from "../services/intelligence";

export function useDealIntelligence({
  deal = null,
  messages = [],
  tasks = [],
  offerReadiness,
  offerRange,
  offerStrategy,
  conversationAnalysis,
  leadPriority,
  followUpPlan,
} = {}) {
  return useMemo(
    () =>
      analyzeDealIntelligence({
        deal,
        messages: Array.isArray(messages) ? messages : [],
        tasks: Array.isArray(tasks) ? tasks : [],
        offerReadiness,
        offerRange,
        offerStrategy,
        conversationAnalysis,
        leadPriority,
        followUpPlan,
      }),
    [
      deal,
      messages,
      tasks,
      offerReadiness,
      offerRange,
      offerStrategy,
      conversationAnalysis,
      leadPriority,
      followUpPlan,
    ]
  );
}
