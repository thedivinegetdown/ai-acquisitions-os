import { describe, expect, it } from "vitest";
import { buildOwnerOperatingReport } from "../ownerOperatingReportService";

const ORG = "org-a";
const NOW = "2026-09-23T16:00:00.000Z";
const BUSINESS_TIME_ZONE = "America/Chicago";

function owned(record = {}) {
  return {
    organization_id: ORG,
    created_at: "2026-09-01T12:00:00.000Z",
    ...record,
  };
}

function sources(overrides = {}) {
  return {
    deals: [],
    sellerTasks: [],
    sequenceSteps: [],
    offerRevisions: [],
    closingRevisions: [],
    messages: [],
    ...overrides,
  };
}

function report(sourceOverrides = {}, options = {}) {
  return buildOwnerOperatingReport({
    businessTimeZone: options.businessTimeZone || BUSINESS_TIME_ZONE,
    organizationId: ORG,
    evaluatedAt: options.evaluatedAt || NOW,
    sources: sources(sourceOverrides),
  });
}

describe("buildOwnerOperatingReport", () => {
  it.each([
    ["2026-10-01T17:00:00.000Z", { due: 0, overdue: 0, waiting: 1 }],
    ["2026-10-02T17:00:00.000Z", { due: 1, overdue: 0, waiting: 0 }],
    ["2026-10-03T17:00:00.000Z", { due: 0, overdue: 1, waiting: 0 }],
    ["2026-10-02T03:30:00.000Z", { due: 0, overdue: 0, waiting: 1 }],
  ])("classifies a date-only deal commitment by the organization business date at %s", (evaluatedAt, expected) => {
    const result = report({
      deals: [owned({
        id: "312a97dd-769c-4b93-bc1c-8c40c8c01bd6",
        stage: "New Lead",
        next_action: "Run property research",
        next_action_due_date: "2026-10-02",
      })],
    }, { evaluatedAt });

    expect(result.work.due.value).toBe(expected.due);
    expect(result.work.overdue.value).toBe(expected.overdue);
    expect(result.work.waiting.value).toBe(expected.waiting);
  });

  it("does not apply date-only business-zone conversion to timestamp commitments", () => {
    const result = report({
      sellerTasks: [owned({
        id: "timestamp-task",
        due_at: "2026-10-02T12:00:00.000Z",
        status: "open",
      })],
    }, { evaluatedAt: "2026-10-02T03:30:00.000Z" });

    expect(result.work).toMatchObject({
      due: { value: 1 },
      overdue: { value: 0 },
      waiting: { value: 0 },
    });
  });

  it("counts only active tenant-owned deal actions as waiting or overdue by calendar date", () => {
    const action = "Run one RentCast property research lookup and compare it with OCPA/tax-sale facts";
    const result = report({
      deals: [
        owned({ id: "312a97dd-769c-4b93-bc1c-8c40c8c01bd6", stage: "New Lead", next_action: action, next_action_due_date: "2026-10-02" }),
        owned({ id: "late", stage: "Contacted", next_action: "Review title", next_action_due_date: "2026-09-30" }),
        owned({ id: "cleared", stage: "New Lead", next_action: null, next_action_due_date: "2026-10-02" }),
        owned({ id: "completed", stage: "New Lead", status: "Completed", next_action: "Finished", next_action_due_date: "2026-10-02" }),
        owned({ id: "closed", stage: "Closed", next_action: "Old action", next_action_due_date: "2026-10-02" }),
        owned({ id: "foreign", organization_id: "org-b", stage: "New Lead", next_action: "Foreign action", next_action_due_date: "2026-10-02" }),
      ],
    }, { evaluatedAt: "2026-10-01T12:00:00.000Z" });

    expect(result.work).toMatchObject({
      due: { status: "available", value: 0 },
      overdue: { status: "available", value: 1 },
      waiting: { status: "available", value: 1 },
    });
    expect(result.funnel.qualifiedOpportunities.status).toBe("unavailable");
    expect(result.financial.expectedProceeds.value).toBe(0);
  });

  it("dedupes the same open obligation across deals, seller tasks, and sequences", () => {
    const action = "Run one RentCast property research lookup and compare it with OCPA/tax-sale facts";
    const dealId = "312a97dd-769c-4b93-bc1c-8c40c8c01bd6";
    const result = report({
      deals: [owned({ id: dealId, stage: "New Lead", next_action: action, next_action_due_date: "2026-10-02" })],
      sellerTasks: [
        owned({ id: "same-task", deal_id: dealId, title: action, status: "open", due_at: "2026-10-02T12:00:00.000Z" }),
        owned({ id: "other-task", deal_id: dealId, title: "Call seller", status: "open", due_at: "2026-10-02T12:00:00.000Z" }),
        owned({ id: "done-task", deal_id: dealId, title: "Finished task", status: "completed", due_at: "2026-09-30T12:00:00.000Z" }),
      ],
      sequenceSteps: [
        owned({ id: "same-step", deal_id: dealId, action_type: action, status: "Pending", due_date: "2026-10-02" }),
        owned({ id: "late-step", deal_id: dealId, action_type: "Review documents", status: "Pending", due_date: "2026-09-30" }),
      ],
    }, { evaluatedAt: "2026-10-01T12:00:00.000Z" });

    expect(result.work).toMatchObject({
      waiting: { status: "available", value: 2 },
      overdue: { status: "available", value: 1 },
      completed: { status: "available", value: 1 },
    });
  });

  it("classifies due, overdue, completed, and waiting work at the supplied time", () => {
    const result = report({
      sellerTasks: [
        owned({ id: "due", status: "open", due_at: "2026-09-23T12:00:00Z" }),
        owned({ id: "late", status: "open", due_at: "2026-09-22T12:00:00Z" }),
        owned({ id: "done", status: "completed", due_at: "2026-09-20T12:00:00Z" }),
        owned({ id: "cancelled", status: "cancelled", due_at: "2026-09-23T12:00:00Z" }),
      ],
      sequenceSteps: [
        owned({ id: "future", status: "Pending", due_date: "2026-09-25" }),
        owned({ id: "sequence-done", status: "Completed", due_date: "2026-09-21" }),
      ],
    });

    expect(result.work).toMatchObject({
      due: { status: "available", value: 1 },
      overdue: { status: "available", value: 1 },
      completed: { status: "available", value: 2 },
      waiting: { status: "available", value: 1 },
    });
  });

  it("counts lifecycle milestones once per deal instead of once per revision", () => {
    const result = report({
      offerRevisions: [
        owned({ id: "o1", deal_id: "deal-1", revision_number: 1, status: "draft" }),
        owned({ id: "o2", deal_id: "deal-1", revision_number: 2, status: "sent" }),
        owned({ id: "o3", deal_id: "deal-1", revision_number: 3, status: "countered" }),
        owned({ id: "o4", deal_id: "deal-1", revision_number: 4, status: "sent" }),
        owned({ id: "o5", deal_id: "deal-1", revision_number: 5, status: "accepted" }),
      ],
    });

    expect(result.funnel.offersCreated.value).toBe(1);
    expect(result.funnel.offersSent.value).toBe(1);
    expect(result.funnel.acceptedOffers.value).toBe(1);
  });

  it("classifies accepted, closed, and current cancelled or lost outcomes explicitly", () => {
    const result = report({
      offerRevisions: [
        owned({ id: "a1", deal_id: "accepted", revision_number: 1, status: "sent" }),
        owned({ id: "a2", deal_id: "accepted", revision_number: 2, status: "accepted" }),
        owned({ id: "l1", deal_id: "lost", revision_number: 1, status: "sent" }),
        owned({ id: "l2", deal_id: "lost", revision_number: 2, status: "rejected" }),
        owned({ id: "c1", deal_id: "cancelled", revision_number: 1, status: "accepted" }),
      ],
      closingRevisions: [
        owned({ id: "close-1", deal_id: "accepted", revision_number: 1, status: "under_contract" }),
        owned({ id: "close-2", deal_id: "accepted", revision_number: 2, status: "closed" }),
        owned({ id: "cancel-1", deal_id: "cancelled", revision_number: 1, status: "under_contract" }),
        owned({ id: "cancel-2", deal_id: "cancelled", revision_number: 2, status: "cancelled" }),
      ],
    });

    expect(result.funnel.acceptedOffers.value).toBe(2);
    expect(result.funnel.contracts.value).toBe(2);
    expect(result.funnel.closed.value).toBe(1);
    expect(result.funnel.cancelledLost.value).toBe(2);
  });

  it("uses latest active projections and calculates realized net contribution from closed actuals", () => {
    const result = report({
      closingRevisions: [
        owned({
          id: "projection-1",
          deal_id: "active",
          revision_number: 1,
          status: "under_contract",
          expected_proceeds: 18000,
        }),
        owned({
          id: "projection-2",
          deal_id: "active",
          revision_number: 2,
          status: "under_contract",
          expected_proceeds: 22000,
        }),
        owned({
          id: "closed",
          deal_id: "closed",
          revision_number: 2,
          status: "closed",
          expected_proceeds: 40000,
          actual_realized_proceeds: 50000,
          actual_costs: 12000,
        }),
        owned({
          id: "cancelled",
          deal_id: "cancelled",
          revision_number: 2,
          status: "cancelled",
          expected_proceeds: 999999,
          actual_realized_proceeds: 999999,
          actual_costs: 1,
        }),
      ],
    });

    expect(result.financial.expectedProceeds.value).toBe(22000);
    expect(result.financial.realizedProceeds.value).toBe(50000);
    expect(result.financial.realizedCosts.value).toBe(12000);
    expect(result.financial.realizedNetContribution.value).toBe(38000);
  });

  it("keeps unknown financial inputs unavailable instead of converting them to zero", () => {
    const result = report({
      closingRevisions: [
        owned({
          id: "active",
          deal_id: "active",
          revision_number: 1,
          status: "under_contract",
          assignment_fee: null,
          expected_proceeds: null,
        }),
        owned({
          id: "closed",
          deal_id: "closed",
          revision_number: 1,
          status: "closed",
          actual_realized_proceeds: null,
          actual_costs: 5000,
        }),
      ],
    });

    expect(result.financial.expectedProceeds).toMatchObject({ status: "unavailable", value: null });
    expect(result.financial.realizedProceeds).toMatchObject({ status: "unavailable", value: null });
    expect(result.financial.realizedNetContribution).toMatchObject({ status: "unavailable", value: null });
    expect(result.financial.realizedCosts.value).toBe(5000);
  });

  it("strictly excludes records belonging to another tenant", () => {
    const result = report({
      deals: [
        owned({ id: "ours", stage: "Contacted" }),
        owned({ id: "theirs", organization_id: "org-b", stage: "Contacted" }),
      ],
      offerRevisions: [
        owned({ id: "ours-offer", deal_id: "ours", revision_number: 1, status: "sent" }),
        owned({ id: "their-offer", organization_id: "org-b", deal_id: "theirs", revision_number: 1, status: "sent" }),
      ],
    });

    expect(result.funnel.opportunities.value).toBe(1);
    expect(result.funnel.activeOpportunities.value).toBe(1);
    expect(result.funnel.offersCreated.value).toBe(1);
  });

  it("uses the supplied evaluation time for due work and outstanding follow-up age", () => {
    const inputs = {
      sellerTasks: [owned({ id: "task", status: "open", due_at: "2026-09-24T12:00:00Z" })],
      messages: [
        owned({ id: "inbound", deal_id: "deal-1", direction: "inbound", created_at: "2026-09-23T12:00:00Z" }),
      ],
    };
    const first = report(inputs, { evaluatedAt: "2026-09-23T16:00:00Z" });
    const second = report(inputs, { evaluatedAt: "2026-09-24T18:00:00Z" });

    expect(first.work.waiting.value).toBe(1);
    expect(first.work.due.value).toBe(0);
    expect(first.responsiveness.oldestAwaitingTeamFollowUpHours.value).toBe(4);
    expect(second.work.waiting.value).toBe(0);
    expect(second.work.due.value).toBe(1);
    expect(second.responsiveness.oldestAwaitingTeamFollowUpHours.value).toBe(30);
  });

  it("measures only durable response pairs and marks absent timing data unavailable", () => {
    const result = report({
      messages: [
        owned({ id: "out-1", deal_id: "deal-1", direction: "outbound", created_at: "2026-09-23T08:00:00Z" }),
        owned({ id: "in-1", deal_id: "deal-1", direction: "inbound", created_at: "2026-09-23T10:00:00Z" }),
        owned({ id: "out-2", deal_id: "deal-1", direction: "outbound", created_at: "2026-09-23T13:00:00Z" }),
        owned({ id: "undirected", deal_id: "deal-1", direction: null, created_at: "2026-09-23T14:00:00Z" }),
      ],
    });

    expect(result.responsiveness.averageSellerResponseHours).toMatchObject({ value: 2, sampleSize: 1 });
    expect(result.responsiveness.averageTeamFollowUpHours).toMatchObject({ value: 3, sampleSize: 1 });
    expect(result.responsiveness.awaitingTeamFollowUp.value).toBe(0);
    expect(result.responsiveness.oldestAwaitingTeamFollowUpHours.status).toBe("unavailable");
  });

  it("is deterministic for identical source data and evaluation time", () => {
    const inputs = {
      deals: [owned({ id: "deal-1", stage: "New Lead" })],
      sellerTasks: [owned({ id: "task-1", status: "open", due_at: "2026-09-23T12:00:00Z" })],
    };

    expect(report(inputs)).toEqual(report(inputs));
  });

  it("reports qualification as unavailable with the smallest future capture requirement", () => {
    const result = report();

    expect(result.funnel.qualifiedOpportunities.status).toBe("unavailable");
    expect(result.unavailableFacts[0]).toMatchObject({
      metric: "Qualified opportunities",
      missingFact: expect.stringContaining("qualification decision"),
      futureCapture: expect.stringContaining("qualification lifecycle event"),
    });
  });
});
