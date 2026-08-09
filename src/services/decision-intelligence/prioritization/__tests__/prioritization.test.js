import { describe, expect, it } from "vitest";
import {
  ACTION_WINDOW_CONTRACT_VERSION,
  ACTION_WINDOW_RULESET_VERSION,
  ACTION_WINDOW_TYPES,
  COST_OF_DELAY_CONTRACT_VERSION,
  COST_OF_DELAY_LEVELS,
  COST_OF_DELAY_RULESET_VERSION,
  PRIORITIZATION_BASIS_TYPES,
  evaluateCostOfDelay,
  evaluateRecommendedActionWindow,
  normalizeCostOfDelayResult,
  normalizeRecommendedActionWindowResult,
  toCostOfDelayMetric,
  toRecommendedActionWindowMetric,
} from "../index";

const NOW = "2026-08-09T12:00:00.000Z";

function evaluate(basisType, overrides = {}) {
  const { recommendationBasis: basisOverrides, ...inputOverrides } = overrides;
  const input = {
    assetStrategyContext: {
      dealId: "deal-1",
      assetType: "residential-home",
      selectedStrategyId: "residential-acquisition",
      strategyVersion: "residential-strategy-v1",
    },
    recommendation: { recommendationId: "recommendation-1" },
    recommendationBasis: {
      basisType,
      triggerId: "trigger-1",
      directTrigger: true,
      evidenceIds: ["evidence-1"],
      ...basisOverrides,
    },
    evaluatedTimestamp: NOW,
    ...inputOverrides,
  };
  return {
    cost: evaluateCostOfDelay(input),
    window: evaluateRecommendedActionWindow(input),
  };
}

function expectTiming(result, level, windowType) {
  expect(result.cost.level).toBe(level);
  expect(result.window.windowType).toBe(windowType);
}

describe("DI-05 prioritization contracts", () => {
  it("publishes the categorical v1 contracts and rulesets", () => {
    expect(COST_OF_DELAY_CONTRACT_VERSION).toBe("cost-of-delay-contract-v1");
    expect(COST_OF_DELAY_RULESET_VERSION).toBe("cost-of-delay-ruleset-v1");
    expect(ACTION_WINDOW_CONTRACT_VERSION).toBe("recommended-action-window-contract-v1");
    expect(ACTION_WINDOW_RULESET_VERSION).toBe("recommended-action-window-ruleset-v1");
    expect(Object.values(COST_OF_DELAY_LEVELS)).toEqual(["unavailable", "low", "moderate", "high", "critical"]);
    expect(Object.values(ACTION_WINDOW_TYPES)).toContain("before-deadline");
    expect(Object.values(PRIORITIZATION_BASIS_TYPES)).toContain("scheduled-follow-up");
  });

  it("normalizes malformed input, bounds references, and fabricates no timestamps", () => {
    const cost = normalizeCostOfDelayResult({ level: "urgent", evidenceIds: Array.from({ length: 120 }, (_, index) => `e-${index}`) });
    const window = normalizeRecommendedActionWindowResult({ windowType: "soon" });
    expect(cost).toMatchObject({ level: "unavailable", evaluatedTimestamp: null, sourceDueTimestamp: null });
    expect(cost.evidenceIds).toHaveLength(100);
    expect(window).toMatchObject({ windowType: "unavailable", sourceDueTimestamp: null, sourceExpirationTimestamp: null, sourceEventTimestamp: null });
  });
});

