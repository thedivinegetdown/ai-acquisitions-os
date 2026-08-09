import { ASSET_TYPES } from "../../asset-strategy/assetStrategyContracts";
import {
  VACANT_LAND_FACT_IDS,
  VACANT_LAND_REQUIREMENT_IDS,
  VACANT_LAND_STRATEGY_ID,
  VACANT_LAND_STRATEGY_VERSION,
} from "../../asset-strategy/vacant-land/vacantLandStrategyContracts";
import {
  READINESS_ACTION_TYPES,
  READINESS_CRITICALITIES,
  READINESS_GATE_CATEGORIES,
  READINESS_GATE_STATES,
} from "./readinessContracts";
import { approvalGate, evaluateRequiredFact, getFact, resultGate, signalGate } from "./readinessPolicyUtils";

export const VACANT_LAND_READINESS_RULESET_VERSION =
  "vacant-land-offer-readiness-ruleset-v1";

const base = {
  strategyId: VACANT_LAND_STRATEGY_ID,
  strategyVersion: VACANT_LAND_STRATEGY_VERSION,
  rulesetVersion: VACANT_LAND_READINESS_RULESET_VERSION,
  assetType: ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
  criticality: READINESS_CRITICALITIES.BLOCKING,
};

function gate(gateId, label, category, factId, requirementId, relatedSection, actionType, extra = {}) {
  return {
    ...base,
    gateId,
    label,
    description: `${label} must be represented under Vacant Land Acquisition Strategy v1 before offer preparation.`,
    category,
    requiredFactIds: factId ? [factId] : [],
    requiredMissingInformationIds: requirementId ? [requirementId] : [],
    relatedSection,
    safeNextActionType: actionType,
    operatorExplanation: `Review ${label.toLowerCase()} using existing stored facts and Evidence.`,
    ...extra,
  };
}

