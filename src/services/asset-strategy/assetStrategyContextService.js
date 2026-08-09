import { getDealAlias } from "../../utils/dealFields";
import { compactText, uniqueStrings } from "../../utils/text";
import {
  DECISION_EVALUATION_STATES,
  normalizeConflictReference,
  normalizeEvidenceReference,
} from "../decision-intelligence/decisionContracts";
import { classifyOpportunityAsset } from "./assetClassificationService";
import {
  ASSET_CLASSIFICATION_SOURCE_KINDS,
  ASSET_CLASSIFICATION_STATES,
  ASSET_STRATEGY_STATUSES,
  ASSET_TYPES,
  evaluateAssetStrategyAnalysisGate,
  getAssetTypeDefinition,
  normalizeAssetClassification,
} from "./assetStrategyContracts";
import {
  RESIDENTIAL_ACQUISITION_STRATEGY,
  RESIDENTIAL_CAPABILITY_STATES,
  RESIDENTIAL_PURSUIT_PROFILE_ID,
  RESIDENTIAL_PURSUIT_RULESET_VERSION,
  RESIDENTIAL_STRATEGY_VERSION,
} from "./residential/residentialStrategyContracts";
import {
  VACANT_LAND_ACQUISITION_STRATEGY,
  VACANT_LAND_CAPABILITY_STATES,
  VACANT_LAND_PURSUIT_PROFILE_ID,
  VACANT_LAND_PURSUIT_RULESET_VERSION,
  VACANT_LAND_STRATEGY_VERSION,
} from "./vacant-land/vacantLandStrategyContracts";

// Distinct responsibility: turn explicit CRM asset fields into one runtime
// strategy context used by Decision Intelligence and capability-aware UI.
export const ASSET_STRATEGY_CONTEXT_VERSION = "asset-strategy-context-v1";

export const ASSET_STRATEGY_SUPPORT_STATES = Object.freeze({
  UNASSIGNED: "unassigned",
  COMPATIBILITY_ONLY: "compatibility-only",
  CONTRACT_READY: "contract-ready",
  IMPLEMENTED: "implemented",
  DEFERRED: "deferred",
  UNSUPPORTED: "unsupported",
});

export const ASSET_CAPABILITY_IDS = Object.freeze({
  CRM: "crm",
  SELLER_CONTEXT: "seller-context",
  COMMUNICATION: "communication",
  TASKS: "tasks",
  ACTIVITY: "activity",
  DOCUMENTS: "documents",
  APPROVALS: "approvals",
  TIMELINE: "timeline",
  ASSIGNMENT: "assignment",
  GENERIC_CLOSEOUT_RECORDS: "generic-closeout-records",
  RESIDENTIAL_PROPERTY_INTELLIGENCE: "residential-property-intelligence",
  RESIDENTIAL_COMPS: "residential-comps",
  RESIDENTIAL_UNDERWRITING: "residential-underwriting",
  RESIDENTIAL_OFFER_READINESS: "residential-offer-readiness",
  RESIDENTIAL_OFFER_GENERATION: "residential-offer-generation",
  RESIDENTIAL_NEGOTIATION_CALCULATIONS:
    "residential-negotiation-calculations",
  RESIDENTIAL_BUYER_MATCHING: "residential-buyer-matching",
  RESIDENTIAL_BUYER_BLAST: "residential-buyer-blast",
  RESIDENTIAL_PURSUIT_SCORING: "residential-pursuit-scoring",
  RESIDENTIAL_RISK_SIGNALS: "residential-risk-signals",
  RESIDENTIAL_EXIT_CANDIDATES: "residential-exit-candidates",
  LAND_FACT_ADAPTATION: "land-fact-adaptation",
  LAND_VALUATION_CONTEXT: "land-valuation-context",
  LAND_FEASIBILITY_SIGNALS: "land-feasibility-signals",
  LAND_PURSUIT_SCORING: "land-pursuit-scoring",
  LAND_EXIT_CANDIDATES: "land-exit-candidates",
  LAND_BUYER_INPUT: "land-buyer-input",
  LAND_COMPARABLES: "land-comparables",
  LAND_BUILDABILITY_REVIEW: "land-buildability-review",
  LAND_OFFER_REVIEW: "land-offer-review",
  LAND_OFFER_READINESS: "land-offer-readiness",
  LAND_AUTONOMOUS_RESEARCH: "land-autonomous-research",
});

export const GENERIC_ASSET_CAPABILITY_IDS = Object.freeze([
  ASSET_CAPABILITY_IDS.CRM,
  ASSET_CAPABILITY_IDS.SELLER_CONTEXT,
  ASSET_CAPABILITY_IDS.COMMUNICATION,
  ASSET_CAPABILITY_IDS.TASKS,
  ASSET_CAPABILITY_IDS.ACTIVITY,
  ASSET_CAPABILITY_IDS.DOCUMENTS,
  ASSET_CAPABILITY_IDS.APPROVALS,
  ASSET_CAPABILITY_IDS.TIMELINE,
  ASSET_CAPABILITY_IDS.ASSIGNMENT,
  ASSET_CAPABILITY_IDS.GENERIC_CLOSEOUT_RECORDS,
]);

