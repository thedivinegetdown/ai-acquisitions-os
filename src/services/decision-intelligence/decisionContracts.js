import { toSafeDate } from "../../utils/dates";
import { compactText, uniqueStrings } from "../../utils/text";

// Distinct responsibility: define and normalize the versioned, provider-neutral
// Decision Intelligence language without evaluating an opportunity.
export const DECISION_CONTRACT_VERSION = "decision-contract-v1";

export const DECISION_LIFECYCLE_STATES = Object.freeze({
  IDENTIFY: "Identify",
  VERIFY: "Verify",
  DECIDE: "Decide",
  ACT: "Act",
  LEARN: "Learn",
});

export const DECISION_LIFECYCLE_ORDER = Object.freeze(
  Object.values(DECISION_LIFECYCLE_STATES)
);

export const DECISION_EVALUATION_STATES = Object.freeze({
  NOT_EVALUATED: "not-evaluated",
  UNAVAILABLE: "unavailable",
  COMPATIBILITY_RESULT: "compatibility-result",
  EVALUATED: "evaluated",
  EXPIRED: "expired",
  SUPERSEDED: "superseded",
});

export const DECISION_SOURCE_MODES = Object.freeze({
  UNKNOWN: "unknown",
  DETERMINISTIC: "deterministic",
  DETERMINISTIC_COMPATIBILITY: "deterministic-compatibility",
  MANUAL: "manual",
  AI_ASSISTED: "ai-assisted",
  LEGACY_COMPATIBILITY: "legacy-compatibility",
});

export const DECISION_METRIC_REGISTRY = Object.freeze([
  { id: "pursuit-score", label: "Pursuit Score" },
  { id: "recommendation-confidence", label: "Recommendation Confidence" },
  { id: "data-completeness", label: "Data Completeness" },
  { id: "data-reliability", label: "Data Reliability" },
  { id: "financial-resilience", label: "Financial Resilience" },
  { id: "deal-effort", label: "Deal Effort Score" },
  { id: "risk-level", label: "Risk Level" },
  { id: "offer-readiness", label: "Offer Readiness" },
  { id: "cost-of-delay", label: "Cost of Delay" },
  { id: "recommended-action-window", label: "Recommended Action Window" },
].map(Object.freeze));

export const DECISION_ACTION_TAXONOMY = Object.freeze({
  NEEDS_REVIEW: "needs-review",
  FOLLOW_UP_SELLER: "follow-up-seller",
  ADD_CONTACT_INFORMATION: "add-contact-information",
  COLLECT_PROPERTY_CONDITION: "collect-property-condition",
  COLLECT_SELLER_MOTIVATION: "collect-seller-motivation",
  COLLECT_SELLER_TIMELINE: "collect-seller-timeline",
  COLLECT_ASKING_PRICE: "collect-asking-price",
  RUN_COMPS: "run-comps",
  PREPARE_OFFER_RANGE: "prepare-offer-range",
});

export const DECISION_EVIDENCE_LIMIT = 24;
export const DECISION_ISSUE_LIMIT = 20;
export const DECISION_WARNING_LIMIT = 10;

const EVALUATION_STATES = new Set(Object.values(DECISION_EVALUATION_STATES));
const LIFECYCLE_STATES = new Set(DECISION_LIFECYCLE_ORDER);
const SOURCE_MODES = new Set(Object.values(DECISION_SOURCE_MODES));
const METRIC_DEFINITIONS = new Map(
  DECISION_METRIC_REGISTRY.map((definition) => [definition.id, definition])
);
const OUTPUT_STATES = new Set([
  DECISION_EVALUATION_STATES.COMPATIBILITY_RESULT,
  DECISION_EVALUATION_STATES.EVALUATED,
  DECISION_EVALUATION_STATES.EXPIRED,
  DECISION_EVALUATION_STATES.SUPERSEDED,
]);

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function safeText(value, maximum = 240) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const text = compactText(String(value));
  if (text.length <= maximum) return text;
  return `${text.slice(0, maximum - 3).trimEnd()}...`;
}

function nullableText(value, maximum) {
  return safeText(value, maximum) || null;
}

export function normalizeDecisionTimestamp(value) {
  return toSafeDate(value)?.toISOString() || null;
}

function normalizeReferenceIds(values, limit = DECISION_ISSUE_LIMIT) {
  return uniqueStrings(Array.isArray(values) ? values.map((value) => safeText(value)) : []).slice(
    0,
    limit
  );
}

function normalizeWarnings(values) {
  const source = Array.isArray(values) ? values : values ? [values] : [];
  return uniqueStrings(source.map((value) => safeText(value))).slice(0, DECISION_WARNING_LIMIT);
}

