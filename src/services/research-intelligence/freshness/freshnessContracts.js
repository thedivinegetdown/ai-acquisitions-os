import { toSafeDate } from "../../../utils/dates";
import { compactText, uniqueStrings } from "../../../utils/text";

export const FRESHNESS_CONTRACT_VERSION = "freshness-revalidation-contract-v1";
export const FRESHNESS_RULESET_VERSION = "freshness-revalidation-ruleset-v1";
export const FRESHNESS_POLICY_REGISTRY_VERSION = "freshness-policy-registry-v1";

export const FRESHNESS_STATES = Object.freeze({
  NOT_EVALUATED: "not-evaluated",
  UNKNOWN: "unknown",
  CURRENT: "current",
  REVALIDATION_DUE: "revalidation-due",
  STALE: "stale",
  EXPIRED: "expired",
  NOT_APPLICABLE: "not-applicable",
});

export const REVALIDATION_STATES = Object.freeze({
  NOT_REQUIRED: "not-required",
  DUE: "due",
  REQUIRED: "required",
  UNAVAILABLE: "unavailable",
  NOT_APPLICABLE: "not-applicable",
});

export const FRESHNESS_BASES = Object.freeze({
  EXPLICIT_STATE: "explicit-state",
  SOURCE_TIMESTAMP: "source-timestamp",
  OBSERVED_TIMESTAMP: "observed-timestamp",
  EXPLICIT_STATE_PLUS_TIMESTAMP: "explicit-state-plus-timestamp",
  EXPLICIT_ONLY_NO_TIMESTAMP: "explicit-only-no-timestamp",
  POLICY_NOT_APPLICABLE: "policy-not-applicable",
  UNAVAILABLE: "unavailable",
});

export const FRESHNESS_SIGNAL_TYPES = Object.freeze({
  REVALIDATION_DUE: "revalidation-due",
  REVALIDATION_REQUIRED: "revalidation-required",
  CRITICAL_FACT_REVALIDATION_REQUIRED: "critical-fact-revalidation-required",
  FACT_BECAME_STALE: "fact-became-stale",
  EVIDENCE_EXPIRED: "evidence-expired",
  RECOMMENDATION_SUPPORT_REVALIDATION_REQUIRED: "recommendation-support-revalidation-required",
});

export const FRESHNESS_LIMITS = Object.freeze({
  EVIDENCE_ASSESSMENTS: 160,
  FACT_ASSESSMENTS: 80,
  REFERENCES: 100,
  SIGNALS: 100,
  WARNINGS: 30,
  TEXT: 320,
});

const freshnessStates = new Set(Object.values(FRESHNESS_STATES));
const revalidationStates = new Set(Object.values(REVALIDATION_STATES));
const freshnessBases = new Set(Object.values(FRESHNESS_BASES));
const signalTypes = new Set(Object.values(FRESHNESS_SIGNAL_TYPES));

function text(value, maximum = FRESHNESS_LIMITS.TEXT) {
  if (!["string", "number", "boolean"].includes(typeof value)) return null;
  return compactText(String(value)).slice(0, maximum) || null;
}

function timestamp(value) {
  return toSafeDate(value)?.toISOString() || null;
}

function references(value, limit = FRESHNESS_LIMITS.REFERENCES) {
  return uniqueStrings((Array.isArray(value) ? value : []).map((item) => text(item)).filter(Boolean)).slice(0, limit);
}

export function revalidationStateForFreshness(state) {
  if (state === FRESHNESS_STATES.CURRENT) return REVALIDATION_STATES.NOT_REQUIRED;
  if (state === FRESHNESS_STATES.REVALIDATION_DUE) return REVALIDATION_STATES.DUE;
  if ([FRESHNESS_STATES.STALE, FRESHNESS_STATES.EXPIRED].includes(state)) return REVALIDATION_STATES.REQUIRED;
  if (state === FRESHNESS_STATES.NOT_APPLICABLE) return REVALIDATION_STATES.NOT_APPLICABLE;
  return REVALIDATION_STATES.UNAVAILABLE;
}

