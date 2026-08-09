import { ASSET_CLASSIFICATION_STATES } from "../../asset-strategy/assetStrategyContracts";
import { uniqueStrings } from "../../../utils/text";
import {
  READINESS_ACTION_TYPES,
  READINESS_CRITICALITIES,
  READINESS_GATE_STATES,
  READINESS_STATES,
  normalizeApprovalTrigger,
  normalizeReadinessGateResult,
  normalizeReadinessResult,
  validateReadinessPolicy,
} from "./readinessContracts";

const LABELS = Object.freeze({
  [READINESS_STATES.NOT_EVALUATED]: "Not Evaluated",
  [READINESS_STATES.UNAVAILABLE]: "Unavailable",
  [READINESS_STATES.NEEDS_INFORMATION]: "Needs Information",
  [READINESS_STATES.NEEDS_VERIFICATION]: "Needs Verification",
  [READINESS_STATES.MANUAL_REVIEW_REQUIRED]: "Manual Review Required",
  [READINESS_STATES.READY_FOR_OFFER_PREPARATION]: "Ready for Offer Preparation",
  [READINESS_STATES.BLOCKED]: "Blocked",
});

function segment(value) {
  return value ? encodeURIComponent(String(value)) : "unknown";
}

function unavailableResult(context, policy, evaluatedTimestamp, explanation, state = READINESS_STATES.UNAVAILABLE) {
  return normalizeReadinessResult({
    readinessId: context?.dealId ? `readiness:deal:${segment(context.dealId)}:${segment(policy?.strategyId)}` : null,
    dealId: context?.dealId,
    organizationId: context?.organizationId,
    tenantId: context?.tenantId,
    assetType: context?.assetType,
    strategyId: policy?.strategyId,
    strategyVersion: policy?.strategyVersion,
    strategyLabel: policy?.label,
    rulesetVersion: policy?.rulesetVersion,
    evaluationState: state === READINESS_STATES.NOT_EVALUATED ? "not-evaluated" : "evaluated",
    readinessState: state,
    displayLabel: LABELS[state],
    explanation,
    evaluatedTimestamp,
    recommendedNextAction: {
      actionId: "readiness:review-classification",
      actionType: READINESS_ACTION_TYPES.CLASSIFY_ASSET,
      label: "Review asset classification",
      explanation,
      targetSection: "decision",
    },
    warnings: explanation ? [explanation] : [],
  });
}

function stateForGates(gates) {
  const blocking = gates.filter((gate) => gate.criticality === READINESS_CRITICALITIES.BLOCKING);
  if (blocking.some((gate) => gate.evaluationState === READINESS_GATE_STATES.UNAVAILABLE)) return READINESS_STATES.UNAVAILABLE;
  if (blocking.some((gate) => gate.evaluationState === READINESS_GATE_STATES.FAILED)) return READINESS_STATES.BLOCKED;
  const pending = blocking.filter((gate) => gate.evaluationState === READINESS_GATE_STATES.PENDING);
  if (pending.some((gate) => gate.conflictIds.length || gate.staleReferenceIds.length || gate.unverifiedReferenceIds.length)) return READINESS_STATES.NEEDS_VERIFICATION;
  if (pending.length) return READINESS_STATES.NEEDS_INFORMATION;
  if (blocking.some((gate) => gate.evaluationState === READINESS_GATE_STATES.MANUAL_REVIEW)) return READINESS_STATES.MANUAL_REVIEW_REQUIRED;
  return READINESS_STATES.READY_FOR_OFFER_PREPARATION;
}

function nextGate(gates, state) {
  const candidates = [
    ...gates.filter((gate) => gate.gateId.includes("classification") && gate.evaluationState !== READINESS_GATE_STATES.PASSED),
    ...gates.filter((gate) => gate.conflictIds.length),
    ...gates.filter((gate) => gate.evaluationState === READINESS_GATE_STATES.PENDING && !gate.conflictIds.length && !gate.staleReferenceIds.length && !gate.unverifiedReferenceIds.length),
    ...gates.filter((gate) => gate.staleReferenceIds.length || gate.unverifiedReferenceIds.length),
    ...gates.filter((gate) => gate.evaluationState === READINESS_GATE_STATES.FAILED),
    ...gates.filter((gate) => gate.evaluationState === READINESS_GATE_STATES.MANUAL_REVIEW),
    ...gates.filter((gate) => gate.criticality === READINESS_CRITICALITIES.ADVISORY && gate.evaluationState !== READINESS_GATE_STATES.PASSED),
  ];
  const gate = candidates[0];
  if (gate) return gate.safeNextAction;
  return {
    actionId: "readiness:prepare-offer-draft",
    actionType: READINESS_ACTION_TYPES.PREPARE_OFFER_DRAFT,
    label: "Prepare an offer draft for human review",
    explanation: "The deterministic readiness gates pass. Human underwriting, approval, and review still apply.",
    targetSection: "numbers",
    enabled: state === READINESS_STATES.READY_FOR_OFFER_PREPARATION,
  };
}

