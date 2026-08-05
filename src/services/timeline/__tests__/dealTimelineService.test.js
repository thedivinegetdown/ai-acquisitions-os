import { describe, expect, it, vi } from "vitest";
import {
  TIMELINE_CATEGORIES,
  TIMELINE_RELIABILITY_LABELS,
  TIMELINE_SORT_DIRECTIONS,
  TIMELINE_SOURCE_LIMIT,
  adaptActivityRecords,
  adaptApprovalItems,
  adaptCompRecords,
  adaptDealCreationRecord,
  adaptDocumentRecords,
  adaptMessageRecords,
  adaptOfferRecords,
  adaptSequenceRecords,
  adaptTaskRecords,
  adaptTransactionRecords,
  buildDealTimelineContext,
  buildTimelineReadModel,
  filterTimelineEvents,
  groupTimelineEvents,
  loadDealTimeline,
  normalizeTimelineEvent,
  sortTimelineEvents,
} from "../dealTimelineService";

const deal = {
  id: "deal-1",
  organization_id: "org-1",
  tenant_id: "tenant-1",
  owner_name: "Sam Seller",
  phone: "5551112222",
  property_address: "123 Main Street",
};

const context = buildDealTimelineContext(deal);

function timelineEvent(overrides = {}) {
  return normalizeTimelineEvent({
    id: overrides.id || "event-1",
    category: TIMELINE_CATEGORIES.SYSTEM,
    type: "record",
    timestamp: "2026-08-05T12:00:00.000Z",
    title: "Persisted event",
    sourceSystem: "Test record",
    reliability: TIMELINE_RELIABILITY_LABELS.PERSISTED,
    deduplicationKey: overrides.id || "event-1",
    ...overrides,
  });
}