export const RESIDENTIAL_COMPATIBILITY_CAPABILITY_IDS = Object.freeze([
  ASSET_CAPABILITY_IDS.RESIDENTIAL_PROPERTY_INTELLIGENCE,
  ASSET_CAPABILITY_IDS.RESIDENTIAL_COMPS,
  ASSET_CAPABILITY_IDS.RESIDENTIAL_UNDERWRITING,
  ASSET_CAPABILITY_IDS.RESIDENTIAL_OFFER_READINESS,
  ASSET_CAPABILITY_IDS.RESIDENTIAL_OFFER_GENERATION,
  ASSET_CAPABILITY_IDS.RESIDENTIAL_NEGOTIATION_CALCULATIONS,
  ASSET_CAPABILITY_IDS.RESIDENTIAL_BUYER_MATCHING,
  ASSET_CAPABILITY_IDS.RESIDENTIAL_BUYER_BLAST,
]);

export const RESIDENTIAL_STRATEGY_CAPABILITY_IDS = Object.freeze([
  ...RESIDENTIAL_COMPATIBILITY_CAPABILITY_IDS,
  ASSET_CAPABILITY_IDS.RESIDENTIAL_PURSUIT_SCORING,
  ASSET_CAPABILITY_IDS.RESIDENTIAL_RISK_SIGNALS,
  ASSET_CAPABILITY_IDS.RESIDENTIAL_EXIT_CANDIDATES,
]);

export const VACANT_LAND_STRATEGY_CAPABILITY_IDS = Object.freeze([
  ASSET_CAPABILITY_IDS.LAND_FACT_ADAPTATION,
  ASSET_CAPABILITY_IDS.LAND_VALUATION_CONTEXT,
  ASSET_CAPABILITY_IDS.LAND_FEASIBILITY_SIGNALS,
  ASSET_CAPABILITY_IDS.LAND_PURSUIT_SCORING,
  ASSET_CAPABILITY_IDS.LAND_EXIT_CANDIDATES,
  ASSET_CAPABILITY_IDS.LAND_BUYER_INPUT,
  ASSET_CAPABILITY_IDS.LAND_COMPARABLES,
  ASSET_CAPABILITY_IDS.LAND_BUILDABILITY_REVIEW,
  ASSET_CAPABILITY_IDS.LAND_OFFER_REVIEW,
  ASSET_CAPABILITY_IDS.LAND_OFFER_READINESS,
  ASSET_CAPABILITY_IDS.LAND_AUTONOMOUS_RESEARCH,
]);

export const ASSET_CAPABILITY_REASON_CODES = Object.freeze({
  GENERIC_AVAILABLE: "generic-capability-available",
  RESIDENTIAL_COMPATIBILITY_AVAILABLE:
    "residential-compatibility-available",
  RESIDENTIAL_STRATEGY_AVAILABLE: "residential-strategy-available",
  RESIDENTIAL_REVIEW_AVAILABLE: "residential-review-available",
  LAND_STRATEGY_AVAILABLE: "land-strategy-available",
  LAND_REVIEW_AVAILABLE: "land-review-available",
  CLASSIFICATION_REQUIRED: "asset-classification-required",
  CLASSIFICATION_REVIEW_REQUIRED: "asset-classification-review-required",
  STRATEGY_NOT_IMPLEMENTED: "asset-strategy-not-implemented",
  STRATEGY_DEFERRED: "asset-strategy-deferred",
  ASSET_UNSUPPORTED: "asset-type-unsupported",
  UNKNOWN_CAPABILITY: "unknown-asset-capability",
});

export const CLASSIFICATION_COMPATIBILITY_WARNING =
  "Stored asset classification is compatibility evidence and has not been independently verified.";

export const RESIDENTIAL_COMPATIBILITY_WARNING =
  "This existing residential capability remains compatibility-only inside Residential Acquisition Strategy v1.";

export const PURSUIT_SCORING_FRAMEWORK_STATUS = Object.freeze({
  frameworkAvailable: true,
  strategyHookContractAvailable: true,
  concreteProfileAvailable: false,
  productionProfileAvailable: false,
  evaluationState: DECISION_EVALUATION_STATES.NOT_EVALUATED,
  explanation:
    "The Pursuit Scoring Framework is available, but no concrete production Asset Strategy scoring profile is implemented.",
});

const GENERIC_CAPABILITIES = new Set(GENERIC_ASSET_CAPABILITY_IDS);
const RESIDENTIAL_CAPABILITIES = new Set(
  RESIDENTIAL_STRATEGY_CAPABILITY_IDS
);
const VACANT_LAND_CAPABILITIES = new Set(VACANT_LAND_STRATEGY_CAPABILITY_IDS);
const CLASSIFICATION_STATES = new Set(
  Object.values(ASSET_CLASSIFICATION_STATES)
);
const SUPPORT_STATES = new Set(Object.values(ASSET_STRATEGY_SUPPORT_STATES));

