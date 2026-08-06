import {
  ASSET_CLASSIFICATION_STATES,
  ASSET_STRATEGY_STATUSES,
  ASSET_TYPES,
} from "../../../../asset-strategy/assetStrategyContracts";
import { ASSET_STRATEGY_SUPPORT_STATES } from "../../../../asset-strategy/assetStrategyContextService";
import { DECISION_SOURCE_MODES } from "../../../decisionContracts";
import {
  PURSUIT_SCORING_CATEGORY_IDS,
  PURSUIT_SCORING_EVALUATION_STATES,
  PURSUIT_SCORING_INFORMATION_STATES,
  PURSUIT_SCORING_PARTIAL_POLICIES,
  PURSUIT_SCORING_PROFILE_STATUSES,
  PURSUIT_SCORING_ROUNDING_POLICIES,
  PURSUIT_SCORING_VALUE_BEHAVIORS,
  PURSUIT_SCORING_VALUE_DIRECTIONS,
} from "../../pursuitScoringContracts";

export const FIXTURE_EVALUATED_AT = "2026-08-05T15:00:00.000Z";

function factor({
  assetType,
  categoryId,
  factorId,
  label,
  inputFactId,
  weight,
  missingValueBehavior = PURSUIT_SCORING_VALUE_BEHAVIORS.BLOCK,
  blockingRequirementIds = [],
}) {
  return {
    factorId,
    categoryId,
    label,
    description: `${label} is an illustrative test-only strategy observation.`,
    maximumContribution: weight,
    weightWithinCategory: weight,
    evaluationMethod: "test-fixture-pre-normalized",
    valueDirection: PURSUIT_SCORING_VALUE_DIRECTIONS.PRE_NORMALIZED,
    inputFactIds: [inputFactId],
    blockingRequirementIds,
    evidenceRequirementIds: [`verify-${inputFactId}`],
    acceptedSourceModes: [
      DECISION_SOURCE_MODES.DETERMINISTIC,
      DECISION_SOURCE_MODES.DETERMINISTIC_COMPATIBILITY,
    ],
    missingValueBehavior,
    unknownValueBehavior: missingValueBehavior,
    notApplicableBehavior:
      PURSUIT_SCORING_VALUE_BEHAVIORS.NOT_APPLICABLE,
    minimumEvidenceCount: 1,
    compatibilityEvidenceAllowed: true,
    explanationTemplate: `${label} uses a strategy-supplied normalized observation.`,
    applicableAssetType: assetType,
    rulesetVersion: "test-fixture-rules-v1",
  };
}

const RESIDENTIAL_FACTORS = Object.freeze([
  factor({
    assetType: ASSET_TYPES.RESIDENTIAL_HOME,
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.ECONOMICS,
    factorId: "res-acquisition-spread",
    label: "Acquisition spread",
    inputFactId: "residential.acquisition-spread",
    weight: 60,
    blockingRequirementIds: ["residential-property-arvorcomps"],
  }),
  factor({
    assetType: ASSET_TYPES.RESIDENTIAL_HOME,
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.ECONOMICS,
    factorId: "res-repair-burden",
    label: "Repair burden",
    inputFactId: "residential.repair-burden",
    weight: 40,
    blockingRequirementIds: ["residential-property-repairs"],
  }),
  factor({
    assetType: ASSET_TYPES.RESIDENTIAL_HOME,
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.SELLER_SITUATION,
    factorId: "res-seller-motivation",
    label: "Seller motivation",
    inputFactId: "residential.seller-motivation",
    weight: 100,
  }),
  factor({
    assetType: ASSET_TYPES.RESIDENTIAL_HOME,
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.TIMING,
    factorId: "res-seller-timing",
    label: "Seller timing",
    inputFactId: "residential.seller-timing",
    weight: 100,
  }),
  factor({
    assetType: ASSET_TYPES.RESIDENTIAL_HOME,
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.ASSET_FEASIBILITY,
    factorId: "res-rent-potential",
    label: "Rent potential",
    inputFactId: "residential.rent-potential",
    weight: 40,
    missingValueBehavior: PURSUIT_SCORING_VALUE_BEHAVIORS.OMIT,
  }),
  factor({
    assetType: ASSET_TYPES.RESIDENTIAL_HOME,
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.ASSET_FEASIBILITY,
    factorId: "res-occupancy-complexity",
    label: "Occupancy complexity",
    inputFactId: "residential.occupancy-complexity",
    weight: 60,
    missingValueBehavior: PURSUIT_SCORING_VALUE_BEHAVIORS.OMIT,
  }),
  factor({
    assetType: ASSET_TYPES.RESIDENTIAL_HOME,
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.MARKET_EXIT_FIT,
    factorId: "res-exit-market-fit",
    label: "Exit-market fit",
    inputFactId: "residential.exit-market-fit",
    weight: 100,
  }),
]);

