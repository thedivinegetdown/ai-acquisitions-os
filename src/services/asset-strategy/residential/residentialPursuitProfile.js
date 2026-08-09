import { uniqueStrings } from "../../../utils/text";
import { ASSET_TYPES } from "../assetStrategyContracts";
import {
  DECISION_SOURCE_MODES,
} from "../../decision-intelligence/decisionContracts";
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
  RESIDENTIAL_ACQUISITION_STRATEGY,
  RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS,
  RESIDENTIAL_FACT_IDS,
  RESIDENTIAL_PURSUIT_PROFILE_ID,
  RESIDENTIAL_PURSUIT_RULESET_VERSION,
  RESIDENTIAL_REQUIREMENT_IDS,
  RESIDENTIAL_STRATEGY_ID,
  RESIDENTIAL_STRATEGY_VERSION,
} from "./residentialStrategyContracts";

// Distinct responsibility: define and validate the one active production
// Pursuit Scoring profile owned by Residential Acquisition Strategy v1.
export const RESIDENTIAL_PURSUIT_FACTOR_IDS = Object.freeze({
  ACQUISITION_CEILING_SPREAD: "residential-acquisition-ceiling-spread",
  PROJECTED_FLIP_GROSS_MARGIN:
    "residential-projected-flip-gross-margin-ratio",
  SELLER_MOTIVATION: "residential-seller-motivation",
  MORTGAGE_FLEXIBILITY: "residential-mortgage-flexibility",
  SELLER_TIMELINE: "residential-seller-timeline",
  REPAIR_BURDEN: "residential-repair-burden",
  MARKET_VALUE_SUPPORT: "residential-market-value-support",
  EXIT_OPTION_FIT: "residential-exit-option-fit",
  OCCUPANCY_COMPLEXITY: "residential-occupancy-complexity",
});

export const RESIDENTIAL_REQUIRED_PURSUIT_FACTOR_IDS = Object.freeze([
  RESIDENTIAL_PURSUIT_FACTOR_IDS.ACQUISITION_CEILING_SPREAD,
  RESIDENTIAL_PURSUIT_FACTOR_IDS.PROJECTED_FLIP_GROSS_MARGIN,
  RESIDENTIAL_PURSUIT_FACTOR_IDS.SELLER_MOTIVATION,
  RESIDENTIAL_PURSUIT_FACTOR_IDS.SELLER_TIMELINE,
  RESIDENTIAL_PURSUIT_FACTOR_IDS.REPAIR_BURDEN,
  RESIDENTIAL_PURSUIT_FACTOR_IDS.MARKET_VALUE_SUPPORT,
  RESIDENTIAL_PURSUIT_FACTOR_IDS.EXIT_OPTION_FIT,
]);

export const RESIDENTIAL_OPTIONAL_PURSUIT_FACTOR_IDS = Object.freeze([
  RESIDENTIAL_PURSUIT_FACTOR_IDS.MORTGAGE_FLEXIBILITY,
  RESIDENTIAL_PURSUIT_FACTOR_IDS.OCCUPANCY_COMPLEXITY,
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
  minimumEvidenceCount = inputFactIds.length,
  optional = false,
  weight,
}) {
  return {
    factorId,
    categoryId,
    label,
    description: `${label} is evaluated by Residential Acquisition Strategy v1 from normalized, evidence-linked facts.`,
    maximumContribution: weight,
    weightWithinCategory: weight,
    evaluationMethod: "residential-strategy-v1-threshold-table",
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
    minimumEvidenceCount: Math.max(1, minimumEvidenceCount),
    compatibilityEvidenceAllowed: true,
    explanationTemplate:
      "The contribution is determined by the versioned Residential Strategy threshold table and retained Evidence references.",
    applicableAssetType: ASSET_TYPES.RESIDENTIAL_HOME,
    rulesetVersion: RESIDENTIAL_PURSUIT_RULESET_VERSION,
  };
}

function category({ blocking = true, categoryId, factorIds, label, minimum, weight }) {
  return {
    categoryId,
    label,
    description: `${label} combines only the declared Residential Strategy v1 factors.`,
    weight,
    minimumEvaluatedFactorCount: minimum,
    blocking,
    factorIds,
    explanation: `${label} uses its versioned Residential Strategy factor weights.`,
    applicableAssetType: ASSET_TYPES.RESIDENTIAL_HOME,
    rulesetVersion: RESIDENTIAL_PURSUIT_RULESET_VERSION,
  };
}

