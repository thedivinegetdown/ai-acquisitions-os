import { uniqueStrings } from "../../../utils/text";
import {
  ASSET_STRATEGY_CRITICALITIES,
  ASSET_STRATEGY_REQUIREMENT_SCOPES,
  ASSET_STRATEGY_STATUSES,
  ASSET_TYPES,
  normalizeAssetStrategyContract,
  validateAssetStrategyContract,
} from "../assetStrategyContracts";
import {
  DECISION_EVALUATION_STATES,
  DECISION_SOURCE_MODES,
  normalizeDecisionTimestamp,
} from "../../decision-intelligence/decisionContracts";

// Distinct responsibility: define the serializable Vacant Land Acquisition
// Strategy v1 contracts and policy without reading deals or calculating values.
export const VACANT_LAND_STRATEGY_ID = "vacant-land-acquisition";
export const VACANT_LAND_STRATEGY_VERSION = "vacant-land-strategy-v1";
export const VACANT_LAND_VALUATION_POLICY_VERSION =
  "vacant-land-valuation-policy-v1";
export const VACANT_LAND_PURSUIT_PROFILE_ID =
  "vacant-land-pursuit-profile-v1";
export const VACANT_LAND_PURSUIT_RULESET_VERSION =
  "vacant-land-pursuit-ruleset-v1";
export const VACANT_LAND_STRATEGY_READ_MODEL_VERSION =
  "vacant-land-strategy-read-model-v1";
export const VACANT_LAND_VALUATION_RESULT_VERSION =
  "vacant-land-valuation-result-v1";

export const VACANT_LAND_CAPABILITY_STATES = Object.freeze({
  IMPLEMENTED: "implemented",
  MANUAL_REVIEW: "manual-review",
  REVIEW_ONLY: "review-only",
  INPUT_READY: "input-ready",
  COMPATIBILITY_ONLY: "compatibility-only",
  UNAVAILABLE: "unavailable",
});

export const VACANT_LAND_CAPABILITY_SUPPORT = Object.freeze({
  factAdaptation: VACANT_LAND_CAPABILITY_STATES.IMPLEMENTED,
  valuationContext: VACANT_LAND_CAPABILITY_STATES.IMPLEMENTED,
  feasibilitySignals: VACANT_LAND_CAPABILITY_STATES.IMPLEMENTED,
  pursuitScoring: VACANT_LAND_CAPABILITY_STATES.IMPLEMENTED,
  exitCandidateReview: VACANT_LAND_CAPABILITY_STATES.IMPLEMENTED,
  strategyPresentation: VACANT_LAND_CAPABILITY_STATES.IMPLEMENTED,
  buildabilityConclusion: VACANT_LAND_CAPABILITY_STATES.MANUAL_REVIEW,
  entitlementFeasibility: VACANT_LAND_CAPABILITY_STATES.MANUAL_REVIEW,
  subdivisionFeasibility: VACANT_LAND_CAPABILITY_STATES.MANUAL_REVIEW,
  offerReadiness: VACANT_LAND_CAPABILITY_STATES.UNAVAILABLE,
  offerPreparation: VACANT_LAND_CAPABILITY_STATES.REVIEW_ONLY,
  sellerFinance: VACANT_LAND_CAPABILITY_STATES.MANUAL_REVIEW,
  legalTitleConclusions: VACANT_LAND_CAPABILITY_STATES.MANUAL_REVIEW,
  buyerMatching: VACANT_LAND_CAPABILITY_STATES.INPUT_READY,
  storedLandComps: VACANT_LAND_CAPABILITY_STATES.INPUT_READY,
  automatedZoning: VACANT_LAND_CAPABILITY_STATES.UNAVAILABLE,
  automatedWetlands: VACANT_LAND_CAPABILITY_STATES.UNAVAILABLE,
  automatedFlood: VACANT_LAND_CAPABILITY_STATES.UNAVAILABLE,
  automatedUtilities: VACANT_LAND_CAPABILITY_STATES.UNAVAILABLE,
  autonomousOffers: VACANT_LAND_CAPABILITY_STATES.UNAVAILABLE,
  autonomousResearch: VACANT_LAND_CAPABILITY_STATES.UNAVAILABLE,
  purchaseRecommendation: VACANT_LAND_CAPABILITY_STATES.UNAVAILABLE,
});

