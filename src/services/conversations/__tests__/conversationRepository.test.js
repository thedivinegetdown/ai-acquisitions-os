import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, order, queryResults, select } = vi.hoisted(() => {
  const queryResults = [];
  const order = vi.fn(() => Promise.resolve(queryResults.shift()));
  const select = vi.fn(() => ({ order }));
  const from = vi.fn(() => ({ select }));

  return { from, order, queryResults, select };
});

vi.mock("../../../supabaseClient", () => ({
  supabase: { from },
}));

import { clearCache } from "../../cache";
import { loadConversationSummaries } from "../conversationRepository";

describe("conversationRepository", () => {
  beforeEach(() => {
    clearCache();
    queryResults.length = 0;
    from.mockClear();
    select.mockClear();
    order.mockClear();
  });

  it("loads summaries with direction when the schema supports it", async () => {
    queryResults.push({
      data: [
        {
          phone: "555",
          created_at: "2026-01-01T00:00:00.000Z",
          message: "Hello",
          direction: "outbound",
        },
      ],
      error: null,
    });

    const result = await loadConversationSummaries();

    expect(result.success).toBe(true);
    expect(select).toHaveBeenCalledWith("phone, created_at, message, direction");
    expect(result.data[0]).toMatchObject({
      phone: "555",
      direction: "outbound",
      lastMessagePreview: "Hello",
    });
  });

  it("falls back to status when message_logs.direction is missing", async () => {
    queryResults.push(
      {
        data: null,
        error: {
          code: "42703",
          message: "column message_logs.direction does not exist",
        },
      },
      {
        data: [
          {
            phone: "555",
            created_at: "2026-01-01T00:00:00.000Z",
            message: "Hello",
            status: "sent",
          },
        ],
        error: null,
      }
    );

    const result = await loadConversationSummaries();

    expect(result.success).toBe(true);
    expect(select).toHaveBeenNthCalledWith(
      1,
      "phone, created_at, message, direction"
    );
    expect(select).toHaveBeenNthCalledWith(
      2,
      "phone, created_at, message, status"
    );
    expect(result.data[0]).toMatchObject({
      phone: "555",
      direction: "outbound",
    });
  });
});
