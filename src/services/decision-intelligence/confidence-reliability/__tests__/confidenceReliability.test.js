import { describe, expect, it } from "vitest";
import { buildEvidenceRegistry } from "../../../research-intelligence/evidence";
import {
  CONFIDENCE_LIMITING_FACTORS,
  DATA_RELIABILITY_CONTRACT_VERSION,
  DATA_RELIABILITY_GRADES,
  DATA_RELIABILITY_RULESET_VERSION,
  RECOMMENDATION_BASIS_TYPES,
  RECOMMENDATION_CONFIDENCE_CONTRACT_VERSION,
  RECOMMENDATION_CONFIDENCE_LEVELS,
  RECOMMENDATION_CONFIDENCE_RULESET_VERSION,
  RELIABILITY_ASSESSMENT_BASIS,
  evaluateDataReliability,
  evaluateRecommendationConfidence,
  normalizeDataReliabilityResult,
  normalizeRecommendationBasis,
  normalizeRecommendationConfidenceResult,
  toDataReliabilityMetric,
  toRecommendationConfidenceMetric,
} from "../index";

const NOW = "2026-08-09T16:00:00.000Z";

function evidence(field, overrides = {}) {
  return {
    evidenceId: `evidence:${field}`,
    sourceType: "manual-research",
    sourceSystem: "Operator research",
    sourceRecordId: `record:${field}`,
    sourceField: field,
    relatedCanonicalField: field,
    valueSummary: "Known value",
    normalizedValue: "known-value",
    relationship: "supports",
    extractionMethod: "direct-field",
    verificationState: "verified",
    freshnessState: "current",
    sourceTimestamp: "2026-08-01T12:00:00.000Z",
    organizationId: "org-1",
    tenantId: "tenant-1",
    ...overrides,
  };
}

function registry(records) {
  return buildEvidenceRegistry({
    context: { organizationId: "org-1", tenantId: "tenant-1" },
    evidenceReferences: records,
    evaluatedTimestamp: NOW,
  });
}

function item(field, overrides = {}) {
  return {
    itemId: `missing:${field}`,
    requirementId: `requirement:${field}`,
    canonicalField: field,
    label: field,
    blocking: true,
    criticality: "blocking",
    state: "present",
    ...overrides,
  };
}

function reliability({ conflicts = [], items = [item("deal.askingPrice")], records = [evidence("deal.askingPrice")], basis = {} } = {}) {
  return evaluateDataReliability({
    assetStrategyContext: {
      dealId: "deal-1",
      assetType: "residential-home",
      selectedStrategyId: "residential-acquisition",
      strategyVersion: "residential-strategy-v1",
    },
    conflictReadModel: { activeConflicts: conflicts },
    evidenceRegistry: registry(records),
    missingInformationReadModel: { allItems: items },
    recommendationBasis: normalizeRecommendationBasis(basis),
    evaluatedTimestamp: NOW,
  });
}

function confidence({ basis, reliabilityResult, readinessState = "needs-information", approvalContext = {} } = {}) {
  return evaluateRecommendationConfidence({
    recommendation: { recommendationId: "recommendation:deal:deal-1" },
    recommendationBasis: basis,
    dataReliabilityResult: reliabilityResult || reliability(),
    readinessResult: { readinessState },
    approvalContext,
    conflictReadModel: { blockingConflicts: basis?.conflictIds?.length ? [{ conflictId: basis.conflictIds[0] }] : [] },
    missingInformationReadModel: { blockingItems: basis?.missingInformationIds?.length ? [{ itemId: basis.missingInformationIds[0] }] : [] },
    evidenceRegistry: registry([evidence("deal.askingPrice")]),
    evaluatedTimestamp: NOW,
  });
}

describe("DI-03 contracts", () => {
  it("publishes separate categorical contracts and rulesets", () => {
    expect(DATA_RELIABILITY_CONTRACT_VERSION).toBe("data-reliability-contract-v1");
    expect(DATA_RELIABILITY_RULESET_VERSION).toBe("data-reliability-ruleset-v1");
    expect(RECOMMENDATION_CONFIDENCE_CONTRACT_VERSION).toBe("recommendation-confidence-contract-v1");
    expect(RECOMMENDATION_CONFIDENCE_RULESET_VERSION).toBe("recommendation-confidence-ruleset-v1");
    expect(Object.values(DATA_RELIABILITY_GRADES)).toEqual(["unavailable", "limited", "moderate", "strong"]);
    expect(Object.values(RELIABILITY_ASSESSMENT_BASIS)).toEqual(["insufficient", "partial", "sufficient"]);
    expect(Object.values(RECOMMENDATION_CONFIDENCE_LEVELS)).toEqual(["unavailable", "low", "moderate", "high"]);
  });

  it("normalizes malformed values, bounds arrays, and never fabricates timestamps", () => {
    const reliabilityResult = normalizeDataReliabilityResult({
      grade: "certain",
      evidenceIds: Array.from({ length: 150 }, (_, index) => `e-${index}`),
    });
    const confidenceResult = normalizeRecommendationConfidenceResult({ level: "certain" });
    expect(reliabilityResult.grade).toBe("unavailable");
    expect(reliabilityResult.evidenceIds).toHaveLength(100);
    expect(reliabilityResult.evaluatedTimestamp).toBeNull();
    expect(confidenceResult.level).toBe("unavailable");
    expect(confidenceResult.evaluatedTimestamp).toBeNull();
  });
});

