import { uniqueStrings } from "../../../utils/text";
import {
  DECISION_EVALUATION_STATES,
  DECISION_SOURCE_MODES,
  normalizeEvidenceReference,
} from "../../decision-intelligence/decisionContracts";
import { INFORMATION_STATES } from "../../research-intelligence";
import { getVacantLandFact } from "./vacantLandFactAdapter";
import {
  VACANT_LAND_FACT_IDS,
  VACANT_LAND_VALUATION_OPERATOR_DISCLOSURE,
  VACANT_LAND_VALUATION_POLICY,
  normalizeVacantLandComparable,
  normalizeVacantLandValuationResult,
} from "./vacantLandStrategyContracts";

// Distinct responsibility: validate explicit stored land comparables and build
// deterministic valuation context without appraisals, offers, or provider calls.
export const VACANT_LAND_COMPARABLE_ADAPTER_VERSION =
  "vacant-land-comparable-adapter-v1";

const LAND_CLASSIFICATION_VALUES = new Set([
  "vacant-residential-land",
  "vacant land",
  "vacant residential land",
  "residential lot",
  "land",
]);

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function factValue(readModel, factId) {
  const fact = getVacantLandFact(readModel, factId);
  return fact?.state === INFORMATION_STATES.PRESENT ? fact.value : null;
}

function evidenceForFacts(readModel, factIds) {
  return uniqueStrings(
    factIds.flatMap(
      (factId) =>
        getVacantLandFact(readModel, factId)?.evidenceReferenceIds || []
    )
  ).slice(0, 100);
}

