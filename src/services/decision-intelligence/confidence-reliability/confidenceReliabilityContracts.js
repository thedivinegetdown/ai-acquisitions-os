import { normalizeDecisionTimestamp } from "../decisionContracts";
import { compactText, uniqueStrings } from "../../../utils/text";

export const DATA_RELIABILITY_CONTRACT_VERSION = "data-reliability-contract-v1";
export const DATA_RELIABILITY_RULESET_VERSION = "data-reliability-ruleset-v1";
export const RECOMMENDATION_CONFIDENCE_CONTRACT_VERSION = "recommendation-confidence-contract-v1";
export const RECOMMENDATION_CONFIDENCE_RULESET_VERSION = "recommendation-confidence-ruleset-v1";

export const DATA_RELIABILITY_GRADES = Object.freeze({
  UNAVAILABLE: "unavailable",
  LIMITED: "limited",
  MODERATE: "moderate",
  STRONG: "strong",
});

export const RELIABILITY_ASSESSMENT_BASIS = Object.freeze({
  INSUFFICIENT: "insufficient",
  PARTIAL: "partial",
  SUFFICIENT: "sufficient",
});

export const RECOMMENDATION_CONFIDENCE_LEVELS = Object.freeze({
  UNAVAILABLE: "unavailable",
  LOW: "low",
  MODERATE: "moderate",
  HIGH: "high",
});

export const RECOMMENDATION_BASIS_TYPES = Object.freeze({
  SELLER_REPLY: "seller-reply",
  OVERDUE_ACTION: "overdue-action",
  DUE_ACTION: "due-action",
  MISSING_INFORMATION: "missing-information",
  CONFLICT_REVIEW: "conflict-review",
  PENDING_APPROVAL: "pending-approval",
  READINESS_BLOCKER: "readiness-blocker",
  MANUAL_REVIEW: "manual-review",
  RESIDENTIAL_STRATEGY_GUIDANCE: "residential-strategy-guidance",
  VACANT_LAND_STRATEGY_GUIDANCE: "vacant-land-strategy-guidance",
  READY_FOR_OFFER_PREPARATION: "ready-for-offer-preparation",
  ASSET_CLASSIFICATION: "asset-classification",
  COMPATIBILITY_FALLBACK: "compatibility-fallback",
  UNAVAILABLE: "unavailable",
});

export const CONFIDENCE_LIMITING_FACTORS = Object.freeze({
  INSUFFICIENT_RECOMMENDATION_BASIS: "insufficient-recommendation-basis",
  MISSING_DIRECT_EVIDENCE: "missing-direct-evidence",
  LIMITED_DATA_RELIABILITY: "limited-data-reliability",
  MODERATE_DATA_RELIABILITY: "moderate-data-reliability",
  ACTIVE_BLOCKING_CONFLICT: "active-blocking-conflict",
  EXPLICIT_STALE_INPUT: "explicit-stale-input",
  EXPLICIT_UNVERIFIED_INPUT: "explicit-unverified-input",
  COMPATIBILITY_EVIDENCE: "compatibility-evidence",
  MANUAL_REVIEW_REQUIRED: "manual-review-required",
  READINESS_NOT_READY: "readiness-not-ready",
  MISSING_REQUIRED_INFORMATION: "missing-required-information",
  FALLBACK_RECOMMENDATION: "fallback-recommendation",
  TRACEABILITY_LIMITED: "traceability-limited",
});

export const DATA_RELIABILITY_DISCLAIMER = "Data Reliability describes the quality and traceability of currently available decision Evidence. It does not determine deal quality, guarantee correctness, or replace independent verification.";
export const RECOMMENDATION_CONFIDENCE_DISCLAIMER = "Recommendation Confidence describes how strongly the currently available deterministic basis supports this next action. It is not a probability of deal success, seller acceptance, profitability, or closing.";

export const CONFIDENCE_RELIABILITY_LIMITS = Object.freeze({
  FACTS: 60,
  REFERENCES: 100,
  FACTORS: 24,
  WARNINGS: 20,
});

const grades = new Set(Object.values(DATA_RELIABILITY_GRADES));
const assessmentStates = new Set(Object.values(RELIABILITY_ASSESSMENT_BASIS));
const levels = new Set(Object.values(RECOMMENDATION_CONFIDENCE_LEVELS));
const basisTypes = new Set(Object.values(RECOMMENDATION_BASIS_TYPES));

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value, maximum = 320) {
  if (!["string", "number"].includes(typeof value)) return null;
  return compactText(String(value)).slice(0, maximum) || null;
}

