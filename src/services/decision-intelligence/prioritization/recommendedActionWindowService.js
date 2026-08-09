import { evaluatePrioritizationPolicy } from "./prioritizationPolicy";
import { normalizeRecommendedActionWindowResult } from "./prioritizationContracts";

export function evaluateRecommendedActionWindow(input = {}) {
  try {
    const policy = evaluatePrioritizationPolicy(input);
    const basis = input.recommendationBasis || {};
    const recommendation = input.recommendation || {};
    const dealId = input.assetStrategyContext?.dealId || input.dealId || null;
    return normalizeRecommendedActionWindowResult({
      windowId: dealId ? `recommended-action-window:deal:${encodeURIComponent(dealId)}` : null,
      dealId,
      recommendationId: recommendation.recommendationId,
      basisType: policy.basisType,
      windowType: policy.windowType,
      explanation: policy.explanation,
      sourceDueTimestamp: policy.sourceDueTimestamp,
      sourceExpirationTimestamp: policy.sourceExpirationTimestamp,
      sourceEventTimestamp: policy.sourceEventTimestamp,
      policyDerived: policy.policyDerived,
      evidenceIds: basis.evidenceIds,
      missingInformationIds: basis.missingInformationIds,
      conflictIds: basis.conflictIds,
      approvalReferenceIds: basis.approvalReferenceIds,
      targetSection: basis.targetSection,
      evaluatedTimestamp: input.evaluatedTimestamp,
      warnings: policy.warnings,
    });
  } catch {
    return normalizeRecommendedActionWindowResult({ windowType: "unavailable", evaluatedTimestamp: input.evaluatedTimestamp, warnings: ["Recommended Action Window evaluation failed safely; no deadline was created."] });
  }
}
