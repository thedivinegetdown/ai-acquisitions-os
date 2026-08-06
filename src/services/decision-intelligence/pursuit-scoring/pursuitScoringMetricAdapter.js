import { ASSET_STRATEGY_SUPPORT_STATES } from "../../asset-strategy/assetStrategyContextService";
import {
  DECISION_EVALUATION_STATES,
  DECISION_SOURCE_MODES,
  normalizeMetricOutput,
} from "../decisionContracts";
import {
  PURSUIT_SCORING_EVALUATION_STATES,
  PURSUIT_SCORING_PROFILE_STATUSES,
  normalizePursuitScoreResult,
} from "./pursuitScoringContracts";

// Distinct responsibility: adapt one canonical Pursuit Score result to the
// existing Decision metric contract and enforce production presentation gates.
function hasEvaluatedScore(result) {
  return Boolean(
    [
      PURSUIT_SCORING_EVALUATION_STATES.EVALUATED,
      PURSUIT_SCORING_EVALUATION_STATES.PARTIAL,
    ].includes(result.evaluationState) &&
      Number.isFinite(result.score) &&
      result.score >= 0 &&
      result.score <= 100
  );
}

function hasExplainabilityMetadata(result) {
  return Boolean(
    result.scoringProfileId &&
      result.profileVersion &&
      result.ruleset.rulesetId &&
      result.ruleset.rulesetVersion &&
      result.evidenceReferenceIds.length > 0
  );
}

function isProductionResult(result, assetStrategyContext) {
  return Boolean(
    result.profileStatus === PURSUIT_SCORING_PROFILE_STATUSES.ACTIVE &&
      result.productionEligible &&
      assetStrategyContext?.strategySupportState ===
        ASSET_STRATEGY_SUPPORT_STATES.IMPLEMENTED &&
      assetStrategyContext?.assetType === result.assetType &&
      assetStrategyContext?.selectedStrategyId === result.strategyId
  );
}

function canonicalMetricState(result) {
  if (
    [
      PURSUIT_SCORING_EVALUATION_STATES.EVALUATED,
      PURSUIT_SCORING_EVALUATION_STATES.PARTIAL,
    ].includes(result.evaluationState)
  ) {
    return DECISION_EVALUATION_STATES.EVALUATED;
  }
  if (result.evaluationState === PURSUIT_SCORING_EVALUATION_STATES.EXPIRED) {
    return DECISION_EVALUATION_STATES.EXPIRED;
  }
  if (
    result.evaluationState === PURSUIT_SCORING_EVALUATION_STATES.SUPERSEDED
  ) {
    return DECISION_EVALUATION_STATES.SUPERSEDED;
  }
  if (
    [
      PURSUIT_SCORING_EVALUATION_STATES.BLOCKED,
      PURSUIT_SCORING_EVALUATION_STATES.UNAVAILABLE,
    ].includes(result.evaluationState)
  ) {
    return DECISION_EVALUATION_STATES.UNAVAILABLE;
  }
  return DECISION_EVALUATION_STATES.NOT_EVALUATED;
}

export function toPursuitScoreMetric(
  value,
  { assetStrategyContext = null, productionOnly = false } = {}
) {
  const result = normalizePursuitScoreResult(value);
  const scoreEvaluated = hasEvaluatedScore(result);
  const explainable = hasExplainabilityMetadata(result);
  const productionEligible = isProductionResult(
    result,
    assetStrategyContext
  );
  const outputAllowed =
    scoreEvaluated && explainable && (!productionOnly || productionEligible);
  const requestedState = canonicalMetricState(result);
  const evaluationState = outputAllowed
    ? DECISION_EVALUATION_STATES.EVALUATED
    : scoreEvaluated
      ? DECISION_EVALUATION_STATES.UNAVAILABLE
      : requestedState;
  const explanation = outputAllowed
    ? result.explanation
    : scoreEvaluated && !explainable
      ? "Pursuit Score lacks the Evidence or ruleset metadata required for canonical Decision Intelligence."
      : scoreEvaluated && productionOnly && !productionEligible
        ? "Pursuit Score is not available because no implemented Asset Strategy supplied an active production scoring profile."
        : result.explanation ||
          "No concrete Asset Strategy scoring profile has evaluated Pursuit Score.";

  return normalizeMetricOutput({
    metricId: "pursuit-score",
    evaluationState,
    value: outputAllowed ? result.score : null,
    displayValue: outputAllowed ? result.displayValue : null,
    unit: "score",
    scale: "0-100",
    explanation,
    inputEvidenceIds: outputAllowed ? result.evidenceReferenceIds : [],
    blockingIssueIds: result.blockingIssueIds,
    advisoryIssueIds: result.missingInformationItemIds,
    rulesetVersion: result.ruleset.rulesetVersion,
    evaluatedTimestamp: result.evaluatedTimestamp,
    expirationTimestamp: result.expirationTimestamp,
    sourceMode: DECISION_SOURCE_MODES.DETERMINISTIC,
    partialDataWarnings: result.partialDataWarnings,
  });
}

export function canPresentPursuitScore({
  assetStrategyContext,
  metric,
  result: value,
} = {}) {
  const result = normalizePursuitScoreResult(value);
  return Boolean(
    metric?.metricId === "pursuit-score" &&
      metric.evaluationState === DECISION_EVALUATION_STATES.EVALUATED &&
      Number.isFinite(metric.value) &&
      hasEvaluatedScore(result) &&
      hasExplainabilityMetadata(result) &&
      isProductionResult(result, assetStrategyContext)
  );
}