const LAND_FACTORS = Object.freeze([
  factor({
    assetType: ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.ECONOMICS,
    factorId: "land-price-to-comparable-evidence",
    label: "Price-to-comparable evidence",
    inputFactId: "land.price-to-comparable-evidence",
    weight: 100,
  }),
  factor({
    assetType: ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.ASSET_FEASIBILITY,
    factorId: "land-legal-access",
    label: "Legal access",
    inputFactId: "land.legal-access",
    weight: 60,
    blockingRequirementIds: ["land-legal-access"],
  }),
  factor({
    assetType: ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.ASSET_FEASIBILITY,
    factorId: "land-zoning-permitted-use",
    label: "Zoning and permitted use",
    inputFactId: "land.zoning-permitted-use",
    weight: 40,
    blockingRequirementIds: ["land-zoning", "land-permitted-use"],
  }),
  factor({
    assetType: ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.RISK,
    factorId: "land-flood-wetlands-exposure",
    label: "Flood and wetlands exposure",
    inputFactId: "land.flood-wetlands-exposure",
    weight: 100,
    blockingRequirementIds: [
      "land-flood-zone-status",
      "land-wetlands-status",
    ],
  }),
  factor({
    assetType: ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.MARKET_EXIT_FIT,
    factorId: "land-builder-demand",
    label: "Builder demand",
    inputFactId: "land.builder-demand",
    weight: 100,
    missingValueBehavior: PURSUIT_SCORING_VALUE_BEHAVIORS.OMIT,
  }),
  factor({
    assetType: ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
    categoryId: PURSUIT_SCORING_CATEGORY_IDS.EXECUTION_COMPLEXITY,
    factorId: "land-utility-complexity",
    label: "Utility execution complexity",
    inputFactId: "land.utility-complexity",
    weight: 100,
    missingValueBehavior: PURSUIT_SCORING_VALUE_BEHAVIORS.OMIT,
  }),
]);

function category({ assetType, categoryId, factorIds, label, weight, blocking = true, minimum = 1 }) {
  return {
    categoryId,
    label,
    description: `${label} is a generic category populated by this test-only asset profile.`,
    weight,
    minimumEvaluatedFactorCount: minimum,
    blocking,
    factorIds,
    explanation: `${label} combines only the listed strategy factors.`,
    applicableAssetType: assetType,
    rulesetVersion: "test-fixture-rules-v1",
  };
}

function profileBase({
  assetType,
  categories,
  factors,
  partialEvaluationPolicy =
    PURSUIT_SCORING_PARTIAL_POLICIES.ALLOW_OPTIONAL_OMISSIONS,
  prefix,
  status = PURSUIT_SCORING_PROFILE_STATUSES.TEST_ONLY,
  strategyId,
}) {
  return {
    profileId: `${prefix}-pursuit-test-profile`,
    strategyId,
    strategyVersion: `${prefix}-test-strategy-v1`,
    strategyHookId: `${prefix}-pursuit-hook`,
    assetType,
    profileVersion: "test-profile-v1",
    status,
    label: `${prefix} Pursuit Scoring test fixture`,
    description:
      "Test-only profile used to validate the generic scoring framework; it is not a production strategy threshold set.",
    categoryDefinitions: categories,
    factorDefinitions: factors,
    minimumEvaluationRequirements: {
      minimumEvaluatedCategoryCount: 3,
      minimumEvaluatedFactorCount: 4,
      requiredFactorIds: [factors[0].factorId],
    },
    blockingRequirementIds: [
      "opportunity-identity",
      "asset-classification",
      ...(assetType === ASSET_TYPES.RESIDENTIAL_HOME
        ? ["residential-property-arvorcomps"]
        : ["land-legal-access"]),
    ],
    partialEvaluationPolicy,
    roundingPolicy: PURSUIT_SCORING_ROUNDING_POLICIES.NEAREST_INTEGER,
    rulesetVersion: "test-fixture-rules-v1",
    evidenceAndProvenanceRequirements: {
      requireEvidenceForContributingFactors: true,
      allowCompatibilityEvidence: true,
      acceptedSourceModes: [
        DECISION_SOURCE_MODES.DETERMINISTIC,
        DECISION_SOURCE_MODES.DETERMINISTIC_COMPATIBILITY,
      ],
    },
    effectiveTimestamp: "2026-01-01T00:00:00.000Z",
    expirationTimestamp: "2027-01-01T00:00:00.000Z",
    compatibilityWarnings: [
      "Test fixture values are illustrative and are not production thresholds.",
    ],
  };
}