function normalizeSourceMode(value) {
  return SOURCE_MODES.has(value) ? value : DECISION_SOURCE_MODES.UNKNOWN;
}

function normalizeEvaluationState(value) {
  return EVALUATION_STATES.has(value)
    ? value
    : DECISION_EVALUATION_STATES.NOT_EVALUATED;
}

function normalizeMetricValue(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  return nullableText(value);
}

function identitySegment(value) {
  const text = safeText(value, 160);
  return text ? encodeURIComponent(text) : "";
}

export function createEvidenceReferenceId({
  sourceField,
  sourceRecordId,
  sourceSystem,
  sourceType,
} = {}) {
  const identity = [sourceType, sourceSystem, sourceRecordId]
    .map(identitySegment)
    .filter(Boolean);
  if (identity.length !== 3) return null;
  const field = identitySegment(sourceField) || "record";
  return `evidence:${identity.join(":")}:${field}`;
}

function normalizeProvenanceDetails(value) {
  const source = safeObject(value);
  return Object.fromEntries(
    Object.entries(source)
      .filter(([, entry]) =>
        ["string", "number", "boolean"].includes(typeof entry)
      )
      .slice(0, 12)
      .map(([key, entry]) => [safeText(key, 80), entry])
      .filter(([key]) => Boolean(key))
  );
}

export function normalizeEvidenceReference(value) {
  const source = safeObject(value);
  const sourceType = safeText(source.sourceType, 80);
  const sourceSystem = safeText(source.sourceSystem, 120);
  const sourceRecordId = safeText(source.sourceRecordId, 160);
  if (!sourceType || !sourceSystem || !sourceRecordId) return null;

  const sourceField = nullableText(source.sourceField, 120);
  const evidenceId =
    nullableText(source.evidenceId || source.id, 320) ||
    createEvidenceReferenceId({ sourceField, sourceRecordId, sourceSystem, sourceType });
  if (!evidenceId) return null;

  return {
    evidenceId,
    contractVersion: DECISION_CONTRACT_VERSION,
    sourceType,
    sourceSystem,
    sourceRecordId,
    sourceField,
    sourceTimestamp: normalizeDecisionTimestamp(source.sourceTimestamp),
    observedTimestamp: normalizeDecisionTimestamp(source.observedTimestamp),
    importedTimestamp: normalizeDecisionTimestamp(source.importedTimestamp),
    extractionMethod: nullableText(source.extractionMethod, 120),
    trustLevel: nullableText(source.trustLevel, 80) || "unknown",
    verificationState: nullableText(source.verificationState, 80) || "unknown",
    conflictState: nullableText(source.conflictState, 80) || "unknown",
    freshnessState: nullableText(source.freshnessState, 80) || "unknown",
    relatedCanonicalField: nullableText(source.relatedCanonicalField, 120),
    valueSummary: nullableText(source.valueSummary, 240),
    organizationId: nullableText(source.organizationId, 160),
    tenantId: nullableText(source.tenantId, 160),
    reliabilityLabel: nullableText(source.reliabilityLabel, 120),
    provenanceDetails: normalizeProvenanceDetails(source.provenanceDetails),
    partialDataWarning: nullableText(source.partialDataWarning, 240),
  };
}

export function normalizeRulesetDescriptor(value) {
  const source = safeObject(value);
  return {
    rulesetId: nullableText(source.rulesetId, 160),
    rulesetVersion: nullableText(source.rulesetVersion, 80),
    sourceMode: normalizeSourceMode(source.sourceMode),
    providerName: nullableText(source.providerName, 120),
    modelName: nullableText(source.modelName, 120),
    deterministic: source.deterministic === true,
    compatibility: source.compatibility === true,
    generatedTimestamp: normalizeDecisionTimestamp(source.generatedTimestamp),
    description: nullableText(source.description, 320),
  };
}

export function normalizeDecisionOverrideReference(value) {
  const source = safeObject(value);
  return {
    overrideId: nullableText(source.overrideId || source.id, 240),
    priorDecisionReference: nullableText(source.priorDecisionReference, 240),
    priorRecommendation: source.priorRecommendation || null,
    replacementRecommendation: source.replacementRecommendation || null,
    reason: nullableText(source.reason, 320),
    actor: source.actor || null,
    approvalReference: nullableText(source.approvalReference, 240),
    evidenceReferenceIds: normalizeReferenceIds(source.evidenceReferenceIds),
    requestedTimestamp: normalizeDecisionTimestamp(source.requestedTimestamp),
    decidedTimestamp: normalizeDecisionTimestamp(source.decidedTimestamp),
    status: nullableText(source.status, 80),
  };
}

