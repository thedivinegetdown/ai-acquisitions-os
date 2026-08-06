import { compactText, uniqueStrings } from "../../../utils/text";
import {
  ASSET_STRATEGY_STATUSES,
  normalizeAssetStrategyContract,
  normalizeAssetType,
} from "../../asset-strategy/assetStrategyContracts";
import {
  DECISION_EVALUATION_STATES,
  DECISION_SOURCE_MODES,
  normalizeDecisionTimestamp,
  normalizeRulesetDescriptor,
} from "../decisionContracts";

// Distinct responsibility: define and validate the versioned, provider-neutral
// Pursuit Scoring language without reading deals or calculating a score.
export const PURSUIT_SCORING_CONTRACT_VERSION =
  "pursuit-scoring-contract-v1";

export const PURSUIT_SCORE_SCALE = Object.freeze({
  minimum: 0,
  maximum: 100,
  direction:
    "Higher values indicate greater merit for continued acquisition review under the selected asset strategy.",
});

export const PURSUIT_SCORE_OPERATOR_DISCLAIMER =
  "Pursuit Score prioritizes continued review. It is not an instruction to purchase, make an offer, or proceed without human underwriting and approval.";

export const PURSUIT_SCORING_PRINCIPLES = Object.freeze([
  "No asset strategy, no score.",
  "No valid strategy scoring profile, no score.",
  "Asset classification and strategy profile must match.",
  "Blocking strategy facts may prevent score evaluation.",
  "Missing data is not automatically scored as zero.",
  "Unknown data is not automatically scored negatively.",
  "Evidence-free factors may not contribute.",
  "Every contribution must be explainable.",
  "Every contribution must identify its evidence.",
  "Scores must be reproducible from the same inputs and ruleset.",
  "Score calculation cannot execute side effects or mutate CRM records.",
  "Pursuit Score is separate from Recommendation Confidence, Data Reliability, and Offer Readiness.",
  "Pursuit Score is not an instruction to purchase a property.",
]);

export const PURSUIT_SCORING_CATEGORY_IDS = Object.freeze({
  ECONOMICS: "economics",
  SELLER_SITUATION: "seller-situation",
  TIMING: "timing",
  ASSET_FEASIBILITY: "asset-feasibility",
  MARKET_EXIT_FIT: "market-and-exit-fit",
  EXECUTION_COMPLEXITY: "execution-complexity",
  RISK: "risk",
  EVIDENCE_COVERAGE: "evidence-coverage",
});

export const PURSUIT_SCORING_CATEGORY_REGISTRY = Object.freeze(
  [
    [PURSUIT_SCORING_CATEGORY_IDS.ECONOMICS, "Economics"],
    [PURSUIT_SCORING_CATEGORY_IDS.SELLER_SITUATION, "Seller situation"],
    [PURSUIT_SCORING_CATEGORY_IDS.TIMING, "Timing"],
    [PURSUIT_SCORING_CATEGORY_IDS.ASSET_FEASIBILITY, "Asset feasibility"],
    [PURSUIT_SCORING_CATEGORY_IDS.MARKET_EXIT_FIT, "Market and exit fit"],
    [PURSUIT_SCORING_CATEGORY_IDS.EXECUTION_COMPLEXITY, "Execution complexity"],
    [PURSUIT_SCORING_CATEGORY_IDS.RISK, "Risk"],
    [PURSUIT_SCORING_CATEGORY_IDS.EVIDENCE_COVERAGE, "Evidence coverage"],
  ].map(([id, label]) =>
    Object.freeze({
      id,
      label,
      description: `${label} is a generic scoring dimension whose factors and thresholds belong to a concrete asset strategy.`,
    })
  )
);

export const PURSUIT_SCORING_PROFILE_STATUSES = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  DEFERRED: "deferred",
  RETIRED: "retired",
  TEST_ONLY: "test-only",
});

export const PURSUIT_SCORING_EVALUATION_STATES = Object.freeze({
  NOT_EVALUATED: DECISION_EVALUATION_STATES.NOT_EVALUATED,
  UNAVAILABLE: DECISION_EVALUATION_STATES.UNAVAILABLE,
  EVALUATED: DECISION_EVALUATION_STATES.EVALUATED,
  EXPIRED: DECISION_EVALUATION_STATES.EXPIRED,
  SUPERSEDED: DECISION_EVALUATION_STATES.SUPERSEDED,
  BLOCKED: "blocked",
  PARTIAL: "partial",
});

