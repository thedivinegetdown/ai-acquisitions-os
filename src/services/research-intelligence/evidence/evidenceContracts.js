import { toSafeDate } from "../../../utils/dates";
import { compactText, uniqueStrings } from "../../../utils/text";

export const EVIDENCE_CONTRACT_VERSION = "evidence-provenance-contract-v1";
export const EVIDENCE_RULESET_VERSION = "evidence-provenance-ruleset-v1";

export const EVIDENCE_SOURCE_KINDS = Object.freeze({
  CRM_CURRENT_STATE: "crm-current-state",
  SELLER_STATEMENT: "seller-statement",
  CONVERSATION: "conversation",
  MANUAL_ENTRY: "manual-entry",
  MANUAL_RESEARCH: "manual-research",
  IMPORTED_RECORD: "imported-record",
  DOCUMENT: "document",
  COMPARABLE_SALE: "comparable-sale",
  LAND_COMPARABLE_SALE: "land-comparable-sale",
  PROPERTY_RECORD: "property-record",
  TAX_RECORD: "tax-record",
  TITLE_RECORD: "title-record",
  SURVEY: "survey",
  PLAT: "plat",
  ZONING_RECORD: "zoning-record",
  ENVIRONMENTAL_RECORD: "environmental-record",
  APPROVAL_RECORD: "approval-record",
  WORKFLOW_RECORD: "workflow-record",
  SYSTEM_DERIVED: "system-derived",
  COMPATIBILITY: "compatibility",
  UNKNOWN: "unknown",
});

export const EVIDENCE_RELATIONSHIPS = Object.freeze({
  SUPPORTS: "supports",
  CHALLENGES: "challenges",
  CONTEXTUAL: "contextual",
  UNKNOWN: "unknown",
});

export const EVIDENCE_VERIFICATION_STATES = Object.freeze({
  VERIFIED: "verified",
  UNVERIFIED: "unverified",
  VERIFICATION_REQUIRED: "verification-required",
  NOT_APPLICABLE: "not-applicable",
  UNKNOWN: "unknown",
});

export const EVIDENCE_CONFLICT_STATES = Object.freeze({
  NONE: "none",
  CONFLICTING: "conflicting",
  RESOLVED_EXPLICITLY: "resolved-explicitly",
  UNKNOWN: "unknown",
});

export const EVIDENCE_FRESHNESS_STATES = Object.freeze({
  CURRENT: "current",
  STALE: "stale",
  UNKNOWN: "unknown",
  NOT_APPLICABLE: "not-applicable",
});

export const EVIDENCE_EXTRACTION_METHODS = Object.freeze({
  DIRECT_FIELD: "direct-field",
  SELLER_PROVIDED: "seller-provided",
  MANUAL_ENTRY: "manual-entry",
  MANUAL_RESEARCH: "manual-research",
  IMPORT: "import",
  DOCUMENT_REVIEW: "document-review",
  DETERMINISTIC_DERIVED: "deterministic-derived",
  PROVIDER_IMPORT: "provider-import",
  COMPATIBILITY_ADAPTER: "compatibility-adapter",
  UNKNOWN: "unknown",
});

export const EVIDENCE_STATUSES = Object.freeze({
  USABLE: "usable",
  LIMITED: "limited",
  UNAVAILABLE: "unavailable",
});

export const EVIDENCE_LIMITATION_CODES = Object.freeze({
  MISSING_SOURCE_IDENTITY: "missing-source-identity",
  MISSING_SOURCE_RECORD_ID: "missing-source-record-id",
  MISSING_SOURCE_FIELD: "missing-source-field",
  MISSING_CANONICAL_FIELD: "missing-canonical-field",
  MISSING_EXPLICIT_VALUE: "missing-explicit-value",
  MISSING_SOURCE_TIMESTAMP: "missing-source-timestamp",
  COMPATIBILITY_ONLY: "compatibility-only",
  VERIFICATION_UNKNOWN: "verification-unknown",
  FRESHNESS_UNKNOWN: "freshness-unknown",
  CONFLICTING_EVIDENCE: "conflicting-evidence",
  DERIVED_LINEAGE_INCOMPLETE: "derived-lineage-incomplete",
  TENANT_CONTEXT_MISMATCH: "tenant-context-mismatch",
  MALFORMED_SOURCE: "malformed-source",
});

export const EVIDENCE_SOURCE_IDENTITY_STATES = Object.freeze({
  IDENTIFIED: "identified",
  PARTIALLY_IDENTIFIED: "partially-identified",
  UNIDENTIFIED: "unidentified",
});