const CAPABILITY_LABELS = Object.freeze({
  [ASSET_CAPABILITY_IDS.CRM]: "CRM",
  [ASSET_CAPABILITY_IDS.SELLER_CONTEXT]: "seller context",
  [ASSET_CAPABILITY_IDS.COMMUNICATION]: "communication",
  [ASSET_CAPABILITY_IDS.TASKS]: "tasks",
  [ASSET_CAPABILITY_IDS.ACTIVITY]: "activity",
  [ASSET_CAPABILITY_IDS.DOCUMENTS]: "documents",
  [ASSET_CAPABILITY_IDS.APPROVALS]: "approvals",
  [ASSET_CAPABILITY_IDS.TIMELINE]: "timeline",
  [ASSET_CAPABILITY_IDS.ASSIGNMENT]: "assignment",
  [ASSET_CAPABILITY_IDS.GENERIC_CLOSEOUT_RECORDS]:
    "generic closeout records",
  [ASSET_CAPABILITY_IDS.RESIDENTIAL_PROPERTY_INTELLIGENCE]:
    "residential property intelligence",
  [ASSET_CAPABILITY_IDS.RESIDENTIAL_COMPS]: "residential comps",
  [ASSET_CAPABILITY_IDS.RESIDENTIAL_UNDERWRITING]:
    "residential underwriting",
  [ASSET_CAPABILITY_IDS.RESIDENTIAL_OFFER_READINESS]:
    "residential offer readiness",
  [ASSET_CAPABILITY_IDS.RESIDENTIAL_OFFER_GENERATION]:
    "residential offer generation",
  [ASSET_CAPABILITY_IDS.RESIDENTIAL_NEGOTIATION_CALCULATIONS]:
    "residential negotiation calculations",
  [ASSET_CAPABILITY_IDS.RESIDENTIAL_BUYER_MATCHING]:
    "residential buyer matching",
  [ASSET_CAPABILITY_IDS.RESIDENTIAL_BUYER_BLAST]:
    "residential buyer blast",
  [ASSET_CAPABILITY_IDS.RESIDENTIAL_PURSUIT_SCORING]:
    "residential Pursuit Scoring",
  [ASSET_CAPABILITY_IDS.RESIDENTIAL_RISK_SIGNALS]:
    "residential risk signals",
  [ASSET_CAPABILITY_IDS.RESIDENTIAL_EXIT_CANDIDATES]:
    "residential exit-candidate review",
  [ASSET_CAPABILITY_IDS.LAND_FACT_ADAPTATION]: "land fact adaptation",
  [ASSET_CAPABILITY_IDS.LAND_VALUATION_CONTEXT]: "land valuation context",
  [ASSET_CAPABILITY_IDS.LAND_FEASIBILITY_SIGNALS]: "land feasibility signals",
  [ASSET_CAPABILITY_IDS.LAND_PURSUIT_SCORING]: "land Pursuit Scoring",
  [ASSET_CAPABILITY_IDS.LAND_EXIT_CANDIDATES]: "land exit-candidate review",
  [ASSET_CAPABILITY_IDS.LAND_BUYER_INPUT]: "land buyer input",
  [ASSET_CAPABILITY_IDS.LAND_COMPARABLES]: "stored land comparables",
  [ASSET_CAPABILITY_IDS.LAND_BUILDABILITY_REVIEW]: "buildability review",
  [ASSET_CAPABILITY_IDS.LAND_OFFER_REVIEW]: "land offer review",
  [ASSET_CAPABILITY_IDS.LAND_OFFER_READINESS]: "land offer readiness",
  [ASSET_CAPABILITY_IDS.LAND_AUTONOMOUS_RESEARCH]: "autonomous land research",
});

const RESIDENTIAL_CAPABILITY_RUNTIME_STATE = Object.freeze({
  [ASSET_CAPABILITY_IDS.RESIDENTIAL_PROPERTY_INTELLIGENCE]:
    RESIDENTIAL_CAPABILITY_STATES.COMPATIBILITY_ONLY,
  [ASSET_CAPABILITY_IDS.RESIDENTIAL_COMPS]:
    RESIDENTIAL_CAPABILITY_STATES.COMPATIBILITY_ONLY,
  [ASSET_CAPABILITY_IDS.RESIDENTIAL_UNDERWRITING]:
    RESIDENTIAL_CAPABILITY_STATES.IMPLEMENTED,
  [ASSET_CAPABILITY_IDS.RESIDENTIAL_OFFER_READINESS]:
    RESIDENTIAL_CAPABILITY_STATES.IMPLEMENTED,
  [ASSET_CAPABILITY_IDS.RESIDENTIAL_OFFER_GENERATION]:
    RESIDENTIAL_CAPABILITY_STATES.REVIEW_ONLY,
  [ASSET_CAPABILITY_IDS.RESIDENTIAL_NEGOTIATION_CALCULATIONS]:
    RESIDENTIAL_CAPABILITY_STATES.COMPATIBILITY_ONLY,
  [ASSET_CAPABILITY_IDS.RESIDENTIAL_BUYER_MATCHING]:
    RESIDENTIAL_CAPABILITY_STATES.COMPATIBILITY_ONLY,
  [ASSET_CAPABILITY_IDS.RESIDENTIAL_BUYER_BLAST]:
    RESIDENTIAL_CAPABILITY_STATES.REVIEW_ONLY,
  [ASSET_CAPABILITY_IDS.RESIDENTIAL_PURSUIT_SCORING]:
    RESIDENTIAL_CAPABILITY_STATES.IMPLEMENTED,
  [ASSET_CAPABILITY_IDS.RESIDENTIAL_RISK_SIGNALS]:
    RESIDENTIAL_CAPABILITY_STATES.IMPLEMENTED,
  [ASSET_CAPABILITY_IDS.RESIDENTIAL_EXIT_CANDIDATES]:
    RESIDENTIAL_CAPABILITY_STATES.IMPLEMENTED,
});

