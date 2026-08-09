import { describe, expect, it } from "vitest";
import { ASSET_CLASSIFICATION_STATES, ASSET_TYPES } from "../../../asset-strategy/assetStrategyContracts";
import { RESIDENTIAL_FACT_IDS } from "../../../asset-strategy/residential/residentialStrategyContracts";
import { VACANT_LAND_FACT_IDS } from "../../../asset-strategy/vacant-land/vacantLandStrategyContracts";
import {
  READINESS_ACTION_TYPES,
  READINESS_CONTRACT_VERSION,
  READINESS_CRITICALITIES,
  READINESS_GATE_CATEGORIES,
  READINESS_GATE_STATES,
  READINESS_STATES,
  RESIDENTIAL_READINESS_POLICY,
  VACANT_LAND_READINESS_POLICY,
  evaluateOfferReadiness,
  normalizeReadinessGateDefinition,
  normalizeReadinessResult,
  toOfferReadinessMetric,
  validateReadinessPolicy,
} from "..";

const NOW = "2026-08-09T12:00:00.000Z";

function context(assetType, strategyId, strategyVersion) {
  return {
    dealId: "deal-1",
    organizationId: "org-1",
    tenantId: "tenant-1",
    assetType,
    classificationState: ASSET_CLASSIFICATION_STATES.CLASSIFIED,
    strategySupportState: "implemented",
    selectedStrategyId: strategyId,
    strategyVersion,
  };
}

function fact(factId, value, state = "present", extra = {}) {
  return {
    factId,
    canonicalField: factId,
    value,
    state,
    evidenceReferenceIds: [`evidence:${factId}`],
    conflictIds: [],
    verificationState: "unknown",
    freshnessState: "unknown",
    sourceTimestamp: null,
    ...extra,
  };
}

function resultWithFacts(facts, extra = {}) {
  return {
    eligible: true,
    factReadModel: {
      factsById: Object.fromEntries(facts.map((item) => [item.factId, item])),
    },
    ...extra,
  };
}

function residentialResult(extra = {}) {
  const facts = [
    fact(RESIDENTIAL_FACT_IDS.ASSET_CLASSIFICATION, ASSET_TYPES.RESIDENTIAL_HOME),
    fact(RESIDENTIAL_FACT_IDS.PROPERTY_IDENTITY, "123 Main"),
    fact(RESIDENTIAL_FACT_IDS.ASKING_PRICE, 100000),
    fact(RESIDENTIAL_FACT_IDS.SELLER_MOTIVATION, 8),
    fact(RESIDENTIAL_FACT_IDS.SELLER_TIMELINE, 30),
    fact(RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE, 180000),
    fact(RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE, 25000),
    fact(RESIDENTIAL_FACT_IDS.PROPERTY_CONDITION, "needs work"),
    fact(RESIDENTIAL_FACT_IDS.OCCUPANCY_STATUS, "vacant"),
    fact(RESIDENTIAL_FACT_IDS.MORTGAGE_STATUS, "no mortgage"),
  ];
  return resultWithFacts(facts, {
    underwriting: { evaluationState: "evaluated", inputEvidenceIds: ["evidence:underwriting"], ceilingSpread: -1000 },
    pursuitScoreResult: { score: 20 },
    riskSignals: [],
    ...extra,
  });
}

