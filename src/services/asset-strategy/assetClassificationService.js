import { getDealAlias } from "../../utils/dealFields";
import { compactText, uniqueStrings } from "../../utils/text";
import {
  ASSET_CLASSIFICATION_SOURCE_KINDS,
  ASSET_CLASSIFICATION_STATES,
  ASSET_TYPES,
  normalizeAssetClassification,
} from "./assetStrategyContracts";

// Distinct responsibility: classify only explicit current deal fields into the
// shared asset taxonomy; it never performs strategy analysis or data inference.
export const ASSET_CLASSIFICATION_COMPATIBILITY_RULESET_VERSION =
  "asset-classification-compatibility-v1";

export const ASSET_CLASSIFICATION_RESOLUTIONS = Object.freeze({
  MATCHED: "matched",
  EMPTY: "empty",
  AMBIGUOUS: "ambiguous",
  UNSUPPORTED: "unsupported",
});

export const ASSET_CLASSIFICATION_REASON_CODES = Object.freeze({
  NO_ASSET_TYPE: "no-asset-type",
  MATCHED_CANONICAL_FIELD: "matched-canonical-field",
  MATCHED_LEGACY_PROPERTY_TYPE: "matched-legacy-property-type",
  CONFLICTING_ASSET_TYPES: "conflicting-asset-types",
  AMBIGUOUS_ASSET_TYPE: "ambiguous-asset-type",
  UNSUPPORTED_ASSET_TYPE: "unsupported-asset-type",
});

const FIELD_DEFINITIONS = Object.freeze([
  { field: "asset_type", sourceKind: ASSET_CLASSIFICATION_SOURCE_KINDS.CANONICAL_FIELD },
  { field: "assetType", sourceKind: ASSET_CLASSIFICATION_SOURCE_KINDS.CANONICAL_FIELD },
  {
    field: "property_type",
    sourceKind: ASSET_CLASSIFICATION_SOURCE_KINDS.LEGACY_PROPERTY_TYPE,
  },
  {
    field: "propertyType",
    sourceKind: ASSET_CLASSIFICATION_SOURCE_KINDS.LEGACY_PROPERTY_TYPE,
  },
]);

const ASSET_TYPE_ALIASES = Object.freeze({
  [ASSET_TYPES.RESIDENTIAL_HOME]: [
    "residential home",
    "single family",
    "single family home",
    "single family residential",
    "sfr",
    "house",
    "detached house",
    "townhouse",
    "townhome",
    "condominium",
    "condo",
  ],
  [ASSET_TYPES.VACANT_RESIDENTIAL_LAND]: [
    "vacant residential land",
    "vacant land",
    "residential land",
    "vacant lot",
    "residential lot",
  ],
  [ASSET_TYPES.SMALL_MULTIFAMILY]: [
    "small multifamily",
    "small multi family",
    "duplex",
    "triplex",
    "fourplex",
    "2 4 unit",
    "two to four unit",
  ],
  [ASSET_TYPES.MANUFACTURED_HOME]: [
    "manufactured home",
    "manufactured housing",
    "mobile home",
  ],
  [ASSET_TYPES.COMMERCIAL]: [
    "commercial",
    "commercial property",
    "office",
    "retail",
    "industrial",
  ],
});

const AMBIGUOUS_ALIASES = new Set([
  "residential",
  "land",
  "multifamily",
  "multi family",
  "mixed use",
]);

const EMPTY_ALIASES = new Set([
  "unknown",
  "unclassified",
  "not sure",
  "n a",
  "na",
  "tbd",
]);

