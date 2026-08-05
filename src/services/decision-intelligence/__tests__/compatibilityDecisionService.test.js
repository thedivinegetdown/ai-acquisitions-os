import { describe, expect, it } from "vitest";
import {
  COMPATIBILITY_DECISION_RULESET_VERSION,
  DECISION_EVALUATION_STATES,
  DECISION_SOURCE_MODES,
  buildCompatibilityDecisionReadModel,
} from "../index";

const NOW = Date.parse("2026-08-05T15:00:00Z");

function completeDeal(overrides = {}) {
  return {
    id: "deal-1",
    organization_id: "org-1",
    tenant_id: "tenant-1",
    property_address: "123 Main Street",
    owner_name: "Sam Seller",
    phone: "5551112222",
    stage: "Contacted",
    asking_price: 120000,
    property_condition: "Needs repairs",
    motivation_score: 8,
    seller_timeline: "Within 30 days",
    mortgage_status: "Current",
    repairs_needed: 25000,
    occupancy_status: "Vacant",
    arv: 210000,
    ...overrides,
  };
}

function build(options = {}) {
  return buildCompatibilityDecisionReadModel({ now: NOW, ...options });
}

describe("compatibility decision read model", () => {
  it("classifies Identify only when stable opportunity identity is incomplete", () => {
    const result = build({ deal: { owner_name: "Sam Seller" } });

    expect(result.success).toBe(true);
    expect(result.data.lifecycle.state).toBe("Identify");
    expect(result.data.lifecycle.reason).toContain("stable opportunity identity");
    expect(result.data.recommendation.status).toBe(
      DECISION_EVALUATION_STATES.NOT_EVALUATED
    );
    expect(result.data.decisionRecord.decisionId).toBeNull();
  });

  it("classifies Verify for explicit missing decision-critical facts", () => {
    const result = build({
      deal: {
        id: "deal-1",
        property_address: "123 Main Street",
        owner_name: "Sam Seller",
        stage: "New Lead",
      },
    });

    expect(result.data.lifecycle.state).toBe("Verify");
    expect(result.data.lifecycle.reason).toContain("decision-critical");
    expect(result.data.missingInformationReferences.length).toBeGreaterThan(0);
    expect(result.data.lifecycle.evidenceReferenceIds).toEqual(expect.any(Array));
  });

  it("classifies Decide when the existing checklist is complete for human review", () => {
    const result = build({ deal: completeDeal() });

    expect(result.data.lifecycle.state).toBe("Decide");
    expect(result.data.lifecycle.reason).toContain("human decision review");
    expect(result.data.missingInformationReferences).toEqual([]);
    expect(result.data.lifecycle.previousState).toBeNull();
  });

  it("classifies Act only from a real due action or seller response", () => {
    const due = build({ deal: completeDeal({ due_date: "2026-08-05" }) });
    const sellerReply = build({
      conversationSignals: [
        {
          compatibilityKey: "phone:5551112222",
          linkedDealId: "deal-1",
          lastMessageDirection: "inbound",
          lastMessagePreview: "Can we talk today?",
          lastMessageTimestamp: "2026-08-05T14:00:00Z",
          organizationId: "org-1",
          tenantId: "tenant-1",
        },
      ],
      deal: completeDeal(),
    });

    expect(due.data.lifecycle.state).toBe("Act");
    expect(due.data.lifecycle.reason).toContain("follow-up is due");
    expect(sellerReply.data.lifecycle.state).toBe("Act");
    expect(sellerReply.data.lifecycle.reason).toContain("seller reply");
    expect(sellerReply.data.lifecycle.evidenceReferenceIds.length).toBeGreaterThan(0);
  });

  it("classifies Learn only from a real terminal outcome", () => {
    const result = build({ deal: completeDeal({ stage: "Closed" }) });

    expect(result.data.lifecycle.state).toBe("Learn");
    expect(result.data.lifecycle.reason).toContain('"Closed"');
    expect(result.data.lifecycle.evidenceReferenceIds.length).toBeGreaterThan(0);
  });

  it("preserves a previous lifecycle only when it is supplied as real data", () => {
    const withoutHistory = build({ deal: completeDeal() });
    const withHistory = build({ deal: completeDeal(), previousLifecycle: "Verify" });

    expect(withoutHistory.data.lifecycle.previousState).toBeNull();
    expect(withHistory.data.lifecycle.previousState).toBe("Verify");
  });

  it("wraps the existing deterministic next-action behavior without AI or confidence", () => {
    const result = build({ deal: completeDeal({ due_date: "2026-08-01" }) });
    const recommendation = result.data.recommendation;

    expect(recommendation.label).toBe(
      "Follow up with the seller today and update the next action."
    );
    expect(recommendation.status).toBe(DECISION_EVALUATION_STATES.COMPATIBILITY_RESULT);
    expect(recommendation.sourceMode).toBe(
      DECISION_SOURCE_MODES.DETERMINISTIC_COMPATIBILITY
    );
    expect(recommendation.rulesetVersion).toBe(COMPATIBILITY_DECISION_RULESET_VERSION);
    expect(recommendation.confidenceReference).toBeNull();
    expect(JSON.stringify(recommendation).toLowerCase()).not.toContain("ai recommendation");
  });

  it("normalizes current offer readiness and leaves future metrics unevaluated", () => {
    const result = build({ deal: completeDeal() });
    const readiness = result.data.metricsById["offer-readiness"];

    expect(readiness.evaluationState).toBe(
      DECISION_EVALUATION_STATES.COMPATIBILITY_RESULT
    );
    expect(readiness.value).toBe(100);
    expect(readiness.displayValue).toBe("Ready to Offer");
    for (const id of [
      "pursuit-score",
      "recommendation-confidence",
      "data-reliability",
      "financial-resilience",
      "deal-effort",
      "risk-level",
      "cost-of-delay",
    ]) {
      expect(result.data.metricsById[id]).toMatchObject({
        evaluationState: DECISION_EVALUATION_STATES.NOT_EVALUATED,
        value: null,
        displayValue: null,
      });
    }
    expect(result.data).not.toHaveProperty("pursuitScore");
    expect(result.data).not.toHaveProperty("recommendationConfidence");
  });

  it("maps current missing checklist items to blocking compatibility issues", () => {
    const result = build({
      deal: completeDeal({ asking_price: null, property_condition: null }),
    });
    const readiness = result.data.metricsById["offer-readiness"];

    expect(result.data.missingInformationReferences.map((issue) => issue.label)).toEqual(
      expect.arrayContaining(["Asking price", "Property condition"])
    );
    expect(
      result.data.missingInformationReferences.every((issue) => issue.severity === "blocking")
    ).toBe(true);
    expect(readiness.blockingIssueIds.length).toBeGreaterThanOrEqual(2);
    expect(readiness.advisoryIssueIds).toEqual([]);
  });

  it("uses a real due date as the only compatibility action-window value", () => {
    const withDueDate = build({ deal: completeDeal({ due_date: "2026-08-06" }) });
    const withoutDueDate = build({ deal: completeDeal() });

    expect(withDueDate.data.metricsById["recommended-action-window"]).toMatchObject({
      evaluationState: DECISION_EVALUATION_STATES.COMPATIBILITY_RESULT,
      displayValue: "Due 2026-08-06",
    });
    expect(withoutDueDate.data.metricsById["recommended-action-window"]).toMatchObject({
      evaluationState: DECISION_EVALUATION_STATES.UNAVAILABLE,
      value: null,
    });
  });

  it("keeps current CRM evidence honest about provenance and verification", () => {
    const result = build({ deal: completeDeal() });
    const addressEvidence = result.data.evidenceReferences.find(
      (entry) => entry.relatedCanonicalField === "property.address"
    );

    expect(addressEvidence).toMatchObject({
      sourceType: "crm-current-state",
      sourceSystem: "Deal record",
      sourceTimestamp: null,
      verificationState: "unknown",
      trustLevel: "unknown",
      reliabilityLabel: "Compatibility Record",
    });
    expect(addressEvidence.partialDataWarning).toContain("compatibility evidence");
    expect(result.data.sourceFreshness.latestSourceTimestamp).toBeNull();
  });

  it("bounds evidence and omits evidence outside the current tenant context", () => {
    const references = Array.from({ length: 40 }, (_, index) => ({
      sourceType: "document-record",
      sourceSystem: "Documents",
      sourceRecordId: `document-${index}`,
      sourceField: "summary",
      organizationId: index === 0 ? "other-org" : "org-1",
      tenantId: "tenant-1",
    }));
    const result = build({ deal: completeDeal(), evidenceReferences: references });

    expect(result.data.evidenceReferences.length).toBeLessThanOrEqual(24);
    expect(
      result.data.evidenceReferences.some((entry) => entry.organizationId === "other-org")
    ).toBe(false);
  });

  it("uses only explicit conflicts and linked normalized approval items", () => {
    const result = build({
      approvalItems: [
        {
          id: "approval-1",
          relatedDeal: { id: "deal-1" },
          status: "pending",
          organizationId: "org-1",
          tenantId: "tenant-1",
        },
      ],
      conflicts: [
        {
          conflictId: "conflict-1",
          summary: "Two asking prices are explicitly represented.",
          relatedCanonicalField: "deal.askingPrice",
        },
      ],
      deal: completeDeal(),
    });

    expect(result.data.lifecycle.state).toBe("Verify");
    expect(result.data.conflictReferences).toHaveLength(1);
    expect(result.data.approvalSummary.status).toBe("pending");
    expect(result.data.recommendation.approvalRequirement.required).toBe(true);
  });

  it("uses an approved existing action for Act without calling the recommendation approved", () => {
    const result = build({
      approvalItems: [
        {
          id: "approval-1",
          relatedDeal: { id: "deal-1" },
          requestedAction: "Continue the existing reviewed workflow step.",
          status: "approved",
          organizationId: "org-1",
          tenantId: "tenant-1",
        },
      ],
      deal: completeDeal(),
    });

    expect(result.data.lifecycle.state).toBe("Act");
    expect(result.data.approvalSummary.status).toBe("approved-action-available");
    expect(result.data.recommendation.approvalRequirement.required).toBeNull();
    expect(result.data.recommendation).not.toHaveProperty("approved");
  });

  it("returns a partial successful result with safe source warnings", () => {
    const result = build({
      deal: completeDeal(),
      sourceErrors: [new Error("Approval context could not be loaded.")],
    });

    expect(result.success).toBe(true);
    expect(result.data.sourceStatus).toBe("partial");
    expect(result.data.sourceWarnings).toContain("Approval context could not be loaded.");
  });

  it("returns a safe failure if an input record throws during evaluation", () => {
    const deal = completeDeal();
    Object.defineProperty(deal, "price", {
      get() {
        throw new Error("service_role secret should never be shown");
      },
    });

    const result = build({ deal });

    expect(result.success).toBe(false);
    expect(result.error.message).toBe(
      "Decision information could not be evaluated from the current record."
    );
  });

  it("does not mutate input or infer an asset strategy", () => {
    const deal = completeDeal({ property_type: "Vacant land" });
    const before = JSON.parse(JSON.stringify(deal));
    const result = build({ deal });

    expect(deal).toEqual(before);
    expect(result.data.decisionRecord.assetType).toBeNull();
    expect(result.data.decisionRecord.assetStrategyId).toBeNull();
  });
});
