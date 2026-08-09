import { describe, expect, it } from "vitest";
import {
  COMPATIBILITY_DECISION_RULESET_VERSION,
  DECISION_EVALUATION_STATES,
  DECISION_SOURCE_MODES,
  PURSUIT_SCORING_PROFILE_STATUSES,
  buildCompatibilityDecisionReadModel,
  evaluatePursuitScore,
} from "../index";
import { ASSET_TYPES } from "../../asset-strategy";
import {
  createResidentialScoringProfile,
  createScoringInput,
} from "../pursuit-scoring/__tests__/fixtures/pursuitScoringFixtures";

const NOW = Date.parse("2026-08-05T15:00:00Z");

function completeDeal(overrides = {}) {
  return {
    id: "deal-1",
    organization_id: "org-1",
    tenant_id: "tenant-1",
    asset_type: ASSET_TYPES.RESIDENTIAL_HOME,
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
        asset_type: ASSET_TYPES.RESIDENTIAL_HOME,
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

  it("keeps readiness compatibility-only while integrating production Pursuit Score", () => {
    const result = build({ deal: completeDeal() });
    const readiness = result.data.metricsById["offer-readiness"];

    expect(readiness.evaluationState).toBe(
      DECISION_EVALUATION_STATES.COMPATIBILITY_RESULT
    );
    expect(readiness.value).toBe(100);
    expect(readiness.displayValue).toBe("Ready to Offer");
    expect(result.data.metricsById["pursuit-score"]).toMatchObject({
      evaluationState: DECISION_EVALUATION_STATES.EVALUATED,
      value: 80,
      displayValue: "80/100",
    });
    expect(result.data.pursuitScoreResult).toMatchObject({
      scoringProfileId: "residential-pursuit-profile-v1",
      evaluationState: "partial",
      productionEligible: true,
    });
    for (const id of [
      "recommendation-confidence",
      "data-completeness",
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

  it("never converts an existing lead_score into Pursuit Score", () => {
    const baseline = build({ deal: completeDeal() });
    const result = build({
      deal: completeDeal({ lead_score: 100 }),
    });
    expect(result.data.metricsById["pursuit-score"]).toMatchObject({
      evaluationState: DECISION_EVALUATION_STATES.EVALUATED,
      value: baseline.data.metricsById["pursuit-score"].value,
    });
    expect(result.data.pursuitScoreResult.factorResults.map((factor) => factor.factorId)).not.toContain(
      "lead_score"
    );
  });

  it("uses the registered Residential Strategy result instead of a supplied test fixture", () => {
    const profile = createResidentialScoringProfile({
      status: PURSUIT_SCORING_PROFILE_STATUSES.ACTIVE,
    });
    const scoringResult = evaluatePursuitScore({
      ...createScoringInput(profile),
      executionMode: "production",
    });
    const result = build({
      deal: completeDeal(),
      pursuitScoreResult: scoringResult,
    });

    expect(scoringResult.evaluationState).toBe("evaluated");
    expect(result.data.assetStrategyContext.strategySupportState).toBe("implemented");
    expect(result.data.metricsById["pursuit-score"]).toMatchObject({
      evaluationState: DECISION_EVALUATION_STATES.EVALUATED,
      value: 80,
    });
    expect(result.data.pursuitScoreResult.scoringProfileId).toBe(
      "residential-pursuit-profile-v1"
    );
  });

  it("integrates residential underwriting, signals, exits, and review guidance", () => {
    const result = build({ deal: completeDeal() });
    const strategy = result.data.residentialStrategyResult;

    expect(strategy).toMatchObject({
      eligible: true,
      strategyId: "residential-acquisition",
      strategyVersion: "residential-strategy-v1",
      scoringProfileId: "residential-pursuit-profile-v1",
      evaluationState: "partial",
    });
    expect(strategy.underwriting.acquisitionCeiling).toBe(122000);
    expect(strategy.riskSignals.length).toBeGreaterThan(0);
    expect(strategy.exitCandidates).toHaveLength(5);
    expect(strategy.reviewGuidance.label).toMatch(/Review/i);
    expect(result.data.recommendation.status).toBe(
      DECISION_EVALUATION_STATES.COMPATIBILITY_RESULT
    );
    expect(result.data.metricsById["recommendation-confidence"].value).toBeNull();
    expect(result.data.metricsById["data-reliability"].value).toBeNull();
    expect(result.data.metricsById["risk-level"].value).toBeNull();
  });

  it("keeps blocked residential Pursuit Score null", () => {
    const result = build({ deal: completeDeal({ motivation_score: undefined }) });

    expect(result.data.residentialStrategyResult.pursuitScoreResult).toMatchObject({
      evaluationState: "blocked",
      score: null,
      displayValue: null,
    });
    expect(result.data.metricsById["pursuit-score"]).toMatchObject({
      evaluationState: DECISION_EVALUATION_STATES.UNAVAILABLE,
      value: null,
      displayValue: null,
    });
    expect(result.data.pursuitScoreResult).toBeNull();
  });

  it("keeps seller replies and due actions ahead of Residential Strategy guidance", () => {
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
    const due = build({ deal: completeDeal({ due_date: "2026-08-05" }) });

    expect(sellerReply.data.recommendation.label).toBe("Respond to the seller reply.");
    expect(due.data.recommendation.label).toBe("Complete the due follow-up action.");
  });

  it("keeps a seller reply ahead of an overdue follow-up on the same deal", () => {
    const result = build({
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
      deal: completeDeal({ due_date: "2026-08-01" }),
    });

    expect(result.data.recommendation).toMatchObject({
      label: "Respond to the seller reply.",
      status: DECISION_EVALUATION_STATES.COMPATIBILITY_RESULT,
    });
    const evidenceIds = new Set(
      result.data.evidenceReferences.map((entry) => entry.evidenceId)
    );
    expect(
      result.data.recommendation.evidenceReferenceIds.every((id) =>
        evidenceIds.has(id)
      )
    ).toBe(true);
  });

  it("integrates classified residential strategy context and provenance", () => {
    const result = build({ deal: completeDeal() });
    const classificationEvidence = result.data.evidenceReferences.find(
      (entry) => entry.sourceType === "crm-asset-classification"
    );

    expect(result.data.decisionRecord).toMatchObject({
      assetType: ASSET_TYPES.RESIDENTIAL_HOME,
      assetStrategyId: "residential-acquisition",
      assetStrategyIdentifier: "residential-acquisition",
    });
    expect(result.data.assetStrategyContext).toMatchObject({
      strategySupportState: "implemented",
      compatibilityAnalysisEligibility: true,
      residentialStrategyEligibility: true,
      strategyVersion: "residential-strategy-v1",
    });
    expect(classificationEvidence).toMatchObject({
      sourceField: "asset_type",
      sourceTimestamp: null,
      verificationState: "unknown",
    });
    expect(classificationEvidence.valueSummary).toContain("residential-home");
  });

  it("moves an identified unknown asset to Verify without residential readiness", () => {
    const result = build({
      deal: completeDeal({ asset_type: undefined }),
    });
    const readiness = result.data.metricsById["offer-readiness"];

    expect(result.success).toBe(true);
    expect(result.data.lifecycle.state).toBe("Verify");
    expect(result.data.decisionRecord.assetType).toBeNull();
    expect(result.data.decisionRecord.assetStrategyIdentifier).toBeNull();
    expect(result.data.missingInformationReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "missing-information:deal-1:asset-classification",
          label: "Asset Classification Required",
        }),
      ])
    );
    expect(readiness).toMatchObject({
      evaluationState: DECISION_EVALUATION_STATES.UNAVAILABLE,
      value: null,
      displayValue: null,
    });
    expect(
      result.data.missingInformationReferences.map((issue) => issue.label)
    ).not.toEqual(
      expect.arrayContaining([
        "Asking price",
        "Property condition",
        "Repairs needed",
        "ARV / comps",
      ])
    );
    expect(
      result.data.availableActions.find((action) => action.id === "prepare-offer")
    ).toMatchObject({ enabled: false });
  });

  it("requires human review for conflicting explicit classifications", () => {
    const result = build({
      deal: completeDeal({ property_type: "Vacant land" }),
    });

    expect(result.success).toBe(true);
    expect(result.data.lifecycle.state).toBe("Verify");
    expect(result.data.decisionRecord.assetType).toBeNull();
    expect(result.data.decisionRecord.assetStrategyIdentifier).toBeNull();
    expect(result.data.assetStrategyContext.manualReviewRequired).toBe(true);
    expect(result.data.conflictReferences).toHaveLength(1);
    expect(
      result.data.evidenceReferences.filter(
        (entry) => entry.sourceType === "crm-asset-classification"
      )
    ).toHaveLength(2);
    expect(result.data.metricsById["offer-readiness"]).toMatchObject({
      evaluationState: DECISION_EVALUATION_STATES.UNAVAILABLE,
      value: null,
      displayValue: null,
    });
  });

  it.each([
    [
      "vacant land",
      ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
      "vacant-land-acquisition",
    ],
    [
      "small multifamily",
      ASSET_TYPES.SMALL_MULTIFAMILY,
      "small-multifamily-acquisition",
    ],
    [
      "manufactured home",
      ASSET_TYPES.MANUFACTURED_HOME,
      "manufactured-home-acquisition",
    ],
    ["commercial", ASSET_TYPES.COMMERCIAL, "commercial-acquisition"],
  ])(
    "keeps %s truthful and unavailable for residential readiness",
    (_, assetType, strategyId) => {
      const result = build({ deal: completeDeal({ asset_type: assetType }) });
      const readiness = result.data.metricsById["offer-readiness"];
      const issueLabels = result.data.missingInformationReferences.map(
        (issue) => issue.label
      );
      const recommendationText = [
        result.data.recommendation.label,
        result.data.recommendation.explanation,
      ].join(" ");

      expect(result.success).toBe(true);
      expect(result.data.decisionRecord).toMatchObject({
        assetType,
        assetStrategyIdentifier: strategyId,
      });
      expect(readiness).toMatchObject({
        evaluationState: DECISION_EVALUATION_STATES.UNAVAILABLE,
        value: null,
        displayValue: null,
      });
      expect(issueLabels).not.toEqual(
        expect.arrayContaining([
          "Asking price",
          "Property condition",
          "Repairs needed",
          "ARV / comps",
        ])
      );
      expect(issueLabels).not.toContain(
        result.data.missingInformationReadModel.limitations[0]?.label
      );
      expect(recommendationText).not.toMatch(
        /prepare residential offer|run residential comps|house mao|house arv|residential repair facts/i
      );
      expect(
        result.data.availableActions.find(
          (action) => action.id === "prepare-offer"
        )
      ).toMatchObject({ enabled: false });
      for (const metricId of [
        "pursuit-score",
        "recommendation-confidence",
        "data-completeness",
        "data-reliability",
        "financial-resilience",
        "deal-effort",
        "risk-level",
        "cost-of-delay",
      ]) {
        expect(result.data.metricsById[metricId]).toMatchObject({
          evaluationState:
            metricId === "pursuit-score" &&
            assetType === ASSET_TYPES.VACANT_RESIDENTIAL_LAND
              ? DECISION_EVALUATION_STATES.UNAVAILABLE
              : DECISION_EVALUATION_STATES.NOT_EVALUATED,
          value: null,
          displayValue: null,
        });
      }
    }
  );

  it("integrates a real land Pursuit Score only from complete land strategy facts", () => {
    const result = build({
      now: Date.parse("2026-08-09T12:00:00Z"),
      deal: completeDeal({
        asset_type: ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
        parcel_number: "APN-100",
        legal_access: "documented",
        zoning: "R-1",
        permitted_use: "single family dwelling",
        flood_status: "no",
        wetlands_status: "no",
        taxes_and_liens: "current",
        comparable_land_value: 200000,
        acreage: 5,
        utilities: "available",
        water_sewer_septic: "available",
        road_frontage: "positive",
        builder_demand: "high",
      }),
    });

    expect(result.success).toBe(true);
    expect(result.data.vacantLandStrategyResult).toMatchObject({
      eligible: true,
      strategyVersion: "vacant-land-strategy-v1",
    });
    expect(result.data.vacantLandStrategyResult.pursuitScoreResult.blockingIssueIds).toEqual([]);
    expect(result.data.vacantLandStrategyResult.pursuitScoreResult).toMatchObject({
      evaluationState: expect.stringMatching(/evaluated|partial/),
      score: expect.any(Number),
      scoringProfileId: "vacant-land-pursuit-profile-v1",
      profileVersion: "vacant-land-pursuit-profile-v1",
      ruleset: expect.objectContaining({ rulesetVersion: "vacant-land-pursuit-ruleset-v1" }),
    });
    expect(result.data.metricsById["pursuit-score"].value).toEqual(expect.any(Number));
    expect(result.data.residentialStrategyResult).toBeNull();
    expect(JSON.stringify(result.data.vacantLandStrategyResult)).not.toMatch(
      /after-repair|repair-to-arv|house mao|rental cash flow/i
    );
  });

  it("maps strategy requirements to blocking and advisory issue references", () => {
    const result = build({
      deal: completeDeal({ asking_price: null, property_condition: null }),
    });
    const readiness = result.data.metricsById["offer-readiness"];

    expect(result.data.missingInformationReferences.map((issue) => issue.label)).toEqual(
      expect.arrayContaining(["Asking price", "Property condition"])
    );
    expect(
      result.data.missingInformationReferences.find((issue) => issue.label === "Asking price")
    ).toMatchObject({ severity: "blocking" });
    expect(
      result.data.missingInformationReferences.find((issue) => issue.label === "Property condition")
    ).toMatchObject({ severity: "advisory" });
    expect(readiness.blockingIssueIds.length).toBeGreaterThanOrEqual(1);
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

  it("represents a linked pending approval as a real deterministic recommendation", () => {
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
      deal: completeDeal(),
    });

    expect(result.data.recommendation).toMatchObject({
      label: "Review the pending approval before continuing.",
      status: DECISION_EVALUATION_STATES.COMPATIBILITY_RESULT,
    });
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

  it("returns a partial safe result when asset classification cannot be read", () => {
    const deal = completeDeal();
    Object.defineProperty(deal, "asset_type", {
      get() {
        throw new Error("classification read failed");
      },
    });

    const result = build({ deal });

    expect(result.success).toBe(true);
    expect(result.data.sourceStatus).toBe("partial");
    expect(result.data.decisionRecord.assetType).toBeNull();
    expect(result.data.lifecycle.state).toBe("Verify");
    expect(result.data.sourceWarnings).toContain(
      "Asset classification could not be read from the current CRM record."
    );
    expect(result.data.metricsById["offer-readiness"].value).toBeNull();
  });

  it("returns a partial successful result if one requirement field throws", () => {
    const deal = completeDeal();
    Object.defineProperty(deal, "price", {
      get() {
        throw new Error("service_role secret should never be shown");
      },
    });

    const result = build({ deal });

    expect(result.success).toBe(true);
    expect(result.data.sourceStatus).toBe("partial");
    expect(result.data.metricsById["offer-readiness"]).toMatchObject({
      evaluationState: DECISION_EVALUATION_STATES.UNAVAILABLE,
      value: null,
      displayValue: null,
    });
    expect(result.data.sourceWarnings).toContain(
      "Residential offer readiness could not be evaluated from one or more stored fields."
    );
    expect(JSON.stringify(result)).not.toContain("service_role");
  });

  it("does not move to Verify for an advisory-only missing core fact", () => {
    const result = build({
      deal: completeDeal({
        asset_type: ASSET_TYPES.SMALL_MULTIFAMILY,
        motivation_score: null,
      }),
    });

    expect(result.data.missingInformationReadModel.advisoryItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ requirementId: "seller-motivation" }),
      ])
    );
    expect(result.data.missingInformationReadModel.blockingItems).toEqual([]);
    expect(result.data.lifecycle.state).toBe("Decide");
  });

  it("keeps an urgent seller reply above missing-information actions", () => {
    const result = build({
      conversationSignals: [
        {
          compatibilityKey: "phone:5551112222",
          linkedDealId: "deal-1",
          lastMessageDirection: "inbound",
          lastMessagePreview: "Can you call me?",
          lastMessageTimestamp: "2026-08-05T14:00:00Z",
          organizationId: "org-1",
          tenantId: "tenant-1",
        },
      ],
      deal: completeDeal({ property_condition: null }),
    });

    expect(result.data.lifecycle.state).toBe("Act");
    expect(result.data.recommendation.label).toBe("Respond to the seller reply.");
  });

  it("does not mutate input while mapping an explicit legacy asset field", () => {
    const deal = completeDeal({
      asset_type: undefined,
      property_type: "Vacant land",
    });
    const before = JSON.parse(JSON.stringify(deal));
    const result = build({ deal });

    expect(deal).toEqual(before);
    expect(result.data.decisionRecord.assetType).toBe(
      ASSET_TYPES.VACANT_RESIDENTIAL_LAND
    );
    expect(result.data.decisionRecord.assetStrategyIdentifier).toBe(
      "vacant-land-acquisition"
    );
    expect(result.data.metricsById["offer-readiness"].value).toBeNull();
  });
});
