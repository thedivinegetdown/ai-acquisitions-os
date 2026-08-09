import {
  DECISION_EVALUATION_STATES,
  DECISION_SOURCE_MODES,
  normalizeMetricOutput,
} from "../decisionContracts";
import { READINESS_STATES, normalizeReadinessResult } from "./readinessContracts";

// Distinct responsibility: adapt a canonical string-valued readiness gate
// result to the existing Decision Intelligence metric registry.
export function toOfferReadinessMetric(value) {
  const result = normalizeReadinessResult(value);
  const evaluated =
    result.evaluationState === "evaluated" &&
    ![READINESS_STATES.NOT_EVALUATED, READINESS_STATES.UNAVAILABLE].includes(
      result.readinessState
    );
  return normalizeMetricOutput({
    metricId: "offer-readiness",
    evaluationState: evaluated
      ? DECISION_EVALUATION_STATES.EVALUATED
      : DECISION_EVALUATION_STATES.UNAVAILABLE,
    value: evaluated ? result.readinessState : null,
    displayValue: evaluated ? result.displayLabel : null,
    unit: "readiness-state",
    scale: null,
    explanation: result.explanation || "Offer Readiness is unavailable for the selected Asset Strategy.",
    inputEvidenceIds: result.evidenceIds,
    blockingIssueIds: [
      ...result.blockingGateResults.map((gate) => gate.gateId),
      ...result.missingInformationIds,
      ...result.conflictIds,
    ],
    advisoryIssueIds: result.advisoryGateResults.map((gate) => gate.gateId),
    rulesetVersion: result.rulesetVersion,
    evaluatedTimestamp: result.evaluatedTimestamp,
    sourceMode: DECISION_SOURCE_MODES.DETERMINISTIC,
    partialDataWarnings: result.warnings,
  });
}
