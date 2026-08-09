import { uniqueStrings } from "../../../utils/text";
import {
  ASSET_CLASSIFICATION_STATES,
} from "../../asset-strategy/assetStrategyContracts";
import { ASSET_STRATEGY_SUPPORT_STATES } from "../../asset-strategy/assetStrategyContextService";
import { STRATEGY_LIMITATION_TYPES } from "../../research-intelligence/missingInformationContracts";
import {
  DECISION_SOURCE_MODES,
  normalizeDecisionTimestamp,
  normalizeEvidenceReference,
  normalizeRulesetDescriptor,
} from "../decisionContracts";
import {
  PURSUIT_SCORING_EVALUATION_STATES,
  PURSUIT_SCORING_EXECUTION_MODES,
  PURSUIT_SCORING_INFORMATION_STATES,
  PURSUIT_SCORING_LIMITS,
  PURSUIT_SCORING_PARTIAL_POLICIES,
  PURSUIT_SCORING_PROFILE_STATUSES,
  PURSUIT_SCORING_ROUNDING_POLICIES,
  PURSUIT_SCORING_VALUE_BEHAVIORS,
  normalizePursuitScoreResult,
  normalizePursuitScoringCategoryResult,
  normalizePursuitScoringFactorResult,
  normalizePursuitScoringObservation,
  validatePursuitScoringProfile,
  validatePursuitScoringProfileHook,
} from "./pursuitScoringContracts";

// Distinct responsibility: evaluate strategy-supplied observations through a
// validated Pursuit Scoring profile without reading raw deal fields or causing side effects.
export const PURSUIT_SCORING_RULESET_ID = "pursuit-scoring-engine";

const BLOCKING_LIMITATION_TYPES = new Set([
  STRATEGY_LIMITATION_TYPES.STRATEGY_NOT_IMPLEMENTED,
  STRATEGY_LIMITATION_TYPES.STRATEGY_DEFERRED,
  STRATEGY_LIMITATION_TYPES.CAPABILITY_BLOCKED,
  STRATEGY_LIMITATION_TYPES.UNSUPPORTED_ASSET_TYPE,
]);

const COMPATIBILITY_SOURCE_MODES = new Set([
  DECISION_SOURCE_MODES.DETERMINISTIC_COMPATIBILITY,
  DECISION_SOURCE_MODES.LEGACY_COMPATIBILITY,
]);

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

function identitySegment(value) {
  return encodeURIComponent(String(value || "").trim());
}

function scoringRuleset(profile, evaluatedTimestamp) {
  return normalizeRulesetDescriptor({
    rulesetId: `${PURSUIT_SCORING_RULESET_ID}:${profile.profileId || "unavailable"}`,
    rulesetVersion: profile.rulesetVersion,
    sourceMode: DECISION_SOURCE_MODES.DETERMINISTIC,
    providerName: null,
    modelName: null,
    deterministic: true,
    compatibility: false,
    generatedTimestamp: evaluatedTimestamp,
    description:
      "Deterministic weighted evaluation of strategy-supplied, evidence-linked factor observations.",
  });
}

function baseResult({
  assetStrategyContext,
  evaluationState,
  evaluatedTimestamp,
  explanation,
  profile,
  productionEligible = false,
  warnings = [],
}) {
  const context = safeObject(assetStrategyContext);
  const scoreId =
    context.dealId && profile.profileId
      ? `pursuit-score:deal:${identitySegment(context.dealId)}:${identitySegment(
          profile.profileId
        )}:${identitySegment(profile.profileVersion)}`
      : null;
  return normalizePursuitScoreResult({
    scoreId,
    organizationId: context.organizationId,
    tenantId: context.tenantId,
    strategyId: profile.strategyId || context.selectedStrategyId,
    strategyVersion: profile.strategyVersion,
    strategySupportState: context.strategySupportState,
    assetType: profile.assetType || context.assetType,
    scoringProfileId: profile.profileId,
    profileVersion: profile.profileVersion,
    profileStatus: profile.status,
    productionEligible,
    evaluationState,
    score: null,
    displayValue: null,
    categoryResults: [],
    factorResults: [],
    evidenceReferenceIds: [],
    blockingIssueIds: [],
    missingInformationItemIds: [],
    conflictIds: [],
    ruleset: scoringRuleset(profile, evaluatedTimestamp),
    evaluatedTimestamp,
    expirationTimestamp: profile.expirationTimestamp,
    sourceMode: DECISION_SOURCE_MODES.DETERMINISTIC,
    explanation,
    partialDataWarnings: warnings,
  });
}

