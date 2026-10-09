import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACTION_AUTHORIZATION, getOperatingScopePolicy, isOperatingActionEligible } from "../operatingScopePolicy";
import { listDeals, saveDealOperatingScope } from "../../repositories/dealRepository";

const state = vi.hoisted(() => ({ record: null, payloads: [], context: { organizationId: "org-1", role: "owner" } }));
const from = vi.hoisted(() => vi.fn());
const fetch = vi.fn(() => { throw new Error("Provider calls are forbidden in persistence tests."); });
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });
vi.mock("../../../supabaseClient", () => ({ supabase: { from } }));
vi.mock("../../organizations", () => ({
  requireActiveOrganizationContext: vi.fn(async () => state.context),
  stripOrganizationOwnership: (payload) => payload,
}));
vi.mock("../../repositories/operationalDiagnosticRepository", () => ({ recordOperationalFailure: vi.fn() }));

beforeEach(() => {
  fetch.mockClear(); vi.stubGlobal("fetch", fetch);
  state.context = { organizationId: "org-1", role: "owner" };
  state.payloads = [];
  state.record = {
    id: "deal-1", organization_id: "org-1", updated_at: "2026-10-09T15:00:00Z",
    operating_scope: "active_acquisition", stage: "New Lead", status: "Unqualified Property Research",
    owner_name: "Unknown seller", asset_type: "residential-home", arv: null, asking_price: null,
    next_action: "Review saved public evidence", due_date: "2026-10-10", research_revision: 9,
    research_evidence: [{ id: "evidence-1", value: "Cached provider evidence" }],
  };
  from.mockReset().mockImplementation(() => {
    let payload = null;
    const filters = [];
    const query = {
      update: vi.fn((value) => { payload = value; state.payloads.push(value); return query; }),
      eq: vi.fn((key, value) => { filters.push([key, value]); return query; }),
      select: vi.fn(() => query), order: vi.fn(() => query),
      range: vi.fn(async () => ({ data: filters.every(([key, value]) => state.record[key] === value) ? [structuredClone(state.record)] : [], error: null })),
      limit: vi.fn(async () => {
        if (!filters.every(([key, value]) => state.record[key] === value)) return { data: [], error: null };
        state.record = { ...state.record, ...payload };
        return { data: [structuredClone(state.record)], error: null };
      }),
    };
    return query;
  });
});

describe("deal operating scope policy and persistence", () => {
  it.each([{}, { operating_scope: null }, { operating_scope: "active_acquisition" }])("preserves legacy/active acquisition eligibility: %j", (deal) => {
    expect(getOperatingScopePolicy(deal)).toMatchObject({ scope: "active_acquisition", supported: true, restricted: false });
    expect(isOperatingActionEligible(deal, ACTION_AUTHORIZATION.ACQUISITION)).toBe(true);
  });

  it("permits only classified research review in research-only scope", () => {
    const deal = { operating_scope: "research_only" };
    expect(isOperatingActionEligible(deal, ACTION_AUTHORIZATION.RESEARCH_REVIEW)).toBe(true);
    expect(isOperatingActionEligible(deal, ACTION_AUTHORIZATION.ACQUISITION)).toBe(false);
    expect(isOperatingActionEligible(deal, ACTION_AUTHORIZATION.UNCLASSIFIED)).toBe(false);
    expect(isOperatingActionEligible(deal, undefined)).toBe(false);
  });

  it.each(["", "invalid", false, {}, []])("fails closed for unsupported scope %j", (scope) => {
    const deal = { operating_scope: scope };
    expect(getOperatingScopePolicy(deal)).toMatchObject({ supported: false, restricted: true });
    expect(isOperatingActionEligible(deal, ACTION_AUTHORIZATION.RESEARCH_REVIEW)).toBe(false);
    expect(isOperatingActionEligible(deal, ACTION_AUTHORIZATION.ACQUISITION)).toBe(false);
  });

  it("saves one field, reloads it through the normal tenant repository, and preserves factual state", async () => {
    const before = structuredClone(state.record);
    const saved = await saveDealOperatingScope(before, "research_only");
    expect(saved.success).toBe(true);
    expect(state.payloads).toEqual([{ operating_scope: "research_only", updated_at: expect.any(String) }]);
    expect(state.payloads[0].updated_at).not.toBe(before.updated_at);
    const reloaded = await listDeals();
    expect(reloaded.data).toEqual([state.record]);
    expect(reloaded.data[0].operating_scope).toBe("research_only");
    const { operating_scope: _scope, updated_at: _updated, ...facts } = reloaded.data[0];
    const { operating_scope: _oldScope, updated_at: _oldUpdated, ...oldFacts } = before;
    expect(facts).toEqual(oldFacts);
    expect((await saveDealOperatingScope(reloaded.data[0], "active_acquisition")).success).toBe(true);
  });

  it("rejects another tenant and non-owner before a write", async () => {
    expect((await saveDealOperatingScope({ ...state.record, organization_id: "org-2" }, "research_only")).success).toBe(false);
    state.context.role = "analyst";
    expect((await saveDealOperatingScope(state.record, "research_only")).success).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("does not reload a deal from another tenant", async () => {
    state.record.organization_id = "org-2";
    expect((await listDeals()).data).toEqual([]);
  });

  it("rejects stale timestamps and changed scope without replacing newer data", async () => {
    const before = structuredClone(state.record);
    state.record.updated_at = "newer-revision";
    expect((await saveDealOperatingScope(before, "research_only")).success).toBe(false);
    expect(state.record.operating_scope).toBe("active_acquisition");
    state.record = { ...before, operating_scope: "research_only" };
    expect((await saveDealOperatingScope(before, "active_acquisition")).success).toBe(false);
    expect(state.record.operating_scope).toBe("research_only");
  });

  it("rejects unsupported saves and records without stale-write identity", async () => {
    expect((await saveDealOperatingScope(state.record, "unsafe")).success).toBe(false);
    expect((await saveDealOperatingScope({ ...state.record, updated_at: null }, "research_only")).success).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });
});
