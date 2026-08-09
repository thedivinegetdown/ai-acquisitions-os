import { normalizeDecisionTimestamp } from "../../decision-intelligence/decisionContracts";
import { compactText, uniqueStrings } from "../../../utils/text";

export const CONFLICT_CONTRACT_VERSION = "conflict-resolution-contract-v1";
export const CONFLICT_RULESET_VERSION = "conflict-detection-ruleset-v1";

export const CONFLICT_STATES = Object.freeze({
  OPEN: "open",
  REVIEW_REQUIRED: "review-required",
  RESOLUTION_PROPOSED: "resolution-proposed",
  RESOLVED: "resolved",
  DISMISSED: "dismissed",
  SUPERSEDED: "superseded",
});

export const CONFLICT_TYPES = Object.freeze({
  VALUE_MISMATCH: "value-mismatch",
  CLASSIFICATION_MISMATCH: "classification-mismatch",
  SOURCE_DISAGREEMENT: "source-disagreement",
  EXPLICIT_CONFLICT: "explicit-conflict",
  DUPLICATE_EQUIVALENT: "duplicate-equivalent",
});

export const CONFLICT_CRITICALITIES = Object.freeze({
  BLOCKING: "blocking",
  ADVISORY: "advisory",
});

export const CONFLICT_COMPARISON_TYPES = Object.freeze({
  TEXT: "normalized-text",
  KNOWN_STATUS: "normalized-known-status",
  NUMBER: "finite-number",
  MONEY: "money",
  DATE: "date",
  BOOLEAN: "boolean",
  ASSET_TYPE: "asset-type",
  PARCEL_IDENTIFIER: "parcel-identifier",
  IDENTIFIER: "explicit-string-identifier",
  TIMELINE: "seller-timeline",
});

export const CONFLICT_ACTION_TYPES = Object.freeze({
  REVIEW_CONFLICT: "review-conflict",
  REVIEW_SOURCE: "review-source",
  REVIEW_DOCUMENTS: "review-documents",
  REVIEW_PROPERTY: "review-property",
  REVIEW_PARCEL: "review-parcel",
  REVIEW_NUMBERS: "review-numbers",
  REVIEW_SELLER: "review-seller",
  REVIEW_COMMUNICATION: "review-communication",
  COLLECT_INFORMATION: "collect-more-information",
  MANUAL_REVIEW: "manual-review",
});

export const CONFLICT_LIMITS = Object.freeze({
  CONFLICTS: 32,
  CANDIDATES: 12,
  REFERENCES: 64,
  WARNINGS: 16,
  PROFILES: 3,
});

const states = new Set(Object.values(CONFLICT_STATES));
const types = new Set(Object.values(CONFLICT_TYPES));
const criticalities = new Set(Object.values(CONFLICT_CRITICALITIES));
const comparisonTypes = new Set(Object.values(CONFLICT_COMPARISON_TYPES));
const actionTypes = new Set(Object.values(CONFLICT_ACTION_TYPES));

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value, max = 240) {
  if (!["string", "number", "boolean"].includes(typeof value)) return null;
  return compactText(String(value)).slice(0, max) || null;
}

function strings(value, limit = CONFLICT_LIMITS.REFERENCES) {
  return uniqueStrings((Array.isArray(value) ? value : []).map((entry) => text(entry, 320)).filter(Boolean)).slice(0, limit);
}

function comparableValue(value) {
  if (["string", "number", "boolean"].includes(typeof value)) return value;
  return null;
}

function distinctComparableValues(candidates) {
  const values = new Map();
  candidates.forEach((candidate) => {
    const key = `${typeof candidate.normalizedComparableValue}:${JSON.stringify(candidate.normalizedComparableValue)}`;
    if (!values.has(key)) values.set(key, candidate.normalizedComparableValue);
  });
  return [...values.values()].slice(0, CONFLICT_LIMITS.CANDIDATES);
}