function normalizeEvidence(values) {
  const byId = new Map();
  (Array.isArray(values) ? values : [])
    .map(normalizeEvidenceReference)
    .filter(Boolean)
    .slice(0, PURSUIT_SCORING_LIMITS.EVIDENCE)
    .forEach((entry) => {
      if (!byId.has(entry.evidenceId)) byId.set(entry.evidenceId, entry);
    });
  return byId;
}

function normalizeObservations(values) {
  const byFactorId = new Map();
  const observationIds = new Set();
  const warnings = [];

  (Array.isArray(values) ? values : [])
    .slice(0, PURSUIT_SCORING_LIMITS.OBSERVATIONS)
    .map(normalizePursuitScoringObservation)
    .forEach((observation) => {
      if (!observation.observationId || !observation.factorId) return;
      if (observationIds.has(observation.observationId)) {
        warnings.push(
          `Duplicate observation ${observation.observationId} was ignored.`
        );
        return;
      }
      observationIds.add(observation.observationId);
      if (byFactorId.has(observation.factorId)) {
        warnings.push(
          `Duplicate factor observation ${observation.factorId} was ignored.`
        );
        return;
      }
      byFactorId.set(observation.factorId, observation);
    });

  return { byFactorId, warnings: uniqueStrings(warnings) };
}

function getOpenInformationItems(readModel) {
  return (Array.isArray(readModel?.openItems) ? readModel.openItems : [])
    .filter((item) => item && typeof item === "object")
    .slice(0, PURSUIT_SCORING_LIMITS.REFERENCES);
}

function getBlockingLimitations(readModel) {
  return (Array.isArray(readModel?.limitations) ? readModel.limitations : [])
    .filter((limitation) => BLOCKING_LIMITATION_TYPES.has(limitation?.type))
    .slice(0, PURSUIT_SCORING_LIMITS.REFERENCES);
}

function behaviorForState(factor, informationState) {
  if (
    informationState ===
    PURSUIT_SCORING_INFORMATION_STATES.NOT_APPLICABLE
  ) {
    return factor.notApplicableBehavior;
  }
  if (
    [
      PURSUIT_SCORING_INFORMATION_STATES.UNKNOWN,
      PURSUIT_SCORING_INFORMATION_STATES.UNVERIFIED,
      PURSUIT_SCORING_INFORMATION_STATES.STALE,
      PURSUIT_SCORING_INFORMATION_STATES.UNAVAILABLE,
    ].includes(informationState)
  ) {
    return factor.unknownValueBehavior;
  }
  return factor.missingValueBehavior;
}

function unavailableFactorResult({ factor, observation, reason, behavior }) {
  const notApplicable =
    behavior === PURSUIT_SCORING_VALUE_BEHAVIORS.NOT_APPLICABLE;
  const blocked = behavior === PURSUIT_SCORING_VALUE_BEHAVIORS.BLOCK;
  return normalizePursuitScoringFactorResult({
    ...(observation || {}),
    factorId: factor.factorId,
    categoryId: factor.categoryId,
    label: factor.label,
    evaluationState: blocked
      ? PURSUIT_SCORING_EVALUATION_STATES.BLOCKED
      : notApplicable
        ? PURSUIT_SCORING_EVALUATION_STATES.NOT_EVALUATED
        : PURSUIT_SCORING_EVALUATION_STATES.PARTIAL,
    informationState: notApplicable
      ? PURSUIT_SCORING_INFORMATION_STATES.NOT_APPLICABLE
      : observation?.informationState ||
        PURSUIT_SCORING_INFORMATION_STATES.MISSING,
    applicable: !notApplicable,
    normalizedScore: null,
    weightWithinCategory: factor.weightWithinCategory,
    categoryPointContribution: null,
    maximumCategoryPointContribution: factor.maximumContribution,
    omittedWeight: notApplicable ? 0 : factor.weightWithinCategory,
    blockingReason: blocked ? reason : null,
    explanation: reason,
    partialDataWarnings: blocked || notApplicable ? [] : [reason],
  });
}

function evidenceIsCompatibility(evidence) {
  return Boolean(
    evidence?.reliabilityLabel === "Compatibility Record" ||
      evidence?.provenanceDetails?.compatibilityMapping === true ||
      String(evidence?.sourceType || "").includes("compatibility")
  );
}