function isExplicitLandComparable(comparable) {
  const value = String(comparable.assetType || "").trim().toLowerCase();
  return LAND_CLASSIFICATION_VALUES.has(value);
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function createComparableEvidence(comparable, context) {
  if (!comparable.comparableId) return null;
  const pricePerAcre = comparable.salePrice / comparable.acreage;
  return normalizeEvidenceReference({
    sourceType: "land-comparable-sale",
    sourceSystem: comparable.sourceType || "Stored land comparable record",
    sourceRecordId: comparable.comparableId,
    sourceField: "sale_price",
    sourceTimestamp: comparable.sourceTimestamp || comparable.saleDate,
    extractionMethod: "explicit-land-comparable-price-per-acre",
    trustLevel: "unknown",
    verificationState: "unknown",
    conflictState: "unknown",
    freshnessState: "unknown",
    relatedCanonicalField: "property.landComps",
    factId: VACANT_LAND_FACT_IDS.COMPARABLE_LAND_VALUE,
    relationship: "supports",
    valueSummary: `${comparable.salePrice} sale price / ${comparable.acreage} acres = ${pricePerAcre} per acre`,
    organizationId: context.organizationId,
    tenantId: context.tenantId,
    reliabilityLabel: "Stored Land Comparable",
    provenanceDetails: {
      explicitLandClassification: true,
      salePrice: comparable.salePrice,
      acreage: comparable.acreage,
      pricePerAcre,
      compatibilityCurrentState: true,
    },
    partialDataWarning:
      "Stored land comparable Evidence has not been independently verified or adjusted for location, zoning, utilities, topography, time, or parcel size.",
  });
}

export function adaptVacantLandComparables({
  comparables = [],
  factReadModel,
} = {}) {
  const source = Array.isArray(comparables)
    ? comparables
    : factValue(factReadModel, VACANT_LAND_FACT_IDS.LAND_COMPARABLES) || [];
  const warnings = [];
  const validComparables = [];
  const evidenceReferences = [];

  source.slice(0, 25).forEach((entry) => {
    try {
      const comparable = normalizeVacantLandComparable(entry);
      if (!comparable.comparableId) {
        warnings.push("A stored comparable without a stable record ID was omitted.");
        return;
      }
      if (!isExplicitLandComparable(comparable)) {
        warnings.push(
          `Comparable ${comparable.comparableId} was omitted because it is not explicitly classified as land.`
        );
        return;
      }
      if (!(comparable.salePrice > 0) || !(comparable.acreage > 0)) {
        warnings.push(
          `Land comparable ${comparable.comparableId} requires positive sale price and acreage.`
        );
        return;
      }
      const pricePerAcre = comparable.salePrice / comparable.acreage;
      const normalized = { ...comparable, pricePerAcre };
      validComparables.push(normalized);
      const evidence = createComparableEvidence(normalized, factReadModel || {});
      if (evidence) evidenceReferences.push(evidence);
    } catch {
      warnings.push("One malformed land comparable was omitted.");
    }
  });

  if (validComparables.length === 1) {
    warnings.push(
      "One valid land comparable provides limited market support and is not an appraisal."
    );
  } else if (validComparables.length === 2) {
    warnings.push(
      "Two valid land comparables provide limited market support and are not an appraisal."
    );
  }

  return {
    adapterVersion: VACANT_LAND_COMPARABLE_ADAPTER_VERSION,
    validComparables,
    invalidComparableCount: Math.max(0, source.slice(0, 25).length - validComparables.length),
    medianPricePerAcre: median(
      validComparables.map((comparable) => comparable.pricePerAcre)
    ),
    evidenceReferences,
    partialDataWarnings: uniqueStrings(warnings).slice(0, 16),
  };
}

export function evaluateVacantLandValuation({
  blockingIssueIds = [],
  comparables = [],
  evaluatedTimestamp,
  factReadModel,
} = {}) {
  const askingPrice = finiteNumber(
    factValue(factReadModel, VACANT_LAND_FACT_IDS.ASKING_PRICE)
  );
  const parcelSizeAcres = finiteNumber(
    factValue(factReadModel, VACANT_LAND_FACT_IDS.PARCEL_SIZE_ACRES)
  );
  const manualIndicatedValue = finiteNumber(
    factValue(factReadModel, VACANT_LAND_FACT_IDS.COMPARABLE_LAND_VALUE)
  );
  const comparableContext = adaptVacantLandComparables({
    comparables:
      comparables.length > 0
        ? comparables
        : factValue(factReadModel, VACANT_LAND_FACT_IDS.LAND_COMPARABLES) || [],
    factReadModel,
  });
  const comparableIndicatedValue =
    comparableContext.medianPricePerAcre > 0 && parcelSizeAcres > 0
      ? comparableContext.medianPricePerAcre * parcelSizeAcres
      : null;
  const usesComparableValue = comparableIndicatedValue > 0;
  const indicatedLandValue = usesComparableValue
    ? comparableIndicatedValue
    : manualIndicatedValue > 0
      ? manualIndicatedValue
      : null;
  const valuationSource = usesComparableValue
    ? "median-persisted-land-comparable-price-per-acre"
    : indicatedLandValue
      ? "explicit-stored-indicated-land-value"
      : null;
  const blocking = uniqueStrings(blockingIssueIds).slice(0, 40);
  const evaluationState =
    askingPrice > 0 && indicatedLandValue > 0 && blocking.length === 0
      ? DECISION_EVALUATION_STATES.EVALUATED
      : DECISION_EVALUATION_STATES.NOT_EVALUATED;
  const warnings = uniqueStrings([
    ...comparableContext.partialDataWarnings,
    ...(comparableContext.validComparables.length && !parcelSizeAcres
      ? [
          "Valid land comparables are stored, but subject acreage is required to derive an indicated total value.",
        ]
      : []),
    ...(usesComparableValue && manualIndicatedValue > 0
      ? [
          "A manual indicated land value is also stored. The policy uses valid land comparables first and preserves the manual source separately without combining them.",
        ]
      : []),
  ]).slice(0, 16);
  const inputEvidenceIds = uniqueStrings([
    ...evidenceForFacts(factReadModel, [
      VACANT_LAND_FACT_IDS.ASKING_PRICE,
      VACANT_LAND_FACT_IDS.PARCEL_SIZE_ACRES,
      VACANT_LAND_FACT_IDS.COMPARABLE_LAND_VALUE,
      VACANT_LAND_FACT_IDS.LAND_COMPARABLES,
    ]),
    ...comparableContext.evidenceReferences.map((entry) => entry.evidenceId),
  ]).slice(0, 100);

  return {
    ...normalizeVacantLandValuationResult({
      evaluationState,
      askingPrice,
      parcelSizeAcres,
      askingPricePerAcre:
        askingPrice > 0 && parcelSizeAcres > 0
          ? askingPrice / parcelSizeAcres
          : null,
      indicatedLandValue,
      indicatedValuePerAcre:
        indicatedLandValue > 0 && parcelSizeAcres > 0
          ? indicatedLandValue / parcelSizeAcres
          : null,
      grossLandSpread:
        indicatedLandValue > 0 && askingPrice > 0
          ? indicatedLandValue - askingPrice
          : null,
      discountToIndicatedValueRatio:
        indicatedLandValue > 0 && askingPrice > 0
          ? (indicatedLandValue - askingPrice) / indicatedLandValue
          : null,
      askingToIndicatedValueRatio:
        indicatedLandValue > 0 && askingPrice > 0
          ? askingPrice / indicatedLandValue
          : null,
      comparableCount: comparableContext.validComparables.length,
      medianComparablePricePerAcre: comparableContext.medianPricePerAcre,
      valuationSource,
      comparableRecords: comparableContext.validComparables,
      inputEvidenceIds,
      blockingIssueIds: blocking,
      partialDataWarnings: warnings,
      assumptions: VACANT_LAND_VALUATION_POLICY.assumptions,
      operatorDisclosure: VACANT_LAND_VALUATION_OPERATOR_DISCLOSURE,
      evaluatedTimestamp,
      sourceMode: inputEvidenceIds.length
        ? DECISION_SOURCE_MODES.DETERMINISTIC_COMPATIBILITY
        : DECISION_SOURCE_MODES.DETERMINISTIC,
    }),
    evidenceLineage: { derivedFromEvidenceIds: inputEvidenceIds },
    evidenceReferences: comparableContext.evidenceReferences,
  };
}
