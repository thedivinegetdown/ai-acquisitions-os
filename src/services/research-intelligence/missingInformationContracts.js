import { normalizeDecisionTimestamp } from "../decision-intelligence/decisionContracts";
import { compactText, uniqueStrings } from "../../utils/text";

// Distinct responsibility: define and normalize the versioned, provider-neutral
// Missing Information language without reading records or choosing requirements.
export const MISSING_INFORMATION_CONTRACT_VERSION =
  "missing-information-contract-v1";
export const MISSING_INFORMATION_RULESET_VERSION =
  "missing-information-detection-v1";

export const INFORMATION_STATES = Object.freeze({
  PRESENT: "present",
  MISSING: "missing",
  UNKNOWN: "unknown",
  UNVERIFIED: "unverified",
  CONFLICTING: "conflicting",
  STALE: "stale",
  UNAVAILABLE: "unavailable",
  NOT_APPLICABLE: "not-applicable",
});

export const MISSING_INFORMATION_CRITICALITIES = Object.freeze({
  BLOCKING: "blocking",
  ADVISORY: "advisory",
  INFORMATIONAL: "informational",
});

export const MISSING_INFORMATION_SCOPES = Object.freeze({
  IDENTIFICATION: "identification",
  SELLER_OUTREACH: "seller-outreach",
  DECISION_REVIEW: "decision-review",
  UNDERWRITING: "underwriting",
  OFFER_READINESS: "offer-readiness",
  RISK_REVIEW: "risk-review",
  LEGAL_OR_TITLE_REVIEW: "legal-or-title-review",
  BUILDABILITY_REVIEW: "buildability-review",
  BUYER_MATCHING: "buyer-matching",
  CLOSING: "closing",
});

export const VALUE_PRESENCE_POLICIES = Object.freeze({
  NON_EMPTY_TEXT: "non-empty-text",
  ANY_FINITE_NUMBER: "any-finite-number",
  POSITIVE_NUMBER: "positive-number",
  BOOLEAN_INCLUDING_FALSE: "boolean-including-false",
  VALID_DATE: "valid-date",
  NON_EMPTY_COLLECTION: "non-empty-collection",
  EXPLICIT_KNOWN_STATUS: "explicit-known-status-value",
  EVIDENCE_BACKED_VALUE: "evidence-backed-value",
  LEGACY_COMPATIBILITY_VALUE: "legacy-compatibility-value",
});

export const MISSING_INFORMATION_ACTION_TYPES = Object.freeze({
  ASK_SELLER: "ask-seller",
  RESEARCH_PROPERTY: "research-property",
  REVIEW_DOCUMENTS: "review-documents",
  CLASSIFY_ASSET: "classify-asset",
  REVIEW_CONFLICT: "review-conflict",
  OPEN_EXISTING_CONTEXT: "open-existing-context",
  MANUAL_REVIEW: "manual-review",
});

export const STRATEGY_LIMITATION_TYPES = Object.freeze({
  STRATEGY_NOT_IMPLEMENTED: "strategy-not-implemented",
  STRATEGY_DEFERRED: "strategy-deferred",
  CAPABILITY_BLOCKED: "capability-blocked",
  PROVIDER_UNAVAILABLE: "provider-unavailable",
  UNSUPPORTED_ASSET_TYPE: "unsupported-asset-type",
});

export const MISSING_INFORMATION_LIMITS = Object.freeze({
  PROFILES: 8,
  REQUIREMENTS_PER_PROFILE: 80,
  ITEMS: 100,
  REFERENCES: 24,
  ACTIONS: 8,
  WARNINGS: 10,
});

const STATES = new Set(Object.values(INFORMATION_STATES));
const CRITICALITIES = new Set(
  Object.values(MISSING_INFORMATION_CRITICALITIES)
);
const SCOPES = new Set(Object.values(MISSING_INFORMATION_SCOPES));
const POLICIES = new Set(Object.values(VALUE_PRESENCE_POLICIES));
const ACTION_TYPES = new Set(
  Object.values(MISSING_INFORMATION_ACTION_TYPES)
);
const LIMITATION_TYPES = new Set(Object.values(STRATEGY_LIMITATION_TYPES));
const DECISION_ROOM_SECTIONS = new Set([
  "decision",
  "seller",
  "property",
  "numbers",
  "communication",
  "activity",
  "documents",
  "closing",
]);
const UNKNOWN_TEXT_VALUES = new Set([
  "unknown",
  "not sure",
  "unsure",
  "tbd",
  "n/a",
  "na",
]);

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function safeText(value, maximum = 320) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const text = compactText(String(value));
  if (text.length <= maximum) return text;
  return `${text.slice(0, maximum - 3).trimEnd()}...`;
}

