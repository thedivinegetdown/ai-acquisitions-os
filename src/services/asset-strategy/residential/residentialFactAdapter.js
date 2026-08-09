import { DEAL_FIELD_ALIASES } from "../../../utils/dealFields";
import { parseSafeNumber } from "../../../utils/numbers";
import { compactText, uniqueStrings } from "../../../utils/text";
import {
  DECISION_SOURCE_MODES,
  normalizeDecisionTimestamp,
  normalizeEvidenceReference,
} from "../../decision-intelligence/decisionContracts";
import { INFORMATION_STATES } from "../../research-intelligence/missingInformationContracts";
import { ASSET_CLASSIFICATION_STATES, ASSET_TYPES } from "../assetStrategyContracts";
import { normalizeStrategyTimeline } from "../strategyTimeline";
import {
  RESIDENTIAL_FACT_IDS,
  RESIDENTIAL_STRATEGY_ID,
  RESIDENTIAL_STRATEGY_VERSION,
} from "./residentialStrategyContracts";

// Distinct responsibility: adapt stored residential CRM fields into bounded
// normalized facts and compatibility Evidence without performing underwriting.
export const RESIDENTIAL_FACT_ADAPTER_VERSION =
  "residential-fact-adapter-v1";
export const RESIDENTIAL_FACT_LIMIT = 40;
export const RESIDENTIAL_EVIDENCE_LIMIT = 100;

const UNKNOWN_TEXT = new Set(["unknown", "not sure", "unsure", "tbd", "n/a", "na"]);
const NO_REPAIRS_TEXT = new Set([
  "none",
  "no repairs",
  "no repairs needed",
  "no repairs required",
]);
const NO_MORTGAGE_TEXT = new Set([
  "none",
  "no mortgage",
  "paid off",
  "free and clear",
]);
const COMPARABLE_EVIDENCE_TYPES = new Set([
  "comparable-sale",
  "property-comp",
  "residential-comparable-sale",
]);

const FACT_DESCRIPTORS = Object.freeze([
  {
    factId: RESIDENTIAL_FACT_IDS.PROPERTY_IDENTITY,
    canonicalField: "property.identity",
    aliases: DEAL_FIELD_ALIASES.address,
    policy: "text",
  },
  {
    factId: RESIDENTIAL_FACT_IDS.ASKING_PRICE,
    canonicalField: "deal.askingPrice",
    aliases: DEAL_FIELD_ALIASES.askingPrice,
    policy: "positive-number",
  },
  {
    factId: RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
    canonicalField: "property.afterRepairValue",
    aliases: DEAL_FIELD_ALIASES.arv,
    policy: "positive-number",
  },
  {
    factId: RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE,
    canonicalField: "property.repairs",
    aliases: DEAL_FIELD_ALIASES.repairs,
    policy: "repairs",
  },
  {
    factId: RESIDENTIAL_FACT_IDS.SELLER_MOTIVATION,
    canonicalField: "seller.motivation",
    aliases: DEAL_FIELD_ALIASES.motivation,
    policy: "motivation",
  },
  {
    factId: RESIDENTIAL_FACT_IDS.SELLER_TIMELINE,
    canonicalField: "seller.timeline",
    aliases: DEAL_FIELD_ALIASES.timeline,
    policy: "timeline",
  },
  {
    factId: RESIDENTIAL_FACT_IDS.PROPERTY_CONDITION,
    canonicalField: "property.condition",
    aliases: DEAL_FIELD_ALIASES.condition,
    policy: "known-text",
  },
  {
    factId: RESIDENTIAL_FACT_IDS.OCCUPANCY_STATUS,
    canonicalField: "property.occupancy",
    aliases: DEAL_FIELD_ALIASES.occupancy,
    policy: "occupancy",
  },
  {
    factId: RESIDENTIAL_FACT_IDS.MORTGAGE_BALANCE,
    canonicalField: "property.mortgageBalance",
    aliases: DEAL_FIELD_ALIASES.mortgageBalance,
    policy: "non-negative-number",
  },
  {
    factId: RESIDENTIAL_FACT_IDS.MORTGAGE_STATUS,
    canonicalField: "property.mortgageStatus",
    aliases: DEAL_FIELD_ALIASES.mortgageStatus,
    policy: "known-text",
  },
  {
    factId: RESIDENTIAL_FACT_IDS.RENT_ESTIMATE,
    canonicalField: "property.rentEstimate",
    aliases: DEAL_FIELD_ALIASES.rent,
    policy: "positive-number",
  },
  {
    factId: RESIDENTIAL_FACT_IDS.BEDROOMS,
    canonicalField: "property.bedrooms",
    aliases: DEAL_FIELD_ALIASES.bedrooms,
    policy: "positive-number",
  },
  {
    factId: RESIDENTIAL_FACT_IDS.BATHROOMS,
    canonicalField: "property.bathrooms",
    aliases: DEAL_FIELD_ALIASES.bathrooms,
    policy: "positive-number",
  },
  {
    factId: RESIDENTIAL_FACT_IDS.SQUARE_FOOTAGE,
    canonicalField: "property.squareFootage",
    aliases: DEAL_FIELD_ALIASES.squareFootage,
    policy: "positive-number",
  },
  {
    factId: RESIDENTIAL_FACT_IDS.COMPARABLE_SALE_EVIDENCE,
    canonicalField: "property.comparableSales",
    aliases: DEAL_FIELD_ALIASES.comparableSales,
    policy: "collection",
  },
  {
    factId: RESIDENTIAL_FACT_IDS.BUYER_MATCH_EVIDENCE,
    canonicalField: "closing.buyerMatches",
    aliases: DEAL_FIELD_ALIASES.buyerMatches,
    policy: "collection",
  },
  {
    factId: RESIDENTIAL_FACT_IDS.TITLE_AUTHORITY_WARNING,
    canonicalField: "closing.titleAuthorityWarning",
    aliases: ["title_warning", "authority_warning", "seller_authority_warning"],
    policy: "known-text",
  },
  {
    factId: RESIDENTIAL_FACT_IDS.APPROVAL_CONTEXT,
    canonicalField: "decision.approvalContext",
    aliases: ["approval_context", "approval_status"],
    policy: "known-text",
  },
]);

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function readField(record, field) {
  try {
    return { ok: true, value: record?.[field] };
  } catch {
    return { ok: false, value: undefined };
  }
}