describe("Data Reliability", () => {
  it("distinguishes unavailable, moderate, and strong Evidence without numeric scoring", () => {
    const unavailable = reliability({ records: [] });
    const moderate = reliability({ records: [evidence("deal.askingPrice", { verificationState: "unknown", freshnessState: "unknown", sourceTimestamp: null })] });
    const strong = reliability();
    expect(unavailable).toMatchObject({ grade: "unavailable", assessmentBasis: "insufficient" });
    expect(moderate).toMatchObject({ grade: "moderate", assessmentBasis: "sufficient" });
    expect(strong).toMatchObject({ grade: "strong", assessmentBasis: "sufficient" });
    expect(strong).not.toHaveProperty("score");
    expect(strong).not.toHaveProperty("percentage");
  });

  it.each([
    ["compatibility Evidence", { compatibility: true }],
    ["explicit stale Evidence", { freshnessState: "stale" }],
    ["explicit unverified Evidence", { verificationState: "unverified" }],
    ["verification-required Evidence", { verificationState: "verification-required" }],
    ["partially identified Evidence", { sourceSystem: null }],
    ["contextual-only Evidence", { relationship: "contextual" }],
    ["incomplete derived lineage", { extractionMethod: "deterministic-derived", derivedFromEvidenceIds: [] }],
  ])("marks %s limited", (_label, overrides) => {
    expect(reliability({ records: [evidence("deal.askingPrice", overrides)] }).grade).toBe("limited");
  });

  it("marks an active critical conflict limited without choosing a value", () => {
    const result = reliability({
      conflicts: [{ conflictId: "conflict-arv", canonicalField: "property.afterRepairValue", blocking: true, criticality: "blocking" }],
      items: [item("property.afterRepairValue")],
      records: [evidence("property.afterRepairValue")],
    });
    expect(result.grade).toBe("limited");
    expect(result.criticalFactResults[0].activeConflictIds).toEqual(["conflict-arv"]);
  });

  it("keeps missing information separate from the reliability of represented facts", () => {
    const result = reliability({
      items: [item("deal.askingPrice"), item("property.condition", { state: "missing" })],
      records: [evidence("deal.askingPrice")],
    });
    expect(result.assessmentBasis).toBe("partial");
    expect(result.grade).toBe("moderate");
    expect(result.criticalFactResults.find((fact) => fact.canonicalField === "deal.askingPrice").state).toBe("strong");
    expect(result.criticalFactResults.find((fact) => fact.canonicalField === "property.condition").state).toBe("unavailable");
  });

  it("does not let an advisory limitation lower strong critical Evidence unless recommendation-critical", () => {
    const items = [item("deal.askingPrice"), item("property.rentEstimate", { blocking: false, criticality: "advisory" })];
    const records = [evidence("deal.askingPrice"), evidence("property.rentEstimate", { compatibility: true })];
    expect(reliability({ items, records }).grade).toBe("strong");
    expect(reliability({ items, records, basis: { relatedCanonicalFields: ["property.rentEstimate"] } }).grade).toBe("limited");
  });

  it("does not infer verification, freshness, or authority from source kind or timestamp age", () => {
    const seller = reliability({ records: [evidence("deal.askingPrice", { sourceType: "seller-statement" })] });
    const provider = reliability({ records: [evidence("deal.askingPrice", { sourceType: "provider-record", verificationState: "unknown", freshnessState: "unknown" })] });
    const oldTimestamp = reliability({ records: [evidence("deal.askingPrice", { sourceTimestamp: "2000-01-01T00:00:00Z", freshnessState: "unknown" })] });
    const futureTimestamp = reliability({ records: [evidence("deal.askingPrice", { sourceTimestamp: "2099-01-01T00:00:00Z", freshnessState: "unknown" })] });
    const document = reliability({ records: [evidence("deal.askingPrice", { sourceType: "document-record", verificationState: "unknown" })] });
    expect(seller.grade).toBe("strong");
    expect(provider.grade).toBe("moderate");
    expect(oldTimestamp.grade).toBe("moderate");
    expect(futureTimestamp.grade).toBe("moderate");
    expect(document.grade).toBe("moderate");
  });
});

