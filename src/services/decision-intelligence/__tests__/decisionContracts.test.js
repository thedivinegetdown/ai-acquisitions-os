import { describe, expect, it } from "vitest";
import {
  DECISION_CONTRACT_VERSION,
  DECISION_EVALUATION_STATES,
  DECISION_LIFECYCLE_ORDER,
  DECISION_METRIC_REGISTRY,
  DECISION_SOURCE_MODES,
  normalizeDecisionOverrideReference,
  normalizeDecisionRecord,
  normalizeEvidenceReference,
  normalizeMetricOutput,
  normalizeRecommendation,
  normalizeRulesetDescriptor,
  validateDecisionRecord,
} from "../index";

describe("decision contract foundation", () => {
  it("exports the versioned lifecycle and recommendation evaluation states", () => {
    expect(DECISION_CONTRACT_VERSION).toBe("decision-contract-v1");
    expect(DECISION_LIFECYCLE_ORDER).toEqual([
      "Identify",
      "Verify",
      "Decide",
      "Act",
      "Learn",
    ]);
    expect(Object.values(DECISION_EVALUATION_STATES)).toEqual([
      "not-evaluated",
      "unavailable",
      "compatibility-result",
      "evaluated",
      "expired",
      "superseded",
    ]);
  });

  it("reserves every canonical metric without assigning values", () => {
    expect(DECISION_METRIC_REGISTRY.map((metric) => metric.id)).toEqual([
      "pursuit-score",
      "recommendation-confidence",
      "data-completeness",
      "data-reliability",
      "financial-resilience",
      "deal-effort",
      "risk-level",
      "offer-readiness",
      "cost-of-delay",
      "recommended-action-window",
    ]);

    const record = normalizeDecisionRecord({});
    expect(record.metricOutputs).toHaveLength(10);
    expect(record.metricOutputs.every((metric) => metric.value === null)).toBe(true);
    expect(
      record.metricOutputs.every(
        (metric) => metric.evaluationState === DECISION_EVALUATION_STATES.NOT_EVALUATED
      )
    ).toBe(true);
  });

  it("keeps missing and unavailable metric values null without replacing real zero", () => {
    const missing = normalizeMetricOutput({ metricId: "pursuit-score" });
    const unavailable = normalizeMetricOutput({
      metricId: "data-reliability",
      evaluationState: DECISION_EVALUATION_STATES.UNAVAILABLE,
      value: 90,
      displayValue: "High",
    });
    const explicitZero = normalizeMetricOutput({
      metricId: "offer-readiness",
      evaluationState: DECISION_EVALUATION_STATES.COMPATIBILITY_RESULT,
      value: 0,
      displayValue: "Not Ready",
    });

    expect(missing.value).toBeNull();
    expect(missing.displayValue).toBeNull();
    expect(unavailable.value).toBeNull();
    expect(unavailable.displayValue).toBeNull();
    expect(explicitZero.value).toBe(0);
  });

  it("does not invent recommendation confidence or an evaluated result", () => {
    const recommendation = normalizeRecommendation({ label: "Needs review" });

    expect(recommendation.status).toBe(DECISION_EVALUATION_STATES.NOT_EVALUATED);
    expect(recommendation.confidenceReference).toBeNull();
    expect(recommendation.sourceMode).toBe(DECISION_SOURCE_MODES.UNKNOWN);
  });

  it("requires evidence source identity and never substitutes a source timestamp", () => {
    expect(
      normalizeEvidenceReference({
        sourceType: "crm-current-state",
        sourceSystem: "Deal record",
      })
    ).toBeNull();

    const evidence = normalizeEvidenceReference({
      sourceType: "crm-current-state",
      sourceSystem: "Deal record",
      sourceRecordId: "deal-1",
      sourceField: "asking_price",
      trustLevel: "operator-reviewed",
    });

    expect(evidence.evidenceId).toContain("deal-1");
    expect(evidence.sourceTimestamp).toBeNull();
    expect(evidence.observedTimestamp).toBeNull();
    expect(evidence.trustLevel).toBe("operator-reviewed");
    expect(evidence.verificationState).toBe("unknown");
  });

  it("keeps trust, persistence, provider origin, and verification separate", () => {
    const persisted = normalizeEvidenceReference({
      sourceType: "persisted-record",
      sourceSystem: "Tasks",
      sourceRecordId: "task-1",
      reliabilityLabel: "Persisted Record",
    });
    const provider = normalizeEvidenceReference({
      sourceType: "provider-record",
      sourceSystem: "Optional property adapter",
      sourceRecordId: "provider-1",
      trustLevel: "high",
      reliabilityLabel: "Provider Record",
    });

    expect(persisted.verificationState).toBe("unknown");
    expect(provider.verificationState).toBe("unknown");
    expect(provider.trustLevel).toBe("high");
  });

  it("normalizes a truthful ruleset descriptor without provider or generated-time defaults", () => {
    const ruleset = normalizeRulesetDescriptor({
      rulesetId: "compatibility",
      rulesetVersion: "v1",
      sourceMode: DECISION_SOURCE_MODES.DETERMINISTIC_COMPATIBILITY,
      deterministic: true,
      compatibility: true,
    });

    expect(ruleset).toMatchObject({
      rulesetId: "compatibility",
      rulesetVersion: "v1",
      deterministic: true,
      compatibility: true,
      providerName: null,
      modelName: null,
      generatedTimestamp: null,
    });
  });

  it("defines an override reference shape without persistence or behavior", () => {
    const override = normalizeDecisionOverrideReference({
      overrideId: "override-1",
      priorDecisionReference: "decision-1",
      reason: "Operator supplied a different next step.",
      requestedTimestamp: "2026-08-01T12:00:00Z",
    });

    expect(override.overrideId).toBe("override-1");
    expect(override.requestedTimestamp).toBe("2026-08-01T12:00:00.000Z");
    expect(override.decidedTimestamp).toBeNull();
    expect(override.approvalReference).toBeNull();
  });

  it("handles malformed records and preserves tenant context only when supplied", () => {
    const malformed = normalizeDecisionRecord("bad input");
    const scoped = normalizeDecisionRecord({
      organizationId: "org-1",
      tenantId: "tenant-1",
    });

    expect(malformed.organizationId).toBeNull();
    expect(malformed.tenantId).toBeNull();
    expect(malformed.lifecycle.state).toBeNull();
    expect(scoped.organizationId).toBe("org-1");
    expect(scoped.tenantId).toBe("tenant-1");
  });

  it("normalizes the canonical asset strategy identifier with its compatibility alias", () => {
    const record = normalizeDecisionRecord({
      assetType: "residential-home",
      assetStrategyIdentifier: "residential-acquisition",
    });

    expect(record.assetType).toBe("residential-home");
    expect(record.assetStrategyIdentifier).toBe("residential-acquisition");
    expect(record.assetStrategyId).toBe("residential-acquisition");
  });

  it("validates required canonical decision identity and ruleset fields", () => {
    const invalid = validateDecisionRecord({});
    const valid = validateDecisionRecord({
      decisionId: "decision-1",
      dealId: "deal-1",
      lifecycle: { state: "Decide" },
      ruleset: { rulesetId: "compatibility", rulesetVersion: "v1" },
    });

    expect(invalid.valid).toBe(false);
    expect(invalid.errors.length).toBeGreaterThan(0);
    expect(valid.valid).toBe(true);
  });
});
