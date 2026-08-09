import { normalizeDecisionTimestamp } from "../decisionContracts";
import { compactText, uniqueStrings } from "../../../utils/text";

// Distinct responsibility: define the bounded, provider-neutral language shared
// by every strategy-specific readiness policy and its UI consumers.
export const READINESS_CONTRACT_VERSION = "readiness-gate-contract-v1";

export const READINESS_STATES = Object.freeze({
  NOT_EVALUATED: "not-evaluated",
  UNAVAILABLE: "unavailable",
  NEEDS_INFORMATION: "needs-information",
  NEEDS_VERIFICATION: "needs-verification",
  MANUAL_REVIEW_REQUIRED: "manual-review-required",
  READY_FOR_OFFER_PREPARATION: "ready-for-offer-preparation",
  BLOCKED: "blocked",
});

export const READINESS_GATE_STATES = Object.freeze({
  PASSED: "passed",
  FAILED: "failed",
  PENDING: "pending",
  MANUAL_REVIEW: "manual-review",
  NOT_APPLICABLE: "not-applicable",
  UNAVAILABLE: "unavailable",
});

export const READINESS_CRITICALITIES = Object.freeze({
  BLOCKING: "blocking",
  ADVISORY: "advisory",
});

export const READINESS_GATE_CATEGORIES = Object.freeze({
  ASSET_IDENTITY: "Asset and Identity",
  SELLER_CONTEXT: "Seller Context",
  STRATEGY_ANALYSIS: "Strategy Analysis",
  MARKET_EVIDENCE: "Market Evidence",
  FEASIBILITY: "Property or Parcel Feasibility",
  TITLE_LEGAL: "Title and Legal Review",
  EXECUTION_CONTEXT: "Execution Context",
  APPROVAL: "Approval",
});

export const READINESS_ACTION_TYPES = Object.freeze({
  CLASSIFY_ASSET: "classify-asset",
  COLLECT_INFORMATION: "collect-information",
  VERIFY_INFORMATION: "verify-information",
  REVIEW_PROPERTY: "review-property",
  REVIEW_PARCEL: "review-parcel",
  REVIEW_NUMBERS: "review-numbers",
  REVIEW_MARKET_EVIDENCE: "review-market-evidence",
  REVIEW_DOCUMENTS: "review-documents",
  REVIEW_TITLE_LEGAL: "review-title-or-legal",
  REVIEW_RISK_FEASIBILITY: "review-risk-or-feasibility",
  REQUEST_APPROVAL: "request-approval",
  PREPARE_OFFER_DRAFT: "prepare-offer-draft",
  MANUAL_REVIEW: "manual-review",
});

export const READINESS_OPERATOR_DISCLAIMER =
  "Offer Readiness indicates whether the currently available facts, evidence, strategy analysis, and review conditions support preparing an offer for human review. It is not an instruction to purchase, submit an offer, or bypass required approval, legal review, or underwriting.";

export const READINESS_LIMITS = Object.freeze({
  GATES: 32,
  REFERENCES: 32,
  WARNINGS: 12,
  SOURCE_TIMESTAMPS: 16,
});

const readinessStates = new Set(Object.values(READINESS_STATES));
const gateStates = new Set(Object.values(READINESS_GATE_STATES));
const criticalities = new Set(Object.values(READINESS_CRITICALITIES));
const categories = new Set(Object.values(READINESS_GATE_CATEGORIES));
const actionTypes = new Set(Object.values(READINESS_ACTION_TYPES));

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value, maximum = 480) {
  if (!["string", "number"].includes(typeof value)) return "";
  const result = compactText(String(value));
  return result.length <= maximum ? result : `${result.slice(0, maximum - 3).trimEnd()}...`;
}

function nullable(value, maximum) {
  return text(value, maximum) || null;
}

function references(values, limit = READINESS_LIMITS.REFERENCES) {
  return uniqueStrings((Array.isArray(values) ? values : []).map((value) => text(value, 240))).slice(0, limit);
}

function warnings(values) {
  return references(values, READINESS_LIMITS.WARNINGS);
}