const GATES = Object.freeze([
  gate("land-classification", "Vacant land asset classification", READINESS_GATE_CATEGORIES.ASSET_IDENTITY, VACANT_LAND_FACT_IDS.ASSET_CLASSIFICATION, "asset-classification", "decision", READINESS_ACTION_TYPES.CLASSIFY_ASSET),
  gate("land-parcel-identity", "Parcel identity", READINESS_GATE_CATEGORIES.ASSET_IDENTITY, VACANT_LAND_FACT_IDS.PARCEL_IDENTITY, VACANT_LAND_REQUIREMENT_IDS.PARCEL_IDENTITY, "property", READINESS_ACTION_TYPES.REVIEW_PARCEL),
  gate("land-asking-price", "Asking price", READINESS_GATE_CATEGORIES.SELLER_CONTEXT, VACANT_LAND_FACT_IDS.ASKING_PRICE, VACANT_LAND_REQUIREMENT_IDS.ASKING_PRICE, "seller", READINESS_ACTION_TYPES.COLLECT_INFORMATION),
  gate("land-seller-motivation", "Seller motivation", READINESS_GATE_CATEGORIES.SELLER_CONTEXT, VACANT_LAND_FACT_IDS.SELLER_MOTIVATION, VACANT_LAND_REQUIREMENT_IDS.SELLER_MOTIVATION, "seller", READINESS_ACTION_TYPES.COLLECT_INFORMATION),
  gate("land-seller-timeline", "Seller timeline", READINESS_GATE_CATEGORIES.SELLER_CONTEXT, VACANT_LAND_FACT_IDS.SELLER_TIMELINE, VACANT_LAND_REQUIREMENT_IDS.SELLER_TIMELINE, "seller", READINESS_ACTION_TYPES.COLLECT_INFORMATION),
  gate("land-legal-access", "Legal access", READINESS_GATE_CATEGORIES.FEASIBILITY, VACANT_LAND_FACT_IDS.LEGAL_ACCESS, VACANT_LAND_REQUIREMENT_IDS.LEGAL_ACCESS, "property", READINESS_ACTION_TYPES.REVIEW_DOCUMENTS),
  gate("land-zoning", "Zoning", READINESS_GATE_CATEGORIES.FEASIBILITY, VACANT_LAND_FACT_IDS.ZONING, VACANT_LAND_REQUIREMENT_IDS.ZONING, "property", READINESS_ACTION_TYPES.REVIEW_PARCEL),
  gate("land-permitted-use", "Permitted use", READINESS_GATE_CATEGORIES.FEASIBILITY, VACANT_LAND_FACT_IDS.PERMITTED_USE, VACANT_LAND_REQUIREMENT_IDS.PERMITTED_USE, "property", READINESS_ACTION_TYPES.REVIEW_PARCEL),
  gate("land-flood-status", "Flood status", READINESS_GATE_CATEGORIES.FEASIBILITY, VACANT_LAND_FACT_IDS.FLOOD_STATUS, VACANT_LAND_REQUIREMENT_IDS.FLOOD_STATUS, "property", READINESS_ACTION_TYPES.REVIEW_PARCEL),
  gate("land-wetlands-status", "Wetlands status", READINESS_GATE_CATEGORIES.FEASIBILITY, VACANT_LAND_FACT_IDS.WETLANDS_STATUS, VACANT_LAND_REQUIREMENT_IDS.WETLANDS_STATUS, "property", READINESS_ACTION_TYPES.REVIEW_PARCEL),
  gate("land-tax-lien-status", "Taxes and liens", READINESS_GATE_CATEGORIES.TITLE_LEGAL, VACANT_LAND_FACT_IDS.TAXES_AND_LIENS, VACANT_LAND_REQUIREMENT_IDS.TAXES_AND_LIENS, "documents", READINESS_ACTION_TYPES.REVIEW_TITLE_LEGAL),
  gate("land-market-evidence", "Land-value Evidence", READINESS_GATE_CATEGORIES.MARKET_EVIDENCE, VACANT_LAND_FACT_IDS.COMPARABLE_LAND_VALUE, VACANT_LAND_REQUIREMENT_IDS.VALUE_SUPPORT, "numbers", READINESS_ACTION_TYPES.REVIEW_MARKET_EVIDENCE),
  gate("land-valuation", "Land valuation context", READINESS_GATE_CATEGORIES.STRATEGY_ANALYSIS, null, null, "numbers", READINESS_ACTION_TYPES.REVIEW_NUMBERS, { requiredStrategyResultPaths: ["valuation.evaluationState"] }),
  gate("land-critical-signals", "Parcel feasibility review", READINESS_GATE_CATEGORIES.FEASIBILITY, null, null, "property", READINESS_ACTION_TYPES.REVIEW_RISK_FEASIBILITY, { approvalTrigger: "significant-land-feasibility-condition" }),
  gate("land-advisory-facts", "Advisory parcel facts", READINESS_GATE_CATEGORIES.EXECUTION_CONTEXT, null, null, "property", READINESS_ACTION_TYPES.REVIEW_PARCEL, { criticality: READINESS_CRITICALITIES.ADVISORY }),
  gate("land-approval", "Approval review", READINESS_GATE_CATEGORIES.APPROVAL, null, null, "decision", READINESS_ACTION_TYPES.REQUEST_APPROVAL),
]);

function manualResult(definition, fact, reason, triggerReason) {
  return {
    evaluationState: READINESS_GATE_STATES.MANUAL_REVIEW,
    reason,
    factIds: [fact.factId],
    evidenceIds: fact.evidenceReferenceIds || [],
    approvalRequirement: { required: true, reason, triggerReasons: [triggerReason] },
    safeNextAction: {
      actionId: `${definition.gateId}:manual-review`,
      actionType: READINESS_ACTION_TYPES.MANUAL_REVIEW,
      label: `Review ${definition.label}`,
      explanation: reason,
      targetSection: definition.relatedSection,
    },
  };
}