export const VACANT_LAND_FACT_IDS = Object.freeze({
  ASSET_CLASSIFICATION: "land-asset-classification",
  PARCEL_IDENTITY: "parcel-identity",
  ASKING_PRICE: "asking-price",
  SELLER_MOTIVATION: "seller-motivation",
  SELLER_TIMELINE: "seller-timeline",
  LEGAL_ACCESS: "legal-access",
  ZONING: "zoning",
  PERMITTED_USE: "permitted-use",
  FLOOD_STATUS: "flood-zone-status",
  WETLANDS_STATUS: "wetlands-status",
  TAXES_AND_LIENS: "taxes-and-liens",
  COMPARABLE_LAND_VALUE: "comparable-land-value",
  PARCEL_SIZE_ACRES: "parcel-size-acres",
  PARCEL_SIZE_SQUARE_FEET: "parcel-size-square-feet",
  ROAD_FRONTAGE: "road-frontage",
  UTILITIES: "utilities",
  WATER_SEWER_SEPTIC: "water-sewer-septic",
  TOPOGRAPHY: "topography",
  DEED_RESTRICTIONS: "deed-restrictions",
  SUBDIVISION_POTENTIAL: "subdivision-potential",
  BUILDER_DEMAND: "builder-demand",
  BUYER_DEMAND: "buyer-demand",
  LAND_COMPARABLES: "land-comparables",
  PARCEL_NUMBER: "parcel-number",
  COUNTY: "county",
  STATE: "state",
  ZIP: "zip",
  LEGAL_DESCRIPTION: "legal-description",
  LATITUDE: "latitude",
  LONGITUDE: "longitude",
});

export const VACANT_LAND_REQUIREMENT_IDS = Object.freeze({
  PARCEL_IDENTITY: "land-strategy-parcel-identity",
  ASKING_PRICE: "land-strategy-asking-price",
  SELLER_MOTIVATION: "land-strategy-seller-motivation",
  SELLER_TIMELINE: "land-strategy-seller-timeline",
  LEGAL_ACCESS: "land-strategy-legal-access",
  ZONING: "land-strategy-zoning",
  PERMITTED_USE: "land-strategy-permitted-use",
  FLOOD_STATUS: "land-strategy-flood-zone-status",
  WETLANDS_STATUS: "land-strategy-wetlands-status",
  TAXES_AND_LIENS: "land-strategy-taxes-and-liens",
  VALUE_SUPPORT: "land-strategy-value-support",
  PARCEL_SIZE: "land-strategy-parcel-size",
  ROAD_FRONTAGE: "land-strategy-road-frontage",
  UTILITIES: "land-strategy-utilities",
  WATER_SEWER_SEPTIC: "land-strategy-water-sewer-septic",
  TOPOGRAPHY: "land-strategy-topography",
  DEED_RESTRICTIONS: "land-strategy-deed-restrictions",
  SUBDIVISION: "land-strategy-subdivision-potential",
  BUILDER_DEMAND: "land-strategy-builder-demand",
});

export const VACANT_LAND_EVIDENCE_REQUIREMENT_IDS = Object.freeze({
  CURRENT_RECORD: "land-current-record-evidence",
  PARCEL_IDENTITY: "land-parcel-identity-evidence",
  LEGAL_ACCESS: "land-legal-access-evidence",
  ZONING_USE: "land-zoning-use-evidence",
  ENVIRONMENTAL: "land-environmental-evidence",
  TITLE_TAX: "land-title-tax-evidence",
  MARKET_VALUE: "land-market-value-evidence",
});

