import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import { assembleDecisionRoomInputs } from "../decisionRoomInputService";

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

describe("stored obligation recommendation safety", () => {
  const obligation = "Obtain professional title update, Winter Garden municipal lien search, and HOA estoppel before setting maximum bid";
  const dealId = "312a97dd-769c-4b93-bc1c-8c40c8c01bd6";
  let providerFetch;

  function fixture(overrides = {}) {
    return completeDeal({
      id: dealId,
      owner_name: null,
      phone: null,
      stage: "New Lead",
      arv: null,
      asking_price: null,
      next_action: obligation,
      due_date: "2026-10-02",
      next_action_due_date: "2026-10-02",
      research_evidence: [{ evidenceId: "retained-evidence", valueSummary: "Title remains unresolved" }],
      latest_offer: null,
      offer_ready: false,
      closing_date: null,
      ...overrides,
    });
  }

  function evaluate(deal, now = "2026-10-09T15:00:00Z", sources = {}) {
    return buildCompatibilityDecisionReadModel(assembleDecisionRoomInputs({ deal, now, ...sources }));
  }

  beforeEach(() => {
    providerFetch = vi.fn(() => { throw new Error("Provider calls are forbidden in recommendation evaluation."); });
    vi.stubGlobal("fetch", providerFetch);
  });

  afterEach(() => {
    expect(providerFetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it.each([
    ["2026-10-09T15:00:00Z", "overdue", "critical", "overdue-action"],
    ["2026-10-02T15:00:00Z", "due", "high", "due-action"],
  ])("uses the stored diligence action and retains urgency at %s", (now, urgency, delay, basis) => {
    const deal = fixture();
    const before = structuredClone(deal);
    const result = evaluate(deal, now);

    expect(result.success).toBe(true);
    expect(result.data.recommendation).toMatchObject({
      actionCode: "needs-review",
      label: `Complete the ${urgency} next action: ${obligation}`,
    });
    expect(result.data.recommendation.explanation).not.toMatch(/seller|outreach|call|text|email/i);
    expect(result.data.recommendationBasis.basisType).toBe(basis);
    expect(result.data.costOfDelayResult.level).toBe(delay);
    expect(result.data.recommendedActionWindowResult.windowType).toBe(urgency === "due" ? "today" : "overdue");
    expect(deal).toEqual(before);
  });

  it("does not infer seller outreach for a future deal obligation", () => {
    const deal = fixture();
    const before = structuredClone(deal);
    const result = evaluate(deal, "2026-10-01T15:00:00Z");

    expect(result.success).toBe(true);
    expect(result.data.recommendation.actionCode).not.toBe("follow-up-seller");
    expect(result.data.recommendation.label).not.toMatch(/follow up with|call|text|email/i);
    expect(result.data.recommendationBasis.basisType).not.toMatch(/due-action/);
    expect(deal).toEqual(before);
  });

  it.each([null, "", "   ", "Unknown", 42])("uses neutral review for an overdue date with unusable action %j", (next_action) => {
    const deal = fixture({ next_action });
    const before = structuredClone(deal);
    const result = evaluate(deal);

    expect(result.success).toBe(true);
    expect(result.data.recommendation).toMatchObject({
      actionCode: "needs-review",
      label: "Review and update the overdue commitment.",
    });
    expect(result.data.recommendationConfidenceResult.level).toBe("high");
    expect(deal).toEqual(before);
  });

  it("uses neutral review for a due-today commitment without action text", () => {
    const result = evaluate(fixture({ next_action: null }), "2026-10-02T15:00:00Z");

    expect(result.data.recommendation).toMatchObject({
      actionCode: "needs-review", label: "Review and update the due commitment.",
    });
    expect(result.data.recommendedActionWindowResult.windowType).toBe("today");
  });

  it("preserves existing deal due-date precedence over the next-action date", () => {
    const result = evaluate(fixture({ due_date: "2026-10-09", next_action_due_date: "2026-10-10" }));

    expect(result.data.recommendation.label).toBe(`Complete the due next action: ${obligation}`);
    expect(result.data.recommendedActionWindowResult.sourceDueTimestamp).toBe("2026-10-09T00:00:00.000Z");
  });

  it.each(["sellerTasks", "sequenceSteps"])("retains explicit stored seller follow-up from %s", (source) => {
    const deal = fixture({ due_date: null, next_action_due_date: null });
    const action = "Follow up with the seller about the signed disclosure";
    const record = { id: "follow-up-1", deal_id: dealId, organization_id: "org-1", status: "pending",
      ...(source === "sellerTasks" ? { title: action, due_at: "2026-10-02T12:00:00Z" }
        : { action_type: action, due_date: "2026-10-02" }) };
    const sources = { [source]: [record] };
    const before = structuredClone({ deal, sources });
    const result = evaluate(deal, undefined, sources);

    expect(result.success).toBe(true);
    expect(result.data.recommendation.label).toBe(`Complete the due action: ${action}`);
    expect(result.data.recommendationBasis.basisType).toBe("due-action");
    expect({ deal, sources }).toEqual(before);
  });

  it("does not turn a non-contact seller task into seller outreach", () => {
    const result = evaluate(fixture({ due_date: null, next_action_due_date: null }), undefined, {
      sellerTasks: [{ id: "title-review", deal_id: dealId, title: "Review the saved title report", due_at: "2026-10-02", status: "open" }],
    });

    expect(result.data.recommendation).toMatchObject({
      actionCode: "needs-review", label: "Complete the due action: Review the saved title report",
    });
  });

  it("keeps neutral due-work review evaluated when asset strategy is unavailable", () => {
    const result = evaluate(fixture({ asset_type: "unknown", next_action: null }));

    expect(result.data.recommendation).toMatchObject({
      actionCode: "needs-review", label: "Review and update the overdue commitment.",
      status: DECISION_EVALUATION_STATES.COMPATIBILITY_RESULT,
    });
  });

  it("preserves overdue deal precedence over an earlier seller task", () => {
    const result = evaluate(fixture(), undefined, { sellerTasks: [{
      id: "seller-follow-up", deal_id: dealId, title: "Call the seller", due_at: "2026-10-01", status: "open",
    }] });

    expect(result.data.recommendation.label).toBe(`Complete the overdue next action: ${obligation}`);
    expect(result.data.recommendationBasis.basisType).toBe("overdue-action");
  });

  it("preserves earliest due work and seller-task/sequence/deal input order for ties", () => {
    const deal = fixture({ due_date: "2026-10-09", next_action_due_date: "2026-10-09" });
    const sellerTask = { id: "seller-task", deal_id: dealId, title: "Call the seller", due_at: "2026-10-09", status: "open" };
    const sequence = { id: "sequence-step", deal_id: dealId, action_type: "Email the seller", due_date: "2026-10-09", status: "pending" };
    const tied = evaluate(deal, undefined, { sellerTasks: [sellerTask], sequenceSteps: [sequence] });
    const earlier = evaluate(deal, undefined, { sellerTasks: [sellerTask], sequenceSteps: [{ ...sequence, due_date: "2026-10-08" }] });
    const withoutTask = evaluate(deal, undefined, { sequenceSteps: [sequence] });
    const completedTask = evaluate(deal, undefined, { sellerTasks: [{ ...sellerTask, status: "completed" }], sequenceSteps: [sequence] });

    expect(tied.data.recommendation.label).toBe("Complete the due action: Call the seller");
    expect(earlier.data.recommendation.label).toBe("Complete the due action: Email the seller");
    expect(withoutTask.data.recommendation.label).toBe("Complete the due action: Email the seller");
    expect(completedTask.data.recommendation.label).toBe("Complete the due action: Email the seller");
  });

  it("refreshes action semantics when only the saved next action changes", () => {
    const deal = fixture();
    const first = build({ deal, now: "2026-10-09T15:00:00Z" });
    const result = build({ deal: { ...deal, next_action: "Review the saved title report" }, now: "2026-10-09T15:00:00Z",
      previousRecalculation: first.data.recalculation });

    expect(result.data.recalculation.state).toBe("recalculated");
    expect(result.data.recommendation.label).toBe("Complete the overdue next action: Review the saved title report");
  });
});

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
    expect(due.data.costOfDelayResult).toMatchObject({ level: "high" });
    expect(due.data.recommendedActionWindowResult).toMatchObject({
      windowType: "today",
      sourceDueTimestamp: "2026-08-05T00:00:00.000Z",
    });
    expect(sellerReply.data.costOfDelayResult).toMatchObject({ level: "high" });
    expect(sellerReply.data.recommendedActionWindowResult).toMatchObject({
      windowType: "act-now",
      sourceDueTimestamp: null,
      sourceEventTimestamp: "2026-08-05T14:00:00.000Z",
    });
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

  it("wraps the existing deterministic next-action behavior with canonical confidence and no AI", () => {
    const result = build({ deal: completeDeal({ due_date: "2026-08-01" }) });
    const recommendation = result.data.recommendation;

    expect(recommendation.label).toBe(
      "Review and update the overdue commitment."
    );
    expect(recommendation.status).toBe(DECISION_EVALUATION_STATES.COMPATIBILITY_RESULT);
    expect(recommendation.sourceMode).toBe(
      DECISION_SOURCE_MODES.DETERMINISTIC_COMPATIBILITY
    );
    expect(recommendation.rulesetVersion).toBe(COMPATIBILITY_DECISION_RULESET_VERSION);
    expect(recommendation.confidenceReference).toBe(
      result.data.recommendationConfidenceResult.confidenceId
    );
    expect(result.data.recommendationBasis.basisType).toBe("overdue-action");
    expect(result.data.recommendationConfidenceResult.level).toBe("high");
    expect(result.data.costOfDelayResult.level).toBe("critical");
    expect(result.data.recommendedActionWindowResult.windowType).toBe("overdue");
    expect(JSON.stringify(recommendation).toLowerCase()).not.toContain("ai recommendation");
  });

  it("keeps canonical readiness independent while integrating production Pursuit Score", () => {
    const result = build({ deal: completeDeal() });
    const readiness = result.data.metricsById["offer-readiness"];

    expect(readiness.evaluationState).toBe(
      DECISION_EVALUATION_STATES.EVALUATED
    );
    expect(readiness.value).toBe("ready-for-offer-preparation");
    expect(readiness.displayValue).toBe("Ready for Offer Preparation");
    expect(readiness.unit).toBe("readiness-state");
    expect(readiness.scale).toBeNull();
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
    expect(result.data.metricsById["recommendation-confidence"]).toMatchObject({
      evaluationState: DECISION_EVALUATION_STATES.EVALUATED,
      value: "low",
      unit: "confidence-level",
      scale: null,
    });
    expect(result.data.metricsById["data-reliability"]).toMatchObject({
      evaluationState: DECISION_EVALUATION_STATES.EVALUATED,
      value: "limited",
      unit: "reliability-grade",
      scale: null,
    });
    for (const id of [
      "data-completeness",
      "financial-resilience",
      "deal-effort",
      "risk-level",
    ]) {
      expect(result.data.metricsById[id]).toMatchObject({
        evaluationState: DECISION_EVALUATION_STATES.NOT_EVALUATED,
        value: null,
        displayValue: null,
      });
    }
    expect(result.data.metricsById["cost-of-delay"]).toMatchObject({
      evaluationState: DECISION_EVALUATION_STATES.EVALUATED,
      value: "high",
      unit: "delay-impact",
      scale: null,
    });
    expect(result.data.metricsById["recommended-action-window"]).toMatchObject({
      evaluationState: DECISION_EVALUATION_STATES.EVALUATED,
      value: "today",
      unit: "action-window",
      scale: null,
    });
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
    expect(result.data.costOfDelayResult.level).toBe(baseline.data.costOfDelayResult.level);
    expect(result.data.recommendedActionWindowResult.windowType).toBe(
      baseline.data.recommendedActionWindowResult.windowType
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
    expect(result.data.metricsById["recommendation-confidence"].value).toBe("low");
    expect(result.data.metricsById["data-reliability"].value).toBe("limited");
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
    expect(due.data.recommendation.label).toBe("Review and update the due commitment.");
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

  it("uses canonical vacant-land readiness without residential requirements", () => {
    const result = build({
      deal: completeDeal({ asset_type: ASSET_TYPES.VACANT_RESIDENTIAL_LAND }),
    });
    const readiness = result.data.metricsById["offer-readiness"];

    expect(readiness).toMatchObject({
      evaluationState: DECISION_EVALUATION_STATES.EVALUATED,
      value: "needs-information",
      displayValue: "Needs Information",
    });
    expect(result.data.missingInformationReferences.map((issue) => issue.label)).not.toEqual(
      expect.arrayContaining(["Property condition", "Repairs needed", "ARV / comps"])
    );
  });

  it.each([
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
    "keeps %s truthful and unavailable for canonical readiness",
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
        "data-completeness",
        "financial-resilience",
        "deal-effort",
        "risk-level",
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
      expect(result.data.metricsById["cost-of-delay"]).toMatchObject({
        evaluationState: DECISION_EVALUATION_STATES.EVALUATED,
        value: "low",
      });
      expect(result.data.metricsById["recommendation-confidence"]).toMatchObject({
        evaluationState: DECISION_EVALUATION_STATES.EVALUATED,
        value: "low",
      });
      expect(result.data.metricsById["data-reliability"].value).toEqual(
        expect.stringMatching(/limited|moderate/)
      );
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
    expect(readiness.advisoryIssueIds).toContain("residential-advisory-signals");
  });

  it("uses canonical timing categories while preserving a real source due date", () => {
    const withDueDate = build({ deal: completeDeal({ due_date: "2026-08-06" }) });
    const withoutDueDate = build({ deal: completeDeal() });

    expect(withDueDate.data.metricsById["recommended-action-window"]).toMatchObject({
      evaluationState: DECISION_EVALUATION_STATES.EVALUATED,
      value: "today",
      displayValue: "Today",
    });
    expect(withDueDate.data.recommendedActionWindowResult.sourceDueTimestamp).toBe(
      "2026-08-06T00:00:00.000Z"
    );
    expect(withDueDate.data.recommendation.actionWindow.dueTimestamp).toBeNull();
    expect(withoutDueDate.data.metricsById["recommended-action-window"]).toMatchObject({
      evaluationState: DECISION_EVALUATION_STATES.EVALUATED,
      value: "today",
    });
    expect(withoutDueDate.data.recommendation.actionWindow.dueTimestamp).toBeNull();
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

  it("exposes canonical Evidence coverage, traceability, reliability, and confidence", () => {
    const result = build({ deal: completeDeal() });
    expect(result.data.evidenceRegistry.contractVersion).toBe("evidence-provenance-contract-v1");
    expect(result.data.evidenceCoverage.counts.representedFields).toBeGreaterThan(0);
    expect(result.data.evidenceLineage.outputs.map((output) => output.outputId)).toEqual(
      expect.arrayContaining(["residential-underwriting", "pursuit-score", "offer-readiness"])
    );
    expect(result.data.recommendationTraceability).toMatchObject({ rulesetVersion: COMPATIBILITY_DECISION_RULESET_VERSION });
    expect(result.data.metricsById["data-reliability"].value).toBe("limited");
    expect(result.data.metricsById["recommendation-confidence"].value).toBe("low");
    expect(result.data.recommendationTraceability.basisType).toBe(
      "residential-strategy-guidance"
    );
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
    expect(result.data.metricsById["offer-readiness"]).toMatchObject({
      evaluationState: DECISION_EVALUATION_STATES.UNAVAILABLE,
      value: null,
    });
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
      evaluationState: DECISION_EVALUATION_STATES.EVALUATED,
      value: "ready-for-offer-preparation",
    });
    expect(result.data.sourceWarnings.some((warning) => /could not be read/i.test(warning))).toBe(true);
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
    expect(result.data.recommendationBasis.basisType).toBe("seller-reply");
    expect(result.data.metricsById["recommendation-confidence"].value).toBe("high");
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
    expect(result.data.metricsById["offer-readiness"]).toMatchObject({
      evaluationState: DECISION_EVALUATION_STATES.EVALUATED,
      value: "needs-information",
    });
  });

  it("routes a detected Residential ARV conflict through every decision safety layer", () => {
    const result = build({ deal: completeDeal({ after_repair_value: 195000 }) });
    const conflict = result.data.conflictReadModel.conflicts.find(
      (entry) => entry.canonicalField === "property.afterRepairValue"
    );
    const item = result.data.missingInformationReadModel.openItems.find(
      (entry) => entry.canonicalField === "property.afterRepairValue"
    );

    expect(conflict).toMatchObject({ blocking: true, state: "review-required" });
    expect(item).toMatchObject({ state: "conflicting", conflictIds: [conflict.conflictId] });
    expect(result.data.missingInformationReadModel.highestPriorityAction.actionType).toBe("review-conflict");
    expect(result.data.residentialStrategyResult.factReadModel.factsById["after-repair-value"]).toMatchObject({
      state: "conflicting",
      conflictIds: [conflict.conflictId],
    });
    expect(result.data.metricsById["pursuit-score"].value).toBeNull();
    expect(result.data.metricsById["offer-readiness"].value).toBe("needs-verification");
    expect(result.data.lifecycle.state).toBe("Verify");
    expect(result.data.dataReliabilityResult.grade).toBe("limited");
    expect(result.data.recommendationBasis).toMatchObject({
      basisType: "conflict-review",
      conflictIds: [conflict.conflictId],
    });
    expect(result.data.recommendationConfidenceResult.level).toBe("high");
  });

  it("routes a detected Vacant Land legal-access conflict without residential fallback", () => {
    const result = build({
      now: Date.parse("2026-08-09T12:00:00Z"),
      deal: completeDeal({
        asset_type: ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
        parcel_number: "APN-100",
        legal_access: "documented",
        access_status: "no",
        zoning: "R-1",
        permitted_use: "single family dwelling",
        flood_status: "no",
        wetlands_status: "no",
        taxes_and_liens: "current",
        comparable_land_value: 200000,
      }),
    });
    const conflict = result.data.conflictReadModel.conflicts.find(
      (entry) => entry.canonicalField === "property.legalAccess"
    );

    expect(conflict).toMatchObject({ blocking: true });
    expect(result.data.vacantLandStrategyResult.factReadModel.factsById["legal-access"]).toMatchObject({ state: "conflicting" });
    expect(result.data.metricsById["pursuit-score"].value).toBeNull();
    expect(result.data.metricsById["offer-readiness"].value).toBe("needs-verification");
    expect(result.data.residentialStrategyResult).toBeNull();
    expect(result.data.dataReliabilityResult.grade).toBe("limited");
    expect(result.data.recommendationConfidenceResult.level).toBe("high");
  });

  it("omits an optional conflicted scoring input without forcing Verify by itself", () => {
    const result = build({
      deal: completeDeal({ mortgage_balance: 50000, loan_balance: 90000 }),
    });
    const conflict = result.data.conflictReadModel.conflicts.find(
      (entry) => entry.canonicalField === "property.mortgageBalance"
    );

    expect(conflict).toMatchObject({ blocking: false });
    expect(result.data.lifecycle.state).toBe("Decide");
    expect(result.data.residentialStrategyResult.pursuitScoreResult.evaluationState).toBe("partial");
  });

  it("preserves DI-04R mixed-state aggregation while prioritizing conflict review", () => {
    const result = build({
      deal: completeDeal({ property_condition: null, after_repair_value: 195000 }),
    });

    expect(result.data.readinessResult.readinessState).toBe("needs-information");
    expect(result.data.readinessResult.recommendedNextAction.actionType).toBe("verify-information");
    expect(result.data.recommendationBasis.basisType).toBe("conflict-review");
    expect(result.data.recommendationConfidenceResult.level).toBe("high");
  });

  it("keeps a real seller reply ahead of detected conflict work", () => {
    const result = build({
      conversationSignals: [{
        compatibilityKey: "phone:5551112222",
        linkedDealId: "deal-1",
        lastMessageDirection: "inbound",
        lastMessagePreview: "Please call me.",
        lastMessageTimestamp: "2026-08-05T14:00:00Z",
        organizationId: "org-1",
        tenantId: "tenant-1",
      }],
      deal: completeDeal({ after_repair_value: 195000 }),
    });

    expect(result.data.recommendation.label).toBe("Respond to the seller reply.");
    expect(result.data.recommendationBasis.basisType).toBe("seller-reply");
    expect(result.data.recommendationConfidenceResult.level).toBe("high");
  });

  it("preserves an explicit resolution without rewriting disagreeing CRM aliases", () => {
    const deal = completeDeal({ after_repair_value: 195000 });
    const before = JSON.parse(JSON.stringify(deal));
    const conflictId = "conflict:deal:deal-1:field:property.afterRepairValue";
    const result = build({
      conflictResolutions: [{
        resolutionId: "resolution-1",
        conflictId,
        status: "resolved",
        selectedCandidateId: "candidate-reviewed",
        actorReference: "user-1",
        reason: "Reviewed stored market evidence.",
        decidedTimestamp: "2026-08-09T12:00:00Z",
      }],
      deal,
    });

    expect(result.data.conflictReadModel.resolvedConflicts[0]).toMatchObject({
      conflictId,
      state: "resolved",
      explicitResolutionReference: expect.objectContaining({ actorReference: "user-1" }),
    });
    expect(result.data.conflictReferences).toEqual([]);
    expect(deal).toEqual(before);
  });
});