function readAliases(record, aliases) {
  let represented = null;
  const warnings = [];
  for (const field of aliases) {
    const read = readField(record, field);
    if (!read.ok) {
      warnings.push(`The stored ${field} field could not be read.`);
      continue;
    }
    if (read.value !== null && read.value !== undefined && read.value !== "") {
      return { field, value: read.value, represented: true, warnings };
    }
    if (!represented && read.value !== undefined) {
      represented = { field, value: read.value };
    }
  }
  return represented
    ? { ...represented, represented: true, warnings }
    : { field: null, value: undefined, represented: false, warnings };
}

function safeText(value) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return compactText(String(value));
}

function normalizedText(value) {
  return safeText(value).toLowerCase();
}

function normalizedTimestamp(value) {
  return normalizeDecisionTimestamp(value);
}

function getRecordId(deal, context) {
  return (
    context?.dealId ||
    safeText(readField(deal, "id").value) ||
    safeText(readField(deal, "deal_id").value) ||
    null
  );
}

function getTenantContext(deal, context) {
  return {
    organizationId:
      context?.organizationId ||
      safeText(readField(deal, "organization_id").value) ||
      safeText(readField(deal, "organizationId").value) ||
      null,
    tenantId:
      context?.tenantId ||
      safeText(readField(deal, "tenant_id").value) ||
      safeText(readField(deal, "tenantId").value) ||
      null,
  };
}

function sourceTimestamp(deal, field) {
  const fieldCandidates = field
    ? [`${field}_updated_at`, `${field}UpdatedAt`]
    : [];
  for (const candidate of fieldCandidates) {
    const timestamp = normalizedTimestamp(readField(deal, candidate).value);
    if (timestamp) return { timestamp, scope: "field" };
  }
  const recordTimestamp = normalizedTimestamp(
    readField(deal, "updated_at").value || readField(deal, "updatedAt").value
  );
  return {
    timestamp: recordTimestamp,
    scope: recordTimestamp ? "record" : "unavailable",
  };
}