describe("timeline event contract", () => {
  it("normalizes the stable contract without substituting the current time", () => {
    const event = normalizeTimelineEvent({
      id: "undated-1",
      category: TIMELINE_CATEGORIES.TASKS,
      type: "task-record",
      title: "Task record",
      sourceSystem: "Task record",
      reliability: TIMELINE_RELIABILITY_LABELS.PERSISTED,
    });

    expect(event.timestamp).toBeNull();
    expect(event.deterministicSortKey).toBe("undated:undated-1");
    expect(event.partialDataWarning).toContain("no trustworthy timestamp");
    expect(event.timestamp).not.toBe(new Date().toISOString());
  });

  it("rejects events without a supported category or real source label", () => {
    expect(normalizeTimelineEvent({ title: "Unknown", sourceSystem: "Test" })).toBeNull();
    expect(
      normalizeTimelineEvent({
        category: TIMELINE_CATEGORIES.SYSTEM,
        title: "No source",
      })
    ).toBeNull();
  });
});
describe("timeline source adapters", () => {
  it("reuses Inbox message direction, delivery status, and stable IDs", () => {
    const result = adaptMessageRecords(
      [
        {
          id: "message-1",
          deal_id: "deal-1",
          phone: "5551112222",
          message: "I am ready to talk.",
          direction: "inbound",
          status: "received",
          created_at: "2026-08-05T11:00:00.000Z",
        },
        {
          id: "message-2",
          deal_id: "deal-1",
          phone: "5551112222",
          message: "Thanks, I will call.",
          status: "sent",
          created_at: "2026-08-05T11:05:00.000Z",
        },
      ],
      context
    );

    expect(result.events[0]).toMatchObject({
      id: "message:message-1",
      direction: "inbound",
      status: "received",
      sourceRecordId: "message-1",
      reliability: TIMELINE_RELIABILITY_LABELS.PERSISTED,
    });
    expect(result.events[1]).toMatchObject({
      id: "message:message-2",
      direction: "outbound",
      status: "sent",
      reliability: TIMELINE_RELIABILITY_LABELS.COMPATIBILITY,
    });
    expect(result.events[1].partialDataWarning).toContain("legacy-status");
  });

  it("normalizes persisted activity and note records without inventing an actor", () => {
    const withActor = adaptActivityRecords(
      [
        {
          id: "activity-1",
          deal_id: "deal-1",
          note: "Seller requested a call tomorrow.",
          author_name: "Alex Agent",
          created_at: "2026-08-04T16:00:00.000Z",
        },
      ],
      context
    ).events[0];
    const withoutActor = adaptActivityRecords(
      [
        {
          id: "activity-2",
          deal_id: "deal-1",
          note: "Imported activity record.",
          created_at: "2026-08-04T17:00:00.000Z",
        },
      ],
      context
    ).events[0];

    expect(withActor.actorLabel).toBe("Alex Agent");
    expect(withActor.reliability).toBe(TIMELINE_RELIABILITY_LABELS.USER_ENTERED);
    expect(withoutActor.actorLabel).toBeNull();
  });

  it("keeps task records without created timestamps in the Undated contract", () => {
    const event = adaptTaskRecords(
      [{ id: "task-1", deal_id: "deal-1", title: "Call seller", status: "open" }],
      context
    ).events[0];

    expect(event.type).toBe("task-record");
    expect(event.timestamp).toBeNull();
    expect(event.title).toBe("Task record: Call seller");
  });

  it("normalizes document additions without claiming signing or completion", () => {
    const event = adaptDocumentRecords(
      [
        {
          id: "document-1",
          deal_id: "deal-1",
          title: "Purchase agreement draft",
          doc_type: "Purchase Agreement",
          created_at: "2026-08-03T10:00:00.000Z",
        },
      ],
      context
    ).events[0];

    expect(event.title).toBe("Document added: Purchase agreement draft");
    expect(event.status).toBeNull();
    expect(event.targetSection).toBe("documents");
  });

  it("normalizes persisted comps with recorded currency facts", () => {
    const event = adaptCompRecords(
      [
        {
          id: "comp-1",
          deal_id: "deal-1",
          address: "125 Main Street",
          sale_price: 210000,
          created_at: "2026-08-02T10:00:00.000Z",
        },
      ],
      context
    ).events[0];

    expect(event.category).toBe(TIMELINE_CATEGORIES.UNDERWRITING);
    expect(event.summary).toContain("$210,000");
    expect(event.targetSection).toBe("property");
  });

  it("normalizes only persisted sequence records with their real row timestamp", () => {
    const event = adaptSequenceRecords(
      [
        {
          id: "step-1",
          deal_id: "deal-1",
          action_type: "Call",
          step_day: 2,
          status: "Open",
          created_at: "2026-08-01T10:00:00.000Z",
        },
      ],
      context
    ).events[0];

    expect(event.type).toBe("sequence-step-added");
    expect(event.summary).toBe("Call, day 2.");
    expect(event.targetSection).toBe("communication");
  });

  it("supports historical offer and transaction records without deriving snapshot events", () => {
    const offer = adaptOfferRecords(
      [
        {
          id: "offer-1",
          deal_id: "deal-1",
          event_type: "prepared",
          amount: 100000,
          created_at: "2026-07-31T10:00:00.000Z",
        },
      ],
      context
    ).events[0];
    const transaction = adaptTransactionRecords(
      [
        {
          id: "milestone-1",
          deal_id: "deal-1",
          milestone: "Title review opened",
          occurred_at: "2026-07-30T10:00:00.000Z",
        },
      ],
      context
    ).events[0];

    expect(offer.targetSection).toBe("numbers");
    expect(offer.summary).toContain("$100,000");
    expect(transaction.targetSection).toBe("closing");
    expect(transaction.title).toContain("Title review opened");
  });

  it("reuses normalized approval fields only when timestamps are declared persisted", () => {
    const approval = {
      id: "approval-1",
      sourceId: "notification-1",
      relatedDeal: { id: "deal-1" },
      title: "Review offer",
      requestedAction: "Review the prepared offer.",
      requestedTimestamp: "2026-07-29T10:00:00.000Z",
      requestedBy: { name: "Deterministic rules", type: "system" },
      sourceSystem: "Action Inbox",
      status: "deferred",
      decisionMetadata: {
        actor: "Current user",
        decidedAt: "2026-07-29T11:00:00.000Z",
        sessionOnly: true,
      },
      targetWorkspace: "approvals",
      targetRoute: "/approvals",
    };

    expect(adaptApprovalItems([approval], context).events).toEqual([]);
    const trusted = adaptApprovalItems([approval], context, {
      timestampsArePersisted: true,
    });
    expect(trusted.events).toHaveLength(1);
    expect(trusted.events[0].type).toBe("approval-requested");
    expect(trusted.events.some((event) => event.type === "approval-decided")).toBe(false);
  });

  it("includes a persisted approval decision but never session-only defer state", () => {
    const result = adaptApprovalItems(
      [
        {
          id: "approval-2",
          relatedDeal: { id: "deal-1" },
          title: "Review workflow",
          requestedTimestamp: "2026-07-29T10:00:00.000Z",
          sourceSystem: "Approval record",
          status: "approved",
          decisionMetadata: {
            actor: "Alex Agent",
            decidedAt: "2026-07-29T11:00:00.000Z",
            sessionOnly: false,
          },
        },
      ],
      context,
      { timestampsArePersisted: true }
    );

    expect(result.events.map((event) => event.type)).toEqual([
      "approval-requested",
      "approval-decided",
    ]);
  });

  it("emits only a real deal-creation system event and ignores generic updated state", () => {
    const result = adaptDealCreationRecord(
      {
        ...deal,
        created_at: "2026-07-28T10:00:00.000Z",
        updated_at: "2026-08-05T10:00:00.000Z",
        stage: "Under Contract",
      },
      context
    );

    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe("deal-created");
    expect(result.events[0].title).not.toContain("updated");
    expect(adaptDealCreationRecord(deal, context).events).toEqual([]);
  });

  it("bounds every adapter and safely omits malformed and cross-deal records", () => {
    const records = Array.from({ length: TIMELINE_SOURCE_LIMIT + 5 }, (_, index) => ({
      id: `task-${index}`,
      deal_id: "deal-1",
      title: `Task ${index}`,
      created_at: "2026-08-01T10:00:00.000Z",
    }));
    const bounded = adaptTaskRecords(records, context);
    const malformed = adaptTaskRecords(
      [null, { id: "wrong", deal_id: "deal-2", title: "Wrong deal" }],
      context
    );

    expect(bounded.events).toHaveLength(TIMELINE_SOURCE_LIMIT);
    expect(bounded.truncated).toBe(true);
    expect(malformed.events).toEqual([]);
    expect(malformed.warnings.join(" ")).toContain("omitted");
  });
});