export const EVIDENCE_VALUE_TRACEABILITY_STATES = Object.freeze({
  DIRECT: "direct",
  DERIVED: "derived",
  CONTEXTUAL: "contextual",
  UNAVAILABLE: "unavailable",
});

export const EVIDENCE_VERIFICATION_AVAILABILITY = Object.freeze({
  EXPLICIT: "explicit",
  ABSENT: "absent",
});

export const EVIDENCE_TIMESTAMP_AVAILABILITY = Object.freeze({
  SOURCE_TIME_PRESENT: "source-time-present",
  OBSERVATION_TIME_ONLY: "observation-time-only",
  UNAVAILABLE: "unavailable",
});

export const EVIDENCE_LIMITS = Object.freeze({
  RECORDS: 160,
  REFERENCES: 100,
  WARNINGS: 24,
  PROVENANCE_FIELDS: 16,
  TEXT: 320,
  LINEAGE_DEPTH: 8,
  LINEAGE_NODES: 100,
});

const SOURCE_KIND_ALIASES = Object.freeze({
  "crm-current-state": EVIDENCE_SOURCE_KINDS.CRM_CURRENT_STATE,
  "crm-asset-classification": EVIDENCE_SOURCE_KINDS.COMPATIBILITY,
  "crm-residential-fact": EVIDENCE_SOURCE_KINDS.COMPATIBILITY,
  "crm-vacant-land-fact": EVIDENCE_SOURCE_KINDS.COMPATIBILITY,
  "deal-record": EVIDENCE_SOURCE_KINDS.CRM_CURRENT_STATE,
  "seller-statement": EVIDENCE_SOURCE_KINDS.SELLER_STATEMENT,
  "conversation-summary": EVIDENCE_SOURCE_KINDS.CONVERSATION,
  conversation: EVIDENCE_SOURCE_KINDS.CONVERSATION,
  "manual-record": EVIDENCE_SOURCE_KINDS.MANUAL_ENTRY,
  "manual-research": EVIDENCE_SOURCE_KINDS.MANUAL_RESEARCH,
  "persisted-record": EVIDENCE_SOURCE_KINDS.IMPORTED_RECORD,
  "document-record": EVIDENCE_SOURCE_KINDS.DOCUMENT,
  "comparable-sale": EVIDENCE_SOURCE_KINDS.COMPARABLE_SALE,
  "land-comparable-sale": EVIDENCE_SOURCE_KINDS.LAND_COMPARABLE_SALE,
  "vacant-land-comparable": EVIDENCE_SOURCE_KINDS.LAND_COMPARABLE_SALE,
  "parcel-comparable-sale": EVIDENCE_SOURCE_KINDS.LAND_COMPARABLE_SALE,
  "property-record": EVIDENCE_SOURCE_KINDS.PROPERTY_RECORD,
  "tax-record": EVIDENCE_SOURCE_KINDS.TAX_RECORD,
  "title-record": EVIDENCE_SOURCE_KINDS.TITLE_RECORD,
  survey: EVIDENCE_SOURCE_KINDS.SURVEY,
  plat: EVIDENCE_SOURCE_KINDS.PLAT,
  "zoning-record": EVIDENCE_SOURCE_KINDS.ZONING_RECORD,
  "environmental-record": EVIDENCE_SOURCE_KINDS.ENVIRONMENTAL_RECORD,
  "approval-record": EVIDENCE_SOURCE_KINDS.APPROVAL_RECORD,
  "task-record": EVIDENCE_SOURCE_KINDS.WORKFLOW_RECORD,
  "workflow-record": EVIDENCE_SOURCE_KINDS.WORKFLOW_RECORD,
  "system-derived": EVIDENCE_SOURCE_KINDS.SYSTEM_DERIVED,
  "provider-record": EVIDENCE_SOURCE_KINDS.IMPORTED_RECORD,
});

const EXTRACTION_ALIASES = Object.freeze({
  "explicit-field-read": EVIDENCE_EXTRACTION_METHODS.DIRECT_FIELD,
  "compatibility-current-state-read": EVIDENCE_EXTRACTION_METHODS.COMPATIBILITY_ADAPTER,
  "residential-strategy-compatibility-field-adapter": EVIDENCE_EXTRACTION_METHODS.COMPATIBILITY_ADAPTER,
  "vacant-land-strategy-compatibility-field-adapter": EVIDENCE_EXTRACTION_METHODS.COMPATIBILITY_ADAPTER,
  "explicit-field-compatibility-mapping": EVIDENCE_EXTRACTION_METHODS.COMPATIBILITY_ADAPTER,
  "explicit-legacy-field-mapping": EVIDENCE_EXTRACTION_METHODS.COMPATIBILITY_ADAPTER,
  "normalized-conversation-signal": EVIDENCE_EXTRACTION_METHODS.DIRECT_FIELD,
  "task-record-read": EVIDENCE_EXTRACTION_METHODS.DIRECT_FIELD,
  "explicit-land-comparable-price-per-acre": EVIDENCE_EXTRACTION_METHODS.DETERMINISTIC_DERIVED,
  "conflict-alias-comparison": EVIDENCE_EXTRACTION_METHODS.COMPATIBILITY_ADAPTER,
});