function landResult(extra = {}) {
  const facts = [
    fact(VACANT_LAND_FACT_IDS.ASSET_CLASSIFICATION, ASSET_TYPES.VACANT_RESIDENTIAL_LAND),
    fact(VACANT_LAND_FACT_IDS.PARCEL_IDENTITY, "APN-1"),
    fact(VACANT_LAND_FACT_IDS.ASKING_PRICE, 40000),
    fact(VACANT_LAND_FACT_IDS.SELLER_MOTIVATION, 7),
    fact(VACANT_LAND_FACT_IDS.SELLER_TIMELINE, 60),
    fact(VACANT_LAND_FACT_IDS.LEGAL_ACCESS, "documented"),
    fact(VACANT_LAND_FACT_IDS.ZONING, "R-1"),
    fact(VACANT_LAND_FACT_IDS.PERMITTED_USE, "single-family residential"),
    fact(VACANT_LAND_FACT_IDS.FLOOD_STATUS, "no-known-constraint"),
    fact(VACANT_LAND_FACT_IDS.WETLANDS_STATUS, "no-known-constraint"),
    fact(VACANT_LAND_FACT_IDS.TAXES_AND_LIENS, "clear-recorded"),
    fact(VACANT_LAND_FACT_IDS.COMPARABLE_LAND_VALUE, 70000),
  ];
  return resultWithFacts(facts, {
    valuation: { evaluationState: "evaluated", inputEvidenceIds: ["evidence:land-value"], grossLandSpread: -5000 },
    pursuitScoreResult: { score: 95 },
    feasibilitySignals: [],
    ...extra,
  });
}

function evaluate(policy, strategyResult, overrides = {}) {
  return evaluateOfferReadiness({
    assetStrategyContext: context(policy.assetType, policy.strategyId, policy.strategyVersion),
    evaluatedTimestamp: NOW,
    evidenceReferences: [],
    missingInformationReadModel: { openItems: [] },
    policy,
    strategyResult,
    ...overrides,
  });
}

function evaluateGateStates(gateResults) {
  const policy = {
    strategyId: RESIDENTIAL_READINESS_POLICY.strategyId,
    strategyVersion: RESIDENTIAL_READINESS_POLICY.strategyVersion,
    assetType: RESIDENTIAL_READINESS_POLICY.assetType,
    rulesetVersion: RESIDENTIAL_READINESS_POLICY.rulesetVersion,
    label: "Readiness precedence fixture",
    gates: gateResults.map((_, index) => ({
      gateId: `fixture-gate-${index}`,
      label: `Fixture gate ${index}`,
      category: READINESS_GATE_CATEGORIES.STRATEGY_ANALYSIS,
      criticality: READINESS_CRITICALITIES.BLOCKING,
      relatedSection: "decision",
      safeNextActionType: READINESS_ACTION_TYPES.COLLECT_INFORMATION,
    })),
    evaluateGate(definition) {
      return gateResults[Number(definition.gateId.replace("fixture-gate-", ""))];
    },
  };
  return evaluate(policy, residentialResult());
}

describe("readiness contracts", () => {
  it("normalizes the versioned non-numeric contract and bounded categories", () => {
    expect(READINESS_CONTRACT_VERSION).toBe("readiness-gate-contract-v1");
    expect(Object.values(READINESS_GATE_CATEGORIES)).toContain("Title and Legal Review");
    expect(normalizeReadinessGateDefinition({ gateId: "x", label: "X", category: "bad" }).category).toBe("Strategy Analysis");
    expect(normalizeReadinessResult({ readinessState: "invalid" }).readinessState).toBe(READINESS_STATES.NOT_EVALUATED);
    expect(validateReadinessPolicy(RESIDENTIAL_READINESS_POLICY).valid).toBe(true);
    expect(validateReadinessPolicy(VACANT_LAND_READINESS_POLICY).valid).toBe(true);
  });

  it("does not fabricate source timestamps", () => {
    const result = normalizeReadinessResult({ evaluatedTimestamp: NOW, gateResults: [{ gateId: "g", label: "Gate", evaluationState: "passed" }] });
    expect(result.gateResults[0].sourceTimestamps).toEqual([]);
  });
});