export function normalizeEvidenceFreshnessAssessment(source = {}) {
  const state = freshnessStates.has(source.state) ? source.state : FRESHNESS_STATES.UNKNOWN;
  return {
    assessmentId: text(source.assessmentId),
    contractVersion: FRESHNESS_CONTRACT_VERSION,
    rulesetVersion: FRESHNESS_RULESET_VERSION,
    evidenceId: text(source.evidenceId),
    canonicalField: text(source.canonicalField, 160),
    factId: text(source.factId, 160),
    policyId: text(source.policyId, 160),
    policyVersion: text(source.policyVersion, 160),
    state,
    revalidationState: revalidationStates.has(source.revalidationState)
      ? source.revalidationState
      : revalidationStateForFreshness(state),
    basis: freshnessBases.has(source.basis) ? source.basis : FRESHNESS_BASES.UNAVAILABLE,
    selectedTimestamp: timestamp(source.selectedTimestamp),
    timestampSource: text(source.timestampSource, 80),
    evaluatedTimestamp: timestamp(source.evaluatedTimestamp),
    ageDays: Number.isFinite(source.ageDays) && source.ageDays >= 0 ? source.ageDays : null,
    ageMilliseconds: Number.isFinite(source.ageMilliseconds) && source.ageMilliseconds >= 0 ? source.ageMilliseconds : null,
    revalidationDueTimestamp: timestamp(source.revalidationDueTimestamp),
    staleTimestamp: timestamp(source.staleTimestamp),
    expirationTimestamp: timestamp(source.expirationTimestamp),
    policyDerived: source.policyDerived === true,
    explicitOriginalFreshnessState: text(source.explicitOriginalFreshnessState, 80),
    relationship: text(source.relationship, 80),
    evidenceStatus: text(source.evidenceStatus, 80),
    criticality: source.criticality === "blocking" ? "blocking" : "advisory",
    warnings: references(source.warnings, FRESHNESS_LIMITS.WARNINGS),
    limitationCodes: references(source.limitationCodes),
  };
}

export function normalizeFactFreshnessAssessment(source = {}) {
  const state = freshnessStates.has(source.state) ? source.state : FRESHNESS_STATES.UNKNOWN;
  return {
    factFreshnessId: text(source.factFreshnessId),
    contractVersion: FRESHNESS_CONTRACT_VERSION,
    rulesetVersion: FRESHNESS_RULESET_VERSION,
    canonicalField: text(source.canonicalField, 160),
    factId: text(source.factId, 160),
    label: text(source.label, 160),
    assetType: text(source.assetType, 120),
    strategyId: text(source.strategyId, 160),
    strategyVersion: text(source.strategyVersion, 160),
    criticality: source.criticality === "blocking" ? "blocking" : "advisory",
    state,
    revalidationState: revalidationStateForFreshness(state),
    policyId: text(source.policyId, 160),
    policyVersion: text(source.policyVersion, 160),
    evidenceIds: references(source.evidenceIds),
    currentEvidenceIds: references(source.currentEvidenceIds),
    revalidationDueEvidenceIds: references(source.revalidationDueEvidenceIds),
    staleEvidenceIds: references(source.staleEvidenceIds),
    expiredEvidenceIds: references(source.expiredEvidenceIds),
    unknownEvidenceIds: references(source.unknownEvidenceIds),
    selectedSourceTimestamps: references(source.selectedSourceTimestamps),
    ageDays: Number.isFinite(source.ageDays) && source.ageDays >= 0 ? source.ageDays : null,
    oldestRelevantSourceTimestamp: timestamp(source.oldestRelevantSourceTimestamp),
    newestRelevantSourceTimestamp: timestamp(source.newestRelevantSourceTimestamp),
    policyTimestamps: {
      revalidationDueTimestamp: timestamp(source.policyTimestamps?.revalidationDueTimestamp),
      staleTimestamp: timestamp(source.policyTimestamps?.staleTimestamp),
      expirationTimestamp: timestamp(source.policyTimestamps?.expirationTimestamp),
      policyDerived: source.policyTimestamps?.policyDerived === true,
    },
    activeConflictIds: references(source.activeConflictIds),
    missingInformationRequirementIds: references(source.missingInformationRequirementIds),
    explanation: text(source.explanation),
    warnings: references(source.warnings, FRESHNESS_LIMITS.WARNINGS),
    limitationCodes: references(source.limitationCodes),
  };
}

export function normalizeFreshnessSignal(source = {}) {
  if (!signalTypes.has(source.signalType)) return null;
  return {
    signalId: text(source.signalId),
    contractVersion: FRESHNESS_CONTRACT_VERSION,
    rulesetVersion: FRESHNESS_RULESET_VERSION,
    signalType: source.signalType,
    dealId: text(source.dealId, 160),
    canonicalField: text(source.canonicalField, 160),
    recommendationId: text(source.recommendationId, 320),
    policyId: text(source.policyId, 160),
    state: freshnessStates.has(source.state) ? source.state : FRESHNESS_STATES.UNKNOWN,
    criticality: source.criticality === "blocking" ? "blocking" : "advisory",
    evidenceIds: references(source.evidenceIds),
    explanation: text(source.explanation),
  };
}

export function validateFreshnessAssessment(value) {
  const normalized = normalizeEvidenceFreshnessAssessment(value);
  const errors = [];
  if (!normalized.evidenceId) errors.push("Evidence ID is required.");
  if (!normalized.evaluatedTimestamp) errors.push("A supplied evaluation timestamp is required.");
  if (normalized.selectedTimestamp && normalized.evaluatedTimestamp && new Date(normalized.selectedTimestamp) > new Date(normalized.evaluatedTimestamp)) {
    errors.push("A future source timestamp cannot establish current freshness.");
  }
  return { valid: errors.length === 0, errors, normalized };
}
