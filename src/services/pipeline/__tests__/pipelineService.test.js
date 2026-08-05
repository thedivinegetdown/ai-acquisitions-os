import { describe, expect, it } from "vitest";
import {
  DEFAULT_PIPELINE_FILTERS,
  buildPipelineReadModel,
  filterPipelineItems,
  getPipelineActiveFilterCount,
  getPipelineStageColumns,
  normalizePipelineItem,
  normalizePipelineStage,
} from "../pipelineService";

const NOW = new Date("2026-08-04T12:00:00.000Z").getTime();

function deal(overrides = {}) {
  return {
    id: "deal-1",
    organization_id: "org-1",
    tenant_id: "tenant-1",
    property_address: "123 Main Street",
    owner_name: "Alex Seller",
    phone: "+15555550100",
    stage: "Contacted",
    status: "Active",
    source: "Referral",
    acquisitions_rep: "Morgan Acquisitions",
    asking_price: 125000,
    arv: 210000,
    repairs: 25000,
    next_action: "Call seller",
    due_date: "2026-08-04",
    updated_at: "2026-08-03T10:00:00.000Z",
    ...overrides,
  };
}

describe("pipelineService", () => {
  it("normalizes real pipeline facts without adding scores or recommendations", () => {
    const item = normalizePipelineItem(deal({ data_reliability_grade: "B" }), {
      now: NOW,
      selectedIds: ["deal-1"],
    });

    expect(item).toEqual(
      expect.objectContaining({
        dealId: "deal-1",
        propertyAddress: "123 Main Street",
        seller: "Alex Seller",
        currentStage: "Contacted",
        assignedUser: "Morgan Acquisitions",
        targetRoute: "/deals/deal-1",
        selected: true,
        dataConfidence: "B",
      })
    );
    expect(item.financialSummary).toEqual({ askingPrice: 125000, arv: 210000, repairs: 25000 });
    expect(item).not.toHaveProperty("pursuitScore");
    expect(item).not.toHaveProperty("recommendationConfidence");
  });

  it("maps canonical, missing, and unknown stages without fabricating a stage", () => {
    expect(normalizePipelineStage("under_contract")).toEqual(
      expect.objectContaining({ id: "under-contract", label: "Under Contract", known: true })
    );
    expect(normalizePipelineStage("")).toEqual(
      expect.objectContaining({ id: "unstaged", label: "Unstaged", known: false })
    );
    expect(normalizePipelineStage("Researching")).toEqual(
      expect.objectContaining({ id: "other", sourceLabel: "Researching", known: false })
    );
  });

  it("uses stable stage ordering and includes compatibility columns only when represented", () => {
    const items = [
      normalizePipelineItem(deal({ id: "other", stage: "Researching" }), { now: NOW }),
      normalizePipelineItem(deal({ id: "new", stage: "New Lead" }), { now: NOW }),
    ];
    const columns = getPipelineStageColumns(items);

    expect(columns.map((column) => column.label)).toEqual([
      "New Lead",
      "Contacted",
      "Offer Sent",
      "Under Contract",
      "Closed",
      "Dead Lead",
      "Other",
    ]);
    expect(columns.find((column) => column.id === "other")?.count).toBe(1);
  });

  it("classifies active deals as stale after the existing 14-day compatibility window", () => {
    const stale = normalizePipelineItem(
      deal({ updated_at: "2026-07-01T10:00:00.000Z" }),
      { now: NOW }
    );
    const terminal = normalizePipelineItem(
      deal({ stage: "Closed", updated_at: "2026-07-01T10:00:00.000Z" }),
      { now: NOW }
    );

    expect(stale.stale).toBe(true);
    expect(stale.riskFlags).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "stale", level: "Medium" })])
    );
    expect(terminal.stale).toBe(false);
  });

  it("classifies missing next actions and core missing information explicitly", () => {
    const item = normalizePipelineItem(
      deal({ next_action: "", property_address: "", phone: "", email: "", source: "" }),
      { now: NOW }
    );

    expect(item.missingNextAction).toBe(true);
    expect(item.atRisk).toBe(true);
    expect(item.missingInformation).toEqual(
      expect.arrayContaining([
        "Property address",
        "Lead source",
        "Seller contact information",
        "Next action",
      ])
    );
  });

  it("uses explicit unread state only when the loaded record supplies it", () => {
    expect(normalizePipelineItem(deal(), { now: NOW }).unreadConversation).toBeNull();
    expect(
      normalizePipelineItem(deal({ unread_message_count: 2 }), { now: NOW }).unreadConversation
    ).toBe(true);
    expect(
      normalizePipelineItem(deal({ unread_message_count: 0 }), { now: NOW }).unreadConversation
    ).toBe(false);
  });

  it("reuses normalized Inbox Needs Reply signals without treating them as unread", () => {
    const model = buildPipelineReadModel({
      conversations: [
        {
          compatibilityKey: "phone:5555550100",
          phone: "+15555550100",
          lastMessageDirection: "inbound",
          lastMessagePreview: "Can you call me?",
          lastMessageTimestamp: "2026-08-04T11:00:00.000Z",
          needsReply: true,
        },
      ],
      deals: [deal()],
      now: NOW,
    });

    expect(model.items[0]).toMatchObject({
      needsReply: true,
      unreadConversation: null,
      needsAttention: true,
    });
    expect(model.items[0].attentionReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "Unified Inbox" }),
      ])
    );
  });

  it("reuses the normalized approval model for approval indicators", () => {
    const model = buildPipelineReadModel({
      deals: [deal({ offer_ready: true })],
      now: NOW,
    });

    expect(model.items[0]).toEqual(
      expect.objectContaining({ approvalRequired: true, approvalCount: 1 })
    );
    expect(model.sources).toContain("Universal Approval Inbox read model");
  });

  it("bounds results, consolidates duplicate IDs, and reports malformed records", () => {
    const manyDeals = Array.from({ length: 280 }, (_, index) =>
      deal({
        id: `deal-${index}`,
        property_address: `${index} Main`,
        due_date: index === 279 ? "2026-01-01" : "2026-08-10",
      })
    );
    const model = buildPipelineReadModel({
      deals: [null, ...manyDeals, deal({ id: "deal-1" })],
      limit: 999,
      now: NOW,
    });

    expect(model.items).toHaveLength(250);
    expect(model.items.map((item) => item.dealId)).toContain("deal-279");
    expect(model.truncated).toBe(true);
    expect(model.sourceStatus).toBe("partial");
    expect(model.sourceWarnings.join(" ")).toMatch(/malformed|duplicate/i);
  });

  it("preserves tenant context and excludes explicit cross-tenant records", () => {
    const model = buildPipelineReadModel({
      deals: [deal(), deal({ id: "other", tenant_id: "tenant-2" })],
      tenantId: "tenant-1",
      now: NOW,
    });

    expect(model.items).toHaveLength(1);
    expect(model.items[0].tenantId).toBe("tenant-1");
  });

  it("applies one filter contract across searchable and structured fields", () => {
    const model = buildPipelineReadModel({
      deals: [
        deal({ id: "due", unread_message_count: 1 }),
        deal({
          id: "waiting",
          property_address: "456 Oak Avenue",
          stage: "New Lead",
          acquisitions_rep: "Taylor",
          source: "Direct Mail",
          due_date: "2026-08-10",
        }),
      ],
      now: NOW,
    });

    expect(filterPipelineItems(model.items, { search: "oak" })).toHaveLength(1);
    expect(filterPipelineItems(model.items, { stage: "new-lead" })).toHaveLength(1);
    expect(filterPipelineItems(model.items, { assignedUser: "Taylor" })).toHaveLength(1);
    expect(filterPipelineItems(model.items, { source: "Direct Mail" })).toHaveLength(1);
    expect(filterPipelineItems(model.items, { unreadResponse: true })).toHaveLength(1);
    expect(getPipelineActiveFilterCount({ ...DEFAULT_PIPELINE_FILTERS, search: "oak" })).toBe(1);
  });

  it("implements deterministic quick focus views over the same items", () => {
    const model = buildPipelineReadModel({
      deals: [
        deal({ id: "new", stage: "New Lead" }),
        deal({ id: "waiting", due_date: "2026-08-10" }),
        deal({ id: "stale", updated_at: "2026-07-01T10:00:00.000Z" }),
      ],
      now: NOW,
    });

    expect(filterPipelineItems(model.items, {}, "new-leads").map((item) => item.dealId)).toContain(
      "new"
    );
    expect(filterPipelineItems(model.items, {}, "waiting").map((item) => item.dealId)).toContain(
      "waiting"
    );
    expect(filterPipelineItems(model.items, {}, "at-risk").map((item) => item.dealId)).toContain(
      "stale"
    );
  });

  it("operates without a provider and exposes only real supported filter capabilities", () => {
    const model = buildPipelineReadModel({
      deals: [deal({ offer_ready: true, unread_message_count: 0 })],
      now: NOW,
    });

    expect(model.freeFirst).toEqual(
      expect.objectContaining({ providerRequired: false, costCategory: "core-free-first" })
    );
    expect(model.supportedFilters.unreadResponse).toBe(true);
    expect(model.supportedFilters.approvalRequired).toBe(true);
  });
});