const VACANT_LAND_CAPABILITY_RUNTIME_STATE = Object.freeze({
  [ASSET_CAPABILITY_IDS.LAND_FACT_ADAPTATION]: VACANT_LAND_CAPABILITY_STATES.IMPLEMENTED,
  [ASSET_CAPABILITY_IDS.LAND_VALUATION_CONTEXT]: VACANT_LAND_CAPABILITY_STATES.IMPLEMENTED,
  [ASSET_CAPABILITY_IDS.LAND_FEASIBILITY_SIGNALS]: VACANT_LAND_CAPABILITY_STATES.IMPLEMENTED,
  [ASSET_CAPABILITY_IDS.LAND_PURSUIT_SCORING]: VACANT_LAND_CAPABILITY_STATES.IMPLEMENTED,
  [ASSET_CAPABILITY_IDS.LAND_EXIT_CANDIDATES]: VACANT_LAND_CAPABILITY_STATES.IMPLEMENTED,
  [ASSET_CAPABILITY_IDS.LAND_BUYER_INPUT]: VACANT_LAND_CAPABILITY_STATES.INPUT_READY,
  [ASSET_CAPABILITY_IDS.LAND_COMPARABLES]: VACANT_LAND_CAPABILITY_STATES.COMPATIBILITY_ONLY,
  [ASSET_CAPABILITY_IDS.LAND_BUILDABILITY_REVIEW]: VACANT_LAND_CAPABILITY_STATES.MANUAL_REVIEW,
  [ASSET_CAPABILITY_IDS.LAND_OFFER_REVIEW]: VACANT_LAND_CAPABILITY_STATES.REVIEW_ONLY,
  [ASSET_CAPABILITY_IDS.LAND_OFFER_READINESS]: VACANT_LAND_CAPABILITY_STATES.IMPLEMENTED,
  [ASSET_CAPABILITY_IDS.LAND_AUTONOMOUS_RESEARCH]: VACANT_LAND_CAPABILITY_STATES.UNAVAILABLE,
});

const SUPPORT_BY_ASSET_TYPE = Object.freeze({
  [ASSET_TYPES.RESIDENTIAL_HOME]: Object.freeze({
    strategyLabel: "Residential Acquisition Strategy v1",
    supportState: ASSET_STRATEGY_SUPPORT_STATES.IMPLEMENTED,
    supportLabel: "Implemented",
    lifecycleStatus: ASSET_STRATEGY_STATUSES.ACTIVE,
    strategyVersion: RESIDENTIAL_STRATEGY_VERSION,
  }),
  [ASSET_TYPES.VACANT_RESIDENTIAL_LAND]: Object.freeze({
    strategyLabel: "Vacant Land Acquisition Strategy v1",
    supportState: ASSET_STRATEGY_SUPPORT_STATES.IMPLEMENTED,
    supportLabel: "Implemented",
    lifecycleStatus: ASSET_STRATEGY_STATUSES.ACTIVE,
    strategyVersion: VACANT_LAND_STRATEGY_VERSION,
  }),
  [ASSET_TYPES.SMALL_MULTIFAMILY]: Object.freeze({
    strategyLabel: "Small Multifamily Strategy",
    supportState: ASSET_STRATEGY_SUPPORT_STATES.CONTRACT_READY,
    supportLabel: "Strategy Not Yet Implemented",
    lifecycleStatus: null,
  }),
  [ASSET_TYPES.MANUFACTURED_HOME]: Object.freeze({
    strategyLabel: "Manufactured Home Strategy",
    supportState: ASSET_STRATEGY_SUPPORT_STATES.DEFERRED,
    supportLabel: "Deferred",
    lifecycleStatus: ASSET_STRATEGY_STATUSES.DEFERRED,
  }),
  [ASSET_TYPES.COMMERCIAL]: Object.freeze({
    strategyLabel: "Commercial Strategy",
    supportState: ASSET_STRATEGY_SUPPORT_STATES.DEFERRED,
    supportLabel: "Deferred",
    lifecycleStatus: ASSET_STRATEGY_STATUSES.DEFERRED,
  }),
});

const FIELD_TIMESTAMP_KEYS = Object.freeze({
  asset_type: ["asset_type_updated_at", "assetTypeUpdatedAt"],
  assetType: ["assetTypeUpdatedAt", "asset_type_updated_at"],
  property_type: ["property_type_updated_at", "propertyTypeUpdatedAt"],
  propertyType: ["propertyTypeUpdatedAt", "property_type_updated_at"],
});

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function safeText(value, maximum = 320) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const text = compactText(String(value));
  if (text.length <= maximum) return text;
  return `${text.slice(0, maximum - 3).trimEnd()}...`;
}

function readField(record, key) {
  try {
    return record?.[key];
  } catch {
    return undefined;
  }
}

function getDealId(deal) {
  try {
    return safeText(getDealAlias(deal, "id"), 160) || null;
  } catch {
    return null;
  }
}

function getRecordContext(deal) {
  return {
    organizationId:
      safeText(
        readField(deal, "organization_id") || readField(deal, "organizationId"),
        160
      ) || null,
    tenantId:
      safeText(readField(deal, "tenant_id") || readField(deal, "tenantId"), 160) ||
      null,
  };
}

function getEvidenceTimestamp(deal, field) {
  const specificKeys = FIELD_TIMESTAMP_KEYS[field] || [];
  for (const key of specificKeys) {
    const value = readField(deal, key);
    if (value) return { timestamp: value, scope: "field" };
  }

  const recordTimestamp =
    readField(deal, "updated_at") || readField(deal, "updatedAt") || null;
  return {
    timestamp: recordTimestamp,
    scope: recordTimestamp ? "record" : "unavailable",
  };
}

