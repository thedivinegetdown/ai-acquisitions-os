import { uniqueStrings } from "../../../utils/text";
import {
  CONFIDENCE_LIMITING_FACTORS,
  DATA_RELIABILITY_GRADES,
  RECOMMENDATION_BASIS_TYPES,
  RECOMMENDATION_CONFIDENCE_LEVELS,
  normalizeRecommendationBasis,
  normalizeRecommendationConfidenceResult,
} from "./confidenceReliabilityContracts";

const DIRECT_HIGH_BASES = new Set([
  RECOMMENDATION_BASIS_TYPES.SELLER_REPLY,
  RECOMMENDATION_BASIS_TYPES.OVERDUE_ACTION,
  RECOMMENDATION_BASIS_TYPES.DUE_ACTION,
  RECOMMENDATION_BASIS_TYPES.CONFLICT_REVIEW,
  RECOMMENDATION_BASIS_TYPES.MISSING_INFORMATION,
]);
const STRATEGY_BASES = new Set([
  RECOMMENDATION_BASIS_TYPES.RESIDENTIAL_STRATEGY_GUIDANCE,
  RECOMMENDATION_BASIS_TYPES.VACANT_LAND_STRATEGY_GUIDANCE,
]);

function reliabilityLevel(grade) {
  if (grade === DATA_RELIABILITY_GRADES.STRONG) return RECOMMENDATION_CONFIDENCE_LEVELS.HIGH;
  if (grade === DATA_RELIABILITY_GRADES.MODERATE) return RECOMMENDATION_CONFIDENCE_LEVELS.MODERATE;
  return RECOMMENDATION_CONFIDENCE_LEVELS.LOW;
}