function normalizeEvidence(values, tenantContext) {
  const byId = new Map();
  (Array.isArray(values) ? values : [])
    .map(normalizeEvidenceReference)
    .filter(Boolean)
    .filter((entry) => {
      if (
        tenantContext.organizationId &&
        entry.organizationId &&
        tenantContext.organizationId !== entry.organizationId
      ) {
        return false;
      }
      return !(
        tenantContext.tenantId &&
        entry.tenantId &&
        tenantContext.tenantId !== entry.tenantId
      );
    })
    .slice(0, RESIDENTIAL_EVIDENCE_LIMIT)
    .forEach((entry) => {
      if (!byId.has(entry.evidenceId)) byId.set(entry.evidenceId, entry);
    });
  return [...byId.values()];
}

function evidenceForDescriptor(evidence, descriptor) {
  const aliases = new Set(descriptor.aliases);
  const compatibleCanonicalFields = new Set([
    descriptor.canonicalField,
    ...(descriptor.factId === RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE
      ? ["property.arvOrComps"]
      : []),
  ]);
  return evidence.filter(
    (entry) =>
      compatibleCanonicalFields.has(entry.relatedCanonicalField) ||
      (entry.sourceField && aliases.has(entry.sourceField)) ||
      (descriptor.factId === RESIDENTIAL_FACT_IDS.COMPARABLE_SALE_EVIDENCE &&
        COMPARABLE_EVIDENCE_TYPES.has(entry.sourceType))
  );
}

function isCompatibilityEvidence(entry) {
  return Boolean(
    entry?.reliabilityLabel === "Compatibility Record" ||
      entry?.provenanceDetails?.compatibilityCurrentState === true ||
      entry?.provenanceDetails?.compatibilityMapping === true ||
      String(entry?.sourceType || "").includes("compatibility")
  );
}

function hasVerifiedZeroRepairEvidence(evidence) {
  return evidence.some(
    (entry) =>
      entry.verificationState === "verified" &&
      ["property.repairs", "repairs"].includes(
        entry.relatedCanonicalField || entry.sourceField
      )
  );
}

export function normalizeResidentialTimeline(value, evaluatedTimestamp) {
  return normalizeStrategyTimeline(value, evaluatedTimestamp);
}

function basePresence(read) {
  const text = normalizedText(read.value);
  if (!read.represented) return { state: INFORMATION_STATES.MISSING, value: null };
  if (UNKNOWN_TEXT.has(text)) return { state: INFORMATION_STATES.UNKNOWN, value: null };
  return null;
}

function evaluateFactValue(descriptor, read, evidence, evaluatedTimestamp) {
  const absent = basePresence(read);
  if (absent) return absent;
  const numeric = parseSafeNumber(read.value);
  const text = normalizedText(read.value);

  if (descriptor.policy === "positive-number") {
    return numeric !== null && numeric > 0
      ? { state: INFORMATION_STATES.PRESENT, value: numeric }
      : { state: INFORMATION_STATES.UNKNOWN, value: null };
  }
  if (descriptor.policy === "non-negative-number") {
    return numeric !== null && numeric >= 0
      ? { state: INFORMATION_STATES.PRESENT, value: numeric }
      : { state: INFORMATION_STATES.UNKNOWN, value: null };
  }
  if (descriptor.policy === "motivation") {
    return numeric !== null && numeric >= 0 && numeric <= 10
      ? { state: INFORMATION_STATES.PRESENT, value: numeric }
      : { state: INFORMATION_STATES.UNKNOWN, value: null };
  }
  if (descriptor.policy === "repairs") {
    if (NO_REPAIRS_TEXT.has(text) && hasVerifiedZeroRepairEvidence(evidence)) {
      return { state: INFORMATION_STATES.PRESENT, value: 0 };
    }
    if (numeric > 0) return { state: INFORMATION_STATES.PRESENT, value: numeric };
    if (numeric === 0 && hasVerifiedZeroRepairEvidence(evidence)) {
      return { state: INFORMATION_STATES.PRESENT, value: 0 };
    }
    return { state: INFORMATION_STATES.UNKNOWN, value: null };
  }
  if (descriptor.policy === "timeline") {
    const timeline = normalizeResidentialTimeline(read.value, evaluatedTimestamp);
    return { state: timeline.state, value: timeline.days, normalized: timeline };
  }
  if (descriptor.policy === "occupancy") {
    const values = {
      vacant: "vacant",
      "owner occupied": "owner-occupied",
      "owner-occupied": "owner-occupied",
      "tenant occupied": "tenant-occupied",
      "tenant-occupied": "tenant-occupied",
      occupied: "occupied-other",
    };
    return values[text]
      ? { state: INFORMATION_STATES.PRESENT, value: values[text] }
      : { state: INFORMATION_STATES.UNKNOWN, value: null };
  }
  if (descriptor.policy === "collection") {
    const collection = Array.isArray(read.value)
      ? read.value
      : read.value && typeof read.value === "object"
        ? [read.value]
        : [];
    return collection.length
      ? { state: INFORMATION_STATES.PRESENT, value: collection.slice(0, 25) }
      : { state: INFORMATION_STATES.MISSING, value: [] };
  }
  if (descriptor.policy === "known-text") {
    return safeText(read.value)
      ? { state: INFORMATION_STATES.PRESENT, value: safeText(read.value) }
      : { state: INFORMATION_STATES.MISSING, value: null };
  }
  return safeText(read.value)
    ? { state: INFORMATION_STATES.PRESENT, value: safeText(read.value) }
    : { state: INFORMATION_STATES.MISSING, value: null };
}