function getClassificationLabel(classification) {
  if (classification.state === ASSET_CLASSIFICATION_STATES.CLASSIFIED) {
    return "Classified";
  }
  if (classification.state === ASSET_CLASSIFICATION_STATES.AMBIGUOUS) {
    return "Review Required";
  }
  if (classification.state === ASSET_CLASSIFICATION_STATES.UNSUPPORTED) {
    return "Unsupported Classification";
  }
  return "Classification Required";
}

function getClassificationSourceLabel(sourceKind) {
  if (sourceKind === ASSET_CLASSIFICATION_SOURCE_KINDS.CANONICAL_FIELD) {
    return "Canonical asset field";
  }
  if (sourceKind === ASSET_CLASSIFICATION_SOURCE_KINDS.LEGACY_PROPERTY_TYPE) {
    return "Legacy property type compatibility mapping";
  }
  if (sourceKind === ASSET_CLASSIFICATION_SOURCE_KINDS.MANUAL) {
    return "Manual classification";
  }
  if (sourceKind === ASSET_CLASSIFICATION_SOURCE_KINDS.IMPORT) {
    return "Imported classification";
  }
  return "No classification source";
}

function getUnassignedSupport(classification) {
  if (classification.state === ASSET_CLASSIFICATION_STATES.UNSUPPORTED) {
    return {
      strategyLabel: "No supported strategy selected",
      supportState: ASSET_STRATEGY_SUPPORT_STATES.UNSUPPORTED,
      supportLabel: "Unsupported",
      lifecycleStatus: null,
    };
  }

  return {
    strategyLabel: "No strategy selected",
    supportState: ASSET_STRATEGY_SUPPORT_STATES.UNASSIGNED,
    supportLabel:
      classification.state === ASSET_CLASSIFICATION_STATES.AMBIGUOUS
        ? "Review Required"
        : "Classification Required",
    lifecycleStatus: null,
  };
}

function getStatusSummary(assetTypeLabel, classification, support) {
  if (classification.state === ASSET_CLASSIFICATION_STATES.AMBIGUOUS) {
    return "Asset Type Conflict - Review Required";
  }
  if (classification.state === ASSET_CLASSIFICATION_STATES.UNSUPPORTED) {
    return "Unsupported Asset Type - Review Required";
  }
  if (classification.state !== ASSET_CLASSIFICATION_STATES.CLASSIFIED) {
    return "Asset Type Unknown - Classification Required";
  }
  return `${assetTypeLabel} - ${support.supportLabel}`;
}

function safelyClassifyOpportunity(deal, context) {
  try {
    return classifyOpportunityAsset(deal, context);
  } catch {
    return normalizeAssetClassification({
      organizationId: context.organizationId,
      tenantId: context.tenantId,
      opportunityId: context.opportunityId,
      state: ASSET_CLASSIFICATION_STATES.UNCLASSIFIED,
      reasonCode: "asset-classification-read-failed",
      requiresHumanReview: true,
      partialDataWarnings: [
        "Asset classification could not be read from the current CRM record.",
      ],
    });
  }
}

export function adaptAssetClassificationEvidence({ classification, deal } = {}) {
  const normalizedClassification = normalizeAssetClassification(classification);
  const safeDeal = safeObject(deal);
  const sourceRecordId = normalizedClassification.opportunityId || getDealId(safeDeal);
  if (!sourceRecordId) return [];

  return normalizedClassification.sourceValues
    .map((sourceValue) => {
      const timestamp = getEvidenceTimestamp(safeDeal, sourceValue.field);
      const mappedDefinition = getAssetTypeDefinition(sourceValue.mappedAssetType);
      return normalizeEvidenceReference({
        sourceType: "crm-asset-classification",
        sourceSystem: "Deal record",
        sourceRecordId,
        sourceField: sourceValue.field,
        sourceTimestamp: timestamp.timestamp,
        extractionMethod: sourceValue.mappedAssetType
          ? "explicit-field-compatibility-mapping"
          : "explicit-field-read",
        trustLevel: "unknown",
        verificationState: "unknown",
        conflictState:
          normalizedClassification.state === ASSET_CLASSIFICATION_STATES.AMBIGUOUS
            ? "conflicting"
            : "unknown",
        freshnessState: "unknown",
        relatedCanonicalField: "property.assetType",
        valueSummary: mappedDefinition
          ? `Stored value "${sourceValue.rawValue}" maps to ${mappedDefinition.label}.`
          : `Stored value "${sourceValue.rawValue}" does not map to one canonical asset type.`,
        organizationId: normalizedClassification.organizationId,
        tenantId: normalizedClassification.tenantId,
        reliabilityLabel: "Compatibility Record",
        provenanceDetails: {
          storedValue: sourceValue.rawValue,
          mappedCanonicalAssetType: sourceValue.mappedAssetType || "",
          classificationResolution: sourceValue.resolution || "unknown",
          sourceTimestampScope: timestamp.scope,
          compatibilityMapping: true,
        },
        partialDataWarning: CLASSIFICATION_COMPATIBILITY_WARNING,
      });
    })
    .filter(Boolean);
}

export function buildAssetClassificationConflicts({
  classification,
  evidenceReferences = [],
} = {}) {
  const normalizedClassification = normalizeAssetClassification(classification);
  if (
    normalizedClassification.state !== ASSET_CLASSIFICATION_STATES.AMBIGUOUS ||
    !normalizedClassification.opportunityId
  ) {
    return [];
  }

  const conflictingFields = normalizedClassification.sourceValues
    .map((sourceValue) => sourceValue.field)
    .filter(Boolean);
  const summary =
    normalizedClassification.reasonCode === "conflicting-asset-types"
      ? `Explicit asset classification fields (${conflictingFields.join(", ")}) map to different canonical asset types.`
      : "The stored asset classification is ambiguous and requires human review.";
  const conflict = normalizeConflictReference({
    conflictId: `conflict:deal:${encodeURIComponent(
      normalizedClassification.opportunityId
    )}:asset-classification`,
    summary,
    state: "unresolved",
    relatedCanonicalField: "property.assetType",
    evidenceReferenceIds: evidenceReferences.map(
      (reference) => reference.evidenceId
    ),
  });
  return conflict ? [conflict] : [];
}

