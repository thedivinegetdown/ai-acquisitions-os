import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCompatibilityDecisionReadModel } from "../compatibilityDecisionService";
vi.mock("../../../supabaseClient", () => ({ supabase: {} }));
const fetch = vi.fn(() => { throw new Error("Provider calls are forbidden in policy tests."); });
beforeEach(() => { fetch.mockClear(); vi.stubGlobal("fetch", fetch); });
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });

const now = "2026-10-09T16:00:00Z";
const base = {
  id: "deal-1", organization_id: "org-1", asset_type: "residential-home",
  property_address: "123 Main Street", stage: "New Lead", status: "Unqualified Property Research",
};
const complete = {
  ...base, owner_name: "Actual seller", phone: "5551112222", asking_price: 120000,
  property_condition: "Needs repairs", motivation_score: 8, seller_timeline: "Within 30 days",
  mortgage_status: "Current", repairs_needed: 25000, occupancy_status: "Vacant", arv: 210000,
};
const build = (deal, options = {}) => buildCompatibilityDecisionReadModel({ deal, now, ...options }).data;

describe("research-only recommendation eligibility", () => {
  it("preserves implicit and explicit active acquisition behavior", () => {
    const legacy = build(base);
    const active = build({ ...base, operating_scope: "active_acquisition" });
    expect(active.recommendation).toEqual(legacy.recommendation);
    expect(legacy.recommendation.label).toBe("Open seller");
  });

  it("keeps missing seller facts blocking while suppressing seller CTAs and leaving inputs unchanged", () => {
    const deal = { ...base, operating_scope: "research_only", research_evidence: [{ evidenceId: "e-1", fact: "Public record" }] };
    const before = structuredClone(deal);
    const result = build(deal);
    const seller = result.missingInformationReadModel.allItems.find((item) => item.requirementId === "seller-identity");
    expect(seller).toMatchObject({ state: "missing", blocking: true });
    expect(seller.availableActions.every((action) => !action.enabled)).toBe(true);
    const sellerRequirements = new Set(["seller-identity", "seller-contact-method", "seller-target-price", "seller-motivation", "seller-timeline"]);
    for (const item of result.missingInformationReadModel.openItems.filter((item) => sellerRequirements.has(item.requirementId))) {
      expect(item.availableActions.every((action) => !action.enabled)).toBe(true);
    }
    expect(result.recommendation.label).not.toMatch(/Open seller|contact|ask.*price|call|text|email|title|HOA|municipal|bid|offer|purchase|closing/i);
    expect(deal).toEqual(before);
    expect(result.recommendationBasis.relatedCanonicalFields).toContain("deal.operatingScope");
    expect(result.recommendation.evidenceReferenceIds.every((id) => result.evidenceReferences.some((entry) => entry.evidenceId === id))).toBe(true);
  });

  it("retains safe classification review", () => {
    const result = build({ ...base, asset_type: null, operating_scope: "research_only" });
    expect(result.recommendation.label).toBe("Review asset classification source");
  });

  it("permits only existing-evidence review in place of manual research procurement guidance", () => {
    const result = build({ ...base, asset_type: "vacant-residential-land", operating_scope: "research_only" });
    const researchActions = result.missingInformationReadModel.openItems.flatMap((item) => item.availableActions).filter((action) => action.enabled);
    expect(researchActions.some((action) => action.label.startsWith("Review stored evidence:"))).toBe(true);
    expect(researchActions.every((action) => !action.researchGuidance && !action.sellerQuestion)).toBe(true);
  });

  it("returns neutral research review when no eligible information action remains and preserves readiness facts", () => {
    const active = build(complete);
    const research = build({ ...complete, operating_scope: "research_only" });
    expect(research.recommendation.label).toBe("Continue research-only review of this opportunity.");
    expect(research.readinessResult).toEqual(active.readinessResult);
    expect(research.residentialStrategyResult.underwriting).toEqual(active.residentialStrategyResult.underwriting);
    expect(research.residentialStrategyResult.pursuitScoreResult).toEqual(active.residentialStrategyResult.pursuitScoreResult);
    expect(research.availableActions.filter((action) => ["prepare-offer", "follow-up", "view-conversation"].includes(action.id)).every((action) => !action.enabled)).toBe(true);
  });

  it.each([
    "Call the seller", "Obtain paid title, HOA estoppel and municipal searches", "Prepare a bid",
    "Create an offer", "Purchase the property", "Progress closing",
    "Continue validation — no outreach or purchase authorized",
  ])("does not authorize arbitrary stored text: %s", (next_action) => {
    const result = build({ ...base, operating_scope: "research_only", next_action, next_action_due_date: "2026-10-02", due_date: "2026-10-02" });
    expect(result.recommendation.label).toBe("Review the overdue commitment within research-only scope.");
    expect(result.recommendationBasis.basisType).toBe("overdue-action");
  });

  it("does not elevate an inbound reply or approved acquisition action above research scope", () => {
    const result = build({ ...complete, operating_scope: "research_only" }, {
      conversationSignals: [{ compatibilityKey: "phone:5551112222", linkedDealId: "deal-1", organizationId: "org-1", lastMessageDirection: "inbound", lastMessagePreview: "Please call", lastMessageTimestamp: now }],
      approvalItems: [{ id: "approval-1", relatedDeal: { id: "deal-1" }, organizationId: "org-1", status: "approved", requestedAction: "Send an offer" }],
    });
    expect(result.recommendation.label).toBe("Continue research-only review of this opportunity.");
  });

  it("recalculates on a scope-only change and fails closed for unsupported scope", () => {
    const active = build(base);
    const research = build({ ...base, operating_scope: "research_only" }, { previousRecalculation: active.recalculation });
    expect(research.recalculation.changedCategories).toContain("operatingScope");
    expect(research.recommendation.label).not.toBe("Open seller");
    expect(build({ ...complete, operating_scope: "invalid" }).recommendation.label).toBe("Review the unsupported operating scope before taking action.");
  });
});