export function normalizeApprovalRequirement(value) {
  const source = safeObject(value);
  return {
    required: typeof source.required === "boolean" ? source.required : null,
    status: nullableText(source.status, 80) || DECISION_EVALUATION_STATES.NOT_EVALUATED,
    reason: nullableText(source.reason, 320),
    approvalReferenceIds: normalizeReferenceIds(source.approvalReferenceIds),
  };
}

function normalizeActionWindow(value) {
  const source = safeObject(value);
  const normalized = {
    label: nullableText(source.label, 160),
    startTimestamp: normalizeDecisionTimestamp(source.startTimestamp),
    endTimestamp: normalizeDecisionTimestamp(source.endTimestamp),
    dueTimestamp: normalizeDecisionTimestamp(source.dueTimestamp),
  };
  return Object.values(normalized).some(Boolean) ? normalized : null;
}

export function normalizeRecommendation(value) {
  const source = safeObject(value);
  return {
    recommendationId: nullableText(source.recommendationId || source.id, 240),
    contractVersion: DECISION_CONTRACT_VERSION,
    actionCode: nullableText(source.actionCode, 120),
    label: nullableText(source.label, 240),
    explanation: nullableText(source.explanation, 480),
    status: normalizeEvaluationState(source.status),
    sourceMode: normalizeSourceMode(source.sourceMode),
    rulesetVersion: nullableText(source.rulesetVersion, 80),
    evidenceReferenceIds: normalizeReferenceIds(source.evidenceReferenceIds),
    missingInformationIds: normalizeReferenceIds(source.missingInformationIds),
    conflictIds: normalizeReferenceIds(source.conflictIds),
    approvalRequirement: normalizeApprovalRequirement(source.approvalRequirement),
    evaluatedTimestamp: normalizeDecisionTimestamp(source.evaluatedTimestamp),
    expirationTimestamp: normalizeDecisionTimestamp(source.expirationTimestamp),
    actionWindow: normalizeActionWindow(source.actionWindow),
    confidenceReference: nullableText(source.confidenceReference, 240),
    overrideReference: source.overrideReference
      ? normalizeDecisionOverrideReference(source.overrideReference)
      : null,
  };
}

export function normalizeMetricOutput(value) {
  const source = safeObject(value);
  const definition = METRIC_DEFINITIONS.get(safeText(source.metricId, 120));
  if (!definition) return null;

  const evaluationState = normalizeEvaluationState(source.evaluationState);
  const hasOutput = OUTPUT_STATES.has(evaluationState);

  return {
    metricId: definition.id,
    contractVersion: DECISION_CONTRACT_VERSION,
    evaluationState,
    value: hasOutput ? normalizeMetricValue(source.value) : null,
    displayValue: hasOutput ? nullableText(source.displayValue, 160) : null,
    unit: nullableText(source.unit, 80),
    scale: nullableText(source.scale, 120),
    label: definition.label,
    explanation: nullableText(source.explanation, 480),
    inputEvidenceIds: normalizeReferenceIds(source.inputEvidenceIds),
    blockingIssueIds: normalizeReferenceIds(source.blockingIssueIds),
    advisoryIssueIds: normalizeReferenceIds(source.advisoryIssueIds),
    rulesetVersion: nullableText(source.rulesetVersion, 80),
    evaluatedTimestamp: normalizeDecisionTimestamp(source.evaluatedTimestamp),
    expirationTimestamp: normalizeDecisionTimestamp(source.expirationTimestamp),
    sourceMode: normalizeSourceMode(source.sourceMode),
    partialDataWarnings: normalizeWarnings(source.partialDataWarnings),
  };
}

export function normalizeDecisionLifecycle(value) {
  const source = safeObject(value);
  return {
    state: LIFECYCLE_STATES.has(source.state) ? source.state : null,
    reason: nullableText(source.reason, 480),
    evidenceReferenceIds: normalizeReferenceIds(source.evidenceReferenceIds),
    previousState: LIFECYCLE_STATES.has(source.previousState) ? source.previousState : null,
    evaluatedTimestamp: normalizeDecisionTimestamp(source.evaluatedTimestamp),
    rulesetVersion: nullableText(source.rulesetVersion, 80),
  };
}

export function normalizeDecisionIssueReference(value) {
  const source = safeObject(value);
  const issueId = nullableText(source.issueId || source.id, 240);
  const label = nullableText(source.label, 200);
  if (!issueId || !label) return null;

  return {
    issueId,
    label,
    description: nullableText(source.description, 320),
    severity: nullableText(source.severity, 80) || "unknown",
    state: nullableText(source.state, 80) || "open",
    relatedCanonicalField: nullableText(source.relatedCanonicalField, 120),
    evidenceReferenceIds: normalizeReferenceIds(source.evidenceReferenceIds),
    sourceMode: normalizeSourceMode(source.sourceMode),
    rulesetVersion: nullableText(source.rulesetVersion, 80),
  };
}