describe("generic readiness engine", () => {
  const passed = { evaluationState: READINESS_GATE_STATES.PASSED, passed: true };
  const missing = { evaluationState: READINESS_GATE_STATES.PENDING, reason: "A required fact is missing." };
  const conflict = {
    evaluationState: READINESS_GATE_STATES.PENDING,
    conflictIds: ["conflict-1"],
    safeNextAction: {
      actionId: "review-conflict",
      actionType: READINESS_ACTION_TYPES.VERIFY_INFORMATION,
      label: "Review conflict",
      targetSection: "decision",
    },
  };
  const stale = { evaluationState: READINESS_GATE_STATES.PENDING, staleReferenceIds: ["stale-1"] };
  const unverified = { evaluationState: READINESS_GATE_STATES.PENDING, unverifiedReferenceIds: ["unverified-1"] };
  const manual = { evaluationState: READINESS_GATE_STATES.MANUAL_REVIEW };
  const failed = { evaluationState: READINESS_GATE_STATES.FAILED, passed: false };
  const unavailable = { evaluationState: READINESS_GATE_STATES.UNAVAILABLE };

  it.each([
    ["missing only", [missing], READINESS_STATES.NEEDS_INFORMATION],
    ["conflict only", [conflict], READINESS_STATES.NEEDS_VERIFICATION],
    ["stale only", [stale], READINESS_STATES.NEEDS_VERIFICATION],
    ["unverified only", [unverified], READINESS_STATES.NEEDS_VERIFICATION],
    ["missing and conflict", [missing, conflict], READINESS_STATES.NEEDS_INFORMATION],
    ["missing and stale", [missing, stale], READINESS_STATES.NEEDS_INFORMATION],
    ["missing and unverified", [missing, unverified], READINESS_STATES.NEEDS_INFORMATION],
    ["missing and manual review", [missing, manual], READINESS_STATES.NEEDS_INFORMATION],
    ["verification and manual review", [conflict, manual], READINESS_STATES.NEEDS_VERIFICATION],
    ["failed and missing", [failed, missing], READINESS_STATES.BLOCKED],
    ["unavailable and failed", [unavailable, failed], READINESS_STATES.UNAVAILABLE],
    ["all passed", [passed, passed], READINESS_STATES.READY_FOR_OFFER_PREPARATION],
  ])("applies canonical aggregate precedence for %s", (_, gates, expectedState) => {
    expect(evaluateGateStates(gates).readinessState).toBe(expectedState);
  });

  it("keeps conflict-first next actions separate from mixed-state aggregation", () => {
    const result = evaluateGateStates([missing, conflict]);
    expect(result.readinessState).toBe(READINESS_STATES.NEEDS_INFORMATION);
    expect(result.recommendedNextAction).toMatchObject({
      actionType: READINESS_ACTION_TYPES.VERIFY_INFORMATION,
      label: "Review conflict",
    });
    expect(result).not.toHaveProperty("score");
    expect(result).not.toHaveProperty("percentage");
  });

  it("is deterministic and never uses Pursuit Score thresholds", () => {
    const first = evaluate(RESIDENTIAL_READINESS_POLICY, residentialResult());
    const second = evaluate(RESIDENTIAL_READINESS_POLICY, residentialResult());
    expect(first).toEqual(second);
    expect(first.readinessState).toBe(READINESS_STATES.READY_FOR_OFFER_PREPARATION);
    expect(first).not.toHaveProperty("score");
  });

  it("keeps a 95 score blocked by critical missing information", () => {
    const strategyResult = landResult();
    delete strategyResult.factReadModel.factsById[VACANT_LAND_FACT_IDS.LEGAL_ACCESS];
    const result = evaluate(VACANT_LAND_READINESS_POLICY, strategyResult, {
      missingInformationReadModel: { openItems: [{ itemId: "missing-access", requirementId: "land-strategy-legal-access", state: "missing", evidenceReferenceIds: [], conflictIds: [] }] },
    });
    expect(result.readinessState).toBe(READINESS_STATES.NEEDS_INFORMATION);
    expect(result.missingInformationIds).toContain("missing-access");
  });

  it("returns needs verification for explicit critical conflict and stale Evidence", () => {
    const conflictResult = residentialResult();
    conflictResult.factReadModel.factsById[RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE] = fact(RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE, 180000, "conflicting", { conflictIds: ["conflict:arv"] });
    const conflictReadiness = evaluate(RESIDENTIAL_READINESS_POLICY, conflictResult);
    expect(conflictReadiness.gateResults.find((gate) => gate.gateId === "residential-market-evidence")).toMatchObject({ evaluationState: "pending", conflictIds: ["conflict:arv"] });
    expect(conflictReadiness.readinessState).toBe(READINESS_STATES.NEEDS_VERIFICATION);
    const staleResult = residentialResult();
    staleResult.factReadModel.factsById[RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE] = fact(RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE, 25000, "stale", { freshnessState: "stale" });
    expect(evaluate(RESIDENTIAL_READINESS_POLICY, staleResult).readinessState).toBe(READINESS_STATES.NEEDS_VERIFICATION);
  });

  it("fails closed when a gate evaluator throws", () => {
    const policy = { ...RESIDENTIAL_READINESS_POLICY, evaluateGate() { throw new Error("private detail"); } };
    const result = evaluate(policy, residentialResult());
    expect(result.readinessState).toBe(READINESS_STATES.UNAVAILABLE);
    expect(result.gateResults.every((gate) => gate.evaluationState === READINESS_GATE_STATES.UNAVAILABLE)).toBe(true);
    expect(JSON.stringify(result)).not.toContain("private detail");
  });

  it("preserves real approval context as a trigger without creating approval state", () => {
    const result = evaluate(RESIDENTIAL_READINESS_POLICY, residentialResult(), {
      approvalContext: {
        required: true,
        status: "pending",
        reason: "A represented offer review is pending.",
        approvalReferenceIds: ["approval-1"],
      },
    });
    expect(result.readinessState).toBe(READINESS_STATES.MANUAL_REVIEW_REQUIRED);
    expect(result.approvalRequirement).toMatchObject({
      required: true,
      status: "pending",
      approvalReferenceIds: ["approval-1"],
    });
    expect(result.recommendedNextAction).toMatchObject({
      actionType: "request-approval",
      targetSection: "approvals",
    });
  });
});