function explicitEvidenceState(evidence) {
  if (evidence.some((entry) => entry.conflictState === "conflicting")) {
    return INFORMATION_STATES.CONFLICTING;
  }
  if (evidence.some((entry) => entry.freshnessState === "stale")) {
    return INFORMATION_STATES.STALE;
  }
  if (evidence.some((entry) => entry.verificationState === "unverified")) {
    return INFORMATION_STATES.UNVERIFIED;
  }
  return null;
}

function createCompatibilityEvidence({
  context,
  deal,
  descriptor,
  read,
  recordId,
  value,
}) {
  if (!recordId || !read.field) return null;
  const timestamp = sourceTimestamp(deal, read.field);
  const summary = Array.isArray(value)
    ? `${value.length} stored record${value.length === 1 ? "" : "s"}`
    : typeof value === "boolean"
      ? value
        ? "Yes"
        : "No"
      : safeText(value);
  return normalizeEvidenceReference({
    sourceType: "crm-residential-fact",
    sourceSystem: "Deal record",
    sourceRecordId: recordId,
    sourceField: read.field,
    sourceTimestamp: timestamp.timestamp,
    extractionMethod: "residential-strategy-compatibility-field-adapter",
    trustLevel: "unknown",
    verificationState: "unknown",
    conflictState: "unknown",
    freshnessState: "unknown",
    relatedCanonicalField: descriptor.canonicalField,
    valueSummary: summary || "Current field is represented",
    organizationId: context.organizationId,
    tenantId: context.tenantId,
    reliabilityLabel: "Compatibility Record",
    provenanceDetails: {
      compatibilityCurrentState: true,
      storedValue:
        ["string", "number", "boolean"].includes(typeof read.value)
          ? read.value
          : "recorded-collection",
      sourceTimestampScope: timestamp.scope,
      strategyVersion: RESIDENTIAL_STRATEGY_VERSION,
    },
    partialDataWarning:
      "This current CRM field is compatibility Evidence without independent field verification.",
  });
}

function normalizeConflictIds(conflicts, descriptor) {
  return uniqueStrings(
    (Array.isArray(conflicts) ? conflicts : [])
      .filter(
        (conflict) =>
          conflict?.relatedCanonicalField === descriptor.canonicalField &&
          conflict?.state !== "resolved"
      )
      .map((conflict) => conflict.conflictId || conflict.id)
      .filter(Boolean)
  ).slice(0, 20);
}

function factSourceMode(evidence) {
  return evidence.some(isCompatibilityEvidence)
    ? DECISION_SOURCE_MODES.DETERMINISTIC_COMPATIBILITY
    : DECISION_SOURCE_MODES.DETERMINISTIC;
}

