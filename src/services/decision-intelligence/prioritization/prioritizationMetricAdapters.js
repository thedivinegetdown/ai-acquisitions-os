import { DECISION_EVALUATION_STATES, DECISION_SOURCE_MODES, normalizeMetricOutput } from "../decisionContracts";

export function toCostOfDelayMetric(result) {
  const evaluated = result?.evaluationState === "evaluated";
  return normalizeMetricOutput({
    metricId: "cost-of-delay",
    evaluationState: evaluated ? DECISION_EVALUATION_STATES.EVALUATED : DECISION_EVALUATION_STATES.UNAVAILABLE,
    value: evaluated ? result.level : null,
    displayValue: evaluated ? result.displayLabel : null,
    unit: "delay-impact",
    scale: null,
    explanation: result?.explanation || "Cost of Delay could not be evaluated.",
    inputEvidenceIds: result?.evidenceIds || [],
    blockingIssueIds: [...(result?.missingInformationIds || []), ...(result?.conflictIds || [])],
    advisoryIssueIds: result?.limitingFactors || [],
    rulesetVersion: result?.rulesetVersion,
    evaluatedTimestamp: result?.evaluatedTimestamp,
    sourceMode: DECISION_SOURCE_MODES.DETERMINISTIC,
  });
}

export function toRecommendedActionWindowMetric(result) {
  const evaluated = result?.evaluationState === "evaluated";
  return normalizeMetricOutput({
    metricId: "recommended-action-window",
    evaluationState: evaluated ? DECISION_EVALUATION_STATES.EVALUATED : DECISION_EVALUATION_STATES.UNAVAILABLE,
    value: evaluated ? result.windowType : null,
    displayValue: evaluated ? result.displayLabel : null,
    unit: "action-window",
    scale: null,
    explanation: result?.explanation || "Recommended Action Window could not be evaluated.",
    inputEvidenceIds: result?.evidenceIds || [],
    blockingIssueIds: [...(result?.missingInformationIds || []), ...(result?.conflictIds || [])],
    rulesetVersion: result?.rulesetVersion,
    evaluatedTimestamp: result?.evaluatedTimestamp,
    sourceMode: DECISION_SOURCE_MODES.DETERMINISTIC,
  });
}