describe("strategy readiness policies", () => {
  it("applies missing-information precedence to mixed Residential verification state", () => {
    const strategyResult = residentialResult();
    delete strategyResult.factReadModel.factsById[RESIDENTIAL_FACT_IDS.PROPERTY_CONDITION];
    strategyResult.factReadModel.factsById[RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE] = fact(
      RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
      180000,
      "conflicting",
      { conflictIds: ["conflict:arv"] }
    );
    const result = evaluate(RESIDENTIAL_READINESS_POLICY, strategyResult);
    expect(result.readinessState).toBe(READINESS_STATES.NEEDS_INFORMATION);
    expect(result.recommendedNextAction.actionType).toBe(READINESS_ACTION_TYPES.VERIFY_INFORMATION);
  });

  it("applies missing-information precedence to mixed Vacant Land verification state", () => {
    const strategyResult = landResult();
    delete strategyResult.factReadModel.factsById[VACANT_LAND_FACT_IDS.LEGAL_ACCESS];
    strategyResult.factReadModel.factsById[VACANT_LAND_FACT_IDS.ZONING] = fact(
      VACANT_LAND_FACT_IDS.ZONING,
      "R-1",
      "conflicting",
      { conflictIds: ["conflict:zoning"] }
    );
    const result = evaluate(VACANT_LAND_READINESS_POLICY, strategyResult);
    expect(result.readinessState).toBe(READINESS_STATES.NEEDS_INFORMATION);
    expect(result.recommendedNextAction.actionType).toBe(READINESS_ACTION_TYPES.VERIFY_INFORMATION);
  });

  it("allows complete residential gates despite negative spread and low score", () => {
    const result = evaluate(RESIDENTIAL_READINESS_POLICY, residentialResult());
    expect(result.readinessState).toBe(READINESS_STATES.READY_FOR_OFFER_PREPARATION);
    expect(result.explanation).not.toMatch(/buy|purchase approved/i);
  });

  it("requires residential condition, occupancy, mortgage status, and market Evidence", () => {
    for (const factId of [RESIDENTIAL_FACT_IDS.PROPERTY_CONDITION, RESIDENTIAL_FACT_IDS.OCCUPANCY_STATUS, RESIDENTIAL_FACT_IDS.MORTGAGE_STATUS, RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE]) {
      const strategyResult = residentialResult();
      delete strategyResult.factReadModel.factsById[factId];
      expect(evaluate(RESIDENTIAL_READINESS_POLICY, strategyResult).readinessState).toBe(READINESS_STATES.NEEDS_INFORMATION);
    }
  });

  it("maps residential signal severity without producing Risk Level", () => {
    const manual = evaluate(RESIDENTIAL_READINESS_POLICY, residentialResult({ riskSignals: [{ signalId: "risk-1", severity: "significant", explanation: "Human review is required." }] }));
    expect(manual.readinessState).toBe(READINESS_STATES.MANUAL_REVIEW_REQUIRED);
    expect(manual.approvalRequirement.required).toBe(true);
    expect(JSON.stringify(manual)).not.toContain("Risk Level");
    const blocked = evaluate(RESIDENTIAL_READINESS_POLICY, residentialResult({ riskSignals: [{ signalId: "risk-2", severity: "blocking", explanation: "Known blocker." }] }));
    expect(blocked.readinessState).toBe(READINESS_STATES.BLOCKED);
  });

  it("handles land access, environmental, and title conditions without buildability conclusions", () => {
    const noAccess = landResult();
    noAccess.factReadModel.factsById[VACANT_LAND_FACT_IDS.LEGAL_ACCESS].value = "none";
    expect(evaluate(VACANT_LAND_READINESS_POLICY, noAccess).readinessState).toBe(READINESS_STATES.BLOCKED);
    const easement = landResult();
    easement.factReadModel.factsById[VACANT_LAND_FACT_IDS.LEGAL_ACCESS].value = "easement-review";
    expect(evaluate(VACANT_LAND_READINESS_POLICY, easement).readinessState).toBe(READINESS_STATES.MANUAL_REVIEW_REQUIRED);
    const flood = landResult();
    flood.factReadModel.factsById[VACANT_LAND_FACT_IDS.FLOOD_STATUS].value = "constraint-present";
    const floodResult = evaluate(VACANT_LAND_READINESS_POLICY, flood);
    expect(floodResult.readinessState).toBe(READINESS_STATES.MANUAL_REVIEW_REQUIRED);
    expect(JSON.stringify(floodResult)).not.toMatch(/parcel is buildable|parcel is unbuildable/i);
  });

  it("keeps unknown advisory land facts non-blocking", () => {
    const result = evaluate(VACANT_LAND_READINESS_POLICY, landResult({ feasibilitySignals: [{ signalId: "land-signal:services-unknown", severity: "attention", explanation: "Utilities are unknown." }] }));
    expect(result.readinessState).toBe(READINESS_STATES.READY_FOR_OFFER_PREPARATION);
    expect(result.advisoryGateResults).toHaveLength(1);
  });
});

describe("readiness metric adapter", () => {
  it("adapts a string readiness state without percentage, confidence, or reliability", () => {
    const readiness = evaluate(RESIDENTIAL_READINESS_POLICY, residentialResult());
    const metric = toOfferReadinessMetric(readiness);
    expect(metric).toMatchObject({ evaluationState: "evaluated", value: "ready-for-offer-preparation", displayValue: "Ready for Offer Preparation", unit: "readiness-state", scale: null });
    expect(metric).not.toHaveProperty("confidence");
    expect(metric).not.toHaveProperty("reliability");
  });
});