function createAssetClassificationFact(context) {
  const present = Boolean(
    context?.classificationState === ASSET_CLASSIFICATION_STATES.CLASSIFIED &&
      context?.assetType === ASSET_TYPES.RESIDENTIAL_HOME &&
      context?.manualReviewRequired !== true
  );
  const evidence = Array.isArray(context?.classificationEvidence)
    ? context.classificationEvidence
    : [];
  return {
    observationId: context?.dealId
      ? `residential-fact:${encodeURIComponent(context.dealId)}:${RESIDENTIAL_FACT_IDS.ASSET_CLASSIFICATION}`
      : null,
    factId: RESIDENTIAL_FACT_IDS.ASSET_CLASSIFICATION,
    canonicalField: "property.assetType",
    state: present ? INFORMATION_STATES.PRESENT : INFORMATION_STATES.UNKNOWN,
    rawValue: context?.assetType || null,
    value: present ? ASSET_TYPES.RESIDENTIAL_HOME : null,
    sourceField:
      context?.classificationSource?.sourceValues?.[0]?.field || null,
    evidenceReferenceIds: evidence.map((entry) => entry.evidenceId),
    conflictIds: (context?.classificationConflicts || []).map(
      (entry) => entry.conflictId
    ),
    verificationState: evidence.find((entry) => entry.verificationState)?.verificationState || "unknown",
    freshnessState: evidence.find((entry) => entry.freshnessState)?.freshnessState || "unknown",
    sourceTimestamp: evidence.find((entry) => entry.sourceTimestamp)?.sourceTimestamp || null,
    sourceMode: factSourceMode(evidence),
    partialDataWarnings: context?.sourceWarnings || [],
  };
}