export function normalizeReadinessAction(value) {
  const source = object(value);
  const actionType = actionTypes.has(source.actionType)
    ? source.actionType
    : READINESS_ACTION_TYPES.MANUAL_REVIEW;
  return {
    actionId: nullable(source.actionId || source.id, 240),
    actionType,
    label: nullable(source.label, 200) || "Review readiness",
    explanation: nullable(source.explanation, 480),
    targetSection: nullable(source.targetSection, 80),
    enabled: source.enabled !== false,
    disabledReason: nullable(source.disabledReason, 320),
  };
}

export function normalizeReadinessGateDefinition(value) {
  const source = object(value);
  return {
    gateId: nullable(source.gateId || source.id, 200),
    contractVersion: READINESS_CONTRACT_VERSION,
    strategyId: nullable(source.strategyId, 160),
    strategyVersion: nullable(source.strategyVersion, 120),
    rulesetVersion: nullable(source.rulesetVersion, 120),
    assetType: nullable(source.assetType, 120),
    label: nullable(source.label, 200),
    description: nullable(source.description, 480),
    category: categories.has(source.category) ? source.category : READINESS_GATE_CATEGORIES.STRATEGY_ANALYSIS,
    criticality: criticalities.has(source.criticality) ? source.criticality : READINESS_CRITICALITIES.BLOCKING,
    requiredFactIds: references(source.requiredFactIds),
    requiredMissingInformationIds: references(source.requiredMissingInformationIds),
    requiredEvidenceRequirementIds: references(source.requiredEvidenceRequirementIds),
    requiredStrategyResultPaths: references(source.requiredStrategyResultPaths),
    explicitBlockingConditions: references(source.explicitBlockingConditions),
    manualReviewConditions: references(source.manualReviewConditions),
    advisoryConditions: references(source.advisoryConditions),
    approvalTrigger: nullable(source.approvalTrigger, 160),
    relatedSection: nullable(source.relatedSection, 80) || "decision",
    safeNextActionType: actionTypes.has(source.safeNextActionType)
      ? source.safeNextActionType
      : READINESS_ACTION_TYPES.MANUAL_REVIEW,
    compatibilityWarning: nullable(source.compatibilityWarning, 320),
    operatorExplanation: nullable(source.operatorExplanation, 480),
  };
}

export function normalizeReadinessGateResult(value) {
  const source = object(value);
  const state = gateStates.has(source.evaluationState)
    ? source.evaluationState
    : READINESS_GATE_STATES.UNAVAILABLE;
  return {
    gateId: nullable(source.gateId || source.id, 200),
    strategyId: nullable(source.strategyId, 160),
    strategyVersion: nullable(source.strategyVersion, 120),
    assetType: nullable(source.assetType, 120),
    label: nullable(source.label, 200) || "Readiness gate",
    category: categories.has(source.category) ? source.category : READINESS_GATE_CATEGORIES.STRATEGY_ANALYSIS,
    evaluationState: state,
    criticality: criticalities.has(source.criticality) ? source.criticality : READINESS_CRITICALITIES.BLOCKING,
    passed: typeof source.passed === "boolean" ? source.passed : state === READINESS_GATE_STATES.PASSED ? true : null,
    reason: nullable(source.reason, 480),
    factIds: references(source.factIds),
    evidenceIds: references(source.evidenceIds),
    missingInformationIds: references(source.missingInformationIds),
    conflictIds: references(source.conflictIds),
    staleReferenceIds: references(source.staleReferenceIds),
    unverifiedReferenceIds: references(source.unverifiedReferenceIds),
    relatedSignalIds: references(source.relatedSignalIds),
    approvalRequirement: normalizeApprovalTrigger(source.approvalRequirement),
    relatedSection: nullable(source.relatedSection, 80) || "decision",
    safeNextAction: normalizeReadinessAction(source.safeNextAction),
    evaluatedTimestamp: normalizeDecisionTimestamp(source.evaluatedTimestamp),
    sourceTimestamps: references(
      (Array.isArray(source.sourceTimestamps) ? source.sourceTimestamps : [])
        .map(normalizeDecisionTimestamp)
        .filter(Boolean),
      READINESS_LIMITS.SOURCE_TIMESTAMPS
    ),
    warnings: warnings(source.warnings),
  };
}