const REQUIRED_FACT_DEFINITIONS = [
  [VACANT_LAND_FACT_IDS.ASSET_CLASSIFICATION, "Land asset classification", "property.assetType", true],
  [VACANT_LAND_FACT_IDS.PARCEL_IDENTITY, "Parcel identity", "property.parcelIdentity", true],
  [VACANT_LAND_FACT_IDS.ASKING_PRICE, "Asking price", "deal.askingPrice", true],
  [VACANT_LAND_FACT_IDS.SELLER_MOTIVATION, "Seller motivation", "seller.motivation", true],
  [VACANT_LAND_FACT_IDS.SELLER_TIMELINE, "Seller timeline", "seller.timeline", true],
  [VACANT_LAND_FACT_IDS.LEGAL_ACCESS, "Legal access", "property.legalAccess", true],
  [VACANT_LAND_FACT_IDS.ZONING, "Zoning", "property.zoning", true],
  [VACANT_LAND_FACT_IDS.PERMITTED_USE, "Permitted use", "property.permittedUse", true],
  [VACANT_LAND_FACT_IDS.FLOOD_STATUS, "Flood-zone status", "property.floodZoneStatus", true],
  [VACANT_LAND_FACT_IDS.WETLANDS_STATUS, "Wetlands status", "property.wetlandsStatus", true],
  [VACANT_LAND_FACT_IDS.TAXES_AND_LIENS, "Taxes and liens", "property.taxesAndLiens", true],
  [VACANT_LAND_FACT_IDS.COMPARABLE_LAND_VALUE, "Comparable land value", "property.comparableLandValue", true],
  [VACANT_LAND_FACT_IDS.PARCEL_SIZE_ACRES, "Parcel size", "property.parcelSizeAcres", false],
  [VACANT_LAND_FACT_IDS.ROAD_FRONTAGE, "Road frontage", "property.roadFrontage", false],
  [VACANT_LAND_FACT_IDS.UTILITIES, "Utilities", "property.utilities", false],
  [VACANT_LAND_FACT_IDS.WATER_SEWER_SEPTIC, "Water, sewer, or septic", "property.waterSewerSeptic", false],
  [VACANT_LAND_FACT_IDS.TOPOGRAPHY, "Topography", "property.topography", false],
  [VACANT_LAND_FACT_IDS.DEED_RESTRICTIONS, "Deed restrictions", "property.deedRestrictions", false],
  [VACANT_LAND_FACT_IDS.SUBDIVISION_POTENTIAL, "Subdivision potential", "property.subdivisionPotential", false],
  [VACANT_LAND_FACT_IDS.BUILDER_DEMAND, "Builder demand", "property.builderDemand", false],
  [VACANT_LAND_FACT_IDS.BUYER_DEMAND, "Land-buyer demand", "property.buyerDemand", false],
  [VACANT_LAND_FACT_IDS.LAND_COMPARABLES, "Land comparable records", "property.landComps", false],
];

export const VACANT_LAND_FACT_REGISTRY = Object.freeze(
  REQUIRED_FACT_DEFINITIONS.map(([factId, label, canonicalField, blocking]) =>
    Object.freeze({ factId, label, canonicalField, blocking })
  )
);

const EVIDENCE_REQUIREMENTS = [
  [VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.CURRENT_RECORD, "Current stored record", ["crm-current-state", "manual-entry", "imported-record"]],
  [VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.PARCEL_IDENTITY, "Parcel identity support", ["survey", "plat", "deed", "title-record", "crm-current-state"]],
  [VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.LEGAL_ACCESS, "Legal access support", ["deed", "survey", "plat", "title-record", "manual-research"]],
  [VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.ZONING_USE, "Zoning and permitted-use support", ["zoning-record", "manual-research", "document"]],
  [VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.ENVIRONMENTAL, "Flood and wetlands support", ["environmental-record", "manual-research", "document"]],
  [VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.TITLE_TAX, "Tax and lien support", ["title-record", "tax-record", "manual-research", "document"]],
  [VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.MARKET_VALUE, "Land value support", ["land-comparable-sale", "manual-land-value", "crm-current-state"]],
].map(([verificationRequirementId, label, acceptableSourceTypes]) => ({
  verificationRequirementId,
  label,
  description: `${label} must retain source provenance and does not become verified merely because it is stored.`,
  requiredFactIds: [],
  criticality: ASSET_STRATEGY_CRITICALITIES.BLOCKING,
  acceptableSourceTypes,
  humanReviewRequired: true,
}));