export function normalizeConflictAction(value) {
  const source = object(value);
  return {
    actionId: text(source.actionId || source.id, 240),
    actionType: actionTypes.has(source.actionType) ? source.actionType : CONFLICT_ACTION_TYPES.MANUAL_REVIEW,
    label: text(source.label, 160) || "Review conflict",
    explanation: text(source.explanation, 320),
    targetSection: text(source.targetSection, 80) || "decision",
    enabled: source.enabled !== false,
  };
}

export function normalizeConflictCandidate(value) {
  const source = object(value);
  const candidateId = text(source.candidateId || source.id, 320);
  const canonicalField = text(source.canonicalField, 160);
  const normalizedComparableValue = comparableValue(source.normalizedComparableValue);
  if (!candidateId || !canonicalField || normalizedComparableValue === null) return null;
  return {
    candidateId,
    canonicalField,
    factId: text(source.factId, 160),
    requirementId: text(source.requirementId, 160),
    rawValueSummary: text(source.rawValueSummary, 240),
    normalizedComparableValue,
    comparisonValueType: comparisonTypes.has(source.comparisonValueType)
      ? source.comparisonValueType
      : CONFLICT_COMPARISON_TYPES.TEXT,
    sourceField: text(source.sourceField, 160),
    sourceSystem: text(source.sourceSystem, 160),
    sourceType: text(source.sourceType, 120),
    sourceRecordId: text(source.sourceRecordId, 200),
    evidenceId: text(source.evidenceId, 320),
    organizationId: text(source.organizationId, 160),
    tenantId: text(source.tenantId, 160),
    sourceTimestamp: normalizeDecisionTimestamp(source.sourceTimestamp),
    observedTimestamp: normalizeDecisionTimestamp(source.observedTimestamp),
    verificationState: text(source.verificationState, 80),
    freshnessState: text(source.freshnessState, 80),
    conflictState: text(source.conflictState, 80),
    extractionMethod: text(source.extractionMethod, 160),
    compatibilityEvidence: source.compatibilityEvidence === true,
    partialDataWarning: text(source.partialDataWarning, 240),
  };
}

export function normalizeConflictResolutionReference(value) {
  const source = object(value);
  const resolutionId = text(source.resolutionId || source.id, 240);
  const conflictId = text(source.conflictId, 320);
  if (!resolutionId || !conflictId) return null;
  return {
    resolutionId,
    conflictId,
    status: states.has(source.status) ? source.status : null,
    selectedCandidateId: text(source.selectedCandidateId, 320),
    canonicalValueSummary: text(source.canonicalValueSummary, 240),
    actorReference: text(source.actorReference, 200),
    reason: text(source.reason, 320),
    approvalReference: text(source.approvalReference, 240),
    evidenceIds: strings(source.evidenceIds),
    decidedTimestamp: normalizeDecisionTimestamp(source.decidedTimestamp),
  };
}