describe("direct operational timing", () => {
  it("keeps a real future waiting follow-up Low and Scheduled", () => {
    const result = evaluate("scheduled-follow-up", { timingContext: { sourceDueTimestamp: "2026-08-10T12:00:00Z" } });
    expectTiming(result, "low", "scheduled");
    expect(result.window.sourceDueTimestamp).toBe("2026-08-10T12:00:00.000Z");
  });

  it("preserves a real overdue due timestamp", () => {
    const result = evaluate("overdue-action", { timingContext: { sourceDueTimestamp: "2026-08-08T12:00:00Z" } });
    expectTiming(result, "critical", "overdue");
    expect(result.cost.sourceDueTimestamp).toBe("2026-08-08T12:00:00.000Z");
    expect(result.window.sourceDueTimestamp).toBe("2026-08-08T12:00:00.000Z");
    expect(result.window.policyDerived).toBe(false);
  });

  it("marks a seller reply High / Act Now without inventing a due date", () => {
    const result = evaluate("seller-reply", { sellerReplyContext: { eventTimestamp: "2026-08-09T11:00:00Z" } });
    expectTiming(result, "high", "act-now");
    expect(result.window.sourceEventTimestamp).toBe("2026-08-09T11:00:00.000Z");
    expect(result.window.sourceDueTimestamp).toBeNull();
  });

  it.each([
    ["2026-08-09", "high", "today"],
    ["2026-08-11", "moderate", "before-deadline"],
    ["2026-08-20", "low", "scheduled"],
  ])("maps due action %s to %s / %s", (due, level, windowType) => {
    const result = evaluate("due-action", { timingContext: { sourceDueTimestamp: due } });
    expectTiming(result, level, windowType);
    expect(result.window.sourceDueTimestamp).not.toBeNull();
  });

  it("fails invalid due dates safely", () => {
    const result = evaluate("due-action", { timingContext: { sourceDueTimestamp: "not-a-date" } });
    expectTiming(result, "unavailable", "unavailable");
    expect(result.cost.warnings.join(" ")).toContain("invalid");
  });
});

describe("approval timing", () => {
  it.each([
    ["2026-08-09T11:00:00Z", "critical", "overdue"],
    ["2026-08-10T10:00:00Z", "high", "before-deadline"],
    ["2026-08-11T12:00:00Z", "moderate", "before-deadline"],
    ["2026-08-20T12:00:00Z", "low", "scheduled"],
  ])("maps approval expiration %s to %s / %s", (expirationTimestamp, level, windowType) => {
    const result = evaluate("pending-approval", { approvalContext: { expirationTimestamp } });
    expectTiming(result, level, windowType);
    expect(result.window.sourceExpirationTimestamp).toBe(new Date(expirationTimestamp).toISOString());
  });

  it("uses Moderate / Within 3 Days for a real approval without an expiration", () => {
    const result = evaluate("pending-approval", { recommendationBasis: { approvalReferenceIds: ["approval-1"] } });
    expectTiming(result, "moderate", "within-3-days");
    expect(result.window.sourceExpirationTimestamp).toBeNull();
    expect(result.window.policyDerived).toBe(true);
  });
});