export function normalizeApprovalTrigger(value) {
  const source = object(value);
  return {
    required: source.required === true,
    status: nullable(source.status, 80) || "not-evaluated",
    reason: nullable(source.reason, 320),
    triggerReasons: references(source.triggerReasons),
    approvalReferenceIds: references(source.approvalReferenceIds),
  };
}

export function normalizeReadinessResult(value) {
  const source = object(value);
  const gateResults = (Array.isArray(source.gateResults) ? source.gateResults : [])
    .map(normalizeReadinessGateResult)
    .filter((gate) => gate.gateId)
    .slice(0, READINESS_LIMITS.GATES);
  const readinessState = readinessStates.has(source.readinessState)
    ? source.readinessState
    : READINESS_STATES.NOT_EVALUATED;
  return {
    contractVersion: READINESS_CONTRACT_VERSION,
    readinessId: nullable(source.readinessId || source.id, 240),
    dealId: nullable(source.dealId, 160),
    organizationId: nullable(source.organizationId, 160),
    tenantId: nullable(source.tenantId, 160),
    assetType: nullable(source.assetType, 120),
    strategyId: nullable(source.strategyId, 160),
    strategyVersion: nullable(source.strategyVersion, 120),
    strategyLabel: nullable(source.strategyLabel, 200),
    rulesetVersion: nullable(source.rulesetVersion, 120),
    evaluationState: source.evaluationState === "evaluated" ? "evaluated" : "not-evaluated",
    readinessState,
    displayLabel: nullable(source.displayLabel, 160),
    explanation: nullable(source.explanation, 480),
    gateResults,
    blockingGateResults: gateResults.filter((gate) => gate.criticality === READINESS_CRITICALITIES.BLOCKING && ![READINESS_GATE_STATES.PASSED, READINESS_GATE_STATES.NOT_APPLICABLE].includes(gate.evaluationState)),
    advisoryGateResults: gateResults.filter((gate) => gate.criticality === READINESS_CRITICALITIES.ADVISORY && gate.evaluationState !== READINESS_GATE_STATES.PASSED),
    passedGateResults: gateResults.filter((gate) => gate.evaluationState === READINESS_GATE_STATES.PASSED),
    failedGateResults: gateResults.filter((gate) => gate.evaluationState === READINESS_GATE_STATES.FAILED),
    manualReviewGates: gateResults.filter((gate) => gate.evaluationState === READINESS_GATE_STATES.MANUAL_REVIEW),
    pendingGates: gateResults.filter((gate) => gate.evaluationState === READINESS_GATE_STATES.PENDING),
    evidenceIds: references(source.evidenceIds || gateResults.flatMap((gate) => gate.evidenceIds)),
    missingInformationIds: references(source.missingInformationIds || gateResults.flatMap((gate) => gate.missingInformationIds)),
    conflictIds: references(source.conflictIds || gateResults.flatMap((gate) => gate.conflictIds)),
    approvalRequirement: normalizeApprovalTrigger(source.approvalRequirement),
    recommendedNextAction: normalizeReadinessAction(source.recommendedNextAction),
    evaluatedTimestamp: normalizeDecisionTimestamp(source.evaluatedTimestamp),
    sourceMode: "deterministic",
    warnings: warnings(source.warnings || gateResults.flatMap((gate) => gate.warnings)),
    operatorDisclaimer: READINESS_OPERATOR_DISCLAIMER,
  };
}

export function validateReadinessPolicy(value) {
  const source = object(value);
  const definitions = (Array.isArray(source.gates) ? source.gates : []).map(normalizeReadinessGateDefinition);
  const errors = [];
  if (!source.strategyId || !source.strategyVersion || !source.assetType || !source.rulesetVersion) errors.push("Readiness policy identity is incomplete.");
  if (!definitions.length) errors.push("At least one readiness gate is required.");
  if (definitions.some((gate) => !gate.gateId || !gate.label)) errors.push("Every readiness gate requires an ID and label.");
  if (new Set(definitions.map((gate) => gate.gateId)).size !== definitions.length) errors.push("Readiness gate IDs must be unique.");
  return { valid: errors.length === 0, errors, gates: definitions };
}