const REQUIRED_ANALYSIS_FACTS = Object.freeze([
  VACANT_LAND_FACT_IDS.ASSET_CLASSIFICATION,
  VACANT_LAND_FACT_IDS.PARCEL_IDENTITY,
  VACANT_LAND_FACT_IDS.ASKING_PRICE,
  VACANT_LAND_FACT_IDS.SELLER_MOTIVATION,
  VACANT_LAND_FACT_IDS.SELLER_TIMELINE,
  VACANT_LAND_FACT_IDS.LEGAL_ACCESS,
  VACANT_LAND_FACT_IDS.ZONING,
  VACANT_LAND_FACT_IDS.PERMITTED_USE,
  VACANT_LAND_FACT_IDS.FLOOD_STATUS,
  VACANT_LAND_FACT_IDS.WETLANDS_STATUS,
  VACANT_LAND_FACT_IDS.TAXES_AND_LIENS,
  VACANT_LAND_FACT_IDS.COMPARABLE_LAND_VALUE,
]);

export const VACANT_LAND_VALUATION_POLICY = Object.freeze({
  policyId: VACANT_LAND_VALUATION_POLICY_VERSION,
  policyVersion: VACANT_LAND_VALUATION_POLICY_VERSION,
  status: "active",
  sourcePriority: Object.freeze([
    "valid-persisted-land-comparables",
    "explicit-stored-indicated-land-value",
  ]),
  squareFeetPerAcre: 43560,
  minimumValidComparableCount: 1,
  aggregationMethod: "median-price-per-acre",
  assumptions: Object.freeze([
    "Only explicitly land-classified comparable records with positive sale price and acreage are eligible.",
    "No location, zoning, topography, utility, time, or parcel-size adjustment is applied.",
    "One or two comparable records provide limited market support.",
  ]),
});

export const VACANT_LAND_VALUATION_OPERATOR_DISCLOSURE =
  "Land valuation context compares asking price with the available indicated land-value evidence. It is not an appraisal, guaranteed resale value, or instruction to purchase.";

