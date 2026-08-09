import { uniqueStrings } from "../../../utils/text";
import { ASSET_TYPES } from "../assetStrategyContracts";
import { DECISION_SOURCE_MODES } from "../../decision-intelligence/decisionContracts";
import {
  PURSUIT_SCORING_CATEGORY_IDS,
  PURSUIT_SCORING_PARTIAL_POLICIES,
  PURSUIT_SCORING_PROFILE_STATUSES,
  PURSUIT_SCORING_ROUNDING_POLICIES,
  PURSUIT_SCORING_VALUE_BEHAVIORS,
  PURSUIT_SCORING_VALUE_DIRECTIONS,
  normalizePursuitScoringProfile,
  validatePursuitScoringProfile,
  validatePursuitScoringProfileHook,
} from "../../decision-intelligence/pursuit-scoring/pursuitScoringContracts";
import {
  VACANT_LAND_ACQUISITION_STRATEGY,
  VACANT_LAND_EVIDENCE_REQUIREMENT_IDS,
  VACANT_LAND_FACT_IDS,
  VACANT_LAND_PURSUIT_PROFILE_ID,
  VACANT_LAND_PURSUIT_RULESET_VERSION,
  VACANT_LAND_REQUIREMENT_IDS,
  VACANT_LAND_STRATEGY_ID,
  VACANT_LAND_STRATEGY_VERSION,
} from "./vacantLandStrategyContracts";

// Distinct responsibility: define and validate the active production Pursuit
// Scoring profile owned by Vacant Land Acquisition Strategy v1.
export const VACANT_LAND_PURSUIT_FACTOR_IDS = Object.freeze({
  DISCOUNT_TO_INDICATED_VALUE: "land-discount-to-indicated-value",
  LEGAL_ACCESS: "land-legal-access",
  ZONING_PERMITTED_USE: "land-zoning-permitted-use-clarity",
  FLOOD_WETLANDS: "land-flood-wetlands-review",
  UTILITIES_SITE_SERVICES: "land-utilities-site-services",
  ROAD_FRONTAGE: "land-road-frontage",
  SELLER_MOTIVATION: "land-seller-motivation",
  SELLER_TIMELINE: "land-seller-timeline",
  COMPARABLE_LAND_SUPPORT: "land-comparable-support",
  BUILDER_BUYER_DEMAND: "land-builder-buyer-demand",
  EXIT_OPTION_FIT: "land-exit-option-fit",
});

export const VACANT_LAND_REQUIRED_PURSUIT_FACTOR_IDS = Object.freeze([
  VACANT_LAND_PURSUIT_FACTOR_IDS.DISCOUNT_TO_INDICATED_VALUE,
  VACANT_LAND_PURSUIT_FACTOR_IDS.LEGAL_ACCESS,
  VACANT_LAND_PURSUIT_FACTOR_IDS.ZONING_PERMITTED_USE,
  VACANT_LAND_PURSUIT_FACTOR_IDS.FLOOD_WETLANDS,
  VACANT_LAND_PURSUIT_FACTOR_IDS.SELLER_MOTIVATION,
  VACANT_LAND_PURSUIT_FACTOR_IDS.SELLER_TIMELINE,
  VACANT_LAND_PURSUIT_FACTOR_IDS.COMPARABLE_LAND_SUPPORT,
  VACANT_LAND_PURSUIT_FACTOR_IDS.EXIT_OPTION_FIT,
]);

export const VACANT_LAND_OPTIONAL_PURSUIT_FACTOR_IDS = Object.freeze([
  VACANT_LAND_PURSUIT_FACTOR_IDS.UTILITIES_SITE_SERVICES,
  VACANT_LAND_PURSUIT_FACTOR_IDS.ROAD_FRONTAGE,
  VACANT_LAND_PURSUIT_FACTOR_IDS.BUILDER_BUYER_DEMAND,
]);

const ACCEPTED_SOURCE_MODES = Object.freeze([
  DECISION_SOURCE_MODES.DETERMINISTIC,
  DECISION_SOURCE_MODES.DETERMINISTIC_COMPATIBILITY,
]);