function unavailableCapabilityExplanation(context, capabilityLabel) {
  if (
    context.classificationState === ASSET_CLASSIFICATION_STATES.UNCLASSIFIED
  ) {
    return `Classify the asset type before using ${capabilityLabel}. No residential default is applied.`;
  }
  if (
    context.classificationState === ASSET_CLASSIFICATION_STATES.AMBIGUOUS
  ) {
    return `Review the conflicting or ambiguous asset classification before using ${capabilityLabel}.`;
  }
  if (
    context.classificationState === ASSET_CLASSIFICATION_STATES.UNSUPPORTED
  ) {
    return `${capabilityLabel} is unavailable because the stored asset type is unsupported.`;
  }
  if (context.assetType === ASSET_TYPES.VACANT_RESIDENTIAL_LAND) {
    return `Vacant residential land cannot use ${capabilityLabel}. The land strategy is not yet implemented.`;
  }
  if (context.assetType === ASSET_TYPES.SMALL_MULTIFAMILY) {
    return `Small multifamily cannot use single-family ${capabilityLabel}. Its strategy is not yet implemented.`;
  }
  if (context.assetType === ASSET_TYPES.MANUFACTURED_HOME) {
    return `${capabilityLabel} is unavailable because the manufactured-home strategy is deferred.`;
  }
  if (context.assetType === ASSET_TYPES.COMMERCIAL) {
    return `${capabilityLabel} is unavailable because the commercial strategy is deferred.`;
  }
  return `${capabilityLabel} is unavailable for the current asset classification.`;
}

function unavailableCapabilityReason(context) {
  if (
    context.classificationState === ASSET_CLASSIFICATION_STATES.UNCLASSIFIED
  ) {
    return ASSET_CAPABILITY_REASON_CODES.CLASSIFICATION_REQUIRED;
  }
  if (
    context.classificationState === ASSET_CLASSIFICATION_STATES.AMBIGUOUS
  ) {
    return ASSET_CAPABILITY_REASON_CODES.CLASSIFICATION_REVIEW_REQUIRED;
  }
  if (
    context.classificationState === ASSET_CLASSIFICATION_STATES.UNSUPPORTED
  ) {
    return ASSET_CAPABILITY_REASON_CODES.ASSET_UNSUPPORTED;
  }
  if (context.strategySupportState === ASSET_STRATEGY_SUPPORT_STATES.DEFERRED) {
    return ASSET_CAPABILITY_REASON_CODES.STRATEGY_DEFERRED;
  }
  return ASSET_CAPABILITY_REASON_CODES.STRATEGY_NOT_IMPLEMENTED;
}

