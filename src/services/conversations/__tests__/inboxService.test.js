import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../conversationService", () => ({
  loadConversationInbox: vi.fn(),
  loadThreadMessages: vi.fn(),
}));

import { loadConversationInbox, loadThreadMessages } from "../conversationService";
import {
  COMPOSER_SEND_STATES,
  INBOX_RESULT_LIMIT,
  buildInboxReadModel,
  filterInboxConversations,
  loadInboxReadModel,
  loadInboxThread,
  mergeInboxThreadMessages,
  normalizeInboxSendResult,
  normalizeInboxThreadMessage,
} from "../inboxService";

const NOW = new Date("2026-08-04T12:00:00.000Z").getTime();

function summary(overrides = {}) {
  return {
    id: "message-1",
    phone: "+15555550100",
    message: "Can you call me?",
    direction: "inbound",
    created_at: "2026-08-04T11:00:00.000Z",
    status: "received",
    statusWasExplicit: true,
    ...overrides,
  };
}

function deal(overrides = {}) {
  return {
    id: "deal-1",
    phone: "+1 (555) 555-0100",
    owner_name: "Alex Seller",
    property_address: "123 Main Street",
    stage: "Contacted",
    organization_id: "org-1",
    ...overrides,
  };
}

describe("Inbox read model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reuses legacy message normalization without requiring direction", () => {
    const message = normalizeInboxThreadMessage(
      summary({ direction: undefined, status: "sent" })
    );

    expect(message.direction).toBe("outbound");
    expect(message.deliveryStatus).toBe("sent");
    expect(message.directionSource).toBe("legacy-status");
  });

  it("deduplicates by canonical ID and bridges legacy phone keys when canonical data exists", () => {
    const model = buildInboxReadModel({
      conversationSummaries: [
        summary({ conversation_id: "conversation-1" }),
        summary({
          id: "message-older",
          compatibilityKey: "phone:5555550100",
          phone: "(555) 555-0100",
          created_at: "2026-08-03T11:00:00.000Z",
        }),
        summary({ id: "message-2", phone: "+15555550200" }),
        summary({ id: "message-3", phone: "555-555-0200" }),
      ],
      now: NOW,
    });

    expect(model.items).toHaveLength(2);
    expect(model.items.map((item) => item.compatibilityKey)).toContain(
      "conversation:conversation-1"
    );
    expect(model.sourceWarnings.join(" ")).toMatch(/duplicate/i);
  });

  it("derives Needs Reply only from a valid latest inbound message", () => {
    const model = buildInboxReadModel({
      conversationSummaries: [
        summary(),
        summary({
          id: "outbound",
          phone: "+15555550200",
          direction: "outbound",
          status: "sent",
        }),
        summary({
          id: "malformed",
          phone: "+15555550300",
          message: "",
          direction: "inbound",
        }),
      ],
      now: NOW,
    });

    expect(model.counts.needsReply).toBe(1);
    expect(model.items.find((item) => item.phone === "+15555550100")?.needsReply).toBe(true);
    expect(model.items.find((item) => item.phone === "+15555550200")?.needsReply).toBe(false);
    expect(model.items.find((item) => item.phone === "+15555550300")?.needsReply).toBe(false);
  });

  it("never fabricates unread state and preserves explicit unread data", () => {
    const model = buildInboxReadModel({
      conversationSummaries: [
        summary(),
        summary({ id: "explicit", phone: "+15555550200", is_unread: true }),
        summary({ id: "read", phone: "+15555550300", read_at: "2026-08-04T10:30:00.000Z" }),
        summary({ id: "not-read", phone: "+15555550400", read_at: null }),
      ],
      now: NOW,
    });

    expect(model.items.find((item) => item.phone === "+15555550100")?.unreadState).toBeNull();
    expect(model.items.find((item) => item.phone === "+15555550200")?.unreadState).toBe(true);
    expect(model.items.find((item) => item.phone === "+15555550300")?.unreadState).toBe(false);
    expect(model.items.find((item) => item.phone === "+15555550400")?.unreadState).toBe(true);
    expect(model.supportedFilters.unread).toBe(true);
    expect(model).not.toHaveProperty("unreadFilter");
  });

  it("classifies explicit failed and test-mode message states", () => {
    const model = buildInboxReadModel({
      conversationSummaries: [
        summary({ direction: "outbound", status: "failed" }),
        summary({
          id: "test-message",
          phone: "+15555550200",
          direction: "outbound",
          status: "test",
        }),
      ],
      now: NOW,
    });

    expect(model.counts.failed).toBe(1);
    expect(model.items.find((item) => item.phone === "+15555550100")?.failedDelivery).toBe(true);
    expect(model.items.find((item) => item.phone === "+15555550200")?.testMode).toBe(true);
    expect(model.providerState.mode).toBe("test");
  });

  it("maps linked deal context while preserving unlinked and unavailable context truthfully", () => {
    const model = buildInboxReadModel({
      conversationSummaries: [
        summary(),
        summary({ id: "unlinked", phone: "+15555550200" }),
        summary({ id: "missing-context", phone: "+15555550300", deal_id: "deal-missing" }),
      ],
      deals: [deal()],
      errors: ["deal source failed"],
      now: NOW,
    });

    const linked = model.items.find((item) => item.phone === "+15555550100");
    const unlinked = model.items.find((item) => item.phone === "+15555550200");
    const missing = model.items.find((item) => item.phone === "+15555550300");

    expect(linked).toMatchObject({
      linked: true,
      linkedDealId: "deal-1",
      linkedDealRoute: "/deals/deal-1",
      sellerName: "Alex Seller",
      propertyAddress: "123 Main Street",
    });
    expect(unlinked).toMatchObject({ linked: false, linkedStatus: "unlinked" });
    expect(missing).toMatchObject({
      linked: true,
      linkedContextAvailable: false,
      linkedStatus: "context-unavailable",
    });
    expect(missing.availableActions.find((action) => action.id === "open-deal")).toMatchObject({
      enabled: false,
    });
    expect(model.sourceStatus).toBe("partial");
    expect(model.sourceWarnings.join(" ")).not.toContain("deal source failed");
  });

  it("orders attention deterministically and bounds summaries", () => {
    const many = Array.from({ length: 130 }, (_, index) =>
      summary({
        id: `message-${index}`,
        phone: `+1555${String(index).padStart(7, "0")}`,
        direction: "outbound",
        status: "sent",
      })
    );
    many[129] = summary({
      id: "urgent-inbound",
      phone: "+15559999999",
      direction: "inbound",
    });

    const model = buildInboxReadModel({ conversationSummaries: many, limit: 999, now: NOW });

    expect(model.items).toHaveLength(INBOX_RESULT_LIMIT);
    expect(model.items[0].needsReply).toBe(true);
    expect(model.truncated).toBe(true);
  });

  it("uses one search and supported filter contract", () => {
    const model = buildInboxReadModel({
      conversationSummaries: [
        summary(),
        summary({
          id: "failed",
          phone: "+15555550200",
          message: "Second seller",
          direction: "outbound",
          status: "failed",
        }),
      ],
      deals: [deal()],
      now: NOW,
    });

    expect(filterInboxConversations(model.items, { query: "main" })).toHaveLength(1);
    expect(filterInboxConversations(model.items, { filter: "needs-reply" })).toHaveLength(1);
    expect(filterInboxConversations(model.items, { filter: "failed" })).toHaveLength(1);
    expect(filterInboxConversations(model.items, { filter: "linked" })).toHaveLength(1);
    expect(filterInboxConversations(model.items, { filter: "unlinked" })).toHaveLength(1);
  });

  it("omits malformed summaries without crashing or exposing source errors", () => {
    const model = buildInboxReadModel({
      conversationSummaries: [null, {}, summary()],
      errors: [{ message: "column secret_internal does not exist" }],
      now: NOW,
    });

    expect(model.items).toHaveLength(1);
    expect(model.sourceWarnings.join(" ")).toMatch(/malformed|incomplete/i);
    expect(model.sourceWarnings.join(" ")).not.toContain("secret_internal");
  });

  it("loads bounded summaries through the existing conversation service", async () => {
    loadConversationInbox.mockResolvedValue({
      success: true,
      data: [summary()],
      metadata: { truncated: false },
    });

    const result = await loadInboxReadModel({ deals: [deal()], force: true, now: NOW });

    expect(result.success).toBe(true);
    expect(loadConversationInbox).toHaveBeenCalledWith({ force: true, limit: 500 });
    expect(result.data.items[0].linkedDealId).toBe("deal-1");
    expect(result.data.freeFirst.providerRequired).toBe(false);
  });
});