const sourceKinds = new Set(Object.values(EVIDENCE_SOURCE_KINDS));
const relationships = new Set(Object.values(EVIDENCE_RELATIONSHIPS));
const verificationStates = new Set(Object.values(EVIDENCE_VERIFICATION_STATES));
const conflictStates = new Set(Object.values(EVIDENCE_CONFLICT_STATES));
const freshnessStates = new Set(Object.values(EVIDENCE_FRESHNESS_STATES));
const extractionMethods = new Set(Object.values(EVIDENCE_EXTRACTION_METHODS));

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value, maximum = EVIDENCE_LIMITS.TEXT) {
  if (!["string", "number", "boolean"].includes(typeof value)) return null;
  return compactText(String(value)).slice(0, maximum) || null;
}

function timestamp(value) {
  return toSafeDate(value)?.toISOString() || null;
}

function references(value, limit = EVIDENCE_LIMITS.REFERENCES) {
  return uniqueStrings((Array.isArray(value) ? value : []).map((entry) => text(entry, 320)).filter(Boolean)).slice(0, limit);
}

function primitive(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return text(value);
  return null;
}

function explicitValue(value, comparisonType) {
  if (comparisonType === "date") return timestamp(value);
  if (["finite-number", "money", "number"].includes(comparisonType)) {
    const numeric = typeof value === "string"
      ? Number(value.replace(/[$,\s]/g, ""))
      : Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (comparisonType === "boolean") return typeof value === "boolean" ? value : null;
  return primitive(value);
}

function provenanceDetails(value) {
  return Object.fromEntries(
    Object.entries(object(value))
      .filter(([, entry]) => ["string", "number", "boolean"].includes(typeof entry))
      .slice(0, EVIDENCE_LIMITS.PROVENANCE_FIELDS)
      .map(([key, entry]) => [text(key, 80), typeof entry === "string" ? text(entry, 240) : entry])
      .filter(([key, entry]) => key && entry !== null)
  );
}

export function normalizeEvidenceSourceKind(value, sourceType) {
  if (sourceKinds.has(value)) return value;
  if (sourceKinds.has(sourceType)) return sourceType;
  return SOURCE_KIND_ALIASES[String(sourceType || "").trim().toLowerCase()] || EVIDENCE_SOURCE_KINDS.UNKNOWN;
}

export function normalizeEvidenceExtractionMethod(value) {
  if (extractionMethods.has(value)) return value;
  return EXTRACTION_ALIASES[String(value || "").trim().toLowerCase()] || EVIDENCE_EXTRACTION_METHODS.UNKNOWN;
}

export function createCanonicalEvidenceId({ sourceField, sourceRecordId, sourceSystem, sourceType } = {}) {
  const identity = [sourceType, sourceSystem, sourceRecordId].map((entry) => text(entry, 160)).filter(Boolean);
  if (identity.length !== 3) return null;
  const encoded = identity.map((entry) => encodeURIComponent(entry));
  return `evidence:${encoded.join(":")}:${encodeURIComponent(text(sourceField, 120) || "record")}`;
}

function qualityDimensions(source) {
  const identifiedCount = [source.sourceType, source.sourceSystem, source.sourceRecordId].filter(Boolean).length;
  const sourceIdentityState = identifiedCount === 3
    ? EVIDENCE_SOURCE_IDENTITY_STATES.IDENTIFIED
    : identifiedCount
      ? EVIDENCE_SOURCE_IDENTITY_STATES.PARTIALLY_IDENTIFIED
      : EVIDENCE_SOURCE_IDENTITY_STATES.UNIDENTIFIED;
  const valueTraceability = source.extractionMethod === EVIDENCE_EXTRACTION_METHODS.DETERMINISTIC_DERIVED
    ? EVIDENCE_VALUE_TRACEABILITY_STATES.DERIVED
    : source.relationship === EVIDENCE_RELATIONSHIPS.CONTEXTUAL
      ? EVIDENCE_VALUE_TRACEABILITY_STATES.CONTEXTUAL
      : source.rawValueSummary !== null || source.normalizedValue !== null
        ? EVIDENCE_VALUE_TRACEABILITY_STATES.DIRECT
        : EVIDENCE_VALUE_TRACEABILITY_STATES.UNAVAILABLE;
  return {
    sourceIdentityState,
    valueTraceability,
    verificationAvailability: source.verificationState === EVIDENCE_VERIFICATION_STATES.UNKNOWN
      ? EVIDENCE_VERIFICATION_AVAILABILITY.ABSENT
      : EVIDENCE_VERIFICATION_AVAILABILITY.EXPLICIT,
    timestampAvailability: source.sourceTimestamp
      ? EVIDENCE_TIMESTAMP_AVAILABILITY.SOURCE_TIME_PRESENT
      : source.observedTimestamp
        ? EVIDENCE_TIMESTAMP_AVAILABILITY.OBSERVATION_TIME_ONLY
        : EVIDENCE_TIMESTAMP_AVAILABILITY.UNAVAILABLE,
  };
}

function limitationCodes(source, quality) {
  return uniqueStrings([
    quality.sourceIdentityState !== EVIDENCE_SOURCE_IDENTITY_STATES.IDENTIFIED ? EVIDENCE_LIMITATION_CODES.MISSING_SOURCE_IDENTITY : null,
    !source.sourceRecordId ? EVIDENCE_LIMITATION_CODES.MISSING_SOURCE_RECORD_ID : null,
    !source.sourceField ? EVIDENCE_LIMITATION_CODES.MISSING_SOURCE_FIELD : null,
    !source.relatedCanonicalField ? EVIDENCE_LIMITATION_CODES.MISSING_CANONICAL_FIELD : null,
    source.rawValueSummary === null && source.normalizedValue === null && source.relationship !== EVIDENCE_RELATIONSHIPS.CONTEXTUAL ? EVIDENCE_LIMITATION_CODES.MISSING_EXPLICIT_VALUE : null,
    !source.sourceTimestamp ? EVIDENCE_LIMITATION_CODES.MISSING_SOURCE_TIMESTAMP : null,
    source.compatibility ? EVIDENCE_LIMITATION_CODES.COMPATIBILITY_ONLY : null,
    source.verificationState === EVIDENCE_VERIFICATION_STATES.UNKNOWN ? EVIDENCE_LIMITATION_CODES.VERIFICATION_UNKNOWN : null,
    source.freshnessState === EVIDENCE_FRESHNESS_STATES.UNKNOWN ? EVIDENCE_LIMITATION_CODES.FRESHNESS_UNKNOWN : null,
    source.conflictState === EVIDENCE_CONFLICT_STATES.CONFLICTING ? EVIDENCE_LIMITATION_CODES.CONFLICTING_EVIDENCE : null,
    source.extractionMethod === EVIDENCE_EXTRACTION_METHODS.DETERMINISTIC_DERIVED && !source.derivedFromEvidenceIds.length ? EVIDENCE_LIMITATION_CODES.DERIVED_LINEAGE_INCOMPLETE : null,
  ].filter(Boolean));
}

function evidenceStatus(source, limitations) {
  if (!source.evidenceId || !source.relatedCanonicalField) return EVIDENCE_STATUSES.UNAVAILABLE;
  if (
    source.compatibility ||
    source.relationship === EVIDENCE_RELATIONSHIPS.CONTEXTUAL ||
    source.relationship === EVIDENCE_RELATIONSHIPS.UNKNOWN ||
    limitations.includes(EVIDENCE_LIMITATION_CODES.MISSING_EXPLICIT_VALUE) ||
    limitations.includes(EVIDENCE_LIMITATION_CODES.MISSING_SOURCE_IDENTITY) ||
    limitations.includes(EVIDENCE_LIMITATION_CODES.MISSING_SOURCE_RECORD_ID)
  ) return EVIDENCE_STATUSES.LIMITED;
  return EVIDENCE_STATUSES.USABLE;
}

export function normalizeCanonicalEvidence(value) {
  const input = object(value);
  const sourceType = text(input.sourceType, 80);
  const sourceSystem = text(input.sourceSystem, 120);
  const sourceRecordId = text(input.sourceRecordId, 160);
  const suppliedEvidenceId = text(input.evidenceId || input.id, 320);
  if (!suppliedEvidenceId && (!sourceType || !sourceSystem || !sourceRecordId)) return null;
  const sourceField = text(input.sourceField, 120);
  const evidenceId = suppliedEvidenceId || createCanonicalEvidenceId({ sourceField, sourceRecordId, sourceSystem, sourceType });
  if (!evidenceId) return null;
  const details = provenanceDetails(input.provenanceDetails);
  const compatibility = input.compatibility === true || input.compatibilityEvidence === true || input.reliabilityLabel === "Compatibility Record" || details.compatibilityCurrentState === true || details.compatibilityMapping === true;
  const parentEvidenceIds = references(input.parentEvidenceIds).filter((id) => id !== evidenceId);
  const derivedFromEvidenceIds = references(input.derivedFromEvidenceIds).filter((id) => id !== evidenceId);
  const comparisonType = text(input.comparisonType, 80);
  const normalized = {
    evidenceId,
    contractVersion: EVIDENCE_CONTRACT_VERSION,
    rulesetVersion: EVIDENCE_RULESET_VERSION,
    sourceKind: normalizeEvidenceSourceKind(input.sourceKind, sourceType),
    sourceType,
    sourceSystem,
    sourceRecordId,
    sourceField,
    relatedCanonicalField: text(input.relatedCanonicalField, 160),
    factId: text(input.factId, 160),
    requirementId: text(input.requirementId, 160),
    rawValueSummary: text(input.rawValueSummary ?? input.valueSummary, 320),
    valueSummary: text(input.rawValueSummary ?? input.valueSummary, 320),
    normalizedValue: explicitValue(input.normalizedValue ?? details.normalizedValue ?? details.canonicalValue ?? details.storedValue, comparisonType),
    comparisonType,
    unit: text(input.unit, 40),
    currency: text(input.currency, 12),
    relationship: relationships.has(input.relationship) ? input.relationship : EVIDENCE_RELATIONSHIPS.UNKNOWN,
    extractionMethod: normalizeEvidenceExtractionMethod(input.extractionMethod),
    sourceTimestamp: timestamp(input.sourceTimestamp),
    observedTimestamp: timestamp(input.observedTimestamp),
    importedTimestamp: timestamp(input.importedTimestamp),
    verificationState: verificationStates.has(input.verificationState) ? input.verificationState : EVIDENCE_VERIFICATION_STATES.UNKNOWN,
    conflictState: conflictStates.has(input.conflictState) ? input.conflictState : EVIDENCE_CONFLICT_STATES.UNKNOWN,
    freshnessState: freshnessStates.has(input.freshnessState) ? input.freshnessState : EVIDENCE_FRESHNESS_STATES.UNKNOWN,
    compatibility,
    organizationId: text(input.organizationId, 160),
    tenantId: text(input.tenantId, 160),
    parentEvidenceIds,
    derivedFromEvidenceIds,
    supportingDocumentIds: references(input.supportingDocumentIds),
    provenanceDetails: details,
    warnings: uniqueStrings([...(Array.isArray(input.warnings) ? input.warnings : []), input.partialDataWarning].map((entry) => text(entry, 320)).filter(Boolean)).slice(0, EVIDENCE_LIMITS.WARNINGS),
    partialDataWarning: text(input.partialDataWarning, 320),
    legacyTrustLevel: text(input.legacyTrustLevel ?? input.trustLevel, 80),
    legacyReliabilityLabel: text(input.legacyReliabilityLabel ?? input.reliabilityLabel, 120),
    trustLevel: text(input.legacyTrustLevel ?? input.trustLevel, 80) || "unknown",
    reliabilityLabel: text(input.legacyReliabilityLabel ?? input.reliabilityLabel, 120),
    legacySourceMetadata: {
      canonical: false,
      trustLevel: text(input.legacyTrustLevel ?? input.trustLevel, 80),
      reliabilityLabel: text(input.legacyReliabilityLabel ?? input.reliabilityLabel, 120),
    },
  };
  const quality = qualityDimensions(normalized);
  const limitations = limitationCodes(normalized, quality);
  return {
    ...normalized,
    provenanceQuality: quality,
    limitationCodes: limitations,
    evidenceStatus: evidenceStatus(normalized, limitations),
  };
}

export function validateCanonicalEvidence(value) {
  const normalized = normalizeCanonicalEvidence(value);
  const errors = [];
  if (!normalized) errors.push("Stable source type, system, and record identity are required.");
  const suppliedId = normalized?.evidenceId;
  if (suppliedId && references(value?.parentEvidenceIds).includes(suppliedId)) errors.push("Evidence cannot parent itself.");
  if (suppliedId && references(value?.derivedFromEvidenceIds).includes(suppliedId)) errors.push("Evidence cannot derive from itself.");
  return { valid: errors.length === 0, errors, normalized };
}