function evaluateFactor({
  evidenceById,
  factor,
  informationItems,
  observation,
  profile,
}) {
  const linkedBlockingItems = informationItems.filter(
    (item) =>
      factor.blockingRequirementIds.includes(item.requirementId) &&
      item.state !== PURSUIT_SCORING_INFORMATION_STATES.PRESENT &&
      item.state !== PURSUIT_SCORING_INFORMATION_STATES.NOT_APPLICABLE
  );
  if (linkedBlockingItems.length) {
    return unavailableFactorResult({
      factor,
      observation,
      behavior: PURSUIT_SCORING_VALUE_BEHAVIORS.BLOCK,
      reason: `${factor.label} is blocked by required information: ${linkedBlockingItems
        .map((item) => item.label || item.requirementId)
        .join(", ")}.`,
    });
  }

  if (!observation) {
    return unavailableFactorResult({
      factor,
      observation: null,
      behavior: factor.missingValueBehavior,
      reason: `${factor.label} has no strategy-supplied observation.`,
    });
  }

  if (
    observation.strategyId !== profile.strategyId ||
    observation.assetType !== profile.assetType
  ) {
    return unavailableFactorResult({
      factor,
      observation,
      behavior: PURSUIT_SCORING_VALUE_BEHAVIORS.BLOCK,
      reason: `${factor.label} observation does not match the scoring strategy and asset type.`,
    });
  }

  if (
    observation.conflictIds.length ||
    observation.informationState ===
      PURSUIT_SCORING_INFORMATION_STATES.CONFLICTING
  ) {
    return unavailableFactorResult({
      factor,
      observation,
      behavior: factor.missingValueBehavior,
      reason: `${factor.label} has an explicit unresolved conflict.`,
    });
  }

  if (
    !observation.applicable ||
    observation.informationState ===
      PURSUIT_SCORING_INFORMATION_STATES.NOT_APPLICABLE
  ) {
    return unavailableFactorResult({
      factor,
      observation,
      behavior: factor.notApplicableBehavior,
      reason: `${factor.label} is explicitly not applicable to this evaluation.`,
    });
  }

  if (
    observation.evaluationState !==
      PURSUIT_SCORING_EVALUATION_STATES.EVALUATED ||
    observation.informationState !==
      PURSUIT_SCORING_INFORMATION_STATES.PRESENT ||
    observation.normalizedScore === null
  ) {
    const behavior = behaviorForState(factor, observation.informationState);
    return unavailableFactorResult({
      factor,
      observation,
      behavior,
      reason: `${factor.label} does not contain a valid evaluated 0-100 observation.`,
    });
  }

  const profileSourceModes =
    profile.evidenceAndProvenanceRequirements.acceptedSourceModes;
  if (
    !factor.acceptedSourceModes.includes(observation.sourceMode) ||
    (profileSourceModes.length &&
      !profileSourceModes.includes(observation.sourceMode))
  ) {
    return unavailableFactorResult({
      factor,
      observation,
      behavior: factor.missingValueBehavior,
      reason: `${factor.label} uses a source mode that the scoring profile does not accept.`,
    });
  }

  const evidenceReferences = observation.evidenceReferenceIds
    .map((evidenceId) => evidenceById.get(evidenceId))
    .filter(Boolean);
  const requiredEvidenceCount = Math.max(
    factor.minimumEvidenceCount,
    profile.evidenceAndProvenanceRequirements
      .requireEvidenceForContributingFactors
      ? 1
      : 0
  );
  if (evidenceReferences.length < requiredEvidenceCount) {
    return unavailableFactorResult({
      factor,
      observation,
      behavior: factor.missingValueBehavior,
      reason: `${factor.label} lacks the Evidence references required by its scoring profile.`,
    });
  }

  const containsCompatibilityEvidence =
    COMPATIBILITY_SOURCE_MODES.has(observation.sourceMode) ||
    evidenceReferences.some(evidenceIsCompatibility);
  const compatibilityAllowed =
    factor.compatibilityEvidenceAllowed &&
    profile.evidenceAndProvenanceRequirements.allowCompatibilityEvidence;
  if (containsCompatibilityEvidence && !compatibilityAllowed) {
    return unavailableFactorResult({
      factor,
      observation,
      behavior: factor.missingValueBehavior,
      reason: `${factor.label} has compatibility Evidence that this profile does not permit.`,
    });
  }

  const categoryPointContribution = Math.min(
    (observation.normalizedScore / 100) * factor.weightWithinCategory,
    factor.maximumContribution
  );
  return normalizePursuitScoringFactorResult({
    ...observation,
    categoryId: factor.categoryId,
    label: factor.label,
    evaluationState: PURSUIT_SCORING_EVALUATION_STATES.EVALUATED,
    weightWithinCategory: factor.weightWithinCategory,
    categoryPointContribution,
    maximumCategoryPointContribution: factor.maximumContribution,
    omittedWeight: 0,
    blockingReason: null,
    evidenceReferenceIds: evidenceReferences.map(
      (reference) => reference.evidenceId
    ),
    explanation:
      observation.explanation ||
      `${factor.label} contributed ${categoryPointContribution.toFixed(
        2
      )} category points from its strategy-supplied normalized observation.`,
    partialDataWarnings: uniqueStrings([
      ...observation.partialDataWarnings,
      ...(containsCompatibilityEvidence
        ? ["This factor uses explicitly permitted compatibility Evidence."]
        : []),
    ]),
  });
}