export function normalizeConflictRecord(value) {
  const source = object(value);
  const conflictId = text(source.conflictId || source.id, 320);
  const canonicalField = text(source.canonicalField || source.relatedCanonicalField, 160);
  if (!conflictId || !canonicalField) return null;
  const candidates = (Array.isArray(source.candidateValues) ? source.candidateValues : [])
    .map(normalizeConflictCandidate)
    .filter(Boolean)
    .slice(0, CONFLICT_LIMITS.CANDIDATES);
  const state = states.has(source.state) ? source.state : CONFLICT_STATES.REVIEW_REQUIRED;
  const criticality = criticalities.has(source.criticality)
    ? source.criticality
    : CONFLICT_CRITICALITIES.ADVISORY;
  return {
    conflictId,
    contractVersion: CONFLICT_CONTRACT_VERSION,
    rulesetVersion: CONFLICT_RULESET_VERSION,
    dealId: text(source.dealId, 200),
    organizationId: text(source.organizationId, 160),
    tenantId: text(source.tenantId, 160),
    assetType: text(source.assetType, 120),
    strategyId: text(source.strategyId, 160),
    strategyVersion: text(source.strategyVersion, 120),
    canonicalField,
    relatedCanonicalField: canonicalField,
    factId: text(source.factId, 160),
    requirementIds: strings(source.requirementIds),
    label: text(source.label, 200) || canonicalField,
    description: text(source.description || source.summary, 420),
    summary: text(source.summary || source.description, 320),
    conflictType: types.has(source.conflictType) ? source.conflictType : CONFLICT_TYPES.VALUE_MISMATCH,
    state,
    criticality,
    blocking: criticality === CONFLICT_CRITICALITIES.BLOCKING,
    candidateValues: candidates,
    distinctNormalizedValues: distinctComparableValues(candidates),
    evidenceIds: strings(source.evidenceIds || candidates.map((entry) => entry.evidenceId)),
    evidenceReferenceIds: strings(source.evidenceIds || candidates.map((entry) => entry.evidenceId)),
    affectedMetricIds: strings(source.affectedMetricIds),
    affectedCapabilityIds: strings(source.affectedCapabilityIds),
    relatedSection: text(source.relatedSection, 80) || "decision",
    safeReviewActions: (Array.isArray(source.safeReviewActions) ? source.safeReviewActions : []).map(normalizeConflictAction).slice(0, 8),
    recommendedReviewPath: text(source.recommendedReviewPath, 240),
    explicitResolutionReference: source.explicitResolutionReference
      ? normalizeConflictResolutionReference(source.explicitResolutionReference)
      : null,
    evaluatedTimestamp: normalizeDecisionTimestamp(source.evaluatedTimestamp),
    sourceTimestamps: strings(source.sourceTimestamps, 16),
    warnings: strings(source.warnings, CONFLICT_LIMITS.WARNINGS),
  };
}

export function normalizeConflictReadModel(value) {
  const source = object(value);
  const conflicts = (Array.isArray(source.conflicts) ? source.conflicts : [])
    .map(normalizeConflictRecord)
    .filter(Boolean)
    .slice(0, CONFLICT_LIMITS.CONFLICTS);
  const active = conflicts.filter((entry) => [CONFLICT_STATES.OPEN, CONFLICT_STATES.REVIEW_REQUIRED, CONFLICT_STATES.RESOLUTION_PROPOSED].includes(entry.state));
  return {
    contractVersion: CONFLICT_CONTRACT_VERSION,
    rulesetVersion: CONFLICT_RULESET_VERSION,
    dealId: text(source.dealId, 200),
    organizationId: text(source.organizationId, 160),
    tenantId: text(source.tenantId, 160),
    assetType: text(source.assetType, 120),
    selectedProfiles: strings(source.selectedProfiles, CONFLICT_LIMITS.PROFILES),
    conflicts,
    activeConflicts: active,
    blockingConflicts: active.filter((entry) => entry.blocking),
    advisoryConflicts: active.filter((entry) => !entry.blocking),
    resolvedConflicts: conflicts.filter((entry) => entry.state === CONFLICT_STATES.RESOLVED),
    dismissedConflicts: conflicts.filter((entry) => entry.state === CONFLICT_STATES.DISMISSED),
    highestPriorityConflict: active[0] || null,
    affectedCanonicalFields: strings(active.map((entry) => entry.canonicalField)),
    affectedEvidenceIds: strings(active.flatMap((entry) => entry.evidenceIds)),
    sourceWarnings: strings(source.sourceWarnings, CONFLICT_LIMITS.WARNINGS),
    partialDataWarnings: strings(source.partialDataWarnings, CONFLICT_LIMITS.WARNINGS),
    evaluatedTimestamp: normalizeDecisionTimestamp(source.evaluatedTimestamp),
    counts: {
      open: active.length,
      blocking: active.filter((entry) => entry.blocking).length,
      advisory: active.filter((entry) => !entry.blocking).length,
      resolvedExisting: conflicts.filter((entry) => entry.state === CONFLICT_STATES.RESOLVED).length,
    },
  };
}