describe("timeline aggregation", () => {
  it("sorts deterministically in both directions and leaves undated events last", () => {
    const older = timelineEvent({ id: "older", timestamp: "2026-08-01T10:00:00.000Z" });
    const newer = timelineEvent({ id: "newer", timestamp: "2026-08-05T10:00:00.000Z" });
    const undated = timelineEvent({ id: "undated", timestamp: null });

    expect(sortTimelineEvents([older, undated, newer]).map((event) => event.id)).toEqual([
      "newer",
      "older",
      "undated",
    ]);
    expect(
      sortTimelineEvents(
        [older, undated, newer],
        TIMELINE_SORT_DIRECTIONS.OLDEST
      ).map((event) => event.id)
    ).toEqual(["older", "newer", "undated"]);
  });

  it("deduplicates stable message events and applies the merged result bound", () => {
    const repeated = timelineEvent({ id: "same", deduplicationKey: "message:1" });
    const model = buildTimelineReadModel({
      limit: 2,
      sourceResults: [
        {
          sourceId: "messages",
          label: "Messages",
          status: "complete",
          events: [
            repeated,
            { ...repeated, id: "same-copy" },
            timelineEvent({ id: "event-2", timestamp: "2026-08-04T10:00:00.000Z" }),
            timelineEvent({ id: "event-3", timestamp: "2026-08-03T10:00:00.000Z" }),
          ],
        },
      ],
    });

    expect(model.items).toHaveLength(2);
    expect(model.totalAvailable).toBe(3);
    expect(model.truncated).toBe(true);
    expect(model.sourceWarnings.join(" ")).toContain("duplicate");
  });

  it("preserves successful data when another source fails and reports all-source failure", () => {
    const event = timelineEvent();
    const partial = buildTimelineReadModel({
      sourceResults: [
        { sourceId: "messages", label: "Messages", status: "complete", events: [event] },
        {
          sourceId: "documents",
          label: "Documents",
          status: "failed",
          events: [],
          warnings: ["Document history could not be loaded."],
        },
      ],
    });
    const failed = buildTimelineReadModel({
      sourceResults: [
        {
          sourceId: "messages",
          label: "Messages",
          status: "failed",
          events: [],
          warnings: ["Message history could not be loaded."],
        },
      ],
    });

    expect(partial.sourceStatus).toBe("partial");
    expect(partial.items).toEqual([event]);
    expect(failed.sourceStatus).toBe("failed");
  });

  it("filters one shared read model and groups calendar dates including Undated", () => {
    const now = new Date(2026, 7, 5, 15, 0, 0).getTime();
    const events = [
      timelineEvent({ id: "today", timestamp: new Date(2026, 7, 5, 10).toISOString() }),
      timelineEvent({ id: "yesterday", timestamp: new Date(2026, 7, 4, 10).toISOString() }),
      timelineEvent({ id: "week", timestamp: new Date(2026, 7, 2, 10).toISOString() }),
      timelineEvent({ id: "earlier", timestamp: new Date(2026, 6, 20, 10).toISOString() }),
      timelineEvent({ id: "undated", timestamp: null }),
      timelineEvent({ id: "task", category: TIMELINE_CATEGORIES.TASKS }),
    ];
    const groups = groupTimelineEvents(events.slice(0, 5), { now });

    expect(groups.map((group) => group.label)).toEqual([
      "Today",
      "Yesterday",
      "This Week",
      "Earlier",
      "Undated",
    ]);
    expect(filterTimelineEvents(events, TIMELINE_CATEGORIES.TASKS)).toHaveLength(1);
  });

  it("omits unsupported categories from filters when no real source event exists", () => {
    const model = buildTimelineReadModel({
      sourceResults: [
        {
          sourceId: "messages",
          label: "Messages",
          status: "complete",
          events: [
            timelineEvent({
              id: "message",
              category: TIMELINE_CATEGORIES.COMMUNICATION,
            }),
          ],
        },
      ],
    });

    expect(model.filters.map((filter) => filter.id)).toEqual([
      "all",
      TIMELINE_CATEGORIES.COMMUNICATION,
    ]);
  });
});

