import { describe, expect, it } from "vitest";
import { PURSUIT_SCORING_PROFILE_STATUSES } from "../pursuitScoringContracts";
import { evaluatePursuitScore } from "../pursuitScoringEngine";
import {
  canPresentPursuitScore,
  toPursuitScoreMetric,
} from "../pursuitScoringMetricAdapter";
import {
  createResidentialScoringProfile,
  createScoringInput,
} from "./fixtures/pursuitScoringFixtures";

function activeProductionEvaluation() {
  const profile = createResidentialScoringProfile({
    status: PURSUIT_SCORING_PROFILE_STATUSES.ACTIVE,
  });
  const input = {
    ...createScoringInput(profile),
    executionMode: "production",
  };
  return { input, result: evaluatePursuitScore(input) };
}

describe("Pursuit Score Decision metric adapter", () => {
  it("adapts an explainable evaluated production result", () => {
    const { input, result } = activeProductionEvaluation();
    const metric = toPursuitScoreMetric(result, {
      assetStrategyContext: input.assetStrategyContext,
      productionOnly: true,
    });

    expect(metric).toEqual(
      expect.objectContaining({
        metricId: "pursuit-score",
        evaluationState: "evaluated",
        value: 75,
        displayValue: "75/100",
        scale: "0-100",
        sourceMode: "deterministic",
      })
    );
    expect(metric.inputEvidenceIds).toHaveLength(7);
    expect(metric.rulesetVersion).toBe("test-fixture-rules-v1");
    expect(
      canPresentPursuitScore({
        assetStrategyContext: input.assetStrategyContext,
        metric,
        result,
      })
    ).toBe(true);
  });

  it("keeps blocked and absent results null", () => {
    const profile = createResidentialScoringProfile();
    const input = createScoringInput(profile);
    const blockedResult = evaluatePursuitScore({
      ...input,
      evidenceReferences: [],
    });
    const blockedMetric = toPursuitScoreMetric(blockedResult);
    const absentMetric = toPursuitScoreMetric(null);

    expect(blockedMetric.evaluationState).toBe("unavailable");
    expect(blockedMetric.value).toBeNull();
    expect(blockedMetric.displayValue).toBeNull();
    expect(absentMetric.evaluationState).toBe("not-evaluated");
    expect(absentMetric.value).toBeNull();
  });

  it("does not expose a test-only score through the production gate", () => {
    const profile = createResidentialScoringProfile();
    const input = createScoringInput(profile);
    const result = evaluatePursuitScore(input);
    const metric = toPursuitScoreMetric(result, {
      assetStrategyContext: input.assetStrategyContext,
      productionOnly: true,
    });

    expect(metric.evaluationState).toBe("unavailable");
    expect(metric.value).toBeNull();
    expect(metric.displayValue).toBeNull();
    expect(
      canPresentPursuitScore({
        assetStrategyContext: input.assetStrategyContext,
        metric,
        result,
      })
    ).toBe(false);
  });

  it("refuses an evaluated value without Evidence and ruleset metadata", () => {
    const { input, result } = activeProductionEvaluation();
    const metric = toPursuitScoreMetric(
      {
        ...result,
        evidenceReferenceIds: [],
        ruleset: {},
      },
      {
        assetStrategyContext: input.assetStrategyContext,
        productionOnly: true,
      }
    );
    expect(metric.evaluationState).toBe("unavailable");
    expect(metric.value).toBeNull();
    expect(metric.explanation).toMatch(/Evidence or ruleset metadata/i);
  });

  it("does not populate unrelated Decision Intelligence metrics", () => {
    const { input, result } = activeProductionEvaluation();
    const metric = toPursuitScoreMetric(result, {
      assetStrategyContext: input.assetStrategyContext,
    });
    expect(metric).not.toHaveProperty("recommendationConfidence");
    expect(metric).not.toHaveProperty("dataReliability");
    expect(metric).not.toHaveProperty("riskLevel");
    expect(metric).not.toHaveProperty("costOfDelay");
  });
});
