import { DECISION_EVALUATION_STATES, DECISION_SOURCE_MODES, normalizeMetricOutput } from "../decisionContracts";
import { DATA_RELIABILITY_GRADES, RECOMMENDATION_CONFIDENCE_LEVELS } from "./confidenceReliabilityContracts";

export function toDataReliabilityMetric(result) {
  const evaluated = result?.evaluationState === "evaluated" && result.grade !== DATA_RELIABILITY_GRADES.UNAVAILABLE;
  return normalizeMetricOutput({
    metricId: "data-reliability",
    evaluationState: evaluated ? DECISION_EVALUATION_STATES.EVALUATED : DECISION_EVALUATION_STATES.UNAVAILABLE,
    value: evaluated ? result.grade : null,
    displayValue: evaluated ? result.displayLabel : null,
    unit: "reliability-grade",
    scale: null,
    explanation: result?.explanation || "Data Reliability could not be evaluated.",
    inputEvidenceIds: result?.evidenceIds || [],
    blockingIssueIds: result?.conflictIds || [],
    advisoryIssueIds: result?.basisGapRequirementIds || [],
    rulesetVersion: result?.rulesetVersion,
    evaluatedTimestamp: result?.evaluatedTimestamp,
    sourceMode: DECISION_SOURCE_MODES.DETERMINISTIC,
  });
}

export function toRecommendationConfidenceMetric(result) {
  const evaluated = result?.evaluationState === "evaluated" && result.level !== RECOMMENDATION_CONFIDENCE_LEVELS.UNAVAILABLE;
  return normalizeMetricOutput({
    metricId: "recommendation-confidence",
    evaluationState: evaluated ? DECISION_EVALUATION_STATES.EVALUATED : DECISION_EVALUATION_STATES.UNAVAILABLE,
    value: evaluated ? result.level : null,
    displayValue: evaluated ? result.displayLabel : null,
    unit: "confidence-level",
    scale: null,
    explanation: result?.explanation || "Recommendation Confidence could not be evaluated.",
    inputEvidenceIds: result?.evidenceIds || [],
    blockingIssueIds: result?.conflictIds || [],
    advisoryIssueIds: result?.limitingFactors || [],
    rulesetVersion: result?.rulesetVersion,
    evaluatedTimestamp: result?.evaluatedTimestamp,
    sourceMode: DECISION_SOURCE_MODES.DETERMINISTIC,
  });
}