function nullableText(value, maximum) {
  return safeText(value, maximum) || null;
}

function normalizeStrings(values, limit = MISSING_INFORMATION_LIMITS.REFERENCES) {
  const source = Array.isArray(values) ? values : values ? [values] : [];
  return uniqueStrings(source.map((value) => safeText(value))).slice(0, limit);
}

function normalizeWarnings(values) {
  return normalizeStrings(values, MISSING_INFORMATION_LIMITS.WARNINGS);
}

function isUnknownText(value) {
  return (
    typeof value === "string" &&
    UNKNOWN_TEXT_VALUES.has(compactText(value).toLowerCase())
  );
}

function missingResult(state = INFORMATION_STATES.MISSING) {
  return { present: false, state };
}

export function evaluateValuePresence(policy, value, options = {}) {
  if (options.applicable === false) {
    return missingResult(INFORMATION_STATES.NOT_APPLICABLE);
  }
  if (options.available === false) {
    return missingResult(INFORMATION_STATES.UNAVAILABLE);
  }
  if (isUnknownText(value)) {
    return missingResult(INFORMATION_STATES.UNKNOWN);
  }

  const selectedPolicy = POLICIES.has(policy)
    ? policy
    : VALUE_PRESENCE_POLICIES.NON_EMPTY_TEXT;

  if (selectedPolicy === VALUE_PRESENCE_POLICIES.NON_EMPTY_TEXT) {
    return typeof value === "string" && compactText(value)
      ? { present: true, state: INFORMATION_STATES.PRESENT }
      : missingResult();
  }

  if (
    selectedPolicy === VALUE_PRESENCE_POLICIES.ANY_FINITE_NUMBER ||
    selectedPolicy === VALUE_PRESENCE_POLICIES.POSITIVE_NUMBER
  ) {
    const parsed =
      typeof value === "number"
        ? value
        : typeof value === "string" && compactText(value)
          ? Number(value)
          : Number.NaN;
    const valid =
      Number.isFinite(parsed) &&
      (selectedPolicy !== VALUE_PRESENCE_POLICIES.POSITIVE_NUMBER || parsed > 0);
    return valid
      ? { present: true, state: INFORMATION_STATES.PRESENT }
      : missingResult();
  }

  if (selectedPolicy === VALUE_PRESENCE_POLICIES.BOOLEAN_INCLUDING_FALSE) {
    return typeof value === "boolean"
      ? { present: true, state: INFORMATION_STATES.PRESENT }
      : missingResult();
  }

  if (selectedPolicy === VALUE_PRESENCE_POLICIES.VALID_DATE) {
    const date =
      value instanceof Date
        ? value
        : typeof value === "string" || typeof value === "number"
          ? new Date(value)
          : null;
    return date && Number.isFinite(date.getTime())
      ? { present: true, state: INFORMATION_STATES.PRESENT }
      : missingResult();
  }

  if (selectedPolicy === VALUE_PRESENCE_POLICIES.NON_EMPTY_COLLECTION) {
    const hasEntries =
      (Array.isArray(value) && value.length > 0) ||
      (value instanceof Set && value.size > 0) ||
      (value instanceof Map && value.size > 0);
    return hasEntries
      ? { present: true, state: INFORMATION_STATES.PRESENT }
      : missingResult();
  }

  if (selectedPolicy === VALUE_PRESENCE_POLICIES.EXPLICIT_KNOWN_STATUS) {
    const statusPresent =
      (typeof value === "string" && Boolean(safeText(value, 160))) ||
      (typeof value === "number" && Number.isFinite(value)) ||
      typeof value === "boolean";
    return statusPresent
      ? { present: true, state: INFORMATION_STATES.PRESENT }
      : missingResult();
  }

  if (selectedPolicy === VALUE_PRESENCE_POLICIES.LEGACY_COMPATIBILITY_VALUE) {
    const compatibilityPresent =
      (typeof value === "string" && Boolean(compactText(value))) ||
      (typeof value === "number" && Number.isFinite(value) && value > 0) ||
      value === true ||
      (Boolean(value) && typeof value === "object");
    return compatibilityPresent
      ? { present: true, state: INFORMATION_STATES.PRESENT }
      : missingResult();
  }

  const valueResult = evaluateValuePresence(
    options.valuePolicy || VALUE_PRESENCE_POLICIES.NON_EMPTY_TEXT,
    value,
    { ...options, evidenceReferenceIds: undefined }
  );
  if (!valueResult.present) return valueResult;
  return normalizeStrings(options.evidenceReferenceIds).length
    ? valueResult
    : missingResult(INFORMATION_STATES.UNVERIFIED);
}

