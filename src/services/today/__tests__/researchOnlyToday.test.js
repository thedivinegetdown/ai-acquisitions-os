import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTodayReadModel } from "../todayService";
vi.mock("../../../supabaseClient", () => ({ supabase: {} }));
const fetch = vi.fn(() => { throw new Error("Provider calls are forbidden in policy tests."); });
beforeEach(() => { fetch.mockClear(); vi.stubGlobal("fetch", fetch); });
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });

const now = Date.parse("2026-10-09T16:00:00Z");
const base = { id: "deal-1", organization_id: "org-1", property_address: "123 Main Street", stage: "New Lead" };
const model = (deal, options = {}) => buildTodayReadModel({ deals: [deal], now, businessTimeZone: "America/New_York", ...options });

describe("Today operating scope eligibility", () => {
  it("preserves implicit and explicit active acquisition contact suggestions", () => {
    const legacy = model(base);
    const active = model({ ...base, operating_scope: "active_acquisition" });
    expect(active.items).toEqual(legacy.items);
    expect(active.items.some((item) => item.recommendedNextAction === "Update seller contact details before outreach.")).toBe(true);
  });

  it.each(["2026-10-02", "2026-10-09", "2026-10-10"])("retains one dated research/validation commitment for %s without seller suggestions", (date) => {
    const next_action = "Continue workflow validation on this saved research lead — no outreach, paid diligence, bidding, or purchase action authorized.";
    const deal = { ...base, operating_scope: "research_only", next_action, next_action_due_date: date, due_date: date };
    const before = structuredClone(deal);
    const result = model(deal);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ summary: next_action, dueDate: date, target: { dealId: "deal-1" } });
    expect(result.items[0].recommendedNextAction).not.toMatch(/seller|call|text|email|paid|bid|offer|purchase|closing/i);
    expect(deal).toEqual(before);
  });

  it("suppresses contact, offer, closing, buyer, and document-procurement suggestions without changing stage/readiness", () => {
    const deal = { ...base, stage: "Under Contract", operating_scope: "research_only", offer_ready: true, lead_score: 10, motivation_score: 10 };
    const before = structuredClone(deal);
    expect(model(deal).items).toEqual([]);
    expect(deal).toEqual(before);
    expect(model({ ...deal, operating_scope: "active_acquisition" }).items.some((item) => item.recommendedNextAction.includes("transaction checklist"))).toBe(true);
  });

  it("suppresses inbound seller response suggestions and converts persisted source actions to read-only review", () => {
    const result = model({ ...base, phone: "5551112222", operating_scope: "research_only" }, {
      conversations: [{ phone: "5551112222", linkedDealId: "deal-1", direction: "inbound", lastMessagePreview: "Call me", lastMessageAt: "2026-10-09T15:00:00Z" }],
      sellerTasks: [{ id: "task-1", deal_id: "deal-1", organization_id: "org-1", title: "Call seller", due_at: "2026-10-09T15:00:00Z", status: "open" }],
      sequenceSteps: [{ id: "step-1", deal_id: "deal-1", action_type: "Send offer", due_date: "2026-10-10", status: "open" }],
    });
    expect(result.items.some((item) => item.type === "seller-reply")).toBe(false);
    expect(result.items).toHaveLength(2);
    expect(result.items.every((item) => !/call|seller|offer/i.test(item.recommendedNextAction))).toBe(true);
  });

  it("does not apply one deal's restrictions to another deal", () => {
    const result = model({ ...base, operating_scope: "research_only" }, {
      deals: [{ ...base, operating_scope: "research_only" }, { ...base, id: "deal-2", organization_id: "org-2", operating_scope: "active_acquisition" }],
    });
    expect(result.items.every((item) => item.target.dealId === "deal-2")).toBe(true);
    expect(result.items.some((item) => item.recommendedNextAction.includes("before outreach"))).toBe(true);
  });

  it("does not bypass restrictions through an unlinked phone-only reply", () => {
    const result = model(base, {
      deals: [{ ...base, id: "active-deal", phone: "5551112222" }, { ...base, operating_scope: "research_only", phone: "5551112222" }],
      conversations: [{ phone: "5551112222", direction: "inbound", lastMessagePreview: "Call me", lastMessageAt: "2026-10-09T15:00:00Z" }],
    });
    expect(result.items.some((item) => item.type === "seller-reply")).toBe(false);
  });

  it("fails closed for unsupported scope while keeping the recorded commitment visible", () => {
    const result = model({ ...base, operating_scope: "unsupported", next_action: "Buy this property", due_date: "2026-10-09" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].summary).toBe("Buy this property");
    expect(result.items[0].recommendedNextAction).toBe("Review the unsupported operating scope before taking action.");
  });
});