export function canRunAssetCapability(assetStrategyContext, capabilityId) {
  const context = safeObject(assetStrategyContext);
  const runtimeContext = {
    ...context,
    assetType: getAssetTypeDefinition(context.assetType)?.id || null,
    classificationState: CLASSIFICATION_STATES.has(context.classificationState)
      ? context.classificationState
      : ASSET_CLASSIFICATION_STATES.UNCLASSIFIED,
    strategySupportState: SUPPORT_STATES.has(context.strategySupportState)
      ? context.strategySupportState
      : ASSET_STRATEGY_SUPPORT_STATES.UNASSIGNED,
  };
  const capabilityLabel = CAPABILITY_LABELS[capabilityId] || capabilityId;
  const implementationState =
    RESIDENTIAL_CAPABILITY_RUNTIME_STATE[capabilityId] ||
    VACANT_LAND_CAPABILITY_RUNTIME_STATE[capabilityId] ||
    null;
  const base = {
    capabilityId,
    supportState: runtimeContext.strategySupportState,
    classificationState: runtimeContext.classificationState,
    assetType: runtimeContext.assetType,
    compatibilityOnly:
      implementationState === RESIDENTIAL_CAPABILITY_STATES.COMPATIBILITY_ONLY,
    implementationState,
  };

  if (GENERIC_CAPABILITIES.has(capabilityId)) {
    return {
      ...base,
      allowed: true,
      reasonCode: ASSET_CAPABILITY_REASON_CODES.GENERIC_AVAILABLE,
      explanation: `${capabilityLabel} remains available because it does not require asset-specific analysis.`,
    };
  }

  if (
    !RESIDENTIAL_CAPABILITIES.has(capabilityId) &&
    !VACANT_LAND_CAPABILITIES.has(capabilityId)
  ) {
    return {
      ...base,
      allowed: false,
      reasonCode: ASSET_CAPABILITY_REASON_CODES.UNKNOWN_CAPABILITY,
      explanation: "This capability is not registered in the Asset Strategy runtime taxonomy.",
    };
  }

  const residentialStrategyEligible = Boolean(
    runtimeContext.compatibilityAnalysisEligibility === true &&
      runtimeContext.classificationState ===
        ASSET_CLASSIFICATION_STATES.CLASSIFIED &&
      runtimeContext.assetType === ASSET_TYPES.RESIDENTIAL_HOME &&
      runtimeContext.manualReviewRequired === false &&
      [
        ASSET_STRATEGY_SUPPORT_STATES.COMPATIBILITY_ONLY,
        ASSET_STRATEGY_SUPPORT_STATES.IMPLEMENTED,
      ].includes(runtimeContext.strategySupportState)
  );

  if (residentialStrategyEligible) {
    const compatibilityOnly =
      implementationState ===
      RESIDENTIAL_CAPABILITY_STATES.COMPATIBILITY_ONLY;
    const reviewOnly =
      implementationState === RESIDENTIAL_CAPABILITY_STATES.REVIEW_ONLY;
    return {
      ...base,
      allowed: true,
      reasonCode: compatibilityOnly
        ? ASSET_CAPABILITY_REASON_CODES.RESIDENTIAL_COMPATIBILITY_AVAILABLE
        : reviewOnly
          ? ASSET_CAPABILITY_REASON_CODES.RESIDENTIAL_REVIEW_AVAILABLE
          : ASSET_CAPABILITY_REASON_CODES.RESIDENTIAL_STRATEGY_AVAILABLE,
      explanation: compatibilityOnly
        ? RESIDENTIAL_COMPATIBILITY_WARNING
        : reviewOnly
          ? `${capabilityLabel} is review-only and cannot execute an external action automatically.`
          : `${capabilityLabel} is implemented by Residential Acquisition Strategy v1.`,
    };
  }

  const landStrategyEligible = Boolean(
    runtimeContext.landStrategyEligibility === true &&
      runtimeContext.classificationState === ASSET_CLASSIFICATION_STATES.CLASSIFIED &&
      runtimeContext.assetType === ASSET_TYPES.VACANT_RESIDENTIAL_LAND &&
      runtimeContext.manualReviewRequired === false &&
      runtimeContext.strategySupportState === ASSET_STRATEGY_SUPPORT_STATES.IMPLEMENTED
  );

  if (VACANT_LAND_CAPABILITIES.has(capabilityId) && landStrategyEligible) {
    const reviewOnly = [
      VACANT_LAND_CAPABILITY_STATES.REVIEW_ONLY,
      VACANT_LAND_CAPABILITY_STATES.MANUAL_REVIEW,
    ].includes(implementationState);
    const unavailable =
      implementationState === VACANT_LAND_CAPABILITY_STATES.UNAVAILABLE;
    if (unavailable) {
      return {
        ...base,
        allowed: false,
        reasonCode: ASSET_CAPABILITY_REASON_CODES.STRATEGY_NOT_IMPLEMENTED,
        explanation: `${capabilityLabel} is unavailable in Vacant Land Acquisition Strategy v1.`,
      };
    }
    return {
      ...base,
      allowed: true,
      reasonCode: reviewOnly
        ? ASSET_CAPABILITY_REASON_CODES.LAND_REVIEW_AVAILABLE
        : ASSET_CAPABILITY_REASON_CODES.LAND_STRATEGY_AVAILABLE,
      explanation: reviewOnly
        ? `${capabilityLabel} requires human review and cannot execute an external action automatically.`
        : `${capabilityLabel} is implemented by Vacant Land Acquisition Strategy v1.`,
    };
  }

  return {
    ...base,
    allowed: false,
    reasonCode: unavailableCapabilityReason(runtimeContext),
    explanation: unavailableCapabilityExplanation(
      runtimeContext,
      capabilityLabel
    ),
  };
}