export function normalizeMissingInformationAction(value) {
  const source = safeObject(value);
  const actionType = ACTION_TYPES.has(source.actionType)
    ? source.actionType
    : null;
  const actionId = nullableText(source.actionId || source.id, 240);
  const label = nullableText(source.label, 240);
  if (!actionId || !actionType || !label) return null;
  return {
    actionId,
    actionType,
    label,
    explanation: nullableText(source.explanation, 480),
    requirementId: nullableText(source.requirementId, 200),
    targetSection: DECISION_ROOM_SECTIONS.has(source.targetSection)
      ? source.targetSection
      : null,
    sellerQuestion: nullableText(source.sellerQuestion, 480),
    researchGuidance: nullableText(source.researchGuidance, 640),
    enabled: source.enabled !== false,
    disabledReason: nullableText(source.disabledReason, 320),
  };
}

export function normalizeMissingInformationRequirement(value) {
  const source = safeObject(value);
  const requirementId = nullableText(source.requirementId || source.id, 200);
  const label = nullableText(source.label, 240);
  const canonicalField = nullableText(source.canonicalField, 160);
  if (!requirementId || !label || !canonicalField) return null;
  const criticality = CRITICALITIES.has(source.criticality)
    ? source.criticality
    : MISSING_INFORMATION_CRITICALITIES.ADVISORY;

  return {
    requirementId,
    contractVersion: MISSING_INFORMATION_CONTRACT_VERSION,
    profileId: nullableText(source.profileId, 200),
    assetType: nullableText(source.assetType, 120),
    assetSubtype: nullableText(source.assetSubtype, 120),
    canonicalField,
    acceptedFieldAliases: normalizeStrings(
      source.acceptedFieldAliases || source.aliases,
      20
    ),
    label,
    description: nullableText(source.description, 480),
    category: nullableText(source.category, 120) || "Decision",
    criticality,
    blockingBehavior:
      source.blockingBehavior === true ||
      criticality === MISSING_INFORMATION_CRITICALITIES.BLOCKING,
    requiredFor: normalizeStrings(source.requiredFor, 12).filter((scope) =>
      SCOPES.has(scope)
    ),
    valuePresencePolicy: POLICIES.has(source.valuePresencePolicy)
      ? source.valuePresencePolicy
      : VALUE_PRESENCE_POLICIES.NON_EMPTY_TEXT,
    acceptedSourceTypes: normalizeStrings(source.acceptedSourceTypes, 12),
    evidenceRequirement: nullableText(source.evidenceRequirement, 240),
    verificationRequirement: nullableText(
      source.verificationRequirement,
      240
    ),
    sellerAnswerable: source.sellerAnswerable === true,
    sellerQuestion: nullableText(source.sellerQuestion, 480),
    researchRequired: source.researchRequired === true,
    researchGuidance: nullableText(source.researchGuidance, 640),
    relatedSection: DECISION_ROOM_SECTIONS.has(source.relatedSection)
      ? source.relatedSection
      : "decision",
    compatibilityOnly: source.compatibilityOnly === true,
    rulesetVersion:
      nullableText(source.rulesetVersion, 80) ||
      MISSING_INFORMATION_RULESET_VERSION,
    supersessionWarning: nullableText(source.supersessionWarning, 320),
    partialDataWarnings: normalizeWarnings(source.partialDataWarnings),
  };
}

export function normalizeMissingInformationProfile(value) {
  const source = safeObject(value);
  const profileId = nullableText(source.profileId || source.id, 200);
  const label = nullableText(source.label, 240);
  if (!profileId || !label) return null;
  const requirements = (Array.isArray(source.requirements)
    ? source.requirements
    : []
  )
    .map((requirement) =>
      normalizeMissingInformationRequirement({
        ...safeObject(requirement),
        profileId,
      })
    )
    .filter(Boolean)
    .slice(0, MISSING_INFORMATION_LIMITS.REQUIREMENTS_PER_PROFILE);

  return {
    profileId,
    contractVersion: MISSING_INFORMATION_CONTRACT_VERSION,
    profileVersion: nullableText(source.profileVersion, 80) || "v1",
    label,
    description: nullableText(source.description, 480),
    assetType: nullableText(source.assetType, 120),
    assetSubtype: nullableText(source.assetSubtype, 120),
    compatibilityOnly: source.compatibilityOnly === true,
    rulesetVersion:
      nullableText(source.rulesetVersion, 80) ||
      MISSING_INFORMATION_RULESET_VERSION,
    supersessionWarning: nullableText(source.supersessionWarning, 320),
    requirements,
    partialDataWarnings: normalizeWarnings(source.partialDataWarnings),
  };
}

