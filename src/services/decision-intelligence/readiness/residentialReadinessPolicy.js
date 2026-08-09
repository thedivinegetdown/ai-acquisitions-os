import { ASSET_TYPES } from "../../asset-strategy/assetStrategyContracts";
import {
  RESIDENTIAL_FACT_IDS,
  RESIDENTIAL_REQUIREMENT_IDS,
  RESIDENTIAL_STRATEGY_ID,
  RESIDENTIAL_STRATEGY_VERSION,
} from "../../asset-strategy/residential/residentialStrategyContracts";
import {
  READINESS_ACTION_TYPES,
  READINESS_CRITICALITIES,
  READINESS_GATE_CATEGORIES,
  READINESS_GATE_STATES,
} from "./readinessContracts";
import { approvalGate, evaluateRequiredFact, resultGate, signalGate } from "./readinessPolicyUtils";

export const RESIDENTIAL_READINESS_RULESET_VERSION =
  "residential-offer-readiness-ruleset-v1";

const base = {
  strategyId: RESIDENTIAL_STRATEGY_ID,
  strategyVersion: RESIDENTIAL_STRATEGY_VERSION,
  rulesetVersion: RESIDENTIAL_READINESS_RULESET_VERSION,
  assetType: ASSET_TYPES.RESIDENTIAL_HOME,
  criticality: READINESS_CRITICALITIES.BLOCKING,
};

function gate(gateId, label, category, factIds, requirementIds, relatedSection, actionType, extra = {}) {
  return {
    ...base,
    gateId,
    label,
    description: `${label} must be represented under Residential Acquisition Strategy v1 before offer preparation.`,
    category,
    requiredFactIds: factIds,
    requiredMissingInformationIds: requirementIds,
    relatedSection,
    safeNextActionType: actionType,
    operatorExplanation: `Review ${label.toLowerCase()} in the existing Decision Room context.`,
    ...extra,
  };
}

const GATES = Object.freeze([
  gate("residential-classification", "Residential asset classification", READINESS_GATE_CATEGORIES.ASSET_IDENTITY, [RESIDENTIAL_FACT_IDS.ASSET_CLASSIFICATION], ["asset-classification"], "decision", READINESS_ACTION_TYPES.CLASSIFY_ASSET),
  gate("residential-property-identity", "Property identity", READINESS_GATE_CATEGORIES.ASSET_IDENTITY, [RESIDENTIAL_FACT_IDS.PROPERTY_IDENTITY], ["property-or-parcel-identity"], "property", READINESS_ACTION_TYPES.REVIEW_PROPERTY),
  gate("residential-asking-price", "Asking price", READINESS_GATE_CATEGORIES.SELLER_CONTEXT, [RESIDENTIAL_FACT_IDS.ASKING_PRICE], [RESIDENTIAL_REQUIREMENT_IDS.ASKING_PRICE], "seller", READINESS_ACTION_TYPES.COLLECT_INFORMATION),
  gate("residential-seller-motivation", "Seller motivation", READINESS_GATE_CATEGORIES.SELLER_CONTEXT, [RESIDENTIAL_FACT_IDS.SELLER_MOTIVATION], [RESIDENTIAL_REQUIREMENT_IDS.SELLER_MOTIVATION], "seller", READINESS_ACTION_TYPES.COLLECT_INFORMATION),
  gate("residential-seller-timeline", "Seller timeline", READINESS_GATE_CATEGORIES.SELLER_CONTEXT, [RESIDENTIAL_FACT_IDS.SELLER_TIMELINE], [RESIDENTIAL_REQUIREMENT_IDS.SELLER_TIMELINE], "seller", READINESS_ACTION_TYPES.COLLECT_INFORMATION),
  gate("residential-underwriting", "Residential underwriting", READINESS_GATE_CATEGORIES.STRATEGY_ANALYSIS, [RESIDENTIAL_FACT_IDS.ASKING_PRICE, RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE, RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE], [RESIDENTIAL_REQUIREMENT_IDS.ASKING_PRICE, RESIDENTIAL_REQUIREMENT_IDS.AFTER_REPAIR_VALUE, RESIDENTIAL_REQUIREMENT_IDS.REPAIR_ESTIMATE], "numbers", READINESS_ACTION_TYPES.REVIEW_NUMBERS, { requiredStrategyResultPaths: ["underwriting.evaluationState"] }),
  gate("residential-market-evidence", "Market-value Evidence", READINESS_GATE_CATEGORIES.MARKET_EVIDENCE, [RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE, RESIDENTIAL_FACT_IDS.COMPARABLE_SALE_EVIDENCE], [RESIDENTIAL_REQUIREMENT_IDS.MARKET_VALUE_SUPPORT], "property", READINESS_ACTION_TYPES.REVIEW_MARKET_EVIDENCE),
  gate("residential-property-condition", "Property condition", READINESS_GATE_CATEGORIES.FEASIBILITY, [RESIDENTIAL_FACT_IDS.PROPERTY_CONDITION], [RESIDENTIAL_REQUIREMENT_IDS.PROPERTY_CONDITION], "property", READINESS_ACTION_TYPES.REVIEW_PROPERTY),
  gate("residential-repair-estimate", "Repair estimate", READINESS_GATE_CATEGORIES.FEASIBILITY, [RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE], [RESIDENTIAL_REQUIREMENT_IDS.REPAIR_ESTIMATE], "numbers", READINESS_ACTION_TYPES.REVIEW_NUMBERS),
  gate("residential-occupancy", "Occupancy", READINESS_GATE_CATEGORIES.EXECUTION_CONTEXT, [RESIDENTIAL_FACT_IDS.OCCUPANCY_STATUS], [RESIDENTIAL_REQUIREMENT_IDS.OCCUPANCY_STATUS], "property", READINESS_ACTION_TYPES.REVIEW_PROPERTY),
  gate("residential-mortgage-status", "Mortgage status", READINESS_GATE_CATEGORIES.EXECUTION_CONTEXT, [RESIDENTIAL_FACT_IDS.MORTGAGE_STATUS], [RESIDENTIAL_REQUIREMENT_IDS.MORTGAGE_STATUS], "seller", READINESS_ACTION_TYPES.COLLECT_INFORMATION),
  gate("residential-critical-signals", "Residential risk review", READINESS_GATE_CATEGORIES.STRATEGY_ANALYSIS, [], [], "numbers", READINESS_ACTION_TYPES.REVIEW_RISK_FEASIBILITY, { approvalTrigger: "significant-residential-risk-condition" }),
  gate("residential-advisory-signals", "Residential advisory review", READINESS_GATE_CATEGORIES.EXECUTION_CONTEXT, [], [], "decision", READINESS_ACTION_TYPES.REVIEW_RISK_FEASIBILITY, { criticality: READINESS_CRITICALITIES.ADVISORY }),
  gate("residential-approval", "Approval review", READINESS_GATE_CATEGORIES.APPROVAL, [], [], "decision", READINESS_ACTION_TYPES.REQUEST_APPROVAL),
]);