export function normalizeConflictReference(value) {
  const source = safeObject(value);
  const conflictId = nullableText(source.conflictId || source.id, 240);
  if (!conflictId) return null;

  return {
    conflictId,
    summary: nullableText(source.summary, 320),
    state: nullableText(source.state, 80) || "unresolved",
    relatedCanonicalField: nullableText(source.relatedCanonicalField, 120),
    evidenceReferenceIds: normalizeReferenceIds(source.evidenceReferenceIds),
  };
}

function normalizeEntityReference(value, type) {
  const source = safeObject(value);
  const id = nullableText(source.id, 160);
  const name = nullableText(source.name, 200);
  const address = nullableText(source.address, 240);
  const phone = nullableText(source.phone, 80);
  if (!id && !name && !address && !phone) return null;
  return { id, name, address, phone, type };
}

function normalizeMetricRegistryOutputs(values) {
  const source = Array.isArray(values) ? values : [];
  const byId = new Map(
    source
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => [entry.metricId, entry])
  );

  return DECISION_METRIC_REGISTRY.map((definition) =>
    normalizeMetricOutput(byId.get(definition.id) || { metricId: definition.id })
  );
}

export function normalizeDecisionRecord(value) {
  const source = safeObject(value);
  const assetStrategyIdentifier = nullableText(
    source.assetStrategyIdentifier || source.assetStrategyId,
    160
  );
  const evidenceReferences = (Array.isArray(source.evidenceReferences)
    ? source.evidenceReferences
    : []
  )
    .map(normalizeEvidenceReference)
    .filter(Boolean)
    .slice(0, DECISION_EVIDENCE_LIMIT);

  return {
    decisionId: nullableText(source.decisionId || source.id, 240),
    contractVersion: DECISION_CONTRACT_VERSION,
    organizationId: nullableText(source.organizationId, 160),
    tenantId: nullableText(source.tenantId, 160),
    dealId: nullableText(source.dealId, 160),
    sellerReference: normalizeEntityReference(source.sellerReference, "seller"),
    propertyReference: normalizeEntityReference(source.propertyReference, "property"),
    assetType: nullableText(source.assetType, 120),
    assetStrategyId: assetStrategyIdentifier,
    assetStrategyIdentifier,
    lifecycle: normalizeDecisionLifecycle(source.lifecycle),
    recommendation: normalizeRecommendation(source.recommendation),
    metricOutputs: normalizeMetricRegistryOutputs(source.metricOutputs),
    evidenceReferences,
    missingInformationReferences: (Array.isArray(source.missingInformationReferences)
      ? source.missingInformationReferences
      : []
    )
      .map(normalizeDecisionIssueReference)
      .filter(Boolean)
      .slice(0, DECISION_ISSUE_LIMIT),
    conflictReferences: (Array.isArray(source.conflictReferences)
      ? source.conflictReferences
      : []
    )
      .map(normalizeConflictReference)
      .filter(Boolean)
      .slice(0, DECISION_ISSUE_LIMIT),
    approvalRequirements: (Array.isArray(source.approvalRequirements)
      ? source.approvalRequirements
      : []
    ).map(normalizeApprovalRequirement),
    ruleset: normalizeRulesetDescriptor(source.ruleset),
    evaluatedTimestamp: normalizeDecisionTimestamp(source.evaluatedTimestamp),
    expirationTimestamp: normalizeDecisionTimestamp(source.expirationTimestamp),
    revalidationState: nullableText(source.revalidationState, 80) || "not-evaluated",
    sourceMode: normalizeSourceMode(source.sourceMode),
    partialDataWarnings: normalizeWarnings(source.partialDataWarnings),
    decisionStatus: nullableText(source.decisionStatus, 80),
  };
}

export function validateDecisionRecord(value) {
  const record = normalizeDecisionRecord(value);
  const errors = [];
  if (!record.decisionId) errors.push("Decision ID is required for a canonical decision record.");
  if (!record.dealId) errors.push("Deal ID is required for a canonical decision record.");
  if (!record.lifecycle.state) errors.push("A valid decision lifecycle state is required.");
  if (!record.ruleset.rulesetId || !record.ruleset.rulesetVersion) {
    errors.push("A versioned ruleset descriptor is required.");
  }
  if (record.evidenceReferences.some((entry) => !entry.sourceRecordId)) {
    errors.push("Every evidence reference requires source identity.");
  }
  return { valid: errors.length === 0, errors, record };
}