export function createResidentialScoringProfile(overrides = {}) {
  const assetType = ASSET_TYPES.RESIDENTIAL_HOME;
  const profile = profileBase({
    assetType,
    prefix: "residential",
    strategyId: "residential-acquisition",
    factors: RESIDENTIAL_FACTORS.map((entry) => ({ ...entry })),
    categories: [
      category({
        assetType,
        categoryId: PURSUIT_SCORING_CATEGORY_IDS.ECONOMICS,
        label: "Economics",
        weight: 35,
        factorIds: ["res-acquisition-spread", "res-repair-burden"],
        minimum: 2,
      }),
      category({
        assetType,
        categoryId: PURSUIT_SCORING_CATEGORY_IDS.SELLER_SITUATION,
        label: "Seller situation",
        weight: 20,
        factorIds: ["res-seller-motivation"],
      }),
      category({
        assetType,
        categoryId: PURSUIT_SCORING_CATEGORY_IDS.TIMING,
        label: "Timing",
        weight: 10,
        factorIds: ["res-seller-timing"],
      }),
      category({
        assetType,
        categoryId: PURSUIT_SCORING_CATEGORY_IDS.ASSET_FEASIBILITY,
        label: "Asset feasibility",
        weight: 15,
        factorIds: ["res-rent-potential", "res-occupancy-complexity"],
      }),
      category({
        assetType,
        categoryId: PURSUIT_SCORING_CATEGORY_IDS.MARKET_EXIT_FIT,
        label: "Market and exit fit",
        weight: 20,
        factorIds: ["res-exit-market-fit"],
      }),
    ],
  });
  return { ...profile, ...overrides };
}

export function createLandScoringProfile(overrides = {}) {
  const assetType = ASSET_TYPES.VACANT_RESIDENTIAL_LAND;
  const profile = profileBase({
    assetType,
    prefix: "land",
    strategyId: "vacant-land-acquisition",
    factors: LAND_FACTORS.map((entry) => ({ ...entry })),
    categories: [
      category({
        assetType,
        categoryId: PURSUIT_SCORING_CATEGORY_IDS.ECONOMICS,
        label: "Economics",
        weight: 25,
        factorIds: ["land-price-to-comparable-evidence"],
      }),
      category({
        assetType,
        categoryId: PURSUIT_SCORING_CATEGORY_IDS.ASSET_FEASIBILITY,
        label: "Asset feasibility",
        weight: 30,
        factorIds: ["land-legal-access", "land-zoning-permitted-use"],
        minimum: 2,
      }),
      category({
        assetType,
        categoryId: PURSUIT_SCORING_CATEGORY_IDS.RISK,
        label: "Risk",
        weight: 25,
        factorIds: ["land-flood-wetlands-exposure"],
      }),
      category({
        assetType,
        categoryId: PURSUIT_SCORING_CATEGORY_IDS.MARKET_EXIT_FIT,
        label: "Market and exit fit",
        weight: 10,
        factorIds: ["land-builder-demand"],
        blocking: false,
        minimum: 0,
      }),
      category({
        assetType,
        categoryId: PURSUIT_SCORING_CATEGORY_IDS.EXECUTION_COMPLEXITY,
        label: "Execution complexity",
        weight: 10,
        factorIds: ["land-utility-complexity"],
        blocking: false,
        minimum: 0,
      }),
    ],
  });
  return { ...profile, ...overrides };
}

export function createScoringAssetContext(profile, overrides = {}) {
  return {
    dealId: `deal-${profile.assetType}`,
    organizationId: "org-test",
    tenantId: "tenant-test",
    classificationState: ASSET_CLASSIFICATION_STATES.CLASSIFIED,
    manualReviewRequired: false,
    classificationConflicts: [],
    conflicts: [],
    assetType: profile.assetType,
    selectedStrategyId: profile.strategyId,
    strategySupportState: ASSET_STRATEGY_SUPPORT_STATES.IMPLEMENTED,
    ...overrides,
  };
}

