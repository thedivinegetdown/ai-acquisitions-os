import { normalizeDecisionTimestamp } from "../decisionContracts";
import { RECOMMENDATION_BASIS_TYPES } from "../confidence-reliability";
import { compactText, uniqueStrings } from "../../../utils/text";

export const COST_OF_DELAY_CONTRACT_VERSION = "cost-of-delay-contract-v1";
export const COST_OF_DELAY_RULESET_VERSION = "cost-of-delay-ruleset-v1";
export const ACTION_WINDOW_CONTRACT_VERSION = "recommended-action-window-contract-v1";
export const ACTION_WINDOW_RULESET_VERSION = "recommended-action-window-ruleset-v1";

export const COST_OF_DELAY_LEVELS = Object.freeze({
  UNAVAILABLE: "unavailable",
  LOW: "low",
  MODERATE: "moderate",
  HIGH: "high",
  CRITICAL: "critical",
});

export const ACTION_WINDOW_TYPES = Object.freeze({
  UNAVAILABLE: "unavailable",
  OVERDUE: "overdue",
  ACT_NOW: "act-now",
  TODAY: "today",
  WITHIN_3_DAYS: "within-3-days",
  BEFORE_DEADLINE: "before-deadline",
  SCHEDULED: "scheduled",
  NO_IMMEDIATE_ACTION: "no-immediate-action",
});

export const PRIORITIZATION_BASIS_TYPES = Object.freeze({
  ...RECOMMENDATION_BASIS_TYPES,
  SCHEDULED_FOLLOW_UP: "scheduled-follow-up",
});

export const COST_OF_DELAY_DISCLAIMER = "Cost of Delay describes the operational consequence of postponing the current recommended action. It is not a dollar estimate, profit forecast, probability, or instruction to transact.";
export const ACTION_WINDOW_DISCLAIMER = "Recommended Action Window indicates when the current action should be reviewed based on explicit operational dates and deterministic policy. It does not create a contractual deadline, send an action automatically, or replace user judgment.";

export const PRIORITIZATION_LIMITS = Object.freeze({
  REFERENCES: 100,
  LIMITING_FACTORS: 24,
  WARNINGS: 20,
});

const levels = new Set(Object.values(COST_OF_DELAY_LEVELS));
const windows = new Set(Object.values(ACTION_WINDOW_TYPES));
const bases = new Set(Object.values(PRIORITIZATION_BASIS_TYPES));

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value, maximum = 480) {
  if (!["string", "number"].includes(typeof value)) return null;
  return compactText(String(value)).slice(0, maximum) || null;
}

function strings(value, limit = PRIORITIZATION_LIMITS.REFERENCES) {
  return uniqueStrings((Array.isArray(value) ? value : []).map((entry) => text(entry, 320)).filter(Boolean)).slice(0, limit);
}

function display(value) {
  return value.split("-").map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
}