export const VACANT_LAND_ACQUISITION_STRATEGY = Object.freeze(
  normalizeAssetStrategyContract({
    strategyId: VACANT_LAND_STRATEGY_ID,
    strategyVersion: VACANT_LAND_STRATEGY_VERSION,
    label: "Vacant Land Acquisition Strategy v1",
    description:
      "A deterministic, evidence-linked strategy for continued human review of explicitly classified vacant residential land.",
    assetType: ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
    status: ASSET_STRATEGY_STATUSES.ACTIVE,
    effectiveTimestamp: "2026-08-09T00:00:00.000Z",
    capabilities: {
      requiredFacts: REQUIRED_FACT_DEFINITIONS.map(
        ([factId, label, canonicalField, blocking]) => ({
          factId,
          label,
          description: `${label} is part of Vacant Land Acquisition Strategy v1.`,
          canonicalField,
          criticality: blocking
            ? ASSET_STRATEGY_CRITICALITIES.BLOCKING
            : ASSET_STRATEGY_CRITICALITIES.ADVISORY,
          requiredFor: [
            ASSET_STRATEGY_REQUIREMENT_SCOPES.COMPLETENESS,
            ...(blocking
              ? [ASSET_STRATEGY_REQUIREMENT_SCOPES.PURSUIT_SCORING]
              : []),
          ],
          verificationRequirementIds: [
            VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.CURRENT_RECORD,
          ],
          evidenceRequired: true,
        })
      ),
      dataCompletenessRules: [
        {
          ruleId: "vacant-land-required-facts-v1",
          label: "Vacant land required facts",
          requiredFactIds: REQUIRED_ANALYSIS_FACTS,
          blockingFactIds: REQUIRED_ANALYSIS_FACTS,
          outputMetricIds: ["data-completeness"],
        },
      ],
      underwritingHooks: [
        {
          hookId: "vacant-land-valuation-context-v1",
          label: "Vacant land valuation context",
          inputFactIds: [
            VACANT_LAND_FACT_IDS.ASKING_PRICE,
            VACANT_LAND_FACT_IDS.PARCEL_SIZE_ACRES,
            VACANT_LAND_FACT_IDS.COMPARABLE_LAND_VALUE,
            VACANT_LAND_FACT_IDS.LAND_COMPARABLES,
          ],
          outputKeys: [
            "askingPricePerAcre",
            "indicatedLandValue",
            "indicatedValuePerAcre",
            "grossLandSpread",
            "discountToIndicatedValueRatio",
            "askingToIndicatedValueRatio",
          ],
          evidenceRequirementIds: [
            VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.MARKET_VALUE,
          ],
        },
      ],
      riskRules: [
        {
          ruleId: "vacant-land-feasibility-signals-v1",
          label: "Parcel feasibility review signals",
          requiredFactIds: [
            VACANT_LAND_FACT_IDS.LEGAL_ACCESS,
            VACANT_LAND_FACT_IDS.ZONING,
            VACANT_LAND_FACT_IDS.PERMITTED_USE,
            VACANT_LAND_FACT_IDS.FLOOD_STATUS,
            VACANT_LAND_FACT_IDS.WETLANDS_STATUS,
            VACANT_LAND_FACT_IDS.TAXES_AND_LIENS,
          ],
          blockingFactIds: [VACANT_LAND_FACT_IDS.LEGAL_ACCESS],
          outputMetricIds: ["risk-level"],
          actionCodes: ["manual-review"],
        },
      ],
      pursuitScoringHooks: [
        {
          hookId: "vacant-land-pursuit-scoring-v1",
          label: "Vacant land Pursuit Scoring v1",
          inputFactIds: [
            ...REQUIRED_ANALYSIS_FACTS,
            VACANT_LAND_FACT_IDS.UTILITIES,
            VACANT_LAND_FACT_IDS.WATER_SEWER_SEPTIC,
            VACANT_LAND_FACT_IDS.ROAD_FRONTAGE,
            VACANT_LAND_FACT_IDS.LAND_COMPARABLES,
            VACANT_LAND_FACT_IDS.BUILDER_DEMAND,
            VACANT_LAND_FACT_IDS.BUYER_DEMAND,
          ],
          evidenceRequirementIds: [
            VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.CURRENT_RECORD,
            VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.MARKET_VALUE,
            VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.LEGAL_ACCESS,
            VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.ZONING_USE,
            VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.ENVIRONMENTAL,
          ],
          outputMetricIds: ["pursuit-score"],
        },
      ],
      readinessGates: [
        {
          gateId: "vacant-land-readiness-placeholder-v1",
          label: "Vacant land readiness remains unfinished until DI-04",
          requiredFactIds: REQUIRED_ANALYSIS_FACTS,
          blockingFactIds: REQUIRED_ANALYSIS_FACTS,
          outputMetricIds: ["offer-readiness"],
        },
      ],
      offerLogic: [
        {
          ruleId: "vacant-land-offer-review-only-v1",
          label: "Vacant land offer review only",
          requiredFactIds: REQUIRED_ANALYSIS_FACTS,
          blockingFactIds: REQUIRED_ANALYSIS_FACTS,
          actionCodes: ["prepare-review-only-land-context"],
        },
      ],
      exitStrategies: [
        "land-wholesale",
        "builder-disposition-review",
        "buy-and-resell-review",
        "seller-finance-exploration",
        "subdivision-exploration",
        "entitlement-exploration",
        "long-term-hold-review",
      ].map((exitStrategyId) => ({
        exitStrategyId,
        label: exitStrategyId.replaceAll("-", " "),
        requiredFactIds: [
          VACANT_LAND_FACT_IDS.ASKING_PRICE,
          VACANT_LAND_FACT_IDS.COMPARABLE_LAND_VALUE,
        ],
        evidenceRequirementIds: [
          VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.MARKET_VALUE,
        ],
      })),
      buyerMatchingRules: [
        {
          ruleId: "vacant-land-buyer-input-v1",
          label: "Vacant land buyer input contract",
          requiredFactIds: [
            VACANT_LAND_FACT_IDS.PARCEL_IDENTITY,
            VACANT_LAND_FACT_IDS.PARCEL_SIZE_ACRES,
            VACANT_LAND_FACT_IDS.ZONING,
            VACANT_LAND_FACT_IDS.PERMITTED_USE,
          ],
          blockingFactIds: [],
          actionCodes: ["prepare-land-buyer-context"],
        },
      ],
      verificationRequirements: EVIDENCE_REQUIREMENTS,
    },
  })
);