describe("Recommendation Confidence", () => {
  it("can be high for a traceable conflict review while Data Reliability is limited", () => {
    const limited = reliability({ records: [evidence("deal.askingPrice", { compatibility: true })] });
    const result = confidence({
      reliabilityResult: limited,
      basis: { basisType: "conflict-review", triggerId: "conflict-1", conflictIds: ["conflict-1"], directTrigger: true },
    });
    expect(result.level).toBe("high");
    expect(result.limitingFactors).toContain(CONFIDENCE_LIMITING_FACTORS.LIMITED_DATA_RELIABILITY);
  });

  it.each([
    ["seller-reply", { triggerId: "message-1", evidenceIds: ["evidence:deal.askingPrice"], directTrigger: true }, "high"],
    ["due-action", { triggerId: "task-1", directTrigger: true }, "high"],
    ["missing-information", { triggerId: "missing-1", missingInformationIds: ["missing-1"], directTrigger: true }, "high"],
    ["compatibility-fallback", { triggerId: "fallback-1" }, "low"],
  ])("evaluates %s as %s", (basisType, values, expected) => {
    expect(confidence({ basis: { basisType, ...values } }).level).toBe(expected);
  });

  it("caps strategy and offer-preparation confidence by Data Reliability", () => {
    const moderate = reliability({ records: [evidence("deal.askingPrice", { verificationState: "unknown" })] });
    const limited = reliability({ records: [evidence("deal.askingPrice", { compatibility: true })] });
    expect(confidence({ basis: { basisType: "residential-strategy-guidance", triggerId: "guidance", directTrigger: true }, reliabilityResult: reliability() }).level).toBe("high");
    expect(confidence({ basis: { basisType: "vacant-land-strategy-guidance", triggerId: "guidance", directTrigger: true }, reliabilityResult: moderate }).level).toBe("moderate");
    expect(confidence({ basis: { basisType: "ready-for-offer-preparation", triggerId: "readiness", readinessGateIds: ["gate-1"], directTrigger: true }, reliabilityResult: limited, readinessState: "ready-for-offer-preparation" }).level).toBe("low");
  });

  it("distinguishes real approval records from descriptive approval triggers", () => {
    const real = confidence({ basis: { basisType: "pending-approval", triggerId: "approval-1", approvalReferenceIds: ["approval-1"], directTrigger: true }, approvalContext: { status: "pending" } });
    const descriptive = confidence({ basis: { basisType: "pending-approval", triggerId: "approval-trigger", directTrigger: true } });
    expect(real.level).toBe("high");
    expect(descriptive.level).toBe("moderate");
  });

  it("does not consume Pursuit Score or convert readiness into confidence", () => {
    const basis = { basisType: RECOMMENDATION_BASIS_TYPES.RESIDENTIAL_STRATEGY_GUIDANCE, triggerId: "guidance", directTrigger: true };
    const lowScore = confidence({ basis, reliabilityResult: reliability(), pursuitScore: 20 });
    const highScore = confidence({ basis, reliabilityResult: reliability(), pursuitScore: 95 });
    expect(lowScore.level).toBe("high");
    expect(highScore.level).toBe("high");
    expect(lowScore).toEqual(highScore);
  });

  it("adapts categorical values to metrics with null scales", () => {
    const reliabilityMetric = toDataReliabilityMetric(reliability());
    const confidenceMetric = toRecommendationConfidenceMetric(confidence({ basis: { basisType: "seller-reply", triggerId: "message-1", directTrigger: true } }));
    expect(reliabilityMetric).toMatchObject({ value: "strong", unit: "reliability-grade", scale: null });
    expect(confidenceMetric).toMatchObject({ value: "high", unit: "confidence-level", scale: null });
    expect(JSON.stringify([reliabilityMetric, confidenceMetric])).not.toMatch(/percentage|probability/i);
  });

  it("keeps unavailable assessments null in canonical metrics", () => {
    const reliabilityMetric = toDataReliabilityMetric(reliability({ records: [] }));
    const confidenceMetric = toRecommendationConfidenceMetric(confidence({ basis: { basisType: "unavailable" } }));
    expect(reliabilityMetric).toMatchObject({ evaluationState: "unavailable", value: null, displayValue: null });
    expect(confidenceMetric).toMatchObject({ evaluationState: "unavailable", value: null, displayValue: null });
  });
});