function factor({
  blockingRequirementIds,
  categoryId,
  evidenceRequirementIds,
  factorId,
  inputFactIds,
  label,
  minimumEvidenceCount = 1,
  optional = false,
  weight,
}) {
  return {
    factorId,
    categoryId,
    label,
    description: `${label} is evaluated by Vacant Land Acquisition Strategy v1 from normalized, evidence-linked parcel facts.`,
    maximumContribution: weight,
    weightWithinCategory: weight,
    evaluationMethod: "vacant-land-strategy-v1-threshold-table",
    valueDirection: PURSUIT_SCORING_VALUE_DIRECTIONS.THRESHOLD_TABLE,
    inputFactIds,
    blockingRequirementIds,
    evidenceRequirementIds,
    acceptedSourceModes: ACCEPTED_SOURCE_MODES,
    missingValueBehavior: optional
      ? PURSUIT_SCORING_VALUE_BEHAVIORS.OMIT
      : PURSUIT_SCORING_VALUE_BEHAVIORS.BLOCK,
    unknownValueBehavior: optional
      ? PURSUIT_SCORING_VALUE_BEHAVIORS.OMIT
      : PURSUIT_SCORING_VALUE_BEHAVIORS.BLOCK,
    notApplicableBehavior: PURSUIT_SCORING_VALUE_BEHAVIORS.NOT_APPLICABLE,
    minimumEvidenceCount,
    compatibilityEvidenceAllowed: true,
    explanationTemplate:
      "The contribution follows the versioned Vacant Land Strategy threshold table and retains all Evidence references.",
    applicableAssetType: ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
    rulesetVersion: VACANT_LAND_PURSUIT_RULESET_VERSION,
  };
}

function category({ blocking = true, categoryId, factorIds, label, minimum, weight }) {
  return {
    categoryId,
    label,
    description: `${label} combines only declared Vacant Land Strategy v1 factors.`,
    weight,
    minimumEvaluatedFactorCount: minimum,
    blocking,
    factorIds,
    explanation: `${label} uses its versioned land-specific factor weights.`,
    applicableAssetType: ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
    rulesetVersion: VACANT_LAND_PURSUIT_RULESET_VERSION,
  };
}