export const VACANT_LAND_FEASIBILITY_SIGNAL_SEVERITIES = Object.freeze({
  ATTENTION: "attention",
  SIGNIFICANT: "significant",
  BLOCKING: "blocking",
});

export const VACANT_LAND_EXIT_CANDIDATE_STATES = Object.freeze({
  CANDIDATE: "candidate",
  REVIEWABLE: "reviewable",
  MANUAL_REVIEW_REQUIRED: "manual-review-required",
  BLOCKED: "blocked",
  NOT_EVALUATED: "not-evaluated",
});

export const VACANT_LAND_REVIEW_STATES = Object.freeze({
  CLASSIFY_PARCEL: "classify-parcel",
  VERIFY_CRITICAL_FACTS: "verify-critical-land-facts",
  REVIEW_ACCESS_ZONING: "review-access-and-zoning",
  REVIEW_ENVIRONMENTAL: "review-environmental-constraints",
  REVIEW_ECONOMICS: "review-land-economics",
  REVIEW_EXIT_OPTIONS: "review-exit-options",
  MANUAL_REVIEW_REQUIRED: "manual-review-required",
  UNAVAILABLE: "unavailable",
});

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function safeList(values, limit = 80) {
  return uniqueStrings(Array.isArray(values) ? values.filter(Boolean) : []).slice(
    0,
    limit
  );
}

export function normalizeVacantLandComparable(value) {
  const source = safeObject(value);
  return {
    comparableId: source.comparableId || source.id || null,
    assetType:
      source.assetType || source.asset_type || source.property_type || null,
    salePrice: finiteNumber(source.salePrice ?? source.sale_price),
    saleDate: normalizeDecisionTimestamp(source.saleDate || source.sale_date),
    acreage: finiteNumber(
      source.acreage ?? source.acres ?? source.parcel_acres
    ),
    location: source.location || source.address || source.parcel_location || null,
    sourceType: source.sourceType || source.source_type || null,
    sourceTimestamp: normalizeDecisionTimestamp(
      source.sourceTimestamp || source.source_timestamp || source.updated_at
    ),
    evidenceReferenceIds: safeList(source.evidenceReferenceIds),
  };
}

export function normalizeVacantLandValuationResult(value) {
  const source = safeObject(value);
  return {
    contractVersion: VACANT_LAND_VALUATION_RESULT_VERSION,
    strategyId: VACANT_LAND_STRATEGY_ID,
    strategyVersion: VACANT_LAND_STRATEGY_VERSION,
    policyVersion: VACANT_LAND_VALUATION_POLICY_VERSION,
    evaluationState: source.evaluationState || DECISION_EVALUATION_STATES.NOT_EVALUATED,
    askingPrice: finiteNumber(source.askingPrice),
    parcelSizeAcres: finiteNumber(source.parcelSizeAcres),
    askingPricePerAcre: finiteNumber(source.askingPricePerAcre),
    indicatedLandValue: finiteNumber(source.indicatedLandValue),
    indicatedValuePerAcre: finiteNumber(source.indicatedValuePerAcre),
    grossLandSpread: finiteNumber(source.grossLandSpread),
    discountToIndicatedValueRatio: finiteNumber(
      source.discountToIndicatedValueRatio
    ),
    askingToIndicatedValueRatio: finiteNumber(source.askingToIndicatedValueRatio),
    comparableCount: Math.max(0, Math.trunc(finiteNumber(source.comparableCount) || 0)),
    medianComparablePricePerAcre: finiteNumber(
      source.medianComparablePricePerAcre
    ),
    valuationSource: source.valuationSource || null,
    comparableRecords: (Array.isArray(source.comparableRecords)
      ? source.comparableRecords
      : []
    ).slice(0, 25),
    inputEvidenceIds: safeList(source.inputEvidenceIds),
    blockingIssueIds: safeList(source.blockingIssueIds, 40),
    partialDataWarnings: safeList(source.partialDataWarnings, 16),
    assumptions: (Array.isArray(source.assumptions) ? source.assumptions : []).slice(
      0,
      12
    ),
    operatorDisclosure:
      source.operatorDisclosure || VACANT_LAND_VALUATION_OPERATOR_DISCLOSURE,
    evaluatedTimestamp: normalizeDecisionTimestamp(source.evaluatedTimestamp),
    sourceMode: source.sourceMode || DECISION_SOURCE_MODES.DETERMINISTIC,
  };
}

