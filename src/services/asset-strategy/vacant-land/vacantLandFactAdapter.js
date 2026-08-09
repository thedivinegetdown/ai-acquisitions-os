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
  VACANT_LAND_FACT_IDS,
  VACANT_LAND_STRATEGY_ID,
  VACANT_LAND_STRATEGY_VERSION,
  VACANT_LAND_VALUATION_POLICY,
} from "./vacantLandStrategyContracts";

// Distinct responsibility: adapt explicit stored land CRM fields into bounded
// normalized facts and Evidence without valuing a parcel or calling providers.
export const VACANT_LAND_FACT_ADAPTER_VERSION =
  "vacant-land-fact-adapter-v1";
export const VACANT_LAND_FACT_LIMIT = 50;
export const VACANT_LAND_EVIDENCE_LIMIT = 100;

const UNKNOWN_TEXT = new Set([
  "unknown",
  "not sure",
  "unsure",
  "tbd",
  "n/a",
  "na",
  "not determined",
  "pending",
]);

const LAND_COMPARABLE_EVIDENCE_TYPES = new Set([
  "land-comparable-sale",
  "vacant-land-comparable",
  "parcel-comparable-sale",
]);

const FACT_DESCRIPTORS = Object.freeze([
  [VACANT_LAND_FACT_IDS.PARCEL_IDENTITY, "property.parcelIdentity", DEAL_FIELD_ALIASES.parcelIdentity, "text"],
  [VACANT_LAND_FACT_IDS.PARCEL_NUMBER, "property.parcelNumber", DEAL_FIELD_ALIASES.parcelNumber, "text"],
  [VACANT_LAND_FACT_IDS.ASKING_PRICE, "deal.askingPrice", DEAL_FIELD_ALIASES.askingPrice, "positive-number"],
  [VACANT_LAND_FACT_IDS.SELLER_MOTIVATION, "seller.motivation", DEAL_FIELD_ALIASES.motivation, "motivation"],
  [VACANT_LAND_FACT_IDS.SELLER_TIMELINE, "seller.timeline", DEAL_FIELD_ALIASES.timeline, "timeline"],
  [VACANT_LAND_FACT_IDS.LEGAL_ACCESS, "property.legalAccess", DEAL_FIELD_ALIASES.legalAccess, "legal-access"],
  [VACANT_LAND_FACT_IDS.ZONING, "property.zoning", DEAL_FIELD_ALIASES.zoning, "known-text"],
  [VACANT_LAND_FACT_IDS.PERMITTED_USE, "property.permittedUse", DEAL_FIELD_ALIASES.permittedUse, "known-text"],
  [VACANT_LAND_FACT_IDS.FLOOD_STATUS, "property.floodZoneStatus", DEAL_FIELD_ALIASES.floodStatus, "constraint-status"],
  [VACANT_LAND_FACT_IDS.WETLANDS_STATUS, "property.wetlandsStatus", DEAL_FIELD_ALIASES.wetlandsStatus, "constraint-status"],
  [VACANT_LAND_FACT_IDS.TAXES_AND_LIENS, "property.taxesAndLiens", DEAL_FIELD_ALIASES.taxesAndLiens, "tax-lien-status"],
  [VACANT_LAND_FACT_IDS.COMPARABLE_LAND_VALUE, "property.comparableLandValue", DEAL_FIELD_ALIASES.comparableLandValue, "positive-number"],
  [VACANT_LAND_FACT_IDS.PARCEL_SIZE_ACRES, "property.parcelSizeAcres", DEAL_FIELD_ALIASES.acreage, "positive-number"],
  [VACANT_LAND_FACT_IDS.PARCEL_SIZE_SQUARE_FEET, "property.parcelSizeSquareFeet", DEAL_FIELD_ALIASES.landSquareFootage, "positive-number"],
  [VACANT_LAND_FACT_IDS.ROAD_FRONTAGE, "property.roadFrontage", DEAL_FIELD_ALIASES.roadFrontage, "frontage"],
  [VACANT_LAND_FACT_IDS.UTILITIES, "property.utilities", DEAL_FIELD_ALIASES.utilities, "service-status"],
  [VACANT_LAND_FACT_IDS.WATER_SEWER_SEPTIC, "property.waterSewerSeptic", DEAL_FIELD_ALIASES.waterSewerSeptic, "service-status"],
  [VACANT_LAND_FACT_IDS.TOPOGRAPHY, "property.topography", DEAL_FIELD_ALIASES.topography, "topography"],
  [VACANT_LAND_FACT_IDS.DEED_RESTRICTIONS, "property.deedRestrictions", DEAL_FIELD_ALIASES.deedRestrictions, "restriction-status"],
  [VACANT_LAND_FACT_IDS.SUBDIVISION_POTENTIAL, "property.subdivisionPotential", DEAL_FIELD_ALIASES.subdivisionPotential, "subdivision-status"],
  [VACANT_LAND_FACT_IDS.BUILDER_DEMAND, "property.builderDemand", DEAL_FIELD_ALIASES.builderDemand, "demand-status"],
  [VACANT_LAND_FACT_IDS.BUYER_DEMAND, "property.buyerDemand", DEAL_FIELD_ALIASES.landBuyerDemand, "demand-status"],
  [VACANT_LAND_FACT_IDS.LAND_COMPARABLES, "property.landComps", DEAL_FIELD_ALIASES.landComps, "collection"],
  [VACANT_LAND_FACT_IDS.COUNTY, "property.county", DEAL_FIELD_ALIASES.county, "known-text"],
  [VACANT_LAND_FACT_IDS.STATE, "property.state", DEAL_FIELD_ALIASES.state, "known-text"],
  [VACANT_LAND_FACT_IDS.ZIP, "property.zip", DEAL_FIELD_ALIASES.zip, "known-text"],
  [VACANT_LAND_FACT_IDS.LEGAL_DESCRIPTION, "property.legalDescription", DEAL_FIELD_ALIASES.legalDescription, "known-text"],
  [VACANT_LAND_FACT_IDS.LATITUDE, "property.latitude", DEAL_FIELD_ALIASES.latitude, "finite-number"],
  [VACANT_LAND_FACT_IDS.LONGITUDE, "property.longitude", DEAL_FIELD_ALIASES.longitude, "finite-number"],
].map(([factId, canonicalField, aliases, policy]) => ({
  factId,
  canonicalField,
  aliases,
  policy,
})));

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
  for (const field of aliases || []) {
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

function statusFromSets(text, definitions) {
  for (const [status, accepted] of definitions) {
    if (accepted.has(text)) return status;
  }
  return null;
}

export function normalizeVacantLandStatus(kind, value) {
  const text = normalizedText(value);
  if (!text || UNKNOWN_TEXT.has(text)) return null;

  if (kind === "legal-access") {
    return statusFromSets(text, [
      ["documented", new Set(["yes", "documented", "documented access", "legal access", "deeded access", "recorded access", "public road access"])],
      ["easement-review", new Set(["easement", "easement access", "recorded easement", "access easement"])],
      ["disputed", new Set(["uncertain", "disputed", "disputed access", "unconfirmed"])],
      ["none", new Set(["no", "none", "no legal access", "landlocked"])],
    ]);
  }
  if (kind === "constraint-status") {
    return statusFromSets(text, [
      ["no-known-constraint", new Set(["no", "none", "clear", "not present", "not in flood zone", "no wetlands", "outside flood zone"])],
      ["constraint-present", new Set(["yes", "present", "in flood zone", "floodplain", "wetlands present", "wetland present", "affected"])],
    ]);
  }
  if (kind === "service-status") {
    return statusFromSets(text, [
      ["available", new Set(["yes", "available", "on site", "at property", "all available", "public water and sewer", "septic approved"])],
      ["partial", new Set(["partial", "nearby", "at road", "electric only", "well required", "septic required", "some available"])],
      ["unavailable", new Set(["no", "none", "unavailable", "not available", "off grid"])],
    ]);
  }
  if (kind === "tax-lien-status") {
    return statusFromSets(text, [
      ["clear-recorded", new Set(["current", "paid", "taxes paid", "no liens", "clear", "none"])],
      ["issue-present", new Set(["delinquent", "unpaid", "lien", "liens", "tax lien", "taxes delinquent"])],
    ]);
  }
  if (kind === "restriction-status") {
    return statusFromSets(text, [
      ["none-recorded", new Set(["no", "none", "no restrictions", "unrestricted"])],
      ["restriction-present", new Set(["yes", "present", "restricted", "deed restrictions", "covenants"])],
    ]);
  }
  if (kind === "subdivision-status") {
    return statusFromSets(text, [
      ["positive-record", new Set(["yes", "potential", "possible", "subdividable", "approved"])],
      ["negative-record", new Set(["no", "not allowed", "not subdividable", "prohibited"])],
      ["review-required", new Set(["review required", "conditional", "subject to approval"])],
    ]);
  }
  if (kind === "demand-status") {
    return statusFromSets(text, [
      ["strong", new Set(["strong", "high", "high demand"])],
      ["moderate", new Set(["moderate", "medium", "average"])],
      ["low", new Set(["low", "weak"])],
      ["none-known", new Set(["none", "no known demand", "no demand"])],
    ]);
  }
  if (kind === "topography") {
    return statusFromSets(text, [
      ["difficult", new Set(["steep", "very steep", "rough", "mountainous", "difficult"])],
      ["recorded", new Set(["flat", "level", "rolling", "sloped", "gentle slope"])],
    ]);
  }
  return null;
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
  const candidates = field ? [`${field}_updated_at`, `${field}UpdatedAt`] : [];
  for (const candidate of candidates) {
    const timestamp = normalizeDecisionTimestamp(readField(deal, candidate).value);
    if (timestamp) return { timestamp, scope: "field" };
  }
  const recordTimestamp = normalizeDecisionTimestamp(
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
    .slice(0, VACANT_LAND_EVIDENCE_LIMIT)
    .forEach((entry) => {
      if (!byId.has(entry.evidenceId)) byId.set(entry.evidenceId, entry);
    });
  return [...byId.values()];
}

function evidenceForDescriptor(evidence, descriptor) {
  const aliases = new Set(descriptor.aliases || []);
  return evidence.filter(
    (entry) =>
      entry.relatedCanonicalField === descriptor.canonicalField ||
      (entry.sourceField && aliases.has(entry.sourceField)) ||
      (descriptor.factId === VACANT_LAND_FACT_IDS.LAND_COMPARABLES &&
        LAND_COMPARABLE_EVIDENCE_TYPES.has(entry.sourceType))
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

function basePresence(read) {
  if (!read.represented) {
    return { state: INFORMATION_STATES.MISSING, value: null };
  }
  const text = normalizedText(read.value);
  if (UNKNOWN_TEXT.has(text)) {
    return { state: INFORMATION_STATES.UNKNOWN, value: null };
  }
  return null;
}

function evaluateFactValue(descriptor, read, evaluatedTimestamp) {
  const absent = basePresence(read);
  if (absent) return absent;
  const numeric = parseSafeNumber(read.value);

  if (descriptor.policy === "positive-number") {
    return numeric !== null && numeric > 0
      ? { state: INFORMATION_STATES.PRESENT, value: numeric }
      : { state: INFORMATION_STATES.UNKNOWN, value: null };
  }
  if (descriptor.policy === "finite-number") {
    return numeric !== null
      ? { state: INFORMATION_STATES.PRESENT, value: numeric }
      : { state: INFORMATION_STATES.UNKNOWN, value: null };
  }
  if (descriptor.policy === "motivation") {
    return numeric !== null && numeric >= 0 && numeric <= 10
      ? { state: INFORMATION_STATES.PRESENT, value: numeric }
      : { state: INFORMATION_STATES.UNKNOWN, value: null };
  }
  if (descriptor.policy === "timeline") {
    const timeline = normalizeStrategyTimeline(read.value, evaluatedTimestamp);
    return { state: timeline.state, value: timeline.days, normalized: timeline };
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
  if (descriptor.policy === "frontage") {
    if (numeric !== null && numeric > 0) {
      return {
        state: INFORMATION_STATES.PRESENT,
        value: "positive-frontage",
        normalized: { feet: numeric, method: "explicit-feet" },
      };
    }
    const status = statusFromSets(normalizedText(read.value), [
      ["easement-only", new Set(["easement only", "easement-only", "no direct frontage"])],
      ["no-frontage", new Set(["no", "none", "no frontage", "landlocked"])],
      ["positive-frontage", new Set(["yes", "frontage", "road frontage"])],
    ]);
    return status
      ? { state: INFORMATION_STATES.PRESENT, value: status }
      : { state: INFORMATION_STATES.UNKNOWN, value: null };
  }
  if (
    [
      "legal-access",
      "constraint-status",
      "service-status",
      "tax-lien-status",
      "restriction-status",
      "subdivision-status",
      "demand-status",
      "topography",
    ].includes(descriptor.policy)
  ) {
    const status = normalizeVacantLandStatus(descriptor.policy, read.value);
    return status
      ? { state: INFORMATION_STATES.PRESENT, value: status }
      : { state: INFORMATION_STATES.UNKNOWN, value: null };
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

function createCompatibilityEvidence({ context, deal, descriptor, read, recordId, value }) {
  if (!recordId || !read.field) return null;
  const timestamp = sourceTimestamp(deal, read.field);
  const summary = Array.isArray(value)
    ? `${value.length} stored record${value.length === 1 ? "" : "s"}`
    : safeText(value);
  return normalizeEvidenceReference({
    sourceType: "crm-vacant-land-fact",
    sourceSystem: "Deal record",
    sourceRecordId: recordId,
    sourceField: read.field,
    sourceTimestamp: timestamp.timestamp,
    extractionMethod: "vacant-land-strategy-compatibility-field-adapter",
    trustLevel: "unknown",
    verificationState: "unknown",
    conflictState: "unknown",
    freshnessState: "unknown",
    relatedCanonicalField: descriptor.canonicalField,
    factId: descriptor.factId,
    relationship: "supports",
    valueSummary: summary || "Current field is represented",
    organizationId: context.organizationId,
    tenantId: context.tenantId,
    reliabilityLabel: "Compatibility Record",
    provenanceDetails: {
      compatibilityCurrentState: true,
      storedValue: ["string", "number", "boolean"].includes(typeof read.value)
        ? read.value
        : "recorded-collection",
      sourceTimestampScope: timestamp.scope,
      strategyVersion: VACANT_LAND_STRATEGY_VERSION,
    },
    partialDataWarning:
      "This current CRM land field is compatibility Evidence without independent field verification.",
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
      context?.assetType === ASSET_TYPES.VACANT_RESIDENTIAL_LAND &&
      context?.manualReviewRequired !== true
  );
  const evidence = Array.isArray(context?.classificationEvidence)
    ? context.classificationEvidence
    : [];
  return {
    observationId: context?.dealId
      ? `vacant-land-fact:${encodeURIComponent(context.dealId)}:${VACANT_LAND_FACT_IDS.ASSET_CLASSIFICATION}`
      : null,
    factId: VACANT_LAND_FACT_IDS.ASSET_CLASSIFICATION,
    canonicalField: "property.assetType",
    state: present ? INFORMATION_STATES.PRESENT : INFORMATION_STATES.UNKNOWN,
    rawValue: context?.assetType || null,
    value: present ? ASSET_TYPES.VACANT_RESIDENTIAL_LAND : null,
    sourceField: context?.classificationSource?.sourceValues?.[0]?.field || null,
    evidenceReferenceIds: evidence.map((entry) => entry.evidenceId),
    conflictIds: (context?.classificationConflicts || []).map(
      (entry) => entry.conflictId
    ),
    verificationState:
      evidence.find((entry) => entry.verificationState)?.verificationState ||
      "unknown",
    freshnessState:
      evidence.find((entry) => entry.freshnessState)?.freshnessState ||
      "unknown",
    sourceTimestamp:
      evidence.find((entry) => entry.sourceTimestamp)?.sourceTimestamp || null,
    sourceMode: factSourceMode(evidence),
    partialDataWarnings: context?.sourceWarnings || [],
  };
}

function deriveAcreage(facts, recordId) {
  const acres = facts.find(
    (fact) => fact.factId === VACANT_LAND_FACT_IDS.PARCEL_SIZE_ACRES
  );
  const squareFeet = facts.find(
    (fact) => fact.factId === VACANT_LAND_FACT_IDS.PARCEL_SIZE_SQUARE_FEET
  );
  if (
    acres?.state === INFORMATION_STATES.PRESENT ||
    squareFeet?.state !== INFORMATION_STATES.PRESENT ||
    !(squareFeet.value > 0)
  ) {
    return;
  }
  const converted = squareFeet.value / VACANT_LAND_VALUATION_POLICY.squareFeetPerAcre;
  Object.assign(acres, {
    observationId: recordId
      ? `vacant-land-fact:${encodeURIComponent(recordId)}:${VACANT_LAND_FACT_IDS.PARCEL_SIZE_ACRES}`
      : null,
    state: INFORMATION_STATES.PRESENT,
    rawValue: squareFeet.rawValue,
    value: converted,
    normalized: {
      sourceSquareFeet: squareFeet.value,
      method: "square-feet-to-acres",
    },
    sourceField: squareFeet.sourceField,
    evidenceReferenceIds: squareFeet.evidenceReferenceIds,
    conflictIds: squareFeet.conflictIds,
    verificationState: squareFeet.verificationState,
    freshnessState: squareFeet.freshnessState,
    sourceTimestamp: squareFeet.sourceTimestamp,
    sourceMode: squareFeet.sourceMode,
    partialDataWarnings: uniqueStrings([
      ...(squareFeet.partialDataWarnings || []),
      "Parcel acreage was deterministically converted from explicitly stored parcel square footage.",
    ]),
  });
}

export function adaptVacantLandFacts({
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

  FACT_DESCRIPTORS.slice(0, VACANT_LAND_FACT_LIMIT - 1).forEach((descriptor) => {
    try {
      const read = readAliases(safeDeal, descriptor.aliases);
      warnings.push(...read.warnings);
      const matchingEvidence = evidenceForDescriptor(
        suppliedEvidence,
        descriptor
      );
      const evaluated = evaluateFactValue(
        descriptor,
        read,
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
          ? `vacant-land-fact:${encodeURIComponent(recordId)}:${descriptor.factId}`
          : null,
        factId: descriptor.factId,
        canonicalField: descriptor.canonicalField,
        state,
        rawValue: ["string", "number", "boolean"].includes(typeof read.value)
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
          evidence.find((entry) => entry.sourceTimestamp)?.sourceTimestamp ||
          null,
        sourceMode: factSourceMode(evidence),
        partialDataWarnings: uniqueStrings([
          ...read.warnings,
          ...evidence
            .map((entry) => entry.partialDataWarning)
            .filter(Boolean),
        ]).slice(0, 10),
      });
    } catch {
      warnings.push(`The ${descriptor.factId} fact could not be adapted.`);
    }
  });

  deriveAcreage(facts, recordId);
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

  return {
    adapterVersion: VACANT_LAND_FACT_ADAPTER_VERSION,
    strategyId: VACANT_LAND_STRATEGY_ID,
    strategyVersion: VACANT_LAND_STRATEGY_VERSION,
    dealId: recordId,
    organizationId: tenantContext.organizationId,
    tenantId: tenantContext.tenantId,
    assetType: context.assetType || null,
    facts: facts.slice(0, VACANT_LAND_FACT_LIMIT),
    factsById,
    evidenceReferences: evidenceReferencesOutput,
    informationStates: Object.fromEntries(
      facts
        .filter((fact) => fact?.canonicalField)
        .map((fact) => [fact.canonicalField, fact.state])
    ),
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
    evaluatedTimestamp: normalizeDecisionTimestamp(evaluatedTimestamp),
    partialDataWarnings: uniqueStrings([
      ...warnings,
      ...facts.flatMap((fact) => fact.partialDataWarnings || []),
      ...(recordId
        ? []
        : [
            "A stable deal identifier is required to create auditable Vacant Land Strategy Evidence.",
          ]),
    ]).slice(0, 16),
  };
}

export function getVacantLandFact(factReadModel, factId) {
  return factReadModel?.factsById?.[factId] || null;
}