describe("decision-review and strategy timing", () => {
  it.each([
    ["missing-information", "within 30 days", "high", "today"],
    ["missing-information", "90 days", "moderate", "within-3-days"],
    ["conflict-review", "within 30 days", "high", "today"],
    ["readiness-blocker", "within 30 days", "high", "today"],
    ["manual-review", "90 days", "moderate", "within-3-days"],
  ])("maps %s with %s", (basis, sellerTimelineValue, level, windowType) => {
    const result = evaluate(basis, {
      sellerTimelineValue,
      conflictReadModel: { blockingConflicts: [{ conflictId: "conflict-1" }] },
      missingInformationReadModel: { blockingItems: [{ itemId: "missing-1" }] },
      recommendationBasis: { conflictIds: ["conflict-1"], missingInformationIds: ["missing-1"] },
    });
    expectTiming(result, level, windowType);
    expect(result.window.sourceDueTimestamp).toBeNull();
  });

  it("keeps advisory conflict and Missing Information below High", () => {
    const conflict = evaluate("conflict-review", { sellerTimelineValue: "within 30 days", recommendationBasis: { conflictIds: ["advisory-conflict"] }, conflictReadModel: { blockingConflicts: [] } });
    const missing = evaluate("missing-information", { sellerTimelineValue: "within 30 days", recommendationBasis: { missingInformationIds: ["advisory-item"] }, missingInformationReadModel: { blockingItems: [] } });
    expectTiming(conflict, "low", "no-immediate-action");
    expectTiming(missing, "low", "no-immediate-action");
  });

  it.each(["residential-strategy-guidance", "vacant-land-strategy-guidance"])("reuses shared seller timeline behavior for %s", (basis) => {
    expectTiming(evaluate(basis, { sellerTimelineValue: 30 }), "high", "today");
    expectTiming(evaluate(basis, { sellerTimelineValue: 60 }), "moderate", "within-3-days");
    expectTiming(evaluate(basis, { sellerTimelineValue: 120 }), "low", "no-immediate-action");
    expectTiming(evaluate(basis, { sellerTimelineValue: "sometime soon" }), "moderate", "within-3-days");
  });

  it("never makes offer readiness Critical by itself", () => {
    expectTiming(evaluate("ready-for-offer-preparation", { sellerTimelineValue: 20 }), "high", "today");
    expectTiming(evaluate("ready-for-offer-preparation", { sellerTimelineValue: 120 }), "moderate", "within-3-days");
  });

  it("maps classification and traceable fallback without fake urgency", () => {
    expectTiming(evaluate("asset-classification"), "moderate", "within-3-days");
    expectTiming(evaluate("compatibility-fallback"), "low", "no-immediate-action");
  });
});

describe("independence and metric adapters", () => {
  it("does not consume Pursuit Score, Reliability, Confidence, or readiness as urgency inputs", () => {
    const baseline = evaluate("compatibility-fallback");
    const contextual = evaluate("compatibility-fallback", {
      pursuitScoreResult: { score: 95 },
      dataReliabilityResult: { grade: "strong" },
      recommendationConfidenceResult: { level: "high" },
      readinessResult: { readinessState: "ready-for-offer-preparation" },
    });
    expect(contextual.cost.level).toBe(baseline.cost.level);
    expect(contextual.window.windowType).toBe(baseline.window.windowType);
    expect(evaluate("seller-reply", { pursuitScoreResult: { score: 20 } }).cost.level).toBe("high");
  });

  it("adapts categorical metrics with null scales and no financial precision", () => {
    const result = evaluate("seller-reply", { sellerReplyContext: { eventTimestamp: "2026-08-09T11:00:00Z" } });
    const costMetric = toCostOfDelayMetric(result.cost);
    const windowMetric = toRecommendedActionWindowMetric(result.window);
    expect(costMetric).toMatchObject({ value: "high", unit: "delay-impact", scale: null, rulesetVersion: COST_OF_DELAY_RULESET_VERSION });
    expect(windowMetric).toMatchObject({ value: "act-now", unit: "action-window", scale: null, rulesetVersion: ACTION_WINDOW_RULESET_VERSION });
    expect(JSON.stringify([costMetric, windowMetric])).not.toMatch(/\$|percentage|probability/i);
  });

  it("keeps unavailable metrics null", () => {
    const result = evaluate("unavailable");
    expect(toCostOfDelayMetric(result.cost)).toMatchObject({ value: null, displayValue: null });
    expect(toRecommendedActionWindowMetric(result.window)).toMatchObject({ value: null, displayValue: null });
  });

  it("does not infer staleness or automatic expiration from an old timestamp", () => {
    const result = evaluate("compatibility-fallback", { evidenceRegistry: { evidenceRecords: [{ sourceTimestamp: "2000-01-01T00:00:00Z" }] } });
    expectTiming(result, "low", "no-immediate-action");
    expect(result.cost).not.toHaveProperty("revalidationTask");
    expect(JSON.stringify(result)).not.toMatch(/ttl|stale-by-age/i);
  });
});