const FACTORS = [
  factor({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.ECONOMICS,
    factorId: RESIDENTIAL_PURSUIT_FACTOR_IDS.ACQUISITION_CEILING_SPREAD,
    label: "Acquisition ceiling spread",
    weight: 60,
    inputFactIds: [
      RESIDENTIAL_FACT_IDS.ASKING_PRICE,
      RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
      RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE,
    ],
    blockingRequirementIds: [
      RESIDENTIAL_REQUIREMENT_IDS.ASKING_PRICE,
      RESIDENTIAL_REQUIREMENT_IDS.AFTER_REPAIR_VALUE,
      RESIDENTIAL_REQUIREMENT_IDS.REPAIR_ESTIMATE,
    ],
    evidenceRequirementIds: [
      RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.CURRENT_RECORD,
      RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.MARKET_VALUE,
    ],
  }),
  factor({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.ECONOMICS,
    factorId: RESIDENTIAL_PURSUIT_FACTOR_IDS.PROJECTED_FLIP_GROSS_MARGIN,
    label: "Projected flip gross-margin ratio",
    weight: 40,
    inputFactIds: [
      RESIDENTIAL_FACT_IDS.ASKING_PRICE,
      RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
      RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE,
    ],
    blockingRequirementIds: [
      RESIDENTIAL_REQUIREMENT_IDS.ASKING_PRICE,
      RESIDENTIAL_REQUIREMENT_IDS.AFTER_REPAIR_VALUE,
      RESIDENTIAL_REQUIREMENT_IDS.REPAIR_ESTIMATE,
    ],
    evidenceRequirementIds: [
      RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.CURRENT_RECORD,
      RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.MARKET_VALUE,
    ],
  }),
  factor({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.SELLER_SITUATION,
    factorId: RESIDENTIAL_PURSUIT_FACTOR_IDS.SELLER_MOTIVATION,
    label: "Seller motivation",
    weight: 70,
    inputFactIds: [RESIDENTIAL_FACT_IDS.SELLER_MOTIVATION],
    blockingRequirementIds: [RESIDENTIAL_REQUIREMENT_IDS.SELLER_MOTIVATION],
    evidenceRequirementIds: [
      RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.SELLER_CONTEXT,
    ],
  }),
  factor({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.SELLER_SITUATION,
    factorId: RESIDENTIAL_PURSUIT_FACTOR_IDS.MORTGAGE_FLEXIBILITY,
    label: "Mortgage flexibility",
    weight: 30,
    optional: true,
    minimumEvidenceCount: 4,
    inputFactIds: [
      RESIDENTIAL_FACT_IDS.MORTGAGE_BALANCE,
      RESIDENTIAL_FACT_IDS.MORTGAGE_STATUS,
      RESIDENTIAL_FACT_IDS.ASKING_PRICE,
      RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
      RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE,
    ],
    blockingRequirementIds: [],
    evidenceRequirementIds: [
      RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.CURRENT_RECORD,
    ],
  }),
  factor({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.TIMING,
    factorId: RESIDENTIAL_PURSUIT_FACTOR_IDS.SELLER_TIMELINE,
    label: "Seller timeline",
    weight: 100,
    inputFactIds: [RESIDENTIAL_FACT_IDS.SELLER_TIMELINE],
    blockingRequirementIds: [RESIDENTIAL_REQUIREMENT_IDS.SELLER_TIMELINE],
    evidenceRequirementIds: [
      RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.SELLER_CONTEXT,
    ],
  }),
  factor({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.ASSET_FEASIBILITY,
    factorId: RESIDENTIAL_PURSUIT_FACTOR_IDS.REPAIR_BURDEN,
    label: "Repair burden",
    weight: 70,
    inputFactIds: [
      RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE,
      RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
    ],
    blockingRequirementIds: [
      RESIDENTIAL_REQUIREMENT_IDS.REPAIR_ESTIMATE,
      RESIDENTIAL_REQUIREMENT_IDS.AFTER_REPAIR_VALUE,
    ],
    evidenceRequirementIds: [
      RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.CURRENT_RECORD,
      RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.MARKET_VALUE,
    ],
  }),
  factor({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.ASSET_FEASIBILITY,
    factorId: RESIDENTIAL_PURSUIT_FACTOR_IDS.MARKET_VALUE_SUPPORT,
    label: "Market-value support",
    weight: 30,
    inputFactIds: [
      RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
      RESIDENTIAL_FACT_IDS.COMPARABLE_SALE_EVIDENCE,
    ],
    minimumEvidenceCount: 1,
    blockingRequirementIds: [
      RESIDENTIAL_REQUIREMENT_IDS.AFTER_REPAIR_VALUE,
      RESIDENTIAL_REQUIREMENT_IDS.MARKET_VALUE_SUPPORT,
    ],
    evidenceRequirementIds: [
      RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.MARKET_VALUE,
    ],
  }),
  factor({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.MARKET_EXIT_FIT,
    factorId: RESIDENTIAL_PURSUIT_FACTOR_IDS.EXIT_OPTION_FIT,
    label: "Exit-option fit",
    weight: 100,
    inputFactIds: [
      RESIDENTIAL_FACT_IDS.ASKING_PRICE,
      RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
      RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE,
      RESIDENTIAL_FACT_IDS.RENT_ESTIMATE,
    ],
    minimumEvidenceCount: 3,
    blockingRequirementIds: [
      RESIDENTIAL_REQUIREMENT_IDS.ASKING_PRICE,
      RESIDENTIAL_REQUIREMENT_IDS.AFTER_REPAIR_VALUE,
      RESIDENTIAL_REQUIREMENT_IDS.REPAIR_ESTIMATE,
    ],
    evidenceRequirementIds: [
      RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.CURRENT_RECORD,
      RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.MARKET_VALUE,
    ],
  }),
  factor({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.EXECUTION_COMPLEXITY,
    factorId: RESIDENTIAL_PURSUIT_FACTOR_IDS.OCCUPANCY_COMPLEXITY,
    label: "Occupancy complexity",
    weight: 100,
    optional: true,
    inputFactIds: [RESIDENTIAL_FACT_IDS.OCCUPANCY_STATUS],
    blockingRequirementIds: [],
    evidenceRequirementIds: [
      RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.CURRENT_RECORD,
    ],
  }),
];