function evaluateGate(definition, inputs) {
  if (definition.gateId === "residential-underwriting") {
    const underwriting = inputs.strategyResult?.underwriting;
    for (const [factId, requirementId] of [
      [RESIDENTIAL_FACT_IDS.ASKING_PRICE, RESIDENTIAL_REQUIREMENT_IDS.ASKING_PRICE],
      [RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE, RESIDENTIAL_REQUIREMENT_IDS.AFTER_REPAIR_VALUE],
      [RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE, RESIDENTIAL_REQUIREMENT_IDS.REPAIR_ESTIMATE],
    ]) {
      const factResult = evaluateRequiredFact(definition, inputs, factId, [requirementId]);
      if (factResult.evaluationState !== READINESS_GATE_STATES.PASSED) return factResult;
    }
    return resultGate(
      definition,
      underwriting?.evaluationState === "evaluated",
      underwriting?.evaluationState === "evaluated"
        ? "Residential underwriting is evaluated. Negative economics remain visible but do not become missing information."
        : "Residential underwriting is unavailable because required strategy inputs are incomplete.",
      underwriting?.inputEvidenceIds || []
    );
  }
  if (definition.gateId === "residential-critical-signals") {
    const explicitSignals = (inputs.strategyResult?.riskSignals || []).filter(
      (signal) =>
        !String(signal.signalId || "").startsWith("explicit-conflict:") &&
        ["blocking", "significant"].includes(signal.severity)
    );
    return signalGate(definition, explicitSignals);
  }
  if (definition.gateId === "residential-advisory-signals") {
    return signalGate(definition, (inputs.strategyResult?.riskSignals || []).filter((signal) => signal.severity === "attention"));
  }
  if (definition.gateId === "residential-approval") return approvalGate(definition, inputs.approvalContext);
  if (definition.gateId === "residential-market-evidence") {
    const result = evaluateRequiredFact(definition, inputs, RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE, [RESIDENTIAL_REQUIREMENT_IDS.MARKET_VALUE_SUPPORT]);
    if (result.evaluationState === READINESS_GATE_STATES.PASSED && !result.evidenceIds.length) {
      return { ...result, evaluationState: READINESS_GATE_STATES.PENDING, passed: null, reason: "Market-value Evidence is required before offer preparation." };
    }
    return result;
  }
  return evaluateRequiredFact(definition, inputs, definition.requiredFactIds[0], definition.requiredMissingInformationIds);
}

// Distinct responsibility: encode only Residential Strategy v1 offer-readiness
// gate policy; calculation and aggregation remain in the generic engine.
export const RESIDENTIAL_READINESS_POLICY = Object.freeze({
  ...base,
  label: "Residential Acquisition Strategy v1",
  gates: GATES,
  evaluateGate,
});
