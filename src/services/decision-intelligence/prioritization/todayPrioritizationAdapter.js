import { evaluateCostOfDelay } from "./costOfDelayService";
import { evaluateRecommendedActionWindow } from "./recommendedActionWindowService";

export const COST_OF_DELAY_RANK = Object.freeze({
  critical: 5,
  high: 4,
  moderate: 3,
  low: 2,
  unavailable: 1,
});

function basisForItem(item, evaluatedTimestamp) {
  const dueTimestamp = item.sourceDueTimestamp || item.dueDate || null;
  if (item.category === "completed") return { basisType: "unavailable" };
  if (item.type === "seller-reply") return { basisType: "seller-reply", triggerId: item.id, directTrigger: true, evidenceIds: item.evidenceIds || [] };
  if (item.type === "approval") return { basisType: "pending-approval", triggerId: item.target?.approvalId || item.id, directTrigger: true, approvalReferenceIds: item.target?.approvalId ? [item.target.approvalId] : [] };
  if (item.category === "waiting" && dueTimestamp) return { basisType: "scheduled-follow-up", triggerId: item.id, directTrigger: true };
  if (dueTimestamp) {
    const due = new Date(dueTimestamp);
    const evaluated = new Date(evaluatedTimestamp);
    const overdue = Number.isFinite(due.getTime()) && Number.isFinite(evaluated.getTime()) && due.getTime() < evaluated.getTime() && String(dueTimestamp).slice(0, 10) < String(evaluatedTimestamp).slice(0, 10);
    return { basisType: overdue ? "overdue-action" : "due-action", triggerId: item.id, directTrigger: true };
  }
  return { basisType: "compatibility-fallback", triggerId: item.id, directTrigger: false };
}

export function applyTodayPrioritization(item, { evaluatedTimestamp } = {}) {
  try {
    const recommendationBasis = basisForItem(item, evaluatedTimestamp);
    const input = {
      dealId: item.target?.dealId || item.id,
      recommendation: { recommendationId: `today-recommendation:${item.id}` },
      recommendationBasis,
      evaluatedTimestamp,
      sellerReplyContext: { eventTimestamp: item.type === "seller-reply" ? item.sourceEventTimestamp || item.updatedAt : null },
      approvalContext: item.type === "approval" ? { expirationTimestamp: item.sourceExpirationTimestamp, actionDueAt: item.sourceDueTimestamp || item.dueDate } : {},
      timingContext: { sourceDueTimestamp: item.sourceDueTimestamp || item.dueDate },
    };
    const cost = evaluateCostOfDelay(input);
    const window = evaluateRecommendedActionWindow(input);
    return {
      ...item,
      delayImpact: cost.level,
      delayImpactLabel: cost.displayLabel,
      actionWindowType: window.windowType,
      actionWindowLabel: window.displayLabel,
      sourceDueTimestamp: window.sourceDueTimestamp,
      sourceExpirationTimestamp: window.sourceExpirationTimestamp,
      sourceEventTimestamp: window.sourceEventTimestamp,
      timingExplanation: cost.explanation,
      timingRulesetVersion: cost.rulesetVersion,
      timingWarnings: [...cost.warnings, ...window.warnings],
      sortSignals: { ...item.sortSignals, delayImpactRank: COST_OF_DELAY_RANK[cost.level] || COST_OF_DELAY_RANK.unavailable },
    };
  } catch {
    return { ...item, delayImpact: "unavailable", delayImpactLabel: "Unavailable", actionWindowType: "unavailable", actionWindowLabel: "Unavailable", timingExplanation: "Timing metadata could not be evaluated; existing Today priority remains available.", timingRulesetVersion: null, timingWarnings: ["Today timing adaptation failed safely."], sortSignals: { ...item.sortSignals, delayImpactRank: COST_OF_DELAY_RANK.unavailable } };
  }
}