const FACTORS = [
  factor({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.ECONOMICS,
    factorId: VACANT_LAND_PURSUIT_FACTOR_IDS.DISCOUNT_TO_INDICATED_VALUE,
    label: "Discount to indicated land value",
    weight: 100,
    inputFactIds: [
      VACANT_LAND_FACT_IDS.ASKING_PRICE,
      VACANT_LAND_FACT_IDS.COMPARABLE_LAND_VALUE,
    ],
    blockingRequirementIds: [
      VACANT_LAND_REQUIREMENT_IDS.ASKING_PRICE,
      VACANT_LAND_REQUIREMENT_IDS.VALUE_SUPPORT,
    ],
    evidenceRequirementIds: [
      VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.CURRENT_RECORD,
      VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.MARKET_VALUE,
    ],
    minimumEvidenceCount: 2,
  }),
  factor({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.ASSET_FEASIBILITY,
    factorId: VACANT_LAND_PURSUIT_FACTOR_IDS.LEGAL_ACCESS,
    label: "Legal access",
    weight: 30,
    inputFactIds: [VACANT_LAND_FACT_IDS.LEGAL_ACCESS],
    blockingRequirementIds: [VACANT_LAND_REQUIREMENT_IDS.LEGAL_ACCESS],
    evidenceRequirementIds: [
      VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.LEGAL_ACCESS,
    ],
  }),
  factor({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.ASSET_FEASIBILITY,
    factorId: VACANT_LAND_PURSUIT_FACTOR_IDS.ZONING_PERMITTED_USE,
    label: "Zoning and permitted-use clarity",
    weight: 20,
    inputFactIds: [
      VACANT_LAND_FACT_IDS.ZONING,
      VACANT_LAND_FACT_IDS.PERMITTED_USE,
    ],
    blockingRequirementIds: [
      VACANT_LAND_REQUIREMENT_IDS.ZONING,
      VACANT_LAND_REQUIREMENT_IDS.PERMITTED_USE,
    ],
    evidenceRequirementIds: [
      VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.ZONING_USE,
    ],
  }),
  factor({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.ASSET_FEASIBILITY,
    factorId: VACANT_LAND_PURSUIT_FACTOR_IDS.FLOOD_WETLANDS,
    label: "Flood and wetlands review",
    weight: 25,
    inputFactIds: [
      VACANT_LAND_FACT_IDS.FLOOD_STATUS,
      VACANT_LAND_FACT_IDS.WETLANDS_STATUS,
    ],
    blockingRequirementIds: [
      VACANT_LAND_REQUIREMENT_IDS.FLOOD_STATUS,
      VACANT_LAND_REQUIREMENT_IDS.WETLANDS_STATUS,
    ],
    evidenceRequirementIds: [
      VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.ENVIRONMENTAL,
    ],
  }),
  factor({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.ASSET_FEASIBILITY,
    factorId: VACANT_LAND_PURSUIT_FACTOR_IDS.UTILITIES_SITE_SERVICES,
    label: "Utilities and site services",
    weight: 15,
    optional: true,
    inputFactIds: [
      VACANT_LAND_FACT_IDS.UTILITIES,
      VACANT_LAND_FACT_IDS.WATER_SEWER_SEPTIC,
    ],
    blockingRequirementIds: [],
    evidenceRequirementIds: [
      VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.CURRENT_RECORD,
    ],
  }),
  factor({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.ASSET_FEASIBILITY,
    factorId: VACANT_LAND_PURSUIT_FACTOR_IDS.ROAD_FRONTAGE,
    label: "Road frontage",
    weight: 10,
    optional: true,
    inputFactIds: [VACANT_LAND_FACT_IDS.ROAD_FRONTAGE],
    blockingRequirementIds: [],
    evidenceRequirementIds: [
      VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.CURRENT_RECORD,
    ],
  }),
  factor({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.SELLER_SITUATION,
    factorId: VACANT_LAND_PURSUIT_FACTOR_IDS.SELLER_MOTIVATION,
    label: "Seller motivation",
    weight: 100,
    inputFactIds: [VACANT_LAND_FACT_IDS.SELLER_MOTIVATION],
    blockingRequirementIds: [
      VACANT_LAND_REQUIREMENT_IDS.SELLER_MOTIVATION,
    ],
    evidenceRequirementIds: [
      VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.CURRENT_RECORD,
    ],
  }),
  factor({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.TIMING,
    factorId: VACANT_LAND_PURSUIT_FACTOR_IDS.SELLER_TIMELINE,
    label: "Seller timeline",
    weight: 100,
    inputFactIds: [VACANT_LAND_FACT_IDS.SELLER_TIMELINE],
    blockingRequirementIds: [VACANT_LAND_REQUIREMENT_IDS.SELLER_TIMELINE],
    evidenceRequirementIds: [
      VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.CURRENT_RECORD,
    ],
  }),
  factor({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.MARKET_EXIT_FIT,
    factorId: VACANT_LAND_PURSUIT_FACTOR_IDS.COMPARABLE_LAND_SUPPORT,
    label: "Comparable-land support",
    weight: 50,
    inputFactIds: [
      VACANT_LAND_FACT_IDS.COMPARABLE_LAND_VALUE,
      VACANT_LAND_FACT_IDS.LAND_COMPARABLES,
    ],
    blockingRequirementIds: [VACANT_LAND_REQUIREMENT_IDS.VALUE_SUPPORT],
    evidenceRequirementIds: [
      VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.MARKET_VALUE,
    ],
  }),
  factor({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.MARKET_EXIT_FIT,
    factorId: VACANT_LAND_PURSUIT_FACTOR_IDS.BUILDER_BUYER_DEMAND,
    label: "Builder and land-buyer demand",
    weight: 30,
    optional: true,
    inputFactIds: [
      VACANT_LAND_FACT_IDS.BUILDER_DEMAND,
      VACANT_LAND_FACT_IDS.BUYER_DEMAND,
    ],
    blockingRequirementIds: [],
    evidenceRequirementIds: [
      VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.CURRENT_RECORD,
    ],
  }),
  factor({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.MARKET_EXIT_FIT,
    factorId: VACANT_LAND_PURSUIT_FACTOR_IDS.EXIT_OPTION_FIT,
    label: "Land exit-option fit",
    weight: 20,
    inputFactIds: [
      VACANT_LAND_FACT_IDS.ASKING_PRICE,
      VACANT_LAND_FACT_IDS.COMPARABLE_LAND_VALUE,
      VACANT_LAND_FACT_IDS.ZONING,
      VACANT_LAND_FACT_IDS.PERMITTED_USE,
    ],
    blockingRequirementIds: [
      VACANT_LAND_REQUIREMENT_IDS.ASKING_PRICE,
      VACANT_LAND_REQUIREMENT_IDS.VALUE_SUPPORT,
    ],
    evidenceRequirementIds: [
      VACANT_LAND_EVIDENCE_REQUIREMENT_IDS.MARKET_VALUE,
    ],
  }),
];