export const PURSUIT_SCORING_PARTIAL_POLICIES = Object.freeze({
  DENY: "deny",
  ALLOW_OPTIONAL_OMISSIONS: "allow-optional-omissions",
});

export const PURSUIT_SCORING_ROUNDING_POLICIES = Object.freeze({
  NEAREST_INTEGER: "nearest-integer",
  ONE_DECIMAL: "one-decimal",
  TWO_DECIMALS: "two-decimals",
});

export const PURSUIT_SCORING_VALUE_DIRECTIONS = Object.freeze({
  HIGHER_IS_BETTER: "higher-is-better",
  LOWER_IS_BETTER: "lower-is-better",
  BOOLEAN_POSITIVE: "boolean-positive",
  BOOLEAN_NEGATIVE: "boolean-negative",
  THRESHOLD_TABLE: "threshold-table",
  PRE_NORMALIZED: "pre-normalized",
});

export const PURSUIT_SCORING_VALUE_BEHAVIORS = Object.freeze({
  BLOCK: "block",
  OMIT: "omit",
  NOT_APPLICABLE: "not-applicable",
});

export const PURSUIT_SCORING_EXECUTION_MODES = Object.freeze({
  PRODUCTION: "production",
  TEST: "test",
  DEVELOPMENT: "development",
});

export const PURSUIT_SCORING_INFORMATION_STATES = Object.freeze({
  PRESENT: "present",
  MISSING: "missing",
  UNKNOWN: "unknown",
  UNVERIFIED: "unverified",
  CONFLICTING: "conflicting",
  STALE: "stale",
  UNAVAILABLE: "unavailable",
  NOT_APPLICABLE: "not-applicable",
});

export const PURSUIT_SCORING_LIMITS = Object.freeze({
  CATEGORIES: 16,
  FACTORS: 80,
  OBSERVATIONS: 100,
  EVIDENCE: 100,
  REFERENCES: 40,
  WARNINGS: 16,
});

const CATEGORY_IDS = new Set(
  PURSUIT_SCORING_CATEGORY_REGISTRY.map((category) => category.id)
);
const PROFILE_STATUSES = new Set(
  Object.values(PURSUIT_SCORING_PROFILE_STATUSES)
);
const EVALUATION_STATES = new Set(
  Object.values(PURSUIT_SCORING_EVALUATION_STATES)
);
const PARTIAL_POLICIES = new Set(
  Object.values(PURSUIT_SCORING_PARTIAL_POLICIES)
);
const ROUNDING_POLICIES = new Set(
  Object.values(PURSUIT_SCORING_ROUNDING_POLICIES)
);
const VALUE_DIRECTIONS = new Set(
  Object.values(PURSUIT_SCORING_VALUE_DIRECTIONS)
);
const VALUE_BEHAVIORS = new Set(
  Object.values(PURSUIT_SCORING_VALUE_BEHAVIORS)
);
const SOURCE_MODES = new Set(Object.values(DECISION_SOURCE_MODES));
const INFORMATION_STATES = new Set(
  Object.values(PURSUIT_SCORING_INFORMATION_STATES)
);

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function safeText(value, maximum = 320) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const text = compactText(String(value));
  if (text.length <= maximum) return text;
  return `${text.slice(0, maximum - 3).trimEnd()}...`;
}

