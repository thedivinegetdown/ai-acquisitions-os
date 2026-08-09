import { describe, expect, it } from "vitest";
import { buildTodayBriefing, buildTodayReadModel, TODAY_RESULT_LIMIT } from "../index";

const NOW = Date.now();
const TODAY = new Date(NOW).toISOString().slice(0, 10);
const YESTERDAY = new Date(NOW - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const TOMORROW = new Date(NOW + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

function deal(overrides = {}) {
  return {
    id: "deal-1",
    property_address: "123 Main Street",
    owner_name: "Alex Seller",
    phone: "+15551234567",
    stage: "New Lead",
    source: "Direct Mail",
    created_at: "2026-07-01T10:00:00.000Z",
    updated_at: "2026-07-29T10:00:00.000Z",
    ...overrides,
  };
}

describe("buildTodayReadModel", () => {
  it("normalizes action items from existing notification rules", () => {
    const model = buildTodayReadModel({
      deals: [deal({ due_date: TODAY })],
      now: NOW,
    });

    expect(model.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "act-now",
          relatedDeal: "123 Main Street",
          relatedSeller: "Alex Seller",
          targetWorkspace: "inbox",
          type: "notification",
        }),
      ])
    );
  });

  it("does not surface platform health warnings as Today operator work", () => {
    const model = buildTodayReadModel({
      deals: [],
      now: NOW,
    });

    expect(model.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "System health warnings",
        }),
      ])
    );
  });

  it("keeps Today empty when only system health warnings exist", () => {
    const model = buildTodayReadModel({
      deals: [],
      now: NOW,
    });

    expect(model.items).toHaveLength(0);
  });

  it("classifies overdue tasks and missing data as at risk", () => {
    const model = buildTodayReadModel({
      deals: [
        deal({ id: "overdue", due_date: YESTERDAY }),
        deal({ id: "missing", phone: "", email: "" }),
      ],
      now: NOW,
    });

    expect(model.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "at-risk", title: "Overdue task: 123 Main Street" }),
        expect.objectContaining({ category: "at-risk", title: "Missing contact info: 123 Main Street" }),
      ])
    );
  });

  it("classifies current workflow approval signals as approvals", () => {
    const model = buildTodayReadModel({
      deals: [deal({ next_action: "" })],
      now: NOW,
    });

    expect(model.sourceStatus).toEqual(expect.any(String));
    expect(model.approvals.items).toHaveLength(1);
    expect(model.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "approvals",
          type: "approval",
          title: "Workflow approval pending: 123 Main Street",
        }),
      ])
    );
  });

  it("uses the normalized approval model for offer reviews", () => {
    const model = buildTodayReadModel({
      deals: [deal({ offer_ready: true, next_action: "Call seller" })],
      now: NOW,
    });

    expect(model.approvals.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ approvalType: "offer-review" }),
      ])
    );
    expect(model.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "approvals",
          targetWorkspace: "approvals",
          type: "approval",
        }),
      ])
    );
  });

  it("classifies future follow-ups as waiting and closed-today deals as completed", () => {
    const model = buildTodayReadModel({
      deals: [
        deal({ id: "future", due_date: TOMORROW, next_action: "Call seller" }),
        deal({ id: "closed", stage: "Closed", updated_at: `${TODAY}T09:00:00.000Z` }),
      ],
      now: NOW,
    });

    expect(model.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "waiting", id: "waiting:future" }),
        expect.objectContaining({ category: "completed", id: "completed:closed" }),
      ])
    );
  });

  it("classifies seller replies when bounded conversation summaries are supplied", () => {
    const model = buildTodayReadModel({
      conversations: [
        {
          phone: "+15550000000",
          direction: "inbound",
          lastMessagePreview: "Can you call me?",
          lastMessageAt: "2026-07-30T11:00:00.000Z",
        },
      ],
      deals: [],
      now: NOW,
    });

    expect(model.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "act-now",
          source: "Unified Inbox",
          type: "seller-reply",
          delayImpact: "high",
          actionWindowType: "act-now",
          sourceDueTimestamp: null,
        }),
      ])
    );
  });

  it("keeps scheduled waiting work low and completed work non-urgent", () => {
    const model = buildTodayReadModel({
      deals: [
        deal({ id: "future", due_date: TOMORROW, next_action: "Call seller" }),
        deal({ id: "closed", stage: "Closed", updated_at: `${TODAY}T09:00:00.000Z` }),
      ],
      now: NOW,
    });
    expect(model.items.find((item) => item.id === "waiting:future")).toMatchObject({
      category: "waiting",
      delayImpact: "low",
      actionWindowType: "scheduled",
      sourceDueTimestamp: expect.any(String),
    });
    expect(model.items.find((item) => item.id === "completed:closed")).toMatchObject({
      category: "completed",
      delayImpact: "unavailable",
      actionWindowType: "unavailable",
    });
  });

  it("deduplicates duplicate underlying conditions", () => {
    const model = buildTodayReadModel({
      conversations: [
        {
          phone: "+15550000000",
          direction: "inbound",
          lastMessagePreview: "Please call",
          lastMessageAt: "2026-07-30T11:00:00.000Z",
        },
        {
          phone: "+1 (555) 000-0000",
          direction: "inbound",
          lastMessagePreview: "Please call",
          lastMessageAt: "2026-07-30T11:00:00.000Z",
        },
      ],
      now: NOW,
    });

    expect(model.items.filter((item) => item.type === "seller-reply")).toHaveLength(1);
  });

  it("orders high-risk and overdue work before lower-priority waiting work", () => {
    const model = buildTodayReadModel({
      deals: [
        deal({ id: "future", due_date: TOMORROW }),
        deal({ id: "overdue", due_date: YESTERDAY }),
      ],
      now: NOW,
    });

    expect(model.items[0].category).toBe("at-risk");
  });

  it("sorts Cost of Delay before existing priority only within the same category", () => {
    const model = buildTodayReadModel({
      deals: [
        deal({ id: "missing", phone: "", email: "" }),
        deal({ id: "overdue", due_date: YESTERDAY }),
      ],
      now: NOW,
    });
    const atRisk = model.items.filter((item) => item.category === "at-risk");
    expect(atRisk[0]).toMatchObject({ delayImpact: "critical" });
    expect(atRisk.some((item) => item.delayImpact === "low")).toBe(true);
    expect(model.categories.map((category) => category.id)).toEqual([
      "act-now",
      "approvals",
      "waiting",
      "at-risk",
      "completed",
    ]);
  });

  it("bounds input and output sizes", () => {
    const manyDeals = Array.from({ length: 80 }, (_, index) =>
      deal({ id: `deal-${index}`, due_date: YESTERDAY })
    );

    const model = buildTodayReadModel({ deals: manyDeals, limit: 12, now: NOW });

    expect(model.items.length).toBeLessThanOrEqual(12);
    expect(TODAY_RESULT_LIMIT).toBe(50);
  });

  it("handles malformed or missing data safely", () => {
    const model = buildTodayReadModel({
      deals: [null, {}, deal({ id: "safe", property_address: "", owner_name: "" })],
      now: NOW,
    });

    expect(model.items.length).toBeGreaterThan(0);
    expect(model.sourceStatus).toBe("partial");
  });
});

describe("buildTodayBriefing", () => {
  it("summarizes counts and recommended focus from the read model", () => {
    const model = buildTodayReadModel({
      deals: [deal({ due_date: YESTERDAY })],
      now: NOW,
    });
    const briefing = buildTodayBriefing(model);

    expect(briefing.counts.urgentActions).toBeGreaterThan(0);
    expect(briefing.counts.atRisk).toBeGreaterThan(0);
    expect(briefing.counts.criticalDelay).toBeGreaterThan(0);
    expect(briefing.focusText).toContain("Start with");
    expect(briefing.summary).toContain("Today item");
  });

  it("returns a useful zero-item briefing", () => {
    const briefing = buildTodayBriefing({
      counts: {},
      generatedAt: new Date(NOW).toISOString(),
      items: [],
      sourceStatus: "complete",
      sourceWarnings: [],
    });

    expect(briefing.counts.urgentActions).toBe(0);
    expect(briefing.summary).toBe("No Today items require attention from the currently loaded data.");
  });
});