function evaluateStatusGate(definition, inputs) {
  const factId = definition.requiredFactIds[0];
  const baseResult = evaluateRequiredFact(definition, inputs, factId, definition.requiredMissingInformationIds);
  if (baseResult.evaluationState !== READINESS_GATE_STATES.PASSED) return baseResult;
  const fact = getFact(inputs.strategyResult, factId);
  const value = fact?.value;
  if (definition.gateId === "land-legal-access") {
    if (value === "none") return { ...baseResult, evaluationState: READINESS_GATE_STATES.FAILED, passed: false, reason: "The stored record explicitly indicates no legal access. This blocks offer preparation pending approved title and access review." };
    if (value === "easement-review") return manualResult(definition, fact, "Easement access requires human title and access review.", "significant-land-feasibility-condition");
    if (value === "disputed") return manualResult(definition, fact, "Legal access is explicitly uncertain or disputed and requires human verification.", "significant-land-feasibility-condition");
  }
  if (["land-flood-status", "land-wetlands-status"].includes(definition.gateId) && value === "constraint-present") {
    return manualResult(definition, fact, `${definition.label} includes an explicit stored constraint requiring parcel-specific human review. This is not a buildability conclusion.`, "significant-land-feasibility-condition");
  }
  if (definition.gateId === "land-tax-lien-status" && value === "issue-present") {
    return manualResult(definition, fact, "A stored tax or lien condition requires approved title and legal review. No legal conclusion is inferred.", "material-strategy-warning");
  }
  return baseResult;
}

function evaluateGate(definition, inputs) {
  if (definition.gateId === "land-valuation") {
    const valuation = inputs.strategyResult?.valuation;
    for (const [factId, requirementId] of [
      [VACANT_LAND_FACT_IDS.ASKING_PRICE, VACANT_LAND_REQUIREMENT_IDS.ASKING_PRICE],
      [VACANT_LAND_FACT_IDS.COMPARABLE_LAND_VALUE, VACANT_LAND_REQUIREMENT_IDS.VALUE_SUPPORT],
    ]) {
      const factResult = evaluateRequiredFact(definition, inputs, factId, [requirementId]);
      if (factResult.evaluationState !== READINESS_GATE_STATES.PASSED) return factResult;
    }
    return resultGate(definition, valuation?.evaluationState === "evaluated", valuation?.evaluationState === "evaluated"
      ? "Land valuation context is evaluated. Negative economics do not become missing information or a readiness score."
      : "Land valuation context is unavailable because required land-value facts or Evidence are incomplete.", valuation?.inputEvidenceIds || []);
  }
  if (definition.gateId === "land-critical-signals") {
    const explicitSignals = (inputs.strategyResult?.feasibilitySignals || []).filter((signal) => {
      const id = signal.signalId || "";
      return !/unknown|market-support-missing|conflict-|stale-|unverified-|compatibility-evidence/.test(id) && ["blocking", "significant"].includes(signal.severity);
    });
    return signalGate(definition, explicitSignals);
  }
  if (definition.gateId === "land-advisory-facts") {
    return signalGate(definition, (inputs.strategyResult?.feasibilitySignals || []).filter((signal) => signal.severity === "attention"));
  }
  if (definition.gateId === "land-approval") return approvalGate(definition, inputs.approvalContext);
  if (definition.gateId === "land-market-evidence") {
    const result = evaluateRequiredFact(definition, inputs, VACANT_LAND_FACT_IDS.COMPARABLE_LAND_VALUE, [VACANT_LAND_REQUIREMENT_IDS.VALUE_SUPPORT]);
    if (result.evaluationState === READINESS_GATE_STATES.PASSED && !inputs.strategyResult?.valuation?.inputEvidenceIds?.length) return { ...result, evaluationState: READINESS_GATE_STATES.PENDING, passed: null, reason: "Land-value Evidence is required before offer preparation." };
    return result;
  }
  return evaluateStatusGate(definition, inputs);
}

// Distinct responsibility: encode only Vacant Land Strategy v1 readiness
// policy without importing residential assumptions or raw deal fields.
export const VACANT_LAND_READINESS_POLICY = Object.freeze({
  ...base,
  label: "Vacant Land Acquisition Strategy v1",
  gates: GATES,
  evaluateGate,
});