export function normalizeCostOfDelayResult(value) {
  const source = object(value);
  const level = levels.has(source.level) ? source.level : COST_OF_DELAY_LEVELS.UNAVAILABLE;
  return {
    resultId: text(source.resultId, 320),
    contractVersion: COST_OF_DELAY_CONTRACT_VERSION,
    rulesetVersion: COST_OF_DELAY_RULESET_VERSION,
    dealId: text(source.dealId, 160),
    organizationId: text(source.organizationId, 160),
    tenantId: text(source.tenantId, 160),
    assetType: text(source.assetType, 120),
    strategyId: text(source.strategyId, 160),
    strategyVersion: text(source.strategyVersion, 160),
    recommendationId: text(source.recommendationId, 320),
    recommendationBasisType: bases.has(source.recommendationBasisType) ? source.recommendationBasisType : PRIORITIZATION_BASIS_TYPES.UNAVAILABLE,
    evaluationState: level === COST_OF_DELAY_LEVELS.UNAVAILABLE ? "unavailable" : "evaluated",
    level,
    displayLabel: level === COST_OF_DELAY_LEVELS.UNAVAILABLE ? "Unavailable" : display(level),
    explanation: text(source.explanation, 720),
    directOperationalTrigger: source.directOperationalTrigger === true,
    sourceDueTimestamp: normalizeDecisionTimestamp(source.sourceDueTimestamp),
    approvalExpirationTimestamp: normalizeDecisionTimestamp(source.approvalExpirationTimestamp),
    sellerReplyTimestamp: normalizeDecisionTimestamp(source.sellerReplyTimestamp),
    sellerTimelineDays: Number.isFinite(Number(source.sellerTimelineDays)) && Number(source.sellerTimelineDays) >= 0 ? Number(source.sellerTimelineDays) : null,
    evidenceIds: strings(source.evidenceIds),
    missingInformationIds: strings(source.missingInformationIds),
    conflictIds: strings(source.conflictIds),
    readinessGateIds: strings(source.readinessGateIds),
    approvalReferenceIds: strings(source.approvalReferenceIds),
    recommendationConfidenceReference: text(source.recommendationConfidenceReference, 320),
    dataReliabilityReference: text(source.dataReliabilityReference, 320),
    limitingFactors: strings(source.limitingFactors, PRIORITIZATION_LIMITS.LIMITING_FACTORS),
    evaluatedTimestamp: normalizeDecisionTimestamp(source.evaluatedTimestamp),
    sourceMode: "deterministic",
    warnings: strings(source.warnings, PRIORITIZATION_LIMITS.WARNINGS),
    operatorDisclaimer: COST_OF_DELAY_DISCLAIMER,
  };
}

export function normalizeRecommendedActionWindowResult(value) {
  const source = object(value);
  const windowType = windows.has(source.windowType) ? source.windowType : ACTION_WINDOW_TYPES.UNAVAILABLE;
  return {
    windowId: text(source.windowId, 320),
    contractVersion: ACTION_WINDOW_CONTRACT_VERSION,
    rulesetVersion: ACTION_WINDOW_RULESET_VERSION,
    dealId: text(source.dealId, 160),
    recommendationId: text(source.recommendationId, 320),
    basisType: bases.has(source.basisType) ? source.basisType : PRIORITIZATION_BASIS_TYPES.UNAVAILABLE,
    evaluationState: windowType === ACTION_WINDOW_TYPES.UNAVAILABLE ? "unavailable" : "evaluated",
    windowType,
    displayLabel: windowType === ACTION_WINDOW_TYPES.UNAVAILABLE ? "Unavailable" : display(windowType),
    explanation: text(source.explanation, 720),
    sourceDueTimestamp: normalizeDecisionTimestamp(source.sourceDueTimestamp),
    sourceExpirationTimestamp: normalizeDecisionTimestamp(source.sourceExpirationTimestamp),
    sourceEventTimestamp: normalizeDecisionTimestamp(source.sourceEventTimestamp),
    policyDerived: source.policyDerived === true,
    evidenceIds: strings(source.evidenceIds),
    missingInformationIds: strings(source.missingInformationIds),
    conflictIds: strings(source.conflictIds),
    approvalReferenceIds: strings(source.approvalReferenceIds),
    targetSection: text(source.targetSection, 80),
    evaluatedTimestamp: normalizeDecisionTimestamp(source.evaluatedTimestamp),
    warnings: strings(source.warnings, PRIORITIZATION_LIMITS.WARNINGS),
    operatorDisclaimer: ACTION_WINDOW_DISCLAIMER,
  };
}

export function validateCostOfDelayResult(value) {
  const normalized = normalizeCostOfDelayResult(value);
  const errors = [];
  if (!normalized.resultId) errors.push("A Cost of Delay result ID is required.");
  if (!normalized.evaluatedTimestamp) errors.push("A supplied evaluation timestamp is required.");
  return { valid: errors.length === 0, errors, normalized };
}

export function validateRecommendedActionWindowResult(value) {
  const normalized = normalizeRecommendedActionWindowResult(value);
  const errors = [];
  if (!normalized.windowId) errors.push("A Recommended Action Window ID is required.");
  if (!normalized.evaluatedTimestamp) errors.push("A supplied evaluation timestamp is required.");
  return { valid: errors.length === 0, errors, normalized };
}