function explanationFor(state, gates) {
  const unresolved = gates.filter((gate) => ![READINESS_GATE_STATES.PASSED, READINESS_GATE_STATES.NOT_APPLICABLE].includes(gate.evaluationState));
  if (state === READINESS_STATES.READY_FOR_OFFER_PREPARATION) return "All blocking deterministic gates pass sufficiently to prepare an offer for human review.";
  if (state === READINESS_STATES.BLOCKED) return unresolved[0]?.reason || "A known strategy condition blocks safe offer preparation.";
  if (state === READINESS_STATES.NEEDS_INFORMATION) return unresolved[0]?.reason || "Required decision information is missing or unknown.";
  if (state === READINESS_STATES.NEEDS_VERIFICATION) return unresolved[0]?.reason || "A critical fact requires verification before offer preparation.";
  if (state === READINESS_STATES.MANUAL_REVIEW_REQUIRED) return unresolved[0]?.reason || "A known condition requires human judgment before offer preparation.";
  return unresolved[0]?.reason || "A required strategy result is unavailable.";
}

// Distinct responsibility: execute bounded strategy-supplied gate evaluators and
// aggregate their non-numeric results without reading raw opportunity fields.
export function evaluateOfferReadiness({
  approvalContext = null,
  assetStrategyContext,
  conflicts = [],
  evaluatedTimestamp,
  evidenceReferences = [],
  missingInformationReadModel,
  policy,
  strategyResult,
} = {}) {
  const context = assetStrategyContext || {};
  if (!context.dealId) return unavailableResult(context, policy, evaluatedTimestamp, "A stable opportunity identity is required before readiness can be evaluated.", READINESS_STATES.NOT_EVALUATED);
  if (context.classificationState !== ASSET_CLASSIFICATION_STATES.CLASSIFIED) {
    const conflict = context.classificationState === ASSET_CLASSIFICATION_STATES.AMBIGUOUS;
    return unavailableResult(context, policy, evaluatedTimestamp, conflict
      ? "Asset classification review is required before Offer Readiness can be evaluated."
      : "Asset classification is required before Offer Readiness can be evaluated.");
  }
  if (!policy) return unavailableResult(context, policy, evaluatedTimestamp, "Offer Readiness is not implemented for the selected Asset Strategy.");
  const validation = validateReadinessPolicy(policy);
  if (!validation.valid || typeof policy.evaluateGate !== "function") {
    return unavailableResult(context, policy, evaluatedTimestamp, "The selected readiness policy is unavailable or invalid.");
  }
  if (context.assetType !== policy.assetType || context.selectedStrategyId !== policy.strategyId || context.strategyVersion !== policy.strategyVersion || context.strategySupportState !== "implemented") {
    return unavailableResult(context, policy, evaluatedTimestamp, "The active Asset Strategy does not match this readiness policy.");
  }

  const warnings = [];
  const inputs = {
    approvalContext,
    assetStrategyContext: context,
    conflicts: Array.isArray(conflicts) ? conflicts : [],
    evaluatedTimestamp,
    evidenceReferences: Array.isArray(evidenceReferences) ? evidenceReferences : [],
    missingInformationReadModel: missingInformationReadModel || {},
    strategyResult: strategyResult || {},
  };
  const gateResults = validation.gates.map((definition) => {
    try {
      return normalizeReadinessGateResult({
        ...definition,
        ...policy.evaluateGate(definition, inputs),
        evaluatedTimestamp,
      });
    } catch {
      const warning = `${definition.label} could not be evaluated. Readiness did not fail open.`;
      warnings.push(warning);
      return normalizeReadinessGateResult({
        ...definition,
        evaluationState: READINESS_GATE_STATES.UNAVAILABLE,
        reason: warning,
        evaluatedTimestamp,
        warnings: [warning],
      });
    }
  });
  const readinessState = stateForGates(gateResults);
  const signalApprovalReasons = uniqueStrings(gateResults.flatMap((gate) => gate.approvalRequirement.triggerReasons));
  const existingRequired = approvalContext?.required === true;
  const approvalRequirement = normalizeApprovalTrigger({
    required: existingRequired || signalApprovalReasons.length > 0,
    status: approvalContext?.status || (signalApprovalReasons.length ? "required" : "not-required"),
    reason: approvalContext?.reason || (signalApprovalReasons.length ? "Strategy conditions require human approval review before consequential execution." : null),
    triggerReasons: signalApprovalReasons,
    approvalReferenceIds: approvalContext?.approvalReferenceIds || [],
  });
  const recommendedNextAction = approvalRequirement.required && readinessState === READINESS_STATES.READY_FOR_OFFER_PREPARATION
    ? {
        actionId: "readiness:request-approval",
        actionType: READINESS_ACTION_TYPES.REQUEST_APPROVAL,
        label: "Review required approval",
        explanation: approvalRequirement.reason,
        targetSection: "decision",
      }
    : nextGate(gateResults, readinessState);

  return normalizeReadinessResult({
    readinessId: `readiness:deal:${segment(context.dealId)}:${segment(policy.strategyId)}`,
    dealId: context.dealId,
    organizationId: context.organizationId,
    tenantId: context.tenantId,
    assetType: context.assetType,
    strategyId: policy.strategyId,
    strategyVersion: policy.strategyVersion,
    strategyLabel: policy.label,
    rulesetVersion: policy.rulesetVersion,
    evaluationState: "evaluated",
    readinessState,
    displayLabel: LABELS[readinessState],
    explanation: explanationFor(readinessState, gateResults),
    gateResults,
    evidenceIds: gateResults.flatMap((gate) => gate.evidenceIds),
    missingInformationIds: gateResults.flatMap((gate) => gate.missingInformationIds),
    conflictIds: gateResults.flatMap((gate) => gate.conflictIds),
    approvalRequirement,
    recommendedNextAction,
    evaluatedTimestamp,
    warnings,
  });
}