export function adaptResidentialFacts({
  assetStrategyContext,
  conflicts = [],
  deal,
  evaluatedTimestamp,
  evidenceReferences = [],
} = {}) {
  const safeDeal = safeObject(deal);
  const context = safeObject(assetStrategyContext);
  const tenantContext = getTenantContext(safeDeal, context);
  const recordId = getRecordId(safeDeal, context);
  const suppliedEvidence = normalizeEvidence(evidenceReferences, tenantContext);
  const createdEvidence = [];
  const warnings = [];
  const facts = [createAssetClassificationFact(context)];

  FACT_DESCRIPTORS.slice(0, RESIDENTIAL_FACT_LIMIT - 1).forEach((descriptor) => {
    try {
      const read = readAliases(safeDeal, descriptor.aliases);
      warnings.push(...read.warnings);
      const matchingEvidence = evidenceForDescriptor(suppliedEvidence, descriptor);
      const evaluated = evaluateFactValue(
        descriptor,
        read,
        matchingEvidence,
        evaluatedTimestamp
      );
      const compatibilityEvidence =
        evaluated.state === INFORMATION_STATES.PRESENT
          ? createCompatibilityEvidence({
              context: tenantContext,
              deal: safeDeal,
              descriptor,
              read,
              recordId,
              value: evaluated.value,
            })
          : null;
      if (compatibilityEvidence) createdEvidence.push(compatibilityEvidence);
      const evidence = [
        ...matchingEvidence,
        ...(compatibilityEvidence ? [compatibilityEvidence] : []),
      ];
      const conflictIds = normalizeConflictIds(conflicts, descriptor);
      const explicitState = conflictIds.length
        ? INFORMATION_STATES.CONFLICTING
        : explicitEvidenceState(evidence);
      const state = explicitState || evaluated.state;
      facts.push({
        observationId: recordId
          ? `residential-fact:${encodeURIComponent(recordId)}:${descriptor.factId}`
          : null,
        factId: descriptor.factId,
        canonicalField: descriptor.canonicalField,
        state,
        rawValue:
          ["string", "number", "boolean"].includes(typeof read.value)
            ? read.value
            : null,
        value: state === INFORMATION_STATES.PRESENT ? evaluated.value : null,
        normalized: evaluated.normalized || null,
        sourceField: read.field,
        evidenceReferenceIds: uniqueStrings(
          evidence.map((entry) => entry.evidenceId)
        ),
        conflictIds,
        verificationState:
          evidence.find((entry) => entry.verificationState !== "unknown")
            ?.verificationState || "unknown",
        freshnessState:
          evidence.find((entry) => entry.freshnessState !== "unknown")
            ?.freshnessState || "unknown",
        sourceTimestamp:
          evidence.find((entry) => entry.sourceTimestamp)?.sourceTimestamp || null,
        sourceMode: factSourceMode(evidence),
        partialDataWarnings: uniqueStrings([
          ...read.warnings,
          ...evidence.map((entry) => entry.partialDataWarning).filter(Boolean),
        ]).slice(0, 10),
      });
    } catch {
      warnings.push(`The ${descriptor.factId} fact could not be adapted.`);
    }
  });

  const occupancyFact = facts.find(
    (fact) => fact.factId === RESIDENTIAL_FACT_IDS.OCCUPANCY_STATUS
  );
  if (occupancyFact?.state === INFORMATION_STATES.PRESENT) {
    [
      [
        RESIDENTIAL_FACT_IDS.OWNER_OCCUPIED_STATUS,
        "property.ownerOccupied",
        occupancyFact.value === "owner-occupied",
      ],
      [
        RESIDENTIAL_FACT_IDS.TENANT_OCCUPIED_STATUS,
        "property.tenantOccupied",
        occupancyFact.value === "tenant-occupied",
      ],
    ].forEach(([factId, canonicalField, value]) => {
      facts.push({
        ...occupancyFact,
        observationId: recordId
          ? `residential-fact:${encodeURIComponent(recordId)}:${factId}`
          : null,
        factId,
        canonicalField,
        rawValue: value,
        value,
      });
    });
  }

  const evidenceReferencesOutput = normalizeEvidence(
    [
      ...(Array.isArray(context.classificationEvidence)
        ? context.classificationEvidence
        : []),
      ...suppliedEvidence,
      ...createdEvidence,
    ],
    tenantContext
  );
  const factsById = Object.fromEntries(
    facts.filter((fact) => fact?.factId).map((fact) => [fact.factId, fact])
  );
  const informationStates = Object.fromEntries(
    facts
      .filter((fact) => fact?.canonicalField)
      .map((fact) => [fact.canonicalField, fact.state])
  );

  return {
    adapterVersion: RESIDENTIAL_FACT_ADAPTER_VERSION,
    strategyId: RESIDENTIAL_STRATEGY_ID,
    strategyVersion: RESIDENTIAL_STRATEGY_VERSION,
    dealId: recordId,
    organizationId: tenantContext.organizationId,
    tenantId: tenantContext.tenantId,
    assetType: context.assetType || null,
    facts: facts.slice(0, RESIDENTIAL_FACT_LIMIT),
    factsById,
    evidenceReferences: evidenceReferencesOutput,
    informationStates,
    missingFactIds: facts
      .filter((fact) => fact.state === INFORMATION_STATES.MISSING)
      .map((fact) => fact.factId),
    unknownFactIds: facts
      .filter((fact) => fact.state === INFORMATION_STATES.UNKNOWN)
      .map((fact) => fact.factId),
    conflictIds: uniqueStrings(facts.flatMap((fact) => fact.conflictIds)),
    explicitVerificationStates: Object.fromEntries(
      facts
        .filter((fact) => fact.verificationState !== "unknown")
        .map((fact) => [fact.canonicalField, fact.verificationState])
    ),
    explicitFreshnessStates: Object.fromEntries(
      facts
        .filter((fact) => fact.freshnessState !== "unknown")
        .map((fact) => [fact.canonicalField, fact.freshnessState])
    ),
    evaluatedTimestamp: normalizedTimestamp(evaluatedTimestamp),
    partialDataWarnings: uniqueStrings([
      ...warnings,
      ...facts.flatMap((fact) => fact.partialDataWarnings || []),
      ...(recordId
        ? []
        : ["A stable deal identifier is required to create auditable Residential Strategy Evidence."]),
    ]).slice(0, 16),
  };
}

export function getResidentialFact(factReadModel, factId) {
  return factReadModel?.factsById?.[factId] || null;
}

export function isExplicitNoMortgage(factReadModel) {
  const status = normalizedText(
    getResidentialFact(factReadModel, RESIDENTIAL_FACT_IDS.MORTGAGE_STATUS)
      ?.value
  );
  return NO_MORTGAGE_TEXT.has(status);
}