const CATEGORIES = [
  category({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.ECONOMICS,
    label: "Economics",
    weight: 30,
    minimum: 1,
    factorIds: [VACANT_LAND_PURSUIT_FACTOR_IDS.DISCOUNT_TO_INDICATED_VALUE],
  }),
  category({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.ASSET_FEASIBILITY,
    label: "Asset feasibility",
    weight: 35,
    minimum: 3,
    factorIds: [
      VACANT_LAND_PURSUIT_FACTOR_IDS.LEGAL_ACCESS,
      VACANT_LAND_PURSUIT_FACTOR_IDS.ZONING_PERMITTED_USE,
      VACANT_LAND_PURSUIT_FACTOR_IDS.FLOOD_WETLANDS,
      VACANT_LAND_PURSUIT_FACTOR_IDS.UTILITIES_SITE_SERVICES,
      VACANT_LAND_PURSUIT_FACTOR_IDS.ROAD_FRONTAGE,
    ],
  }),
  category({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.SELLER_SITUATION,
    label: "Seller situation",
    weight: 15,
    minimum: 1,
    factorIds: [VACANT_LAND_PURSUIT_FACTOR_IDS.SELLER_MOTIVATION],
  }),
  category({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.TIMING,
    label: "Timing",
    weight: 10,
    minimum: 1,
    factorIds: [VACANT_LAND_PURSUIT_FACTOR_IDS.SELLER_TIMELINE],
  }),
  category({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.MARKET_EXIT_FIT,
    label: "Market and exit fit",
    weight: 10,
    minimum: 2,
    factorIds: [
      VACANT_LAND_PURSUIT_FACTOR_IDS.COMPARABLE_LAND_SUPPORT,
      VACANT_LAND_PURSUIT_FACTOR_IDS.BUILDER_BUYER_DEMAND,
      VACANT_LAND_PURSUIT_FACTOR_IDS.EXIT_OPTION_FIT,
    ],
  }),
];