function evaluateCategory(category, factorResults) {
  const results = category.factorIds
    .map((factorId) => factorResults.get(factorId))
    .filter(Boolean);
  const evaluated = results.filter(
    (result) =>
      result.evaluationState ===
      PURSUIT_SCORING_EVALUATION_STATES.EVALUATED
  );
  const blocked = results.filter(
    (result) =>
      result.evaluationState === PURSUIT_SCORING_EVALUATION_STATES.BLOCKED
  );
  const omitted = results.filter(
    (result) =>
      result.evaluationState === PURSUIT_SCORING_EVALUATION_STATES.PARTIAL
  );
  const notApplicable = results.filter(
    (result) =>
      result.informationState ===
      PURSUIT_SCORING_INFORMATION_STATES.NOT_APPLICABLE
  );
  const evaluatedFactorWeight = evaluated.reduce(
    (total, result) => total + (result.weightWithinCategory || 0),
    0
  );
  const omittedFactorWeight = omitted.reduce(
    (total, result) => total + (result.weightWithinCategory || 0),
    0
  );
  const belowMinimum =
    evaluated.length < category.minimumEvaluatedFactorCount;
  const categoryBlocked =
    blocked.length > 0 || (category.blocking && belowMinimum);
  const rawCategoryScore =
    !categoryBlocked && !belowMinimum && evaluatedFactorWeight > 0
      ? (evaluated.reduce(
          (total, result) =>
            total + (result.categoryPointContribution || 0),
          0
        ) /
          evaluatedFactorWeight) *
        100
      : null;
  const weightedContribution =
    rawCategoryScore === null
      ? null
      : (rawCategoryScore / 100) * category.weight;
  const partial =
    omitted.length > 0 || notApplicable.length > 0 || belowMinimum;
  const explanation = categoryBlocked
    ? belowMinimum
      ? `${category.label} requires at least ${category.minimumEvaluatedFactorCount} evaluated factors.`
      : `${category.label} contains a blocking factor.`
    : partial
      ? `${category.label} was calculated from ${evaluated.length} evaluated factors; omitted factor weight is disclosed and was not scored as zero.`
      : `${category.label} was calculated from all applicable profile factors.`;

  return normalizePursuitScoringCategoryResult({
    categoryId: category.categoryId,
    label: category.label,
    evaluationState: categoryBlocked
      ? PURSUIT_SCORING_EVALUATION_STATES.BLOCKED
      : partial
        ? PURSUIT_SCORING_EVALUATION_STATES.PARTIAL
        : PURSUIT_SCORING_EVALUATION_STATES.EVALUATED,
    rawCategoryScore,
    weightedContribution,
    maximumWeightedContribution: category.weight,
    evaluatedFactorCount: evaluated.length,
    omittedFactorCount: omitted.length,
    notApplicableFactorCount: notApplicable.length,
    evaluatedFactorWeight,
    omittedFactorWeight,
    blockingFactors: blocked.map((result) => result.factorId),
    factorResults: results,
    evidenceReferenceIds: uniqueStrings(
      evaluated.flatMap((result) => result.evidenceReferenceIds)
    ),
    explanation,
    partialDataWarnings: uniqueStrings(
      results.flatMap((result) => result.partialDataWarnings)
    ),
  });
}

