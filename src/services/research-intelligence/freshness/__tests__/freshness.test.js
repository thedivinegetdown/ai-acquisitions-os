import { describe, expect, it } from "vitest";
import { ASSET_TYPES } from "../../../asset-strategy/assetStrategyContracts";
import {
  FRESHNESS_BASES,
  FRESHNESS_CONTRACT_VERSION,
  FRESHNESS_POLICIES,
  FRESHNESS_POLICY_REGISTRY_VERSION,
  FRESHNESS_RULESET_VERSION,
  FRESHNESS_SIGNAL_TYPES,
  FRESHNESS_STATES,
  REVALIDATION_STATES,
  evaluateEvidenceFreshness,
  evaluateFreshnessAndRevalidation,
  evaluateRecommendationSupportFreshness,
  selectFreshnessPolicy,
  selectFreshnessTimestamp,
  validateFreshnessPolicy,
} from "..";

const NOW = "2026-08-10T12:00:00.000Z";

function daysAgo(days) {
  return new Date(new Date(NOW).getTime() - days * 86400000).toISOString();
}

function evidence(overrides = {}) {
  return {
    evidenceId: "evidence-1",
    relatedCanonicalField: "seller.motivation",
    factId: "seller-motivation",
    sourceKind: "seller-statement",
    sourceTimestamp: daysAgo(1),
    observedTimestamp: null,
    importedTimestamp: null,
    freshnessState: "unknown",
    relationship: "supports",
    evidenceStatus: "usable",
    provenanceDetails: {},
    ...overrides,
  };
}

function assess(field, sourceDays, overrides = {}) {
  const policy = selectFreshnessPolicy({ assetType: overrides.assetType || ASSET_TYPES.RESIDENTIAL_HOME, canonicalField: field });
  return evaluateEvidenceFreshness({
    evidence: evidence({ relatedCanonicalField: field, sourceTimestamp: sourceDays == null ? null : daysAgo(sourceDays), ...overrides }),
    evaluatedTimestamp: NOW,
    policy,
  });
}

describe("freshness contracts and policy registry", () => {
  it("publishes the approved versions and states", () => {
    expect(FRESHNESS_CONTRACT_VERSION).toBe("freshness-revalidation-contract-v1");
    expect(FRESHNESS_RULESET_VERSION).toBe("freshness-revalidation-ruleset-v1");
    expect(FRESHNESS_POLICY_REGISTRY_VERSION).toBe("freshness-policy-registry-v1");
    expect(Object.values(FRESHNESS_STATES)).toContain("revalidation-due");
    expect(Object.values(REVALIDATION_STATES)).toContain("required");
    expect(Object.values(FRESHNESS_SIGNAL_TYPES)).toContain("fact-became-stale");
  });

  it("validates every registered policy and rejects inconsistent thresholds", () => {
    expect(FRESHNESS_POLICIES.every((policy) => validateFreshnessPolicy(policy).valid)).toBe(true);
    expect(validateFreshnessPolicy({ policyId: "bad", policyVersion: "v1", currentThroughDays: 30, revalidationThroughDays: 10, expireAfterDays: 20 }).valid).toBe(false);
  });
});

describe("timestamp selection", () => {
  it("prefers a real field source timestamp", () => {
    expect(selectFreshnessTimestamp(evidence({ observedTimestamp: daysAgo(2) }))).toMatchObject({ timestampSource: "sourceTimestamp", basis: FRESHNESS_BASES.SOURCE_TIMESTAMP });
  });

  it.each(["seller-statement", "conversation", "manual-entry", "manual-research"])("allows observed fallback for %s", (sourceKind) => {
    expect(selectFreshnessTimestamp(evidence({ sourceKind, sourceTimestamp: null, observedTimestamp: daysAgo(2) }))).toMatchObject({ timestampSource: "observedTimestamp" });
  });

  it("rejects document observed time, imported time, and record-scoped update compatibility", () => {
    expect(selectFreshnessTimestamp(evidence({ sourceKind: "document", sourceTimestamp: null, observedTimestamp: daysAgo(2), importedTimestamp: daysAgo(1) })).selectedTimestamp).toBeNull();
    expect(selectFreshnessTimestamp(evidence({ sourceTimestamp: daysAgo(2), provenanceDetails: { sourceTimestampScope: "record" } }))).toMatchObject({ selectedTimestamp: null, warnings: ["record-level-timestamp-not-used-as-field-source-time"] });
  });

  it("does not fabricate a timestamp and rejects future source time", () => {
    expect(assess("seller.motivation", null).state).toBe("unknown");
    const future = assess("seller.motivation", -1);
    expect(future.state).toBe("unknown");
    expect(future.warnings).toContain("future-source-timestamp");
  });
});

