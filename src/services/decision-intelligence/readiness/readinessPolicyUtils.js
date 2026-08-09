import { READINESS_ACTION_TYPES, READINESS_GATE_STATES } from "./readinessContracts";

export function getFact(strategyResult, factId) {
  return strategyResult?.factReadModel?.factsById?.[factId] || null;
}

export function matchingInformationItems(readModel, requirementIds = [], factIds = []) {
  const requirements = new Set(requirementIds);
  const facts = new Set(factIds);
  return (readModel?.openItems || []).filter(
    (item) => requirements.has(item.requirementId) || facts.has(item.canonicalField)
  );
}

function referencesForFact(fact) {
  return {
    evidenceIds: fact?.evidenceReferenceIds || [],
    conflictIds: fact?.conflictIds || [],
    staleReferenceIds: fact?.freshnessState === "stale" ? fact.evidenceReferenceIds || [] : [],
    unverifiedReferenceIds: fact?.verificationState === "unverified" ? fact.evidenceReferenceIds || [] : [],
    sourceTimestamps: fact?.sourceTimestamp ? [fact.sourceTimestamp] : [],
  };
}

export function evaluateRequiredFact(definition, inputs, factId, requirementIds = []) {
  const fact = getFact(inputs.strategyResult, factId);
  const items = matchingInformationItems(inputs.missingInformationReadModel, requirementIds, [fact?.canonicalField].filter(Boolean));
  const itemReferences = {
    missingInformationIds: items.map((item) => item.itemId),
    conflictIds: items.flatMap((item) => item.conflictIds || []),
    staleReferenceIds: items.filter((item) => item.state === "stale").flatMap((item) => item.evidenceReferenceIds || []),
    unverifiedReferenceIds: items.filter((item) => item.state === "unverified").flatMap((item) => item.evidenceReferenceIds || []),
  };
  const common = {
    factIds: [factId],
    ...referencesForFact(fact),
    missingInformationIds: itemReferences.missingInformationIds,
    conflictIds: [...(fact?.conflictIds || []), ...itemReferences.conflictIds],
    staleReferenceIds: [
      ...(fact?.freshnessState === "stale" ? fact.evidenceReferenceIds || [] : []),
      ...itemReferences.staleReferenceIds,
    ],
    unverifiedReferenceIds: [
      ...(fact?.verificationState === "unverified" ? fact.evidenceReferenceIds || [] : []),
      ...itemReferences.unverifiedReferenceIds,
    ],
    evidenceIds: fact?.evidenceReferenceIds || items.flatMap((item) => item.evidenceReferenceIds || []),
    safeNextAction: {
      actionId: `${definition.gateId}:resolve`,
      actionType: READINESS_ACTION_TYPES.COLLECT_INFORMATION,
      label: `Review ${definition.label}`,
      explanation: definition.operatorExplanation || definition.description,
      targetSection: definition.relatedSection,
    },
  };
  const states = new Set(items.map((item) => item.state));
  if (states.has("conflicting") || fact?.conflictIds?.length) return { ...common, evaluationState: READINESS_GATE_STATES.PENDING, reason: `${definition.label} has an explicit unresolved conflict.`, safeNextAction: { ...common.safeNextAction, actionType: READINESS_ACTION_TYPES.VERIFY_INFORMATION } };
  if (states.has("stale") || fact?.freshnessState === "stale") return { ...common, evaluationState: READINESS_GATE_STATES.PENDING, reason: `${definition.label} is explicitly stale and requires review.`, safeNextAction: { ...common.safeNextAction, actionType: READINESS_ACTION_TYPES.VERIFY_INFORMATION } };
  if (states.has("unverified") || fact?.verificationState === "unverified") return { ...common, evaluationState: READINESS_GATE_STATES.PENDING, reason: `${definition.label} is explicitly unverified and requires review.`, safeNextAction: { ...common.safeNextAction, actionType: READINESS_ACTION_TYPES.VERIFY_INFORMATION } };
  if (items.length || !fact || ["missing", "unknown", "unavailable"].includes(fact.state)) return { ...common, evaluationState: READINESS_GATE_STATES.PENDING, reason: `${definition.label} is missing or unknown.` };
  return { ...common, evaluationState: READINESS_GATE_STATES.PASSED, passed: true, reason: `${definition.label} is represented for deterministic review.` };
}

export function resultGate(definition, available, reason, evidenceIds = []) {
  return {
    evaluationState: available ? READINESS_GATE_STATES.PASSED : READINESS_GATE_STATES.UNAVAILABLE,
    passed: available ? true : null,
    reason,
    evidenceIds,
    safeNextAction: {
      actionId: `${definition.gateId}:review`,
      actionType: READINESS_ACTION_TYPES.REVIEW_NUMBERS,
      label: `Review ${definition.label}`,
      explanation: reason,
      targetSection: definition.relatedSection,
    },
  };
}

export function signalGate(definition, signals = []) {
  const blocking = signals.filter((signal) => signal.severity === "blocking");
  const significant = signals.filter((signal) => signal.severity === "significant");
  const attention = signals.filter((signal) => signal.severity === "attention");
  const common = {
    relatedSignalIds: signals.map((signal) => signal.signalId),
    evidenceIds: signals.flatMap((signal) => signal.evidenceReferenceIds || []),
    safeNextAction: {
      actionId: `${definition.gateId}:review`,
      actionType: READINESS_ACTION_TYPES.REVIEW_RISK_FEASIBILITY,
      label: `Review ${definition.label}`,
      explanation: "Review the represented individual strategy signals before offer preparation.",
      targetSection: definition.relatedSection,
    },
  };
  if (blocking.length) return { ...common, evaluationState: READINESS_GATE_STATES.FAILED, passed: false, reason: blocking[0].explanation || blocking[0].label };
  if (significant.length) return { ...common, evaluationState: READINESS_GATE_STATES.MANUAL_REVIEW, reason: significant[0].explanation || significant[0].label, approvalRequirement: { required: true, triggerReasons: [definition.approvalTrigger].filter(Boolean), reason: significant[0].explanation } };
  if (attention.length) return { ...common, evaluationState: READINESS_GATE_STATES.PENDING, reason: attention[0].explanation || attention[0].label };
  return { ...common, evaluationState: READINESS_GATE_STATES.PASSED, passed: true, reason: "No represented strategy signal blocks this gate. This is not an aggregate risk or feasibility conclusion." };
}

export function approvalGate(definition, approvalContext) {
  if (approvalContext?.required === true) {
    return {
      evaluationState: READINESS_GATE_STATES.MANUAL_REVIEW,
      reason: approvalContext.reason || "An existing approval requirement must be reviewed before consequential execution.",
      approvalRequirement: {
        required: true,
        status: approvalContext.status,
        reason: approvalContext.reason,
        triggerReasons: ["explicit-existing-approval-requirement"],
        approvalReferenceIds: approvalContext.approvalReferenceIds || [],
      },
      safeNextAction: {
        actionId: `${definition.gateId}:open-approvals`,
        actionType: READINESS_ACTION_TYPES.REQUEST_APPROVAL,
        label: "Open Approvals",
        explanation: approvalContext.reason || "Review the existing approval requirement.",
        targetSection: "approvals",
      },
    };
  }
  return {
    evaluationState: READINESS_GATE_STATES.PASSED,
    passed: true,
    reason: "No pending existing approval requirement is represented in the supplied approval context.",
  };
}