function strings(value, limit = CONFIDENCE_RELIABILITY_LIMITS.REFERENCES) {
  return uniqueStrings((Array.isArray(value) ? value : []).map((entry) => text(entry)).filter(Boolean)).slice(0, limit);
}

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

export function normalizeFactReliabilityResult(value) {
  const source = object(value);
  const canonicalField = text(source.canonicalField, 160);
  if (!canonicalField) return null;
  return {
    canonicalField,
    factId: text(source.factId, 160),
    label: text(source.label, 240) || canonicalField,
    criticality: source.criticality === "blocking" ? "blocking" : "advisory",
    recommendationCritical: source.recommendationCritical === true,
    state: grades.has(source.state) ? source.state : DATA_RELIABILITY_GRADES.UNAVAILABLE,
    evidenceIds: strings(source.evidenceIds),
    supportingEvidenceCount: count(source.supportingEvidenceCount),
    challengingEvidenceCount: count(source.challengingEvidenceCount),
    contextualEvidenceCount: count(source.contextualEvidenceCount),
    evidenceStatus: text(source.evidenceStatus, 80) || "unavailable",
    sourceIdentityState: text(source.sourceIdentityState, 80) || "unidentified",
    valueTraceability: text(source.valueTraceability, 80) || "unavailable",
    verificationState: text(source.verificationState, 80) || "unknown",
    freshnessState: text(source.freshnessState, 80) || "unknown",
    sourceTimestampAvailability: text(source.sourceTimestampAvailability, 80) || "unavailable",
    compatibilityEvidence: source.compatibilityEvidence === true,
    activeConflictIds: strings(source.activeConflictIds),
    lineageLimitation: source.lineageLimitation === true,
    limitationCodes: strings(source.limitationCodes),
    explanation: text(source.explanation, 640),
    warnings: strings(source.warnings, CONFIDENCE_RELIABILITY_LIMITS.WARNINGS),
  };
}

export function normalizeDataReliabilityResult(value) {
  const source = object(value);
  const grade = grades.has(source.grade) ? source.grade : DATA_RELIABILITY_GRADES.UNAVAILABLE;
  const criticalFactResults = (Array.isArray(source.criticalFactResults) ? source.criticalFactResults : []).map(normalizeFactReliabilityResult).filter(Boolean).slice(0, CONFIDENCE_RELIABILITY_LIMITS.FACTS);
  const advisoryFactResults = (Array.isArray(source.advisoryFactResults) ? source.advisoryFactResults : []).map(normalizeFactReliabilityResult).filter(Boolean).slice(0, CONFIDENCE_RELIABILITY_LIMITS.FACTS);
  const all = [...criticalFactResults, ...advisoryFactResults];
  return {
    resultId: text(source.resultId, 320),
    contractVersion: DATA_RELIABILITY_CONTRACT_VERSION,
    rulesetVersion: DATA_RELIABILITY_RULESET_VERSION,
    dealId: text(source.dealId, 160),
    organizationId: text(source.organizationId, 160),
    tenantId: text(source.tenantId, 160),
    assetType: text(source.assetType, 120),
    strategyId: text(source.strategyId, 160),
    strategyVersion: text(source.strategyVersion, 120),
    evaluationState: grade === DATA_RELIABILITY_GRADES.UNAVAILABLE ? "unavailable" : "evaluated",
    grade,
    displayLabel: grade === DATA_RELIABILITY_GRADES.UNAVAILABLE ? "Unavailable" : `${grade.charAt(0).toUpperCase()}${grade.slice(1)}`,
    assessmentBasis: assessmentStates.has(source.assessmentBasis) ? source.assessmentBasis : RELIABILITY_ASSESSMENT_BASIS.INSUFFICIENT,
    criticalFactResults,
    advisoryFactResults,
    strongFactCount: all.filter((fact) => fact.state === DATA_RELIABILITY_GRADES.STRONG).length,
    moderateFactCount: all.filter((fact) => fact.state === DATA_RELIABILITY_GRADES.MODERATE).length,
    limitedFactCount: all.filter((fact) => fact.state === DATA_RELIABILITY_GRADES.LIMITED).length,
    unavailableFactCount: all.filter((fact) => fact.state === DATA_RELIABILITY_GRADES.UNAVAILABLE).length,
    evidenceIds: strings(source.evidenceIds),
    conflictIds: strings(source.conflictIds),
    limitationCodes: strings(source.limitationCodes),
    basisGapRequirementIds: strings(source.basisGapRequirementIds),
    explanation: text(source.explanation, 720),
    evaluatedTimestamp: normalizeDecisionTimestamp(source.evaluatedTimestamp),
    sourceMode: "deterministic",
    warnings: strings(source.warnings, CONFIDENCE_RELIABILITY_LIMITS.WARNINGS),
    operatorDisclaimer: DATA_RELIABILITY_DISCLAIMER,
  };
}