describe("exact policy thresholds", () => {
  it.each([
    ["seller.motivation", ASSET_TYPES.RESIDENTIAL_HOME, 14, 30, 60],
    ["deal.askingPrice", ASSET_TYPES.RESIDENTIAL_HOME, 30, 60, 120],
    ["property.condition", ASSET_TYPES.RESIDENTIAL_HOME, 30, 60, 120],
    ["property.afterRepairValue", ASSET_TYPES.RESIDENTIAL_HOME, 90, 180, 270],
    ["property.taxesAndLiens", ASSET_TYPES.VACANT_RESIDENTIAL_LAND, 30, 60, 90],
    ["property.zoning", ASSET_TYPES.VACANT_RESIDENTIAL_LAND, 180, 365, 730],
    ["property.utilities", ASSET_TYPES.VACANT_RESIDENTIAL_LAND, 180, 365, 730],
    ["property.builderDemand", ASSET_TYPES.VACANT_RESIDENTIAL_LAND, 30, 60, 90],
  ])("applies boundaries for %s", (field, assetType, current, stale, expired) => {
    expect(assess(field, current, { assetType }).state).toBe("current");
    expect(assess(field, current + 0.001, { assetType }).state).toBe("revalidation-due");
    expect(assess(field, stale, { assetType }).state).toBe("revalidation-due");
    expect(assess(field, stale + 0.001, { assetType }).state).toBe("stale");
    expect(assess(field, expired, { assetType }).state).toBe("stale");
    expect(assess(field, expired + 0.001, { assetType }).state).toBe("expired");
  });

  it("does not age-expire stable identity", () => {
    expect(assess("property.identity", 5000).state).toBe("not-applicable");
  });
});

describe("explicit freshness precedence", () => {
  it("preserves explicit stale unless age policy is expired", () => {
    expect(assess("seller.motivation", 1, { freshnessState: "stale" }).state).toBe("stale");
    expect(assess("seller.motivation", 61, { freshnessState: "stale" }).state).toBe("expired");
    expect(assess("seller.motivation", -1, { freshnessState: "stale" }).state).toBe("stale");
  });

  it("preserves explicit current without timestamp and supersedes it with old age", () => {
    const explicitOnly = assess("seller.motivation", null, { freshnessState: "current" });
    expect(explicitOnly).toMatchObject({ state: "current", basis: "explicit-only-no-timestamp" });
    expect(explicitOnly.limitationCodes).toContain("missing-source-timestamp");
    expect(assess("seller.motivation", 31, { freshnessState: "current" }).state).toBe("stale");
    expect(assess("seller.motivation", 61, { freshnessState: "current" }).state).toBe("expired");
  });

  it("derives over explicit unknown and preserves explicit not applicable", () => {
    expect(assess("seller.motivation", 1, { freshnessState: "unknown" }).state).toBe("current");
    expect(assess("seller.motivation", 1, { freshnessState: "not-applicable" }).state).toBe("not-applicable");
  });
});

describe("fact aggregation and factual signals", () => {
  function readModel(records, previousFreshnessReadModel = null) {
    return evaluateFreshnessAndRevalidation({
      assetStrategyContext: { assetType: ASSET_TYPES.RESIDENTIAL_HOME, dealId: "deal-1", selectedStrategyId: "residential-acquisition", strategyVersion: "residential-strategy-v1" },
      evidenceRegistry: { evidenceRecords: records, evidenceById: Object.fromEntries(records.map((item) => [item.evidenceId, item])) },
      evaluatedTimestamp: NOW,
      missingInformationReadModel: { allItems: [{ canonicalField: "seller.motivation", requirementId: "seller-motivation", label: "Seller motivation", blocking: true }] },
      previousFreshnessReadModel,
    });
  }

  it.each([
    [[1, 1], "current"],
    [[1, null], "unknown"],
    [[1, 15], "revalidation-due"],
    [[1, 31], "stale"],
    [[1, 61], "expired"],
  ])("aggregates supporting Evidence conservatively", (ages, expected) => {
    const records = ages.map((age, index) => evidence({ evidenceId: `e-${index}`, sourceTimestamp: age == null ? null : daysAgo(age) }));
    expect(readModel(records).assessmentsByCanonicalField["seller.motivation"].state).toBe(expected);
  });

  it("keeps conflicts separate and emits current-state signals without fabricating transitions", () => {
    const result = readModel([evidence({ sourceTimestamp: daysAgo(61), conflictState: "conflicting" })]);
    expect(result.assessmentsByCanonicalField["seller.motivation"].activeConflictIds).toEqual([]);
    expect(result.factualSignals.map((item) => item.signalType)).toEqual(expect.arrayContaining(["revalidation-required", "critical-fact-revalidation-required"]));
    expect(result.factualSignals.map((item) => item.signalType)).not.toContain("fact-became-stale");
  });

  it("emits evidence-expired for expired supporting Evidence", () => {
    const result = readModel([evidence({ sourceTimestamp: daysAgo(61) })]);
    expect(result.expiredEvidenceIds).toEqual(["evidence-1"]);
    expect(result.factualSignals.some((item) => item.signalType === "evidence-expired")).toBe(true);
  });

  it("emits a deterministic transition signal only with supplied prior state", () => {
    const current = readModel([evidence({ sourceTimestamp: daysAgo(1) })]);
    const stale = readModel([evidence({ sourceTimestamp: daysAgo(31) })], current);
    const transition = stale.factualSignals.find((item) => item.signalType === "fact-became-stale");
    expect(transition.signalId).toContain("fact-became-stale");
    expect(readModel([evidence({ sourceTimestamp: daysAgo(31) })]).factualSignals.some((item) => item.signalType === "fact-became-stale")).toBe(false);
  });

  it("assesses recommendation support without mutating the recommendation", () => {
    const freshness = readModel([evidence({ sourceTimestamp: daysAgo(31) })]);
    const recommendation = { recommendationId: "recommendation-1", label: "Review analysis" };
    const support = evaluateRecommendationSupportFreshness({ freshnessReadModel: freshness, recommendation, recommendationBasis: { evidenceIds: ["evidence-1"] } });
    expect(support.state).toBe("revalidation-required");
    expect(support.signals[0].signalType).toBe("recommendation-support-revalidation-required");
    expect(recommendation).toEqual({ recommendationId: "recommendation-1", label: "Review analysis" });
  });
});