export function roundAndClampPursuitScore(
  value,
  policy = PURSUIT_SCORING_ROUNDING_POLICIES.NEAREST_INTEGER
) {
  const number = finiteNumber(value);
  if (number === null) return null;
  let rounded;
  if (policy === PURSUIT_SCORING_ROUNDING_POLICIES.ONE_DECIMAL) {
    rounded = Math.round(number * 10) / 10;
  } else if (policy === PURSUIT_SCORING_ROUNDING_POLICIES.TWO_DECIMALS) {
    rounded = Math.round(number * 100) / 100;
  } else {
    rounded = Math.round(number);
  }
  return Math.max(0, Math.min(100, rounded));
}

export function evaluatePursuitScore({
  assetStrategyContext,
  assetStrategyContract,
  scoringProfile,
  factorObservations = [],
  missingInformationReadModel = null,
  evidenceReferences = [],
  evaluatedTimestamp,
  executionMode = PURSUIT_SCORING_EXECUTION_MODES.PRODUCTION,
} = {}) {
  const context = safeObject(assetStrategyContext);
  const normalizedEvaluatedTimestamp = normalizeDecisionTimestamp(
    evaluatedTimestamp
  );
  const profileValidation = validatePursuitScoringProfile(scoringProfile);
  const profile = profileValidation.profile;

  if (!profile.profileId) {
    return baseResult({
      assetStrategyContext: context,
      profile,
      evaluationState: PURSUIT_SCORING_EVALUATION_STATES.NOT_EVALUATED,
      evaluatedTimestamp: normalizedEvaluatedTimestamp,
      explanation:
        "No concrete Asset Strategy scoring profile was supplied, so Pursuit Score was not evaluated.",
    });
  }

  if (!normalizedEvaluatedTimestamp) {
    return baseResult({
      assetStrategyContext: context,
      profile,
      evaluationState: PURSUIT_SCORING_EVALUATION_STATES.BLOCKED,
      evaluatedTimestamp: null,
      explanation:
        "A supplied evaluation timestamp is required for reproducible Pursuit Scoring.",
    });
  }

  if (!profileValidation.valid) {
    return baseResult({
      assetStrategyContext: context,
      profile,
      evaluationState: PURSUIT_SCORING_EVALUATION_STATES.BLOCKED,
      evaluatedTimestamp: normalizedEvaluatedTimestamp,
      explanation: `The Pursuit Scoring profile is invalid: ${profileValidation.errors.join(
        " "
      )}`,
      warnings: profileValidation.errors,
    });
  }

  const evaluationTime = new Date(normalizedEvaluatedTimestamp).getTime();
  if (
    profile.expirationTimestamp &&
    evaluationTime >= new Date(profile.expirationTimestamp).getTime()
  ) {
    return baseResult({
      assetStrategyContext: context,
      profile,
      evaluationState: PURSUIT_SCORING_EVALUATION_STATES.EXPIRED,
      evaluatedTimestamp: normalizedEvaluatedTimestamp,
      explanation: "The supplied Pursuit Scoring profile has expired.",
    });
  }
  if (
    profile.effectiveTimestamp &&
    evaluationTime < new Date(profile.effectiveTimestamp).getTime()
  ) {
    return baseResult({
      assetStrategyContext: context,
      profile,
      evaluationState: PURSUIT_SCORING_EVALUATION_STATES.UNAVAILABLE,
      evaluatedTimestamp: normalizedEvaluatedTimestamp,
      explanation: "The supplied Pursuit Scoring profile is not yet effective.",
    });
  }
  if (profile.status === PURSUIT_SCORING_PROFILE_STATUSES.RETIRED) {
    return baseResult({
      assetStrategyContext: context,
      profile,
      evaluationState: profile.supersededProfileReference
        ? PURSUIT_SCORING_EVALUATION_STATES.SUPERSEDED
        : PURSUIT_SCORING_EVALUATION_STATES.UNAVAILABLE,
      evaluatedTimestamp: normalizedEvaluatedTimestamp,
      explanation: profile.supersededProfileReference
        ? `The scoring profile was superseded by ${profile.supersededProfileReference}.`
        : "The supplied Pursuit Scoring profile is retired.",
    });
  }
  if (
    [
      PURSUIT_SCORING_PROFILE_STATUSES.DRAFT,
      PURSUIT_SCORING_PROFILE_STATUSES.DEFERRED,
    ].includes(profile.status)
  ) {
    return baseResult({
      assetStrategyContext: context,
      profile,
      evaluationState: PURSUIT_SCORING_EVALUATION_STATES.NOT_EVALUATED,
      evaluatedTimestamp: normalizedEvaluatedTimestamp,
      explanation: `A ${profile.status} scoring profile cannot generate a Pursuit Score.`,
    });
  }

  const testOnlyAllowed =
    profile.status === PURSUIT_SCORING_PROFILE_STATUSES.TEST_ONLY &&
    [
      PURSUIT_SCORING_EXECUTION_MODES.TEST,
      PURSUIT_SCORING_EXECUTION_MODES.DEVELOPMENT,
    ].includes(executionMode);
  const productionAllowed =
    profile.status === PURSUIT_SCORING_PROFILE_STATUSES.ACTIVE &&
    executionMode === PURSUIT_SCORING_EXECUTION_MODES.PRODUCTION;
  if (!testOnlyAllowed && !productionAllowed) {
    return baseResult({
      assetStrategyContext: context,
      profile,
      evaluationState: PURSUIT_SCORING_EVALUATION_STATES.NOT_EVALUATED,
      evaluatedTimestamp: normalizedEvaluatedTimestamp,
      explanation:
        "Test-only profiles require explicit test or development execution, and production execution requires an active profile.",
    });
  }

  const contextConflicts = [
    ...(Array.isArray(context.classificationConflicts)
      ? context.classificationConflicts
      : []),
    ...(Array.isArray(context.conflicts) ? context.conflicts : []),
  ];
  if (
    context.classificationState !== ASSET_CLASSIFICATION_STATES.CLASSIFIED ||
    context.manualReviewRequired === true ||
    contextConflicts.length > 0
  ) {
    return normalizePursuitScoreResult({
      ...baseResult({
        assetStrategyContext: context,
        profile,
        evaluationState: PURSUIT_SCORING_EVALUATION_STATES.BLOCKED,
        evaluatedTimestamp: normalizedEvaluatedTimestamp,
        explanation:
          "Pursuit Score requires an explicit, non-conflicting asset classification.",
      }),
      conflictIds: contextConflicts.map(
        (conflict) => conflict.conflictId || conflict.id
      ),
    });
  }
  if (
    context.assetType !== profile.assetType ||
    context.selectedStrategyId !== profile.strategyId
  ) {
    return baseResult({
      assetStrategyContext: context,
      profile,
      evaluationState: PURSUIT_SCORING_EVALUATION_STATES.BLOCKED,
      evaluatedTimestamp: normalizedEvaluatedTimestamp,
      explanation:
        "The scoring profile does not match the classified asset and selected Asset Strategy.",
    });
  }
  if (
    context.strategySupportState !==
    ASSET_STRATEGY_SUPPORT_STATES.IMPLEMENTED
  ) {
    return baseResult({
      assetStrategyContext: context,
      profile,
      evaluationState: PURSUIT_SCORING_EVALUATION_STATES.BLOCKED,
      evaluatedTimestamp: normalizedEvaluatedTimestamp,
      explanation:
        "The selected Asset Strategy is not implemented and cannot produce a Pursuit Score.",
    });
  }
  if (!context.dealId) {
    return baseResult({
      assetStrategyContext: context,
      profile,
      evaluationState: PURSUIT_SCORING_EVALUATION_STATES.BLOCKED,
      evaluatedTimestamp: normalizedEvaluatedTimestamp,
      explanation:
        "A stable deal identifier is required for an auditable Pursuit Score result.",
    });
  }

  const hookValidation = validatePursuitScoringProfileHook({
    profile,
    strategyContract: assetStrategyContract,
  });
  if (!hookValidation.valid) {
    return baseResult({
      assetStrategyContext: context,
      profile,
      evaluationState: PURSUIT_SCORING_EVALUATION_STATES.BLOCKED,
      evaluatedTimestamp: normalizedEvaluatedTimestamp,
      explanation: `The Pursuit Scoring profile is not connected to a valid Asset Strategy hook: ${hookValidation.errors.join(
        " "
      )}`,
      warnings: hookValidation.errors,
    });
  }

  const blockingLimitations = getBlockingLimitations(
    missingInformationReadModel
  );
  if (blockingLimitations.length) {
    return normalizePursuitScoreResult({
      ...baseResult({
        assetStrategyContext: context,
        profile,
        evaluationState: PURSUIT_SCORING_EVALUATION_STATES.BLOCKED,
        evaluatedTimestamp: normalizedEvaluatedTimestamp,
        explanation:
          "A current Asset Strategy or capability limitation prevents Pursuit Scoring.",
      }),
      blockingIssueIds: blockingLimitations.map(
        (limitation) => limitation.limitationId || limitation.id
      ),
    });
  }

  const informationItems = getOpenInformationItems(
    missingInformationReadModel
  );
  const profileBlockingItems = informationItems.filter(
    (item) =>
      profile.blockingRequirementIds.includes(item.requirementId) &&
      item.state !== PURSUIT_SCORING_INFORMATION_STATES.PRESENT &&
      item.state !== PURSUIT_SCORING_INFORMATION_STATES.NOT_APPLICABLE
  );
  if (profileBlockingItems.length) {
    return normalizePursuitScoreResult({
      ...baseResult({
        assetStrategyContext: context,
        profile,
        evaluationState: PURSUIT_SCORING_EVALUATION_STATES.BLOCKED,
        evaluatedTimestamp: normalizedEvaluatedTimestamp,
        explanation:
          "Decision-critical information required by the scoring profile is unresolved.",
      }),
      blockingIssueIds: profileBlockingItems.map(
        (item) => item.itemId || item.requirementId
      ),
      missingInformationItemIds: profileBlockingItems.map(
        (item) => item.itemId || item.requirementId
      ),
      conflictIds: profileBlockingItems.flatMap((item) => item.conflictIds || []),
    });
  }

  const evidenceById = normalizeEvidence(evidenceReferences);
  const observations = normalizeObservations(factorObservations);
  const factorResultMap = new Map();
  profile.factorDefinitions.forEach((factor) => {
    factorResultMap.set(
      factor.factorId,
      evaluateFactor({
        evidenceById,
        factor,
        informationItems,
        observation: observations.byFactorId.get(factor.factorId),
        profile,
      })
    );
  });

  const factorResults = [...factorResultMap.values()];
  const categoryResults = profile.categoryDefinitions.map((category) =>
    evaluateCategory(category, factorResultMap)
  );
  const blockingFactors = factorResults.filter(
    (result) =>
      result.evaluationState === PURSUIT_SCORING_EVALUATION_STATES.BLOCKED
  );
  const blockingCategories = categoryResults.filter(
    (result) =>
      result.evaluationState === PURSUIT_SCORING_EVALUATION_STATES.BLOCKED
  );
  const evaluatedFactors = factorResults.filter(
    (result) =>
      result.evaluationState ===
      PURSUIT_SCORING_EVALUATION_STATES.EVALUATED
  );
  const evaluatedCategories = categoryResults.filter(
    (result) => finiteNumber(result.rawCategoryScore) !== null
  );
  const requiredFactorsMissing =
    profile.minimumEvaluationRequirements.requiredFactorIds.filter(
      (factorId) =>
        factorResultMap.get(factorId)?.evaluationState !==
        PURSUIT_SCORING_EVALUATION_STATES.EVALUATED
    );
  const minimumsFailed =
    evaluatedFactors.length <
      profile.minimumEvaluationRequirements.minimumEvaluatedFactorCount ||
    evaluatedCategories.length <
      profile.minimumEvaluationRequirements.minimumEvaluatedCategoryCount;
  const partialFactors = factorResults.filter(
    (result) =>
      result.evaluationState === PURSUIT_SCORING_EVALUATION_STATES.PARTIAL
  );
  const partialCategories = categoryResults.filter(
    (result) =>
      result.evaluationState === PURSUIT_SCORING_EVALUATION_STATES.PARTIAL
  );
  const partial = partialFactors.length > 0 || partialCategories.length > 0;
  const partialDenied =
    partial &&
    profile.partialEvaluationPolicy ===
      PURSUIT_SCORING_PARTIAL_POLICIES.DENY;

  if (
    blockingFactors.length ||
    blockingCategories.length ||
    requiredFactorsMissing.length ||
    minimumsFailed ||
    partialDenied
  ) {
    const blockingIssueIds = uniqueStrings([
      ...blockingFactors.map((result) => result.factorId),
      ...blockingCategories.map((result) => result.categoryId),
      ...requiredFactorsMissing,
    ]);
    return normalizePursuitScoreResult({
      ...baseResult({
        assetStrategyContext: context,
        profile,
        evaluationState: PURSUIT_SCORING_EVALUATION_STATES.BLOCKED,
        evaluatedTimestamp: normalizedEvaluatedTimestamp,
        explanation: partialDenied
          ? "The scoring profile does not permit partial evaluation, so omitted optional factors block a numeric score."
          : "Required scoring factors or category minimums are not satisfied; no numeric zero was substituted.",
        warnings: observations.warnings,
      }),
      categoryResults,
      factorResults,
      blockingIssueIds,
      missingInformationItemIds: uniqueStrings(
        factorResults.flatMap(
          (result) => result.missingInformationItemIds
        )
      ),
      conflictIds: uniqueStrings(
        factorResults.flatMap((result) => result.conflictIds)
      ),
    });
  }

  const evaluatedCategoryWeight = evaluatedCategories.reduce(
    (total, category) =>
      total + (category.maximumWeightedContribution || 0),
    0
  );
  const omittedCategoryWeight = Math.max(0, 100 - evaluatedCategoryWeight);
  const omittedFactorWeight = categoryResults.reduce(
    (total, category) =>
      total +
      ((category.maximumWeightedContribution || 0) *
        (category.omittedFactorWeight || 0)) /
        100,
    0
  );
  if (evaluatedCategoryWeight <= 0) {
    return baseResult({
      assetStrategyContext: context,
      profile,
      evaluationState: PURSUIT_SCORING_EVALUATION_STATES.BLOCKED,
      evaluatedTimestamp: normalizedEvaluatedTimestamp,
      explanation:
        "No category retained evaluated weight, so Pursuit Score cannot be calculated.",
    });
  }

  const weightedTotal = evaluatedCategories.reduce(
    (total, category) => total + (category.weightedContribution || 0),
    0
  );
  const unroundedScore = (weightedTotal / evaluatedCategoryWeight) * 100;
  const score = roundAndClampPursuitScore(
    unroundedScore,
    profile.roundingPolicy
  );
  const evidenceReferenceIds = uniqueStrings(
    evaluatedFactors.flatMap((result) => result.evidenceReferenceIds)
  ).slice(0, PURSUIT_SCORING_LIMITS.EVIDENCE);
  const evaluationState = partial || omittedCategoryWeight > 0
    ? PURSUIT_SCORING_EVALUATION_STATES.PARTIAL
    : PURSUIT_SCORING_EVALUATION_STATES.EVALUATED;
  const partialWarnings = uniqueStrings([
    ...profile.compatibilityWarnings,
    ...profile.partialDataWarnings,
    ...observations.warnings,
    ...factorResults.flatMap((result) => result.partialDataWarnings),
    ...(evaluationState === PURSUIT_SCORING_EVALUATION_STATES.PARTIAL
      ? [
          `Partial evaluation omitted ${omittedCategoryWeight.toFixed(
            2
          )} category weight and ${omittedFactorWeight.toFixed(
            2
          )} weighted factor points; omitted values were not scored as zero.`,
        ]
      : []),
  ]).slice(0, PURSUIT_SCORING_LIMITS.WARNINGS);

  return normalizePursuitScoreResult({
    scoreId: `pursuit-score:deal:${identitySegment(
      context.dealId
    )}:${identitySegment(profile.profileId)}:${identitySegment(
      profile.profileVersion
    )}`,
    organizationId: context.organizationId,
    tenantId: context.tenantId,
    strategyId: profile.strategyId,
    strategyVersion: profile.strategyVersion,
    strategySupportState: context.strategySupportState,
    assetType: profile.assetType,
    scoringProfileId: profile.profileId,
    profileVersion: profile.profileVersion,
    profileStatus: profile.status,
    productionEligible: productionAllowed,
    evaluationState,
    score,
    displayValue: `${score}/100`,
    categoryResults,
    factorResults,
    evidenceReferenceIds,
    blockingIssueIds: [],
    missingInformationItemIds: uniqueStrings(
      factorResults.flatMap((result) => result.missingInformationItemIds)
    ),
    conflictIds: uniqueStrings(
      factorResults.flatMap((result) => result.conflictIds)
    ),
    ruleset: scoringRuleset(profile, normalizedEvaluatedTimestamp),
    evaluatedTimestamp: normalizedEvaluatedTimestamp,
    expirationTimestamp: profile.expirationTimestamp,
    sourceMode: DECISION_SOURCE_MODES.DETERMINISTIC,
    explanation:
      evaluationState === PURSUIT_SCORING_EVALUATION_STATES.PARTIAL
        ? "Pursuit Score was deterministically calculated from evaluated optional factors. Omitted weight is disclosed and was not treated as zero."
        : "Pursuit Score was deterministically calculated from all applicable strategy factors and their retained Evidence references.",
    evaluatedCategoryWeight,
    omittedCategoryWeight,
    omittedFactorWeight,
    partialDataWarnings: partialWarnings,
  });
}