export function normalizeRecommendationBasis(value) {
  const source = object(value);
  return {
    basisType: basisTypes.has(source.basisType) ? source.basisType : RECOMMENDATION_BASIS_TYPES.UNAVAILABLE,
    triggerId: text(source.triggerId, 320),
    triggerLabel: text(source.triggerLabel, 240),
    relatedCanonicalFields: strings(source.relatedCanonicalFields),
    evidenceIds: strings(source.evidenceIds),
    missingInformationIds: strings(source.missingInformationIds),
    conflictIds: strings(source.conflictIds),
    readinessGateIds: strings(source.readinessGateIds),
    strategyRuleset: text(source.strategyRuleset, 160),
    directTrigger: source.directTrigger === true,
    approvalReferenceIds: strings(source.approvalReferenceIds),
    limitations: strings(source.limitations, CONFIDENCE_RELIABILITY_LIMITS.FACTORS),
    explanation: text(source.explanation, 640),
  };
}

export function normalizeRecommendationConfidenceResult(value) {
  const source = object(value);
  const level = levels.has(source.level) ? source.level : RECOMMENDATION_CONFIDENCE_LEVELS.UNAVAILABLE;
  return {
    confidenceId: text(source.confidenceId, 320),
    contractVersion: RECOMMENDATION_CONFIDENCE_CONTRACT_VERSION,
    rulesetVersion: RECOMMENDATION_CONFIDENCE_RULESET_VERSION,
    recommendationId: text(source.recommendationId, 320),
    basisType: basisTypes.has(source.basisType) ? source.basisType : RECOMMENDATION_BASIS_TYPES.UNAVAILABLE,
    evaluationState: level === RECOMMENDATION_CONFIDENCE_LEVELS.UNAVAILABLE ? "unavailable" : "evaluated",
    level,
    displayLabel: level === RECOMMENDATION_CONFIDENCE_LEVELS.UNAVAILABLE ? "Unavailable" : `${level.charAt(0).toUpperCase()}${level.slice(1)}`,
    dataReliabilityReference: text(source.dataReliabilityReference, 320),
    evidenceIds: strings(source.evidenceIds),
    missingInformationIds: strings(source.missingInformationIds),
    conflictIds: strings(source.conflictIds),
    readinessGateIds: strings(source.readinessGateIds),
    positiveSupportingFactors: strings(source.positiveSupportingFactors, CONFIDENCE_RELIABILITY_LIMITS.FACTORS),
    limitingFactors: strings(source.limitingFactors, CONFIDENCE_RELIABILITY_LIMITS.FACTORS),
    explanation: text(source.explanation, 720),
    evaluatedTimestamp: normalizeDecisionTimestamp(source.evaluatedTimestamp),
    sourceMode: "deterministic",
    warnings: strings(source.warnings, CONFIDENCE_RELIABILITY_LIMITS.WARNINGS),
    operatorDisclaimer: RECOMMENDATION_CONFIDENCE_DISCLAIMER,
  };
}

export function validateDataReliabilityResult(value) {
  const normalized = normalizeDataReliabilityResult(value);
  const errors = [];
  if (!normalized.resultId) errors.push("A Data Reliability result ID is required.");
  if (!normalized.evaluatedTimestamp) errors.push("A supplied evaluation timestamp is required.");
  return { valid: errors.length === 0, errors, normalized };
}

export function validateRecommendationConfidenceResult(value) {
  const normalized = normalizeRecommendationConfidenceResult(value);
  const errors = [];
  if (!normalized.confidenceId) errors.push("A Recommendation Confidence ID is required.");
  if (!normalized.recommendationId) errors.push("A recommendation ID is required.");
  if (!normalized.evaluatedTimestamp) errors.push("A supplied evaluation timestamp is required.");
  return { valid: errors.length === 0, errors, normalized };
}