export function validateMissingInformationProfile(value) {
  const profile = normalizeMissingInformationProfile(value);
  const errors = [];
  if (!profile) return { valid: false, errors: ["A profile ID and label are required."], profile: null };
  if (!profile.requirements.length) errors.push("At least one valid requirement is required.");
  const ids = profile.requirements.map((entry) => entry.requirementId);
  if (new Set(ids).size !== ids.length) {
    errors.push("Requirement IDs must be unique within a profile.");
  }
  return { valid: errors.length === 0, errors, profile };
}

export function normalizeMissingInformationItem(value) {
  const source = safeObject(value);
  const requirementId = nullableText(source.requirementId, 200);
  const label = nullableText(source.label, 240);
  if (!requirementId || !label) return null;
  const criticality = CRITICALITIES.has(source.criticality)
    ? source.criticality
    : MISSING_INFORMATION_CRITICALITIES.ADVISORY;
  return {
    itemId: nullableText(source.itemId || source.id, 320),
    requirementId,
    contractVersion: MISSING_INFORMATION_CONTRACT_VERSION,
    dealId: nullableText(source.dealId, 160),
    organizationId: nullableText(source.organizationId, 160),
    tenantId: nullableText(source.tenantId, 160),
    assetType: nullableText(source.assetType, 120),
    strategyId: nullableText(source.strategyId, 160),
    profileId: nullableText(source.profileId, 200),
    canonicalField: nullableText(source.canonicalField, 160),
    label,
    description: nullableText(source.description, 480),
    category: nullableText(source.category, 120) || "Decision",
    state: STATES.has(source.state) ? source.state : INFORMATION_STATES.UNKNOWN,
    criticality,
    blocking:
      source.blocking === true ||
      criticality === MISSING_INFORMATION_CRITICALITIES.BLOCKING,
    currentValueSummary: nullableText(source.currentValueSummary, 320),
    matchedSourceField: nullableText(source.matchedSourceField, 160),
    evidenceReferenceIds: normalizeStrings(source.evidenceReferenceIds),
    evidenceStatus: nullableText(source.evidenceStatus, 80),
    evidenceLimitationCodes: normalizeStrings(source.evidenceLimitationCodes),
    conflictIds: normalizeStrings(source.conflictIds),
    verificationState: nullableText(source.verificationState, 80),
    freshnessState: nullableText(source.freshnessState, 80),
    reason: nullableText(source.reason, 480),
    sellerQuestion: nullableText(source.sellerQuestion, 480),
    researchGuidance: nullableText(source.researchGuidance, 640),
    relatedSection: DECISION_ROOM_SECTIONS.has(source.relatedSection)
      ? source.relatedSection
      : "decision",
    availableActions: (Array.isArray(source.availableActions)
      ? source.availableActions
      : []
    )
      .map(normalizeMissingInformationAction)
      .filter(Boolean)
      .slice(0, MISSING_INFORMATION_LIMITS.ACTIONS),
    rulesetVersion:
      nullableText(source.rulesetVersion, 80) ||
      MISSING_INFORMATION_RULESET_VERSION,
    evaluatedTimestamp: normalizeDecisionTimestamp(source.evaluatedTimestamp),
    sourceTimestamp: normalizeDecisionTimestamp(source.sourceTimestamp),
    compatibilityWarning: nullableText(source.compatibilityWarning, 320),
    partialDataWarnings: normalizeWarnings(source.partialDataWarnings),
  };
}

export function normalizeStrategyLimitation(value) {
  const source = safeObject(value);
  const limitationId = nullableText(source.limitationId || source.id, 240);
  const label = nullableText(source.label, 240);
  const type = LIMITATION_TYPES.has(source.type) ? source.type : null;
  if (!limitationId || !label || !type) return null;
  return {
    limitationId,
    contractVersion: MISSING_INFORMATION_CONTRACT_VERSION,
    type,
    label,
    explanation: nullableText(source.explanation, 480),
    assetType: nullableText(source.assetType, 120),
    strategyId: nullableText(source.strategyId, 160),
    capabilityId: nullableText(source.capabilityId, 160),
    relatedSection: DECISION_ROOM_SECTIONS.has(source.relatedSection)
      ? source.relatedSection
      : "decision",
    evidenceReferenceIds: normalizeStrings(source.evidenceReferenceIds),
    rulesetVersion:
      nullableText(source.rulesetVersion, 80) ||
      MISSING_INFORMATION_RULESET_VERSION,
    partialDataWarnings: normalizeWarnings(source.partialDataWarnings),
  };
}

export function findRequirementById(profiles, requirementId) {
  for (const profile of Array.isArray(profiles) ? profiles : []) {
    const match = profile?.requirements?.find(
      (requirement) => requirement.requirementId === requirementId
    );
    if (match) return match;
  }
  return null;
}