function normalizeAlias(value) {
  if (typeof value !== "string") return "";
  return compactText(value)
    .toLowerCase()
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ALIAS_TO_ASSET_TYPE = new Map();
Object.entries(ASSET_TYPE_ALIASES).forEach(([assetType, aliases]) => {
  [assetType, ...aliases].forEach((alias) => {
    ALIAS_TO_ASSET_TYPE.set(normalizeAlias(alias), assetType);
  });
});

function safeIdentifier(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  return compactText(String(value)).slice(0, 160) || null;
}

export function resolveAssetTypeAlias(value) {
  const rawValue = typeof value === "string" ? compactText(value) : "";
  const normalizedValue = normalizeAlias(rawValue);

  if (!normalizedValue || EMPTY_ALIASES.has(normalizedValue)) {
    return {
      rawValue,
      normalizedValue,
      assetType: null,
      resolution: ASSET_CLASSIFICATION_RESOLUTIONS.EMPTY,
    };
  }

  const assetType = ALIAS_TO_ASSET_TYPE.get(normalizedValue) || null;
  if (assetType) {
    return {
      rawValue,
      normalizedValue,
      assetType,
      resolution: ASSET_CLASSIFICATION_RESOLUTIONS.MATCHED,
    };
  }

  return {
    rawValue,
    normalizedValue,
    assetType: null,
    resolution: AMBIGUOUS_ALIASES.has(normalizedValue)
      ? ASSET_CLASSIFICATION_RESOLUTIONS.AMBIGUOUS
      : ASSET_CLASSIFICATION_RESOLUTIONS.UNSUPPORTED,
  };
}

function collectSourceValues(record) {
  const source = record && typeof record === "object" ? record : {};
  return FIELD_DEFINITIONS.map((definition) => {
    const resolution = resolveAssetTypeAlias(source[definition.field]);
    return {
      ...definition,
      ...resolution,
    };
  }).filter((entry) => entry.rawValue);
}

function getClassificationState(sourceValues) {
  const candidates = uniqueStrings(
    sourceValues.map((entry) => entry.assetType).filter(Boolean)
  );
  const hasAmbiguousValue = sourceValues.some(
    (entry) => entry.resolution === ASSET_CLASSIFICATION_RESOLUTIONS.AMBIGUOUS
  );
  const hasUnsupportedCanonicalValue = sourceValues.some(
    (entry) =>
      entry.sourceKind === ASSET_CLASSIFICATION_SOURCE_KINDS.CANONICAL_FIELD &&
      entry.resolution === ASSET_CLASSIFICATION_RESOLUTIONS.UNSUPPORTED
  );

  if (candidates.length > 1) {
    return {
      state: ASSET_CLASSIFICATION_STATES.AMBIGUOUS,
      reasonCode: ASSET_CLASSIFICATION_REASON_CODES.CONFLICTING_ASSET_TYPES,
      candidates,
    };
  }

  if (hasAmbiguousValue || (hasUnsupportedCanonicalValue && candidates.length > 0)) {
    return {
      state: ASSET_CLASSIFICATION_STATES.AMBIGUOUS,
      reasonCode: ASSET_CLASSIFICATION_REASON_CODES.AMBIGUOUS_ASSET_TYPE,
      candidates,
    };
  }

  if (candidates.length === 1) {
    const matchedCanonical = sourceValues.some(
      (entry) =>
        entry.sourceKind === ASSET_CLASSIFICATION_SOURCE_KINDS.CANONICAL_FIELD &&
        entry.assetType === candidates[0]
    );
    return {
      state: ASSET_CLASSIFICATION_STATES.CLASSIFIED,
      reasonCode: matchedCanonical
        ? ASSET_CLASSIFICATION_REASON_CODES.MATCHED_CANONICAL_FIELD
        : ASSET_CLASSIFICATION_REASON_CODES.MATCHED_LEGACY_PROPERTY_TYPE,
      candidates,
    };
  }

  if (
    sourceValues.some(
      (entry) =>
        entry.resolution === ASSET_CLASSIFICATION_RESOLUTIONS.AMBIGUOUS
    )
  ) {
    return {
      state: ASSET_CLASSIFICATION_STATES.AMBIGUOUS,
      reasonCode: ASSET_CLASSIFICATION_REASON_CODES.AMBIGUOUS_ASSET_TYPE,
      candidates,
    };
  }

  if (
    sourceValues.some(
      (entry) =>
        entry.resolution === ASSET_CLASSIFICATION_RESOLUTIONS.UNSUPPORTED
    )
  ) {
    return {
      state: ASSET_CLASSIFICATION_STATES.UNSUPPORTED,
      reasonCode: ASSET_CLASSIFICATION_REASON_CODES.UNSUPPORTED_ASSET_TYPE,
      candidates,
    };
  }

  return {
    state: ASSET_CLASSIFICATION_STATES.UNCLASSIFIED,
    reasonCode: ASSET_CLASSIFICATION_REASON_CODES.NO_ASSET_TYPE,
    candidates,
  };
}

export function classifyOpportunityAsset(record, context = {}) {
  const safeRecord = record && typeof record === "object" ? record : {};
  const sourceValues = collectSourceValues(safeRecord);
  const classificationState = getClassificationState(sourceValues);
  const hasCanonicalSource = sourceValues.some(
    (entry) =>
      entry.sourceKind === ASSET_CLASSIFICATION_SOURCE_KINDS.CANONICAL_FIELD
  );
  const matchedCanonical = sourceValues.some(
    (entry) =>
      entry.sourceKind === ASSET_CLASSIFICATION_SOURCE_KINDS.CANONICAL_FIELD &&
      entry.assetType === classificationState.candidates[0]
  );
  const ignoredLegacyValues = sourceValues.filter(
    (entry) =>
      entry.sourceKind ===
        ASSET_CLASSIFICATION_SOURCE_KINDS.LEGACY_PROPERTY_TYPE &&
      entry.resolution === ASSET_CLASSIFICATION_RESOLUTIONS.UNSUPPORTED
  );
  const warnings = [
    ...((Array.isArray(context.partialDataWarnings)
      ? context.partialDataWarnings
      : context.partialDataWarnings
        ? [context.partialDataWarnings]
        : [])),
    ...(matchedCanonical && ignoredLegacyValues.length > 0
      ? ["A legacy property type was not recognized; the canonical asset type was retained."]
      : []),
  ];

  return normalizeAssetClassification({
    classificationId: context.classificationId,
    organizationId:
      context.organizationId ||
      safeRecord.organization_id ||
      safeRecord.organizationId,
    tenantId: context.tenantId || safeRecord.tenant_id || safeRecord.tenantId,
    opportunityId:
      context.opportunityId || safeIdentifier(getDealAlias(safeRecord, "id")),
    state: classificationState.state,
    assetType:
      classificationState.state === ASSET_CLASSIFICATION_STATES.CLASSIFIED
        ? classificationState.candidates[0]
        : null,
    candidateAssetTypes: classificationState.candidates,
    sourceKind: hasCanonicalSource
      ? ASSET_CLASSIFICATION_SOURCE_KINDS.CANONICAL_FIELD
      : sourceValues.some(
            (entry) =>
              entry.sourceKind ===
              ASSET_CLASSIFICATION_SOURCE_KINDS.LEGACY_PROPERTY_TYPE
          )
        ? ASSET_CLASSIFICATION_SOURCE_KINDS.LEGACY_PROPERTY_TYPE
        : ASSET_CLASSIFICATION_SOURCE_KINDS.UNKNOWN,
    sourceValues: sourceValues.map((entry) => ({
      field: entry.field,
      rawValue: entry.rawValue,
      mappedAssetType: entry.assetType,
      resolution: entry.resolution,
    })),
    evidenceReferenceIds: context.evidenceReferenceIds,
    reasonCode: classificationState.reasonCode,
    requiresHumanReview:
      classificationState.state !== ASSET_CLASSIFICATION_STATES.CLASSIFIED,
    rulesetVersion: ASSET_CLASSIFICATION_COMPATIBILITY_RULESET_VERSION,
    classifiedTimestamp: context.classifiedTimestamp,
    partialDataWarnings: warnings,
  });
}