const CATEGORIES = [
  category({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.ECONOMICS,
    label: "Economics",
    weight: 40,
    minimum: 2,
    factorIds: [
      RESIDENTIAL_PURSUIT_FACTOR_IDS.ACQUISITION_CEILING_SPREAD,
      RESIDENTIAL_PURSUIT_FACTOR_IDS.PROJECTED_FLIP_GROSS_MARGIN,
    ],
  }),
  category({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.SELLER_SITUATION,
    label: "Seller situation",
    weight: 20,
    minimum: 1,
    factorIds: [
      RESIDENTIAL_PURSUIT_FACTOR_IDS.SELLER_MOTIVATION,
      RESIDENTIAL_PURSUIT_FACTOR_IDS.MORTGAGE_FLEXIBILITY,
    ],
  }),
  category({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.TIMING,
    label: "Timing",
    weight: 10,
    minimum: 1,
    factorIds: [RESIDENTIAL_PURSUIT_FACTOR_IDS.SELLER_TIMELINE],
  }),
  category({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.ASSET_FEASIBILITY,
    label: "Asset feasibility",
    weight: 15,
    minimum: 2,
    factorIds: [
      RESIDENTIAL_PURSUIT_FACTOR_IDS.REPAIR_BURDEN,
      RESIDENTIAL_PURSUIT_FACTOR_IDS.MARKET_VALUE_SUPPORT,
    ],
  }),
  category({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.MARKET_EXIT_FIT,
    label: "Market and exit fit",
    weight: 10,
    minimum: 1,
    factorIds: [RESIDENTIAL_PURSUIT_FACTOR_IDS.EXIT_OPTION_FIT],
  }),
  category({
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.EXECUTION_COMPLEXITY,
    label: "Execution complexity",
    weight: 5,
    minimum: 0,
    blocking: false,
    factorIds: [RESIDENTIAL_PURSUIT_FACTOR_IDS.OCCUPANCY_COMPLEXITY],
  }),
];