export const VACANT_LAND_PURSUIT_SCORING_PROFILE = Object.freeze(
  normalizePursuitScoringProfile({
    profileId: VACANT_LAND_PURSUIT_PROFILE_ID,
    strategyId: VACANT_LAND_STRATEGY_ID,
    strategyVersion: VACANT_LAND_STRATEGY_VERSION,
    strategyHookId: "vacant-land-pursuit-scoring-v1",
    assetType: ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
    profileVersion: VACANT_LAND_PURSUIT_PROFILE_ID,
    status: PURSUIT_SCORING_PROFILE_STATUSES.ACTIVE,
    label: "Vacant Land Pursuit Scoring v1",
    description:
      "Production vacant-land prioritization for continued human acquisition review.",
    categoryDefinitions: CATEGORIES,
    factorDefinitions: FACTORS,
    minimumEvaluationRequirements: {
      minimumEvaluatedCategoryCount: 5,
      minimumEvaluatedFactorCount: 8,
      requiredFactorIds: VACANT_LAND_REQUIRED_PURSUIT_FACTOR_IDS,
    },
    blockingRequirementIds: [
      VACANT_LAND_REQUIREMENT_IDS.PARCEL_IDENTITY,
      VACANT_LAND_REQUIREMENT_IDS.ASKING_PRICE,
      VACANT_LAND_REQUIREMENT_IDS.SELLER_MOTIVATION,
      VACANT_LAND_REQUIREMENT_IDS.SELLER_TIMELINE,
      VACANT_LAND_REQUIREMENT_IDS.LEGAL_ACCESS,
      VACANT_LAND_REQUIREMENT_IDS.ZONING,
      VACANT_LAND_REQUIREMENT_IDS.PERMITTED_USE,
      VACANT_LAND_REQUIREMENT_IDS.FLOOD_STATUS,
      VACANT_LAND_REQUIREMENT_IDS.WETLANDS_STATUS,
      VACANT_LAND_REQUIREMENT_IDS.TAXES_AND_LIENS,
      VACANT_LAND_REQUIREMENT_IDS.VALUE_SUPPORT,
    ],
    partialEvaluationPolicy:
      PURSUIT_SCORING_PARTIAL_POLICIES.ALLOW_OPTIONAL_OMISSIONS,
    roundingPolicy: PURSUIT_SCORING_ROUNDING_POLICIES.NEAREST_INTEGER,
    rulesetVersion: VACANT_LAND_PURSUIT_RULESET_VERSION,
    evidenceAndProvenanceRequirements: {
      requireEvidenceForContributingFactors: true,
      allowCompatibilityEvidence: true,
      acceptedSourceModes: ACCEPTED_SOURCE_MODES,
    },
    effectiveTimestamp: "2026-08-09T00:00:00.000Z",
    compatibilityWarnings: [
      "Current CRM land fields may contribute only as explicitly labeled compatibility Evidence; persisted does not mean independently verified.",
    ],
  })
);

export function validateVacantLandPursuitProfile(
  value = VACANT_LAND_PURSUIT_SCORING_PROFILE,
  strategy = VACANT_LAND_ACQUISITION_STRATEGY
) {
  const profileValidation = validatePursuitScoringProfile(value);
  const hookValidation = validatePursuitScoringProfileHook({
    profile: value,
    strategyContract: strategy,
  });
  const errors = [...profileValidation.errors, ...hookValidation.errors];
  const profile = profileValidation.profile;
  if (profile.profileId !== VACANT_LAND_PURSUIT_PROFILE_ID) {
    errors.push("Vacant Land Pursuit profile ID does not match v1.");
  }
  if (
    profile.strategyId !== VACANT_LAND_STRATEGY_ID ||
    profile.strategyVersion !== VACANT_LAND_STRATEGY_VERSION
  ) {
    errors.push("Vacant Land Pursuit profile does not match Strategy v1.");
  }
  if (profile.status !== PURSUIT_SCORING_PROFILE_STATUSES.ACTIVE) {
    errors.push("Vacant Land Pursuit profile must be active in production.");
  }
  if (profile.assetType !== ASSET_TYPES.VACANT_RESIDENTIAL_LAND) {
    errors.push("Vacant Land Pursuit profile cannot target another asset type.");
  }
  const serializedFactors = JSON.stringify(
    profile.factorDefinitions.map((factorDefinition) => ({
      factorId: factorDefinition.factorId,
      inputFactIds: factorDefinition.inputFactIds,
    }))
  ).toLowerCase();
  if (/arv|repair|rent|house-mao|lead_score|ai-/.test(serializedFactors)) {
    errors.push("Vacant Land Pursuit profile contains a prohibited input.");
  }
  return {
    valid: errors.length === 0,
    errors: uniqueStrings(errors),
    profile,
  };
}