export function evaluateRecommendationConfidence({ approvalContext = {}, conflictReadModel = {}, dataReliabilityResult = {}, evaluatedTimestamp, evidenceRegistry = {}, missingInformationReadModel = {}, readinessResult = {}, recommendation = {}, recommendationBasis: suppliedBasis } = {}) {
  try {
    const basis = normalizeRecommendationBasis(suppliedBasis);
    const traceable = Boolean(basis.triggerId || basis.evidenceIds.length || basis.missingInformationIds.length || basis.conflictIds.length || basis.readinessGateIds.length || basis.approvalReferenceIds.length);
    let level = RECOMMENDATION_CONFIDENCE_LEVELS.UNAVAILABLE;
    const positive = [];
    const limiting = [];
    if (!recommendation?.recommendationId || basis.basisType === RECOMMENDATION_BASIS_TYPES.UNAVAILABLE) {
      limiting.push(CONFIDENCE_LIMITING_FACTORS.INSUFFICIENT_RECOMMENDATION_BASIS);
    } else if (DIRECT_HIGH_BASES.has(basis.basisType) && basis.directTrigger && traceable) {
      level = RECOMMENDATION_CONFIDENCE_LEVELS.HIGH;
      positive.push("explicit-deterministic-trigger", "direct-action-traceability");
    } else if (basis.basisType === RECOMMENDATION_BASIS_TYPES.PENDING_APPROVAL) {
      level = basis.approvalReferenceIds.length && approvalContext.status !== "unavailable" ? RECOMMENDATION_CONFIDENCE_LEVELS.HIGH : RECOMMENDATION_CONFIDENCE_LEVELS.MODERATE;
      positive.push(basis.approvalReferenceIds.length ? "persisted-approval-trigger" : "descriptive-approval-trigger");
    } else if (basis.basisType === RECOMMENDATION_BASIS_TYPES.MANUAL_REVIEW) {
      level = basis.directTrigger && traceable ? RECOMMENDATION_CONFIDENCE_LEVELS.HIGH : RECOMMENDATION_CONFIDENCE_LEVELS.MODERATE;
      limiting.push(CONFIDENCE_LIMITING_FACTORS.MANUAL_REVIEW_REQUIRED);
    } else if (STRATEGY_BASES.has(basis.basisType) || basis.basisType === RECOMMENDATION_BASIS_TYPES.READY_FOR_OFFER_PREPARATION) {
      level = reliabilityLevel(dataReliabilityResult.grade);
      positive.push("deterministic-strategy-or-readiness-basis");
    } else if (basis.basisType === RECOMMENDATION_BASIS_TYPES.READINESS_BLOCKER) {
      level = traceable ? RECOMMENDATION_CONFIDENCE_LEVELS.MODERATE : RECOMMENDATION_CONFIDENCE_LEVELS.LOW;
      limiting.push(CONFIDENCE_LIMITING_FACTORS.READINESS_NOT_READY);
    } else if (basis.basisType === RECOMMENDATION_BASIS_TYPES.ASSET_CLASSIFICATION) {
      level = basis.conflictIds.length ? RECOMMENDATION_CONFIDENCE_LEVELS.HIGH : traceable ? RECOMMENDATION_CONFIDENCE_LEVELS.MODERATE : RECOMMENDATION_CONFIDENCE_LEVELS.LOW;
    } else if (basis.basisType === RECOMMENDATION_BASIS_TYPES.COMPATIBILITY_FALLBACK) {
      level = traceable ? RECOMMENDATION_CONFIDENCE_LEVELS.LOW : RECOMMENDATION_CONFIDENCE_LEVELS.UNAVAILABLE;
      limiting.push(CONFIDENCE_LIMITING_FACTORS.FALLBACK_RECOMMENDATION);
    }
    if (!basis.evidenceIds.length && !basis.missingInformationIds.length && !basis.conflictIds.length && !basis.approvalReferenceIds.length) limiting.push(CONFIDENCE_LIMITING_FACTORS.MISSING_DIRECT_EVIDENCE);
    if (dataReliabilityResult.grade === DATA_RELIABILITY_GRADES.LIMITED) limiting.push(CONFIDENCE_LIMITING_FACTORS.LIMITED_DATA_RELIABILITY);
    if (dataReliabilityResult.grade === DATA_RELIABILITY_GRADES.MODERATE) limiting.push(CONFIDENCE_LIMITING_FACTORS.MODERATE_DATA_RELIABILITY);
    if ((conflictReadModel.blockingConflicts || []).length) limiting.push(CONFIDENCE_LIMITING_FACTORS.ACTIVE_BLOCKING_CONFLICT);
    if ((missingInformationReadModel.blockingItems || []).length) limiting.push(CONFIDENCE_LIMITING_FACTORS.MISSING_REQUIRED_INFORMATION);
    if ((readinessResult.readinessState || "") !== "ready-for-offer-preparation") limiting.push(CONFIDENCE_LIMITING_FACTORS.READINESS_NOT_READY);
    const referencedEvidence = basis.evidenceIds.map((id) => evidenceRegistry.evidenceById?.[id]).filter(Boolean);
    if (referencedEvidence.some((record) => record.compatibility)) limiting.push(CONFIDENCE_LIMITING_FACTORS.COMPATIBILITY_EVIDENCE);
    if (referencedEvidence.some((record) => record.freshnessState === "stale")) limiting.push(CONFIDENCE_LIMITING_FACTORS.EXPLICIT_STALE_INPUT);
    if (referencedEvidence.some((record) => ["unverified", "verification-required"].includes(record.verificationState))) limiting.push(CONFIDENCE_LIMITING_FACTORS.EXPLICIT_UNVERIFIED_INPUT);
    const confidenceId = recommendation.recommendationId ? `recommendation-confidence:${encodeURIComponent(recommendation.recommendationId)}` : null;
    return normalizeRecommendationConfidenceResult({
      confidenceId,
      recommendationId: recommendation.recommendationId,
      basisType: basis.basisType,
      level,
      dataReliabilityReference: dataReliabilityResult.resultId,
      evidenceIds: basis.evidenceIds,
      missingInformationIds: basis.missingInformationIds,
      conflictIds: basis.conflictIds,
      readinessGateIds: basis.readinessGateIds,
      positiveSupportingFactors: uniqueStrings(positive),
      limitingFactors: uniqueStrings(limiting),
      explanation: level === "high" ? "A clear deterministic trigger directly supports this specific next action." : level === "moderate" ? "The next action has a deterministic basis, but its traceability or decision Evidence remains incomplete." : level === "low" ? "The recommendation is a safe fallback or depends materially on limited Evidence or unresolved review context." : "No valid traceable recommendation basis is available for a confidence assessment.",
      evaluatedTimestamp,
    });
  } catch {
    return normalizeRecommendationConfidenceResult({ evaluatedTimestamp, level: "unavailable", warnings: ["Recommendation Confidence evaluation failed safely; the recommendation remains available without confidence."] });
  }
}