describe("Inbox thread and send contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads a bounded latest page and returns chronological normalized messages", async () => {
    loadThreadMessages.mockResolvedValue({
      success: true,
      data: [
        summary({ id: "new", created_at: "2026-08-04T11:00:00.000Z" }),
        summary({ id: "old", created_at: "2026-08-04T10:00:00.000Z" }),
        summary({ id: "earlier", created_at: "2026-08-04T09:00:00.000Z" }),
      ],
    });
    const conversation = buildInboxReadModel({
      conversationSummaries: [summary()],
      now: NOW,
    }).items[0];

    const result = await loadInboxThread({ conversation, limit: 2, offset: 0 });

    expect(loadThreadMessages).toHaveBeenCalledWith(conversation.phone, {
      ascending: false,
      dealId: "",
      force: false,
      limit: 3,
      offset: 0,
    });
    expect(result.data.messages.map((message) => message.sourceId)).toEqual(["old", "new"]);
    expect(result.data.hasEarlier).toBe(true);
    expect(result.data.nextOffset).toBe(2);
  });

  it("sanitizes thread failures and handles malformed rows", async () => {
    loadThreadMessages.mockResolvedValueOnce({
      success: false,
      error: { message: "raw Supabase relation failure" },
    });
    const conversation = buildInboxReadModel({
      conversationSummaries: [summary()],
      now: NOW,
    }).items[0];

    const failed = await loadInboxThread({ conversation });
    expect(failed.error.message).toBe("This conversation history could not be loaded.");

    loadThreadMessages.mockResolvedValueOnce({
      success: true,
      data: [summary(), summary({ id: "empty", message: "" })],
    });
    const partial = await loadInboxThread({ conversation });
    expect(partial.data.messages).toHaveLength(1);
    expect(partial.data.sourceWarnings.join(" ")).toMatch(/malformed/i);
  });

  it("deduplicates stable message IDs during Realtime merges", () => {
    const message = normalizeInboxThreadMessage(summary());
    const merged = mergeInboxThreadMessages([message], [message]);
    expect(merged).toHaveLength(1);
  });

  it("distinguishes live, test, provider-unavailable, and failed send states", () => {
    expect(
      normalizeInboxSendResult({
        success: true,
        data: { mode: "live", status: "queued" },
      })
    ).toMatchObject({
      success: true,
      state: COMPOSER_SEND_STATES.LIVE_SENT,
      deliveryStatus: "queued",
    });
    expect(
      normalizeInboxSendResult(
        { success: true, data: { mode: "test", status: "test" } },
        { linkedDealId: "deal-1" }
      )
    ).toMatchObject({
      clearDraft: true,
      success: true,
      state: COMPOSER_SEND_STATES.TEST_SAVED,
    });
    expect(
      normalizeInboxSendResult({
        success: true,
        data: { mode: "test", status: "test" },
      })
    ).toMatchObject({
      clearDraft: false,
      success: true,
      state: COMPOSER_SEND_STATES.TEST_UNPERSISTED,
    });
    expect(
      normalizeInboxSendResult({
        success: false,
        error: { message: "Provider unavailable" },
        metadata: { status: 503 },
      })
    ).toMatchObject({
      success: false,
      state: COMPOSER_SEND_STATES.PROVIDER_UNAVAILABLE,
    });
    expect(
      normalizeInboxSendResult({
        success: false,
        error: { message: "Recipient rejected" },
      })
    ).toMatchObject({ success: false, state: COMPOSER_SEND_STATES.FAILED });
  });
});
