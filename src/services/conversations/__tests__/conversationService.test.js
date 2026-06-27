import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../conversationRepository", () => ({
  findConversationByPhone: vi.fn(),
  findDealByPhone: vi.fn(),
  loadConversationSummaries: vi.fn(),
}));

vi.mock("../messageRepository", () => ({
  loadMessageLogs: vi.fn(),
}));

import {
  findConversationByPhone,
  findDealByPhone,
  loadConversationSummaries,
} from "../conversationRepository";
import { loadMessageLogs } from "../messageRepository";
import {
  buildSmsTimelineEvent,
  loadConversationInbox,
  loadConversationThread,
  loadThreadMessages,
} from "../conversationService";

describe("conversationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the conversation inbox through repository summaries", async () => {
    loadConversationSummaries.mockResolvedValue({ success: true, data: [{ phone: "555" }] });

    const result = await loadConversationInbox();

    expect(result.success).toBe(true);
    expect(result.data[0].phone).toBe("555");
  });

  it("composes deal and conversation thread data", async () => {
    findDealByPhone.mockResolvedValue({ success: true, data: { id: "deal-1" } });
    findConversationByPhone.mockResolvedValue({
      success: true,
      data: { phone: "555", messages: [{ id: "m1" }] },
    });

    const result = await loadConversationThread("555");

    expect(result.success).toBe(true);
    expect(result.data.deal.id).toBe("deal-1");
    expect(result.data.conversation.messages).toHaveLength(1);
  });

  it("loads thread messages ascending for seller workspace panels", async () => {
    loadMessageLogs.mockResolvedValue({ success: true, data: [] });

    await loadThreadMessages("555");

    expect(loadMessageLogs).toHaveBeenCalledWith({ phone: "555", ascending: true });
  });

  it("builds stable SMS timeline events", () => {
    const event = buildSmsTimelineEvent({
      id: "m1",
      direction: "outbound",
      message: "Hello",
      created_at: "2026-01-01",
    });

    expect(event.id).toBe("sms-m1");
    expect(event.actor).toBe("You");
    expect(event.preview).toBe("Hello");
  });
});