function nullableText(value, maximum) {
  return safeText(value, maximum) || null;
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nonNegativeInteger(value) {
  const number = finiteNumber(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function normalizeStringList(values, limit, { deduplicate = true } = {}) {
  const source = Array.isArray(values) ? values : values ? [values] : [];
  const normalized = source.map((value) => safeText(value, 200)).filter(Boolean);
  return (deduplicate ? uniqueStrings(normalized) : normalized).slice(0, limit);
}

function normalizeWarnings(values) {
  return normalizeStringList(values, PURSUIT_SCORING_LIMITS.WARNINGS);
}

function normalizePrimitive(value) {
  if (["string", "number", "boolean"].includes(typeof value)) {
    return typeof value === "string" ? safeText(value, 240) : value;
  }
  return null;
}

function normalizeSourceMode(value) {
  return SOURCE_MODES.has(value) ? value : DECISION_SOURCE_MODES.UNKNOWN;
}

function normalizeEvaluationState(value) {
  return EVALUATION_STATES.has(value)
    ? value
    : PURSUIT_SCORING_EVALUATION_STATES.NOT_EVALUATED;
}

export function normalizePursuitScoringCategory(value) {
  const source = safeObject(value);
  return {
    categoryId: nullableText(source.categoryId || source.id, 160),
    label: nullableText(source.label, 200),
    description: nullableText(source.description, 480),
    weight: finiteNumber(source.weight),
    minimumEvaluatedFactorCount: nonNegativeInteger(
      source.minimumEvaluatedFactorCount
    ),
    blocking: source.blocking === true,
    factorIds: normalizeStringList(
      source.factorIds,
      PURSUIT_SCORING_LIMITS.FACTORS,
      { deduplicate: false }
    ),
    explanation: nullableText(source.explanation, 480),
    applicableAssetType: normalizeAssetType(source.applicableAssetType),
    rulesetVersion: nullableText(source.rulesetVersion, 80),
  };
}

export function normalizePursuitScoringFactorDefinition(value) {
  const source = safeObject(value);
  return {
    factorId: nullableText(source.factorId || source.id, 160),
    categoryId: nullableText(source.categoryId, 160),
    label: nullableText(source.label, 200),
    description: nullableText(source.description, 480),
    maximumContribution: finiteNumber(source.maximumContribution),
    weightWithinCategory: finiteNumber(source.weightWithinCategory),
    evaluationMethod: nullableText(source.evaluationMethod, 160),
    valueDirection: VALUE_DIRECTIONS.has(source.valueDirection)
      ? source.valueDirection
      : null,
    inputFactIds: normalizeStringList(
      source.inputFactIds,
      PURSUIT_SCORING_LIMITS.REFERENCES
    ),
    blockingRequirementIds: normalizeStringList(
      source.blockingRequirementIds,
      PURSUIT_SCORING_LIMITS.REFERENCES
    ),
    evidenceRequirementIds: normalizeStringList(
      source.evidenceRequirementIds,
      PURSUIT_SCORING_LIMITS.REFERENCES
    ),
    acceptedSourceModes: normalizeStringList(
      source.acceptedSourceModes,
      PURSUIT_SCORING_LIMITS.REFERENCES
    ).filter((mode) => SOURCE_MODES.has(mode)),
    missingValueBehavior: VALUE_BEHAVIORS.has(source.missingValueBehavior)
      ? source.missingValueBehavior
      : null,
    unknownValueBehavior: VALUE_BEHAVIORS.has(source.unknownValueBehavior)
      ? source.unknownValueBehavior
      : null,
    notApplicableBehavior: VALUE_BEHAVIORS.has(source.notApplicableBehavior)
      ? source.notApplicableBehavior
      : null,
    minimumEvidenceCount: nonNegativeInteger(source.minimumEvidenceCount),
    compatibilityEvidenceAllowed: source.compatibilityEvidenceAllowed === true,
    explanationTemplate: nullableText(source.explanationTemplate, 480),
    applicableAssetType: normalizeAssetType(source.applicableAssetType),
    rulesetVersion: nullableText(source.rulesetVersion, 80),
  };
}

function normalizeMinimumRequirements(value) {
  const source = safeObject(value);
  return {
    minimumEvaluatedCategoryCount: nonNegativeInteger(
      source.minimumEvaluatedCategoryCount
    ),
    minimumEvaluatedFactorCount: nonNegativeInteger(
      source.minimumEvaluatedFactorCount
    ),
    requiredFactorIds: normalizeStringList(
      source.requiredFactorIds,
      PURSUIT_SCORING_LIMITS.FACTORS
    ),
  };
}

function normalizeEvidenceRequirements(value) {
  const source = safeObject(value);
  return {
    requireEvidenceForContributingFactors:
      source.requireEvidenceForContributingFactors !== false,
    allowCompatibilityEvidence: source.allowCompatibilityEvidence === true,
    acceptedSourceModes: normalizeStringList(
      source.acceptedSourceModes,
      PURSUIT_SCORING_LIMITS.REFERENCES
    ).filter((mode) => SOURCE_MODES.has(mode)),
  };
}

export function normalizePursuitScoringProfile(value) {
  const source = safeObject(value);
  const categoryDefinitions = (
    Array.isArray(source.categoryDefinitions)
      ? source.categoryDefinitions
      : Array.isArray(source.categories)
        ? source.categories
        : []
  )
    .map(normalizePursuitScoringCategory)
    .slice(0, PURSUIT_SCORING_LIMITS.CATEGORIES);
  const factorDefinitions = (
    Array.isArray(source.factorDefinitions)
      ? source.factorDefinitions
      : Array.isArray(source.factors)
        ? source.factors
        : []
  )
    .map(normalizePursuitScoringFactorDefinition)
    .slice(0, PURSUIT_SCORING_LIMITS.FACTORS);

  return {
    profileId: nullableText(source.profileId || source.id, 160),
    contractVersion: PURSUIT_SCORING_CONTRACT_VERSION,
    strategyId: nullableText(source.strategyId, 160),
    strategyVersion: nullableText(source.strategyVersion, 80),
    strategyHookId: nullableText(source.strategyHookId, 160),
    assetType: normalizeAssetType(source.assetType),
    profileVersion: nullableText(source.profileVersion || source.version, 80),
    status: PROFILE_STATUSES.has(source.status) ? source.status : null,
    label: nullableText(source.label, 200),
    description: nullableText(source.description, 480),
    categoryDefinitions,
    factorDefinitions,
    categoryWeights: Object.fromEntries(
      categoryDefinitions
        .filter((category) => category.categoryId)
        .map((category) => [category.categoryId, category.weight])
    ),
    minimumEvaluationRequirements: normalizeMinimumRequirements(
      source.minimumEvaluationRequirements
    ),
    blockingRequirementIds: normalizeStringList(
      source.blockingRequirementIds,
      PURSUIT_SCORING_LIMITS.REFERENCES
    ),
    partialEvaluationPolicy: PARTIAL_POLICIES.has(
      source.partialEvaluationPolicy
    )
      ? source.partialEvaluationPolicy
      : null,
    roundingPolicy: ROUNDING_POLICIES.has(source.roundingPolicy)
      ? source.roundingPolicy
      : null,
    rulesetVersion: nullableText(source.rulesetVersion, 80),
    evidenceAndProvenanceRequirements: normalizeEvidenceRequirements(
      source.evidenceAndProvenanceRequirements
    ),
    effectiveTimestamp: normalizeDecisionTimestamp(source.effectiveTimestamp),
    expirationTimestamp: normalizeDecisionTimestamp(source.expirationTimestamp),
    supersededProfileReference: nullableText(
      source.supersededProfileReference,
      200
    ),
    compatibilityWarnings: normalizeWarnings(source.compatibilityWarnings),
    partialDataWarnings: normalizeWarnings(source.partialDataWarnings),
  };
}

export function normalizePursuitScoringObservation(value) {
  const source = safeObject(value);
  const normalizedScore = finiteNumber(source.normalizedScore);
  return {
    observationId: nullableText(source.observationId || source.id, 200),
    contractVersion: PURSUIT_SCORING_CONTRACT_VERSION,
    factorId: nullableText(source.factorId, 160),
    strategyId: nullableText(source.strategyId, 160),
    assetType: normalizeAssetType(source.assetType),
    evaluationState: normalizeEvaluationState(source.evaluationState),
    informationState: INFORMATION_STATES.has(source.informationState)
      ? source.informationState
      : PURSUIT_SCORING_INFORMATION_STATES.PRESENT,
    rawValue: normalizePrimitive(source.rawValue),
    normalizedValue: normalizePrimitive(source.normalizedValue),
    normalizedScore:
      normalizedScore !== null &&
      normalizedScore >= PURSUIT_SCORE_SCALE.minimum &&
      normalizedScore <= PURSUIT_SCORE_SCALE.maximum
        ? normalizedScore
        : null,
    applicable: source.applicable !== false,
    evidenceReferenceIds: normalizeStringList(
      source.evidenceReferenceIds,
      PURSUIT_SCORING_LIMITS.REFERENCES
    ),
    missingInformationItemIds: normalizeStringList(
      source.missingInformationItemIds,
      PURSUIT_SCORING_LIMITS.REFERENCES
    ),
    conflictIds: normalizeStringList(
      source.conflictIds,
      PURSUIT_SCORING_LIMITS.REFERENCES
    ),
    verificationState: nullableText(source.verificationState, 80) || "unknown",
    freshnessState: nullableText(source.freshnessState, 80) || "unknown",
    sourceMode: normalizeSourceMode(source.sourceMode),
    explanation: nullableText(source.explanation, 480),
    evaluatedTimestamp: normalizeDecisionTimestamp(source.evaluatedTimestamp),
    sourceTimestamp: normalizeDecisionTimestamp(source.sourceTimestamp),
    partialDataWarnings: normalizeWarnings(source.partialDataWarnings),
  };
}

export function normalizePursuitScoringFactorResult(value) {
  const source = safeObject(value);
  return {
    ...normalizePursuitScoringObservation(source),
    evaluationState: normalizeEvaluationState(source.evaluationState),
    label: nullableText(source.label, 200),
    categoryId: nullableText(source.categoryId, 160),
    weightWithinCategory: finiteNumber(source.weightWithinCategory),
    categoryPointContribution: finiteNumber(source.categoryPointContribution),
    maximumCategoryPointContribution: finiteNumber(
      source.maximumCategoryPointContribution
    ),
    omittedWeight: finiteNumber(source.omittedWeight),
    blockingReason: nullableText(source.blockingReason, 480),
  };
}

export function normalizePursuitScoringCategoryResult(value) {
  const source = safeObject(value);
  return {
    categoryId: nullableText(source.categoryId || source.id, 160),
    label: nullableText(source.label, 200),
    evaluationState: normalizeEvaluationState(source.evaluationState),
    rawCategoryScore: finiteNumber(source.rawCategoryScore),
    weightedContribution: finiteNumber(source.weightedContribution),
    maximumWeightedContribution: finiteNumber(
      source.maximumWeightedContribution
    ),
    evaluatedFactorCount: nonNegativeInteger(source.evaluatedFactorCount) || 0,
    omittedFactorCount: nonNegativeInteger(source.omittedFactorCount) || 0,
    notApplicableFactorCount:
      nonNegativeInteger(source.notApplicableFactorCount) || 0,
    evaluatedFactorWeight: finiteNumber(source.evaluatedFactorWeight),
    omittedFactorWeight: finiteNumber(source.omittedFactorWeight),
    blockingFactors: normalizeStringList(
      source.blockingFactors,
      PURSUIT_SCORING_LIMITS.FACTORS
    ),
    factorResults: (Array.isArray(source.factorResults)
      ? source.factorResults
      : []
    )
      .map(normalizePursuitScoringFactorResult)
      .slice(0, PURSUIT_SCORING_LIMITS.FACTORS),
    evidenceReferenceIds: normalizeStringList(
      source.evidenceReferenceIds,
      PURSUIT_SCORING_LIMITS.EVIDENCE
    ),
    explanation: nullableText(source.explanation, 640),
    partialDataWarnings: normalizeWarnings(source.partialDataWarnings),
  };
}

export function normalizePursuitScoreResult(value) {
  const source = safeObject(value);
  const evaluationState = normalizeEvaluationState(source.evaluationState);
  const numericScore = finiteNumber(source.score ?? source.value);
  const scoreCanBeRetained = [
    PURSUIT_SCORING_EVALUATION_STATES.EVALUATED,
    PURSUIT_SCORING_EVALUATION_STATES.PARTIAL,
    PURSUIT_SCORING_EVALUATION_STATES.EXPIRED,
    PURSUIT_SCORING_EVALUATION_STATES.SUPERSEDED,
  ].includes(evaluationState);
  const score =
    scoreCanBeRetained &&
    numericScore !== null &&
    numericScore >= PURSUIT_SCORE_SCALE.minimum &&
    numericScore <= PURSUIT_SCORE_SCALE.maximum
      ? numericScore
      : null;

  return {
    scoreId: nullableText(source.scoreId || source.id, 240),
    contractVersion: PURSUIT_SCORING_CONTRACT_VERSION,
    organizationId: nullableText(source.organizationId, 160),
    tenantId: nullableText(source.tenantId, 160),
    strategyId: nullableText(source.strategyId, 160),
    strategyVersion: nullableText(source.strategyVersion, 80),
    strategySupportState: nullableText(source.strategySupportState, 80),
    assetType: normalizeAssetType(source.assetType),
    scoringProfileId: nullableText(
      source.scoringProfileId || source.profileId,
      160
    ),
    profileVersion: nullableText(source.profileVersion, 80),
    profileStatus: PROFILE_STATUSES.has(source.profileStatus)
      ? source.profileStatus
      : null,
    productionEligible: source.productionEligible === true,
    evaluationState,
    score,
    displayValue:
      score === null
        ? null
        : nullableText(source.displayValue, 160) || `${score}/100`,
    scale: Object.freeze({ ...PURSUIT_SCORE_SCALE }),
    categoryResults: (Array.isArray(source.categoryResults)
      ? source.categoryResults
      : []
    )
      .map(normalizePursuitScoringCategoryResult)
      .slice(0, PURSUIT_SCORING_LIMITS.CATEGORIES),
    factorResults: (Array.isArray(source.factorResults)
      ? source.factorResults
      : []
    )
      .map(normalizePursuitScoringFactorResult)
      .slice(0, PURSUIT_SCORING_LIMITS.FACTORS),
    evidenceReferenceIds: normalizeStringList(
      source.evidenceReferenceIds,
      PURSUIT_SCORING_LIMITS.EVIDENCE
    ),
    blockingIssueIds: normalizeStringList(
      source.blockingIssueIds,
      PURSUIT_SCORING_LIMITS.REFERENCES
    ),
    missingInformationItemIds: normalizeStringList(
      source.missingInformationItemIds,
      PURSUIT_SCORING_LIMITS.REFERENCES
    ),
    conflictIds: normalizeStringList(
      source.conflictIds,
      PURSUIT_SCORING_LIMITS.REFERENCES
    ),
    ruleset: normalizeRulesetDescriptor(source.ruleset),
    evaluatedTimestamp: normalizeDecisionTimestamp(source.evaluatedTimestamp),
    expirationTimestamp: normalizeDecisionTimestamp(source.expirationTimestamp),
    sourceMode: normalizeSourceMode(source.sourceMode),
    explanation: nullableText(source.explanation, 720),
    operatorDisclaimer: PURSUIT_SCORE_OPERATOR_DISCLAIMER,
    evaluatedCategoryWeight: finiteNumber(source.evaluatedCategoryWeight),
    omittedCategoryWeight: finiteNumber(source.omittedCategoryWeight),
    omittedFactorWeight: finiteNumber(source.omittedFactorWeight),
    partialDataWarnings: normalizeWarnings(source.partialDataWarnings),
  };
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  values.filter(Boolean).forEach((value) => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });
  return [...duplicates];
}

function approximatelyEqual(left, right) {
  return Math.abs(left - right) < 0.000001;
}

export function validatePursuitScoringProfile(value) {
  const profile = normalizePursuitScoringProfile(value);
  const errors = [];
  const categories = profile.categoryDefinitions;
  const factors = profile.factorDefinitions;
  const categoryIds = categories.map((category) => category.categoryId);
  const factorIds = factors.map((factor) => factor.factorId);
  const categoryIdSet = new Set(categoryIds.filter(Boolean));
  const factorIdSet = new Set(factorIds.filter(Boolean));

  if (!profile.profileId) errors.push("Scoring profile ID is required.");
  if (!profile.strategyId) errors.push("Scoring strategy ID is required.");
  if (!profile.strategyVersion) errors.push("Scoring strategy version is required.");
  if (!profile.strategyHookId) errors.push("A pursuit-scoring strategy hook ID is required.");
  if (!profile.assetType) errors.push("A canonical scoring asset type is required.");
  if (!profile.profileVersion) errors.push("Scoring profile version is required.");
  if (!profile.status) errors.push("A valid scoring profile status is required.");
  if (!profile.label) errors.push("Scoring profile label is required.");
  if (!profile.rulesetVersion) errors.push("Scoring ruleset version is required.");
  if (!profile.partialEvaluationPolicy) {
    errors.push("A valid partial-evaluation policy is required.");
  }
  if (!profile.roundingPolicy) errors.push("A valid rounding policy is required.");
  if (!profile.effectiveTimestamp) {
    errors.push("An effective timestamp is required for a scoring profile.");
  }
  if (categories.length === 0) errors.push("At least one scoring category is required.");
  if (factors.length === 0) errors.push("At least one scoring factor is required.");

  if (duplicateValues(categoryIds).length) {
    errors.push("Scoring category IDs must be unique.");
  }
  if (duplicateValues(factorIds).length) {
    errors.push("Scoring factor IDs must be unique.");
  }

  const categoryWeightTotal = categories.reduce(
    (total, category) => total + (category.weight ?? 0),
    0
  );
  if (!approximatelyEqual(categoryWeightTotal, 100)) {
    errors.push("Active scoring category weights must total 100.");
  }

  categories.forEach((category) => {
    if (!category.categoryId || !CATEGORY_IDS.has(category.categoryId)) {
      errors.push(`Unknown scoring category ${category.categoryId || "(missing)"}.`);
    }
    if (!category.label) {
      errors.push(`Scoring category ${category.categoryId || "(missing)"} needs a label.`);
    }
    if (category.weight === null || category.weight < 0) {
      errors.push(`Scoring category ${category.categoryId || "(missing)"} has an invalid weight.`);
    }
    if (category.factorIds.length === 0) {
      errors.push(`Scoring category ${category.categoryId || "(missing)"} cannot consume weight without factors.`);
    }
    if (duplicateValues(category.factorIds).length) {
      errors.push(`Scoring category ${category.categoryId || "(missing)"} contains duplicate factor references.`);
    }
    category.factorIds.forEach((factorId) => {
      if (!factorIdSet.has(factorId)) {
        errors.push(`Scoring category ${category.categoryId} references unknown factor ${factorId}.`);
      }
    });
    if (
      category.minimumEvaluatedFactorCount === null ||
      category.minimumEvaluatedFactorCount > category.factorIds.length
    ) {
      errors.push(`Scoring category ${category.categoryId || "(missing)"} has an invalid minimum evaluated factor count.`);
    }
    if (!category.applicableAssetType) {
      errors.push(`Scoring category ${category.categoryId || "(missing)"} needs an applicable asset type.`);
    } else if (category.applicableAssetType !== profile.assetType) {
      errors.push(`Scoring category ${category.categoryId} does not match profile asset type ${profile.assetType}.`);
    }
  });

  factors.forEach((factor) => {
    if (!factor.factorId) errors.push("Every scoring factor requires an ID.");
    if (!factor.label) {
      errors.push(`Scoring factor ${factor.factorId || "(missing)"} needs a label.`);
    }
    if (!categoryIdSet.has(factor.categoryId)) {
      errors.push(`Scoring factor ${factor.factorId || "(missing)"} references unknown category ${factor.categoryId || "(missing)"}.`);
    }
    const category = categories.find(
      (entry) => entry.categoryId === factor.categoryId
    );
    if (category && !category.factorIds.includes(factor.factorId)) {
      errors.push(`Scoring factor ${factor.factorId} is not registered by category ${factor.categoryId}.`);
    }
    if (
      factor.weightWithinCategory === null ||
      factor.weightWithinCategory < 0
    ) {
      errors.push(`Scoring factor ${factor.factorId || "(missing)"} has an invalid category weight.`);
    }
    if (
      factor.maximumContribution === null ||
      factor.maximumContribution < 0 ||
      (factor.weightWithinCategory !== null &&
        factor.maximumContribution > factor.weightWithinCategory)
    ) {
      errors.push(`Scoring factor ${factor.factorId || "(missing)"} has an invalid maximum contribution.`);
    }
    if (!factor.evaluationMethod) {
      errors.push(`Scoring factor ${factor.factorId || "(missing)"} needs an evaluation method.`);
    }
    if (!factor.valueDirection) {
      errors.push(`Scoring factor ${factor.factorId || "(missing)"} needs a valid value direction.`);
    }
    if (!factor.missingValueBehavior || !factor.unknownValueBehavior) {
      errors.push(`Scoring factor ${factor.factorId || "(missing)"} needs missing and unknown value behavior.`);
    }
    if (!factor.notApplicableBehavior) {
      errors.push(`Scoring factor ${factor.factorId || "(missing)"} needs not-applicable behavior.`);
    }
    if (factor.minimumEvidenceCount === null || factor.minimumEvidenceCount < 1) {
      errors.push(`Scoring factor ${factor.factorId || "(missing)"} must require at least one Evidence reference.`);
    }
    if (factor.evidenceRequirementIds.length === 0) {
      errors.push(`Scoring factor ${factor.factorId || "(missing)"} needs an Evidence requirement ID.`);
    }
    if (factor.acceptedSourceModes.length === 0) {
      errors.push(`Scoring factor ${factor.factorId || "(missing)"} needs an accepted source mode.`);
    }
    if (factor.inputFactIds.length === 0) {
      errors.push(`Scoring factor ${factor.factorId || "(missing)"} needs at least one strategy input fact.`);
    }
    if (!factor.applicableAssetType) {
      errors.push(`Scoring factor ${factor.factorId || "(missing)"} needs an applicable asset type.`);
    } else if (factor.applicableAssetType !== profile.assetType) {
      errors.push(`Scoring factor ${factor.factorId} does not match profile asset type ${profile.assetType}.`);
    }
  });

  categories.forEach((category) => {
    const categoryFactors = factors.filter(
      (factor) => factor.categoryId === category.categoryId
    );
    const factorWeightTotal = categoryFactors.reduce(
      (total, factor) => total + (factor.weightWithinCategory ?? 0),
      0
    );
    if (!approximatelyEqual(factorWeightTotal, 100)) {
      errors.push(`Factor weights in category ${category.categoryId} must total 100.`);
    }
  });

  profile.minimumEvaluationRequirements.requiredFactorIds.forEach((factorId) => {
    if (!factorIdSet.has(factorId)) {
      errors.push(`Minimum evaluation requirements reference unknown factor ${factorId}.`);
    }
  });
  const minimumCategories =
    profile.minimumEvaluationRequirements.minimumEvaluatedCategoryCount;
  const minimumFactors =
    profile.minimumEvaluationRequirements.minimumEvaluatedFactorCount;
  if (minimumCategories === null || minimumCategories > categories.length) {
    errors.push("Minimum evaluated category count is invalid.");
  }
  if (minimumFactors === null || minimumFactors > factors.length) {
    errors.push("Minimum evaluated factor count is invalid.");
  }

  if (
    profile.expirationTimestamp &&
    profile.effectiveTimestamp &&
    new Date(profile.expirationTimestamp).getTime() <=
      new Date(profile.effectiveTimestamp).getTime()
  ) {
    errors.push("Scoring profile expiration must be after its effective timestamp.");
  }

  return {
    valid: errors.length === 0,
    errors: uniqueStrings(errors),
    profile,
  };
}

export function validatePursuitScoringProfileHook({
  profile: profileValue,
  strategyContract: strategyValue,
} = {}) {
  const profileValidation = validatePursuitScoringProfile(profileValue);
  const profile = profileValidation.profile;
  const strategy = normalizeAssetStrategyContract(strategyValue);
  const errors = [...profileValidation.errors];

  if (!strategy.strategyId) {
    errors.push("A registered Asset Strategy contract is required for scoring.");
  }
  if (!strategy.strategyVersion) {
    errors.push("The registered Asset Strategy requires a version for scoring.");
  }
  if (!strategy.assetType) {
    errors.push("The registered Asset Strategy requires a canonical asset type for scoring.");
  }
  if (strategy.strategyId && strategy.strategyId !== profile.strategyId) {
    errors.push("Scoring profile strategy does not match the Asset Strategy contract.");
  }
  if (
    strategy.strategyVersion &&
    strategy.strategyVersion !== profile.strategyVersion
  ) {
    errors.push("Scoring profile strategy version does not match the Asset Strategy contract.");
  }
  if (strategy.assetType && strategy.assetType !== profile.assetType) {
    errors.push("Scoring profile asset type does not match the Asset Strategy contract.");
  }
  if (strategy.status !== ASSET_STRATEGY_STATUSES.ACTIVE) {
    errors.push("Only an active Asset Strategy contract can supply a scoring hook.");
  }

  const hook = strategy.capabilities.pursuitScoringHooks.find(
    (entry) => entry.hookId === profile.strategyHookId
  );
  if (!hook) {
    errors.push("The scoring profile does not match a registered pursuit-scoring hook.");
  } else {
    if (!hook.outputMetricIds.includes("pursuit-score")) {
      errors.push("The registered strategy hook must target pursuit-score.");
    }
    const hookFacts = new Set(hook.inputFactIds);
    const hookEvidenceRequirements = new Set(hook.evidenceRequirementIds);
    profile.factorDefinitions.flatMap((factor) => factor.inputFactIds).forEach(
      (factId) => {
        if (!hookFacts.has(factId)) {
          errors.push(`The registered strategy hook does not declare scoring fact ${factId}.`);
        }
      }
    );
    profile.factorDefinitions
      .flatMap((factor) => factor.evidenceRequirementIds)
      .forEach((requirementId) => {
        if (!hookEvidenceRequirements.has(requirementId)) {
          errors.push(
            `The registered strategy hook does not declare Evidence requirement ${requirementId}.`
          );
        }
      });
  }

  return {
    valid: errors.length === 0,
    errors: uniqueStrings(errors),
    profile,
    strategy,
    hook: hook || null,
  };
}