export function normalizeVacantLandFeasibilitySignal(value) {
  const source = safeObject(value);
  return {
    signalId: source.signalId || source.id || null,
    label: source.label || null,
    explanation: source.explanation || null,
    severity: Object.values(VACANT_LAND_FEASIBILITY_SIGNAL_SEVERITIES).includes(
      source.severity
    )
      ? source.severity
      : VACANT_LAND_FEASIBILITY_SIGNAL_SEVERITIES.ATTENTION,
    relatedFactIds: safeList(source.relatedFactIds, 20),
    evidenceReferenceIds: safeList(source.evidenceReferenceIds),
    relatedSection: source.relatedSection || "property",
    rulesetVersion: source.rulesetVersion || "vacant-land-feasibility-signals-v1",
  };
}

export function normalizeVacantLandExitCandidate(value) {
  const source = safeObject(value);
  return {
    candidateId: source.candidateId || source.id || null,
    label: source.label || null,
    state: Object.values(VACANT_LAND_EXIT_CANDIDATE_STATES).includes(source.state)
      ? source.state
      : VACANT_LAND_EXIT_CANDIDATE_STATES.NOT_EVALUATED,
    explanation: source.explanation || null,
    supportingValueIds: safeList(source.supportingValueIds, 20),
    evidenceReferenceIds: safeList(source.evidenceReferenceIds),
    missingRequirementIds: safeList(source.missingRequirementIds, 20),
    manualReviewRequirements: safeList(source.manualReviewRequirements, 12),
    limitationDisclosure: source.limitationDisclosure || null,
  };
}

export function validateVacantLandStrategyContract(
  value = VACANT_LAND_ACQUISITION_STRATEGY
) {
  const validation = validateAssetStrategyContract(value);
  const errors = [...validation.errors];
  const strategy = validation.contract;
  if (strategy.strategyId !== VACANT_LAND_STRATEGY_ID) {
    errors.push("Vacant Land Strategy ID does not match v1.");
  }
  if (strategy.strategyVersion !== VACANT_LAND_STRATEGY_VERSION) {
    errors.push("Vacant Land Strategy version does not match v1.");
  }
  if (strategy.status !== ASSET_STRATEGY_STATUSES.ACTIVE) {
    errors.push("Vacant Land Strategy must be active.");
  }
  if (strategy.assetType !== ASSET_TYPES.VACANT_RESIDENTIAL_LAND) {
    errors.push("Vacant Land Strategy cannot target another asset type.");
  }
  const factIds = strategy.capabilities.requiredFacts.map((fact) => fact.factId);
  if (factIds.some((id) => /arv|repair|rent|mao|flip-margin/.test(id))) {
    errors.push("Vacant Land Strategy contains a prohibited residential fact.");
  }
  return {
    valid: errors.length === 0,
    errors: uniqueStrings(errors),
    strategy,
  };
}

export { REQUIRED_ANALYSIS_FACTS as VACANT_LAND_REQUIRED_ANALYSIS_FACT_IDS };
