import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  context: { organizationId: "org-1", role: "owner", userId: "user-1" },
  inserts: [],
  queries: [],
  rows: {},
}));

const from = vi.hoisted(() => vi.fn((table) => {
  const operation = { filters: [], mode: "select", table };
  state.queries.push(operation);
  const builder = {
    eq: vi.fn((column, value) => {
      operation.filters.push([column, value]);
      return builder;
    }),
    insert: vi.fn((payload) => {
      operation.mode = "insert";
      operation.payload = payload;
      state.inserts.push({ payload, table });
      return builder;
    }),
    limit: vi.fn(async () => ({ data: operation.mode === "insert" ? state.rows[`${table}:insert`] || [] : state.rows[table] || [], error: null })),
    order: vi.fn(() => builder),
    select: vi.fn(() => builder),
  };
  return builder;
}));

vi.mock("../../../supabaseClient", () => ({ supabase: { from } }));
vi.mock("../../organizations", () => ({
  requireActiveOrganizationContext: vi.fn(async () => state.context),
}));

const currentReadModel = {
  decisionRecord: {
    contractVersion: "decision-contract-v1",
    dealId: "deal-1",
    organizationId: "org-1",
    evaluatedTimestamp: "2026-09-24T12:00:00.000Z",
    recommendation: { recommendationId: "recommendation-1", label: "Prepare offer", status: "evaluated" },
  },
  recalculation: {
    contractVersion: "recommendation-recalculation-v1",
    fingerprints: { facts: "facts-a" },
    state: "recalculated",
  },
  recommendationBasis: { basisType: "offer-readiness" },
};

describe("decisionMemoryRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.context = { organizationId: "org-1", role: "owner", userId: "user-1" };
    state.inserts = [];
    state.queries = [];
    state.rows = {
      decision_recommendation_snapshots: [],
      decision_owner_decisions: [],
      offer_revisions: [],
      deal_closing_revisions: [],
    };
  });

  it("loads a bounded history from only the active tenant and existing lifecycle sources", async () => {
    const { loadDecisionMemoryByDeal } = await import("../decisionMemoryRepository");
    const result = await loadDecisionMemoryByDeal("deal-1");

    expect(result.success).toBe(true);
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "decision_recommendation_snapshots",
      "decision_owner_decisions",
      "offer_revisions",
      "deal_closing_revisions",
    ]);
    state.queries.forEach((query) => {
      expect(query.filters).toContainEqual(["deal_id", "deal-1"]);
      expect(query.filters).toContainEqual(["organization_id", "org-1"]);
    });
  });

  it("appends a meaningful snapshot and leaves unchanged DI-06 output alone", async () => {
    const { appendRecommendationSnapshot } = await import("../decisionMemoryRepository");
    state.rows["decision_recommendation_snapshots:insert"] = [{ id: "snapshot-1" }];
    const deal = { id: "deal-1", organization_id: "org-1" };
    const created = await appendRecommendationSnapshot({ deal, readModel: currentReadModel });
    expect(created).toMatchObject({ success: true, data: { id: "snapshot-1" } });
    expect(state.inserts[0].payload).toMatchObject({
      deal_id: "deal-1",
      organization_id: "org-1",
      actor_reference: "user-1",
    });

    const unchanged = {
      ...currentReadModel,
      recalculation: { ...currentReadModel.recalculation, state: "unchanged" },
    };
    const skipped = await appendRecommendationSnapshot({ deal, readModel: unchanged });
    expect(skipped.success).toBe(true);
    expect(skipped.metadata).toMatchObject({ skipped: true });
    expect(state.inserts).toHaveLength(1);
  });

  it("persists an owner override against the immutable snapshot with actor and reason", async () => {
    const { appendOwnerDecision } = await import("../decisionMemoryRepository");
    state.rows["decision_owner_decisions:insert"] = [{ id: "decision-1", override_flag: true }];
    const result = await appendOwnerDecision({
      alternative: { label: "Review title first" },
      decisionType: "alternative",
      reason: "An unreleased lien needs review.",
      snapshot: { id: "snapshot-1", deal_id: "deal-1", organization_id: "org-1" },
    });
    expect(result.success).toBe(true);
    expect(state.inserts[0]).toMatchObject({
      table: "decision_owner_decisions",
      payload: {
        recommendation_snapshot_id: "snapshot-1",
        override_flag: true,
        reason: "An unreleased lien needs review.",
        actor_reference: "user-1",
      },
    });
    expect(state.queries.every((query) => query.mode !== "update")).toBe(true);
  });

  it("rejects owner decisions for analysts before touching persistence", async () => {
    const { appendOwnerDecision } = await import("../decisionMemoryRepository");
    state.context.role = "analyst";
    const result = await appendOwnerDecision({
      decisionType: "followed",
      snapshot: { id: "snapshot-1", deal_id: "deal-1", organization_id: "org-1" },
    });
    expect(result.success).toBe(false);
    expect(state.inserts).toHaveLength(0);
  });
});
