import { evaluatePrioritizationPolicy } from "./prioritizationPolicy";
import { normalizeCostOfDelayResult } from "./prioritizationContracts";

export function evaluateCostOfDelay(input = {}) {
  try {
    const policy = evaluatePrioritizationPolicy(input);
    const context = input.assetStrategyContext || {};
    const basis = input.recommendationBasis || {};
    const recommendation = input.recommendation || {};
    const dealId = context.dealId || input.dealId || null;
    return normalizeCostOfDelayResult({
      resultId: dealId ? `cost-of-delay:deal:${encodeURIComponent(dealId)}` : null,
      dealId,
      organizationId: input.evidenceRegistry?.organizationId,
      tenantId: input.evidenceRegistry?.tenantId,
      assetType: context.assetType,
      strategyId: context.selectedStrategyId,
      strategyVersion: context.strategyVersion,
      recommendationId: recommendation.recommendationId,
      recommendationBasisType: policy.basisType,
      level: policy.level,
      explanation: policy.explanation,
      directOperationalTrigger: policy.directOperationalTrigger,
      sourceDueTimestamp: policy.sourceDueTimestamp,
      approvalExpirationTimestamp: policy.sourceExpirationTimestamp,
      sellerReplyTimestamp: policy.sourceEventTimestamp,
      sellerTimelineDays: policy.sellerTimelineDays,
      evidenceIds: basis.evidenceIds,
      missingInformationIds: basis.missingInformationIds,
      conflictIds: basis.conflictIds,
      readinessGateIds: basis.readinessGateIds,
      approvalReferenceIds: basis.approvalReferenceIds,
      recommendationConfidenceReference: input.recommendationConfidenceResult?.confidenceId,
      dataReliabilityReference: input.dataReliabilityResult?.resultId,
      limitingFactors: policy.level === "unavailable" ? ["insufficient-timing-basis"] : [],
      evaluatedTimestamp: input.evaluatedTimestamp,
      warnings: policy.warnings,
    });
  } catch {
    return normalizeCostOfDelayResult({ level: "unavailable", evaluatedTimestamp: input.evaluatedTimestamp, warnings: ["Cost of Delay evaluation failed safely and did not issue an urgency category."] });
  }
}