export const RESIDENTIAL_PURSUIT_SCORING_PROFILE = Object.freeze(
  normalizePursuitScoringProfile({
    profileId: RESIDENTIAL_PURSUIT_PROFILE_ID,
    strategyId: RESIDENTIAL_STRATEGY_ID,
    strategyVersion: RESIDENTIAL_STRATEGY_VERSION,
    strategyHookId: "residential-pursuit-scoring-v1",
    assetType: ASSET_TYPES.RESIDENTIAL_HOME,
    profileVersion: RESIDENTIAL_PURSUIT_PROFILE_ID,
    status: PURSUIT_SCORING_PROFILE_STATUSES.ACTIVE,
    label: "Residential Pursuit Scoring v1",
    description:
      "Production residential prioritization for continued human acquisition review.",
    categoryDefinitions: CATEGORIES,
    factorDefinitions: FACTORS,
    minimumEvaluationRequirements: {
      minimumEvaluatedCategoryCount: 5,
      minimumEvaluatedFactorCount: 7,
      requiredFactorIds: RESIDENTIAL_REQUIRED_PURSUIT_FACTOR_IDS,
    },
    blockingRequirementIds: [
      RESIDENTIAL_REQUIREMENT_IDS.ASKING_PRICE,
      RESIDENTIAL_REQUIREMENT_IDS.AFTER_REPAIR_VALUE,
      RESIDENTIAL_REQUIREMENT_IDS.REPAIR_ESTIMATE,
      RESIDENTIAL_REQUIREMENT_IDS.SELLER_MOTIVATION,
      RESIDENTIAL_REQUIREMENT_IDS.SELLER_TIMELINE,
      RESIDENTIAL_REQUIREMENT_IDS.MARKET_VALUE_SUPPORT,
    ],
    partialEvaluationPolicy:
      PURSUIT_SCORING_PARTIAL_POLICIES.ALLOW_OPTIONAL_OMISSIONS,
    roundingPolicy: PURSUIT_SCORING_ROUNDING_POLICIES.NEAREST_INTEGER,
    rulesetVersion: RESIDENTIAL_PURSUIT_RULESET_VERSION,
    evidenceAndProvenanceRequirements: {
      requireEvidenceForContributingFactors: true,
      allowCompatibilityEvidence: true,
      acceptedSourceModes: ACCEPTED_SOURCE_MODES,
    },
    effectiveTimestamp: "2026-08-05T00:00:00.000Z",
    compatibilityWarnings: [
      "Current CRM fields may contribute only as explicitly labeled compatibility Evidence; persisted does not mean independently verified.",
    ],
  })
);

export function validateResidentialPursuitProfile(
  value = RESIDENTIAL_PURSUIT_SCORING_PROFILE,
  strategy = RESIDENTIAL_ACQUISITION_STRATEGY
) {
  const profileValidation = validatePursuitScoringProfile(value);
  const hookValidation = validatePursuitScoringProfileHook({
    profile: value,
    strategyContract: strategy,
  });
  const errors = [...profileValidation.errors, ...hookValidation.errors];
  const profile = profileValidation.profile;
  if (profile.profileId !== RESIDENTIAL_PURSUIT_PROFILE_ID) {
    errors.push("Residential Pursuit profile ID does not match v1.");
  }
  if (
    profile.strategyId !== RESIDENTIAL_STRATEGY_ID ||
    profile.strategyVersion !== RESIDENTIAL_STRATEGY_VERSION
  ) {
    errors.push("Residential Pursuit profile does not match Strategy v1.");
  }
  if (profile.status !== PURSUIT_SCORING_PROFILE_STATUSES.ACTIVE) {
    errors.push("Residential Pursuit profile must be active in production.");
  }
  if (profile.assetType !== ASSET_TYPES.RESIDENTIAL_HOME) {
    errors.push("Residential Pursuit profile cannot target another asset type.");
  }
  if (/wetlands|legal-access|buildability|lead_score|ai-/.test(JSON.stringify(profile).toLowerCase())) {
    errors.push("Residential Pursuit profile contains a prohibited cross-asset or legacy input.");
  }
  return {
    valid: errors.length === 0,
    errors: uniqueStrings(errors),
    profile,
  };
}