export function createScoringStrategyContract(profile, overrides = {}) {
  return {
    strategyId: profile.strategyId,
    strategyVersion: profile.strategyVersion,
    label: `${profile.label} strategy hook fixture`,
    assetType: profile.assetType,
    status: ASSET_STRATEGY_STATUSES.ACTIVE,
    capabilities: {
      pursuitScoringHooks: [
        {
          hookId: profile.strategyHookId,
          label: "Test-only Pursuit Scoring hook",
          inputFactIds: profile.factorDefinitions.flatMap(
            (entry) => entry.inputFactIds
          ),
          evidenceRequirementIds: profile.factorDefinitions.flatMap(
            (entry) => entry.evidenceRequirementIds
          ),
          outputMetricIds: ["pursuit-score"],
        },
      ],
    },
    ...overrides,
  };
}

export function createScoringEvidence(profile, { compatibility = false } = {}) {
  return profile.factorDefinitions.map((entry) => ({
    evidenceId: `evidence:${entry.factorId}`,
    sourceType: compatibility ? "crm-compatibility" : "test-strategy-fact",
    sourceSystem: "Pursuit Scoring test fixture",
    sourceRecordId: `record:${entry.factorId}`,
    sourceField: entry.inputFactIds[0],
    sourceTimestamp: "2026-08-01T12:00:00.000Z",
    extractionMethod: "test-fixture",
    trustLevel: "unknown",
    verificationState: "unknown",
    conflictState: "none",
    freshnessState: "unknown",
    relatedCanonicalField: entry.inputFactIds[0],
    valueSummary: `Test observation for ${entry.label}`,
    reliabilityLabel: compatibility ? "Compatibility Record" : null,
    provenanceDetails: compatibility
      ? { compatibilityMapping: true }
      : { testFixture: true },
  }));
}

const RESIDENTIAL_SCORES = Object.freeze({
  "res-acquisition-spread": 80,
  "res-repair-burden": 60,
  "res-seller-motivation": 90,
  "res-seller-timing": 80,
  "res-rent-potential": 70,
  "res-occupancy-complexity": 50,
  "res-exit-market-fit": 75,
});

const LAND_SCORES = Object.freeze({
  "land-price-to-comparable-evidence": 70,
  "land-legal-access": 100,
  "land-zoning-permitted-use": 80,
  "land-flood-wetlands-exposure": 60,
  "land-builder-demand": 70,
  "land-utility-complexity": 50,
});

export function createScoringObservations(
  profile,
  { compatibility = false } = {}
) {
  const scores =
    profile.assetType === ASSET_TYPES.RESIDENTIAL_HOME
      ? RESIDENTIAL_SCORES
      : LAND_SCORES;
  return profile.factorDefinitions.map((entry) => ({
    observationId: `observation:${entry.factorId}`,
    factorId: entry.factorId,
    strategyId: profile.strategyId,
    assetType: profile.assetType,
    evaluationState: PURSUIT_SCORING_EVALUATION_STATES.EVALUATED,
    informationState: PURSUIT_SCORING_INFORMATION_STATES.PRESENT,
    rawValue: scores[entry.factorId],
    normalizedValue: scores[entry.factorId],
    normalizedScore: scores[entry.factorId],
    applicable: true,
    evidenceReferenceIds: [`evidence:${entry.factorId}`],
    missingInformationItemIds: [],
    conflictIds: [],
    verificationState: "unknown",
    freshnessState: "unknown",
    sourceMode: compatibility
      ? DECISION_SOURCE_MODES.DETERMINISTIC_COMPATIBILITY
      : DECISION_SOURCE_MODES.DETERMINISTIC,
    explanation: `${entry.label} received a test-only normalized observation.`,
    evaluatedTimestamp: FIXTURE_EVALUATED_AT,
    sourceTimestamp: "2026-08-01T12:00:00.000Z",
  }));
}

export function createScoringInput(profile) {
  return {
    assetStrategyContext: createScoringAssetContext(profile),
    assetStrategyContract: createScoringStrategyContract(profile),
    scoringProfile: profile,
    factorObservations: createScoringObservations(profile),
    evidenceReferences: createScoringEvidence(profile),
    missingInformationReadModel: {
      openItems: [],
      limitations: [],
    },
    evaluatedTimestamp: FIXTURE_EVALUATED_AT,
    executionMode: "test",
  };
}