describe("bounded timeline loading", () => {
  function successfulLoaders(overrides = {}) {
    const success = vi.fn().mockResolvedValue({ success: true, data: [] });
    return {
      messages: success,
      tasks: success,
      documents: success,
      comps: success,
      sequences: success,
      ...overrides,
    };
  }

  it("loads source repositories concurrently through bounded contracts and needs no provider", async () => {
    const messages = vi.fn().mockResolvedValue({
      success: true,
      data: [
        {
          id: "message-1",
          deal_id: "deal-1",
          phone: "5551112222",
          message: "Hello",
          direction: "inbound",
          created_at: "2026-08-05T10:00:00.000Z",
        },
      ],
    });
    const result = await loadDealTimeline({
      deal,
      loaders: successfulLoaders({ messages }),
      now: new Date(2026, 7, 5, 12).getTime(),
    });

    expect(result.success).toBe(true);
    expect(messages).toHaveBeenCalledWith(
      expect.objectContaining({ limit: TIMELINE_SOURCE_LIMIT })
    );
    expect(result.data.items).toHaveLength(1);
    expect(result.data.freeFirst.providerRequired).toBe(false);
  });

  it("returns partial results instead of exposing a source error", async () => {
    const result = await loadDealTimeline({
      deal,
      loaders: successfulLoaders({
        documents: vi.fn().mockResolvedValue({
          success: false,
          error: { message: "raw database details" },
        }),
        messages: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              id: "message-1",
              deal_id: "deal-1",
              phone: "5551112222",
              message: "Hello",
              direction: "inbound",
              created_at: "2026-08-05T10:00:00.000Z",
            },
          ],
        }),
      }),
    });

    expect(result.success).toBe(true);
    expect(result.data.sourceStatus).toBe("partial");
    expect(result.data.sourceWarnings.join(" ")).toContain("Document history");
    expect(result.data.sourceWarnings.join(" ")).not.toContain("raw database details");
  });

  it("returns a safe full failure when every enabled source fails", async () => {
    const failed = vi.fn().mockResolvedValue({ success: false, error: new Error("raw") });
    const result = await loadDealTimeline({
      deal,
      loaders: {
        messages: failed,
        tasks: failed,
        documents: failed,
        comps: failed,
        sequences: failed,
      },
    });

    expect(result.success).toBe(false);
    expect(result.error.message).toBe("Timeline history could not be loaded.");
    expect(result.data.sourceWarnings.join(" ")).not.toContain("raw");
  });

  it("shows an honest empty model when repositories succeed without historical rows", async () => {
    const result = await loadDealTimeline({
      deal,
      loaders: successfulLoaders(),
    });

    expect(result.success).toBe(true);
    expect(result.data.items).toEqual([]);
    expect(result.data.filters).toEqual([
      { id: "all", label: "All Events", count: 0, icon: "deals" },
    ]);
  });
});