export function buildAssetStrategyContext(deal, options = {}) {
  const safeDeal = safeObject(deal);
  const recordContext = getRecordContext(safeDeal);
  const opportunityId = getDealId(safeDeal);
  let classification = options.classification
    ? normalizeAssetClassification(options.classification)
    : safelyClassifyOpportunity(safeDeal, {
        ...recordContext,
        opportunityId,
      });
  const classificationEvidence = adaptAssetClassificationEvidence({
    classification,
    deal: safeDeal,
  });
  classification = normalizeAssetClassification({
    ...classification,
    evidenceReferenceIds: uniqueStrings([
      ...classification.evidenceReferenceIds,
      ...classificationEvidence.map((reference) => reference.evidenceId),
    ]),
  });
  const classificationConflicts = buildAssetClassificationConflicts({
    classification,
    evidenceReferences: classificationEvidence,
  });
  const assetDefinition = getAssetTypeDefinition(classification.assetType);
  const support = assetDefinition
    ? SUPPORT_BY_ASSET_TYPE[assetDefinition.id]
    : getUnassignedSupport(classification);
  const compatibilityAnalysisEligibility = Boolean(
    classification.state === ASSET_CLASSIFICATION_STATES.CLASSIFIED &&
      classification.assetType === ASSET_TYPES.RESIDENTIAL_HOME &&
      !classification.requiresHumanReview
  );
  const residentialStrategyEligibility = Boolean(
    compatibilityAnalysisEligibility &&
      support.supportState === ASSET_STRATEGY_SUPPORT_STATES.IMPLEMENTED
  );
  const landStrategyEligibility = Boolean(
    classification.state === ASSET_CLASSIFICATION_STATES.CLASSIFIED &&
      classification.assetType === ASSET_TYPES.VACANT_RESIDENTIAL_LAND &&
      !classification.requiresHumanReview &&
      support.supportState === ASSET_STRATEGY_SUPPORT_STATES.IMPLEMENTED
  );
  const pursuitScoring = residentialStrategyEligibility
    ? {
        frameworkAvailable: true,
        strategyHookContractAvailable: true,
        concreteProfileAvailable: true,
        productionProfileAvailable: true,
        profileId: RESIDENTIAL_PURSUIT_PROFILE_ID,
        profileVersion: RESIDENTIAL_PURSUIT_PROFILE_ID,
        rulesetVersion: RESIDENTIAL_PURSUIT_RULESET_VERSION,
        strategyId: assetDefinition?.strategyId || null,
        strategyVersion: RESIDENTIAL_STRATEGY_VERSION,
        evaluationState: DECISION_EVALUATION_STATES.NOT_EVALUATED,
        explanation:
          "Residential Acquisition Strategy v1 supplies an active production Pursuit Scoring profile; evaluation still requires complete evidence-linked factors.",
      }
    : landStrategyEligibility
      ? {
          frameworkAvailable: true,
          strategyHookContractAvailable: true,
          concreteProfileAvailable: true,
          productionProfileAvailable: true,
          profileId: VACANT_LAND_PURSUIT_PROFILE_ID,
          profileVersion: VACANT_LAND_PURSUIT_PROFILE_ID,
          rulesetVersion: VACANT_LAND_PURSUIT_RULESET_VERSION,
          strategyId: assetDefinition?.strategyId || null,
          strategyVersion: VACANT_LAND_STRATEGY_VERSION,
          evaluationState: DECISION_EVALUATION_STATES.NOT_EVALUATED,
          explanation:
            "Vacant Land Acquisition Strategy v1 supplies an active production Pursuit Scoring profile; evaluation still requires complete evidence-linked land factors.",
        }
      : { ...PURSUIT_SCORING_FRAMEWORK_STATUS };
  const sourceWarnings = uniqueStrings([
    ...classification.partialDataWarnings,
    ...(classification.sourceValues.length
      ? [CLASSIFICATION_COMPATIBILITY_WARNING]
      : []),
    ...(classification.sourceValues.length && !classificationEvidence.length
      ? [
          "Classification evidence could not be linked because the opportunity has no stable record identifier.",
        ]
      : []),
  ]).slice(0, 10);
  const baseContext = {
    contextVersion: ASSET_STRATEGY_CONTEXT_VERSION,
    dealId: classification.opportunityId || opportunityId,
    organizationId: classification.organizationId || recordContext.organizationId,
    tenantId: classification.tenantId || recordContext.tenantId,
    classification,
    assetType: classification.assetType,
    assetTypeLabel: assetDefinition
      ? assetDefinition.label
      : classification.state === ASSET_CLASSIFICATION_STATES.AMBIGUOUS
        ? "Asset type conflict"
        : classification.state === ASSET_CLASSIFICATION_STATES.UNSUPPORTED
          ? "Unsupported asset type"
          : "Asset type unknown",
    classificationState: classification.state,
    classificationLabel: getClassificationLabel(classification),
    classificationSource: {
      kind: classification.sourceKind,
      label: getClassificationSourceLabel(classification.sourceKind),
      reasonCode: classification.reasonCode,
      sourceValues: classification.sourceValues,
    },
    classificationEvidence,
    classificationConflicts,
    conflicts: classificationConflicts,
    manualReviewRequired: classification.requiresHumanReview,
    selectedStrategyId: assetDefinition?.strategyId || null,
    strategyLabel: support.strategyLabel,
    strategyLifecycleStatus: support.lifecycleStatus,
    strategyVersion: support.strategyVersion || null,
    strategySupportState: support.supportState,
    strategySupportLabel: support.supportLabel,
    compatibilityAnalysisEligibility,
    residentialStrategyEligibility,
    landStrategyEligibility,
    compatibilityWarning:
      compatibilityAnalysisEligibility && !residentialStrategyEligibility
      ? RESIDENTIAL_COMPATIBILITY_WARNING
      : null,
    pursuitScoring,
    genericCapabilityAvailability: Object.fromEntries(
      GENERIC_ASSET_CAPABILITY_IDS.map((capabilityId) => [capabilityId, true])
    ),
    genericCapabilitiesAvailable: true,
    sourceWarnings,
  };
  const blockedCapabilityReasons = [
    ...RESIDENTIAL_STRATEGY_CAPABILITY_IDS,
    ...VACANT_LAND_STRATEGY_CAPABILITY_IDS,
  ].map(
    (capabilityId) => canRunAssetCapability(baseContext, capabilityId)
  ).filter((result) => !result.allowed);
  const strategyAnalysisGate = evaluateAssetStrategyAnalysisGate({
    classification,
    strategy:
      options.strategyContract ||
      (residentialStrategyEligibility
        ? RESIDENTIAL_ACQUISITION_STRATEGY
        : landStrategyEligibility
          ? VACANT_LAND_ACQUISITION_STRATEGY
        : null),
  });

  return {
    ...baseContext,
    statusSummary: getStatusSummary(
      baseContext.assetTypeLabel,
      classification,
      support
    ),
    blockedCapabilities: blockedCapabilityReasons.map(
      (result) => result.capabilityId
    ),
    blockedCapabilityReasons,
    strategyAnalysisGate,
    decisionIntegrationFields: {
      assetType: classification.assetType,
      assetStrategyIdentifier: assetDefinition?.strategyId || null,
      evidenceReferences: classificationEvidence,
      conflictReferences: classificationConflicts,
      strategyVersion: support.strategyVersion || null,
      pursuitScoring,
      partialDataWarnings: sourceWarnings,
    },
  };
}
