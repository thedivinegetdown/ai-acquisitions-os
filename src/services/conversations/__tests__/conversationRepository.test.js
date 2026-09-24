import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, order, queryResults, range, select } = vi.hoisted(() => {
  const queryResults = [];
  const query = {};
  const range = vi.fn(() => Promise.resolve(queryResults.shift()));
  const order = vi.fn(() => query);
  const select = vi.fn(() => query);
  const from = vi.fn(() => query);
  Object.assign(query, { order, range, select });

  return { from, order, queryResults, range, select };
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
    range.mockClear();
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
    expect(select).toHaveBeenCalledWith("*");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(order).toHaveBeenCalledWith("id", { ascending: false });
    expect(range).toHaveBeenCalledWith(0, 249);
    expect(result.data[0]).toMatchObject({
      phone: "555",
      direction: "outbound",
      lastMessagePreview: "Hello",
    });
  });

  it("scans bounded message pages and ranks distinct conversations without duplicates", async () => {
    const noisyConversation = Array.from({ length: 250 }, (_, index) => ({
      id: `noise-${index}`,
      phone: "5550000000",
      created_at: new Date(Date.UTC(2026, 0, 3, 0, 0, 0) - index * 1000).toISOString(),
      message: "Outbound history",
      direction: "outbound",
    }));
    queryResults.push(
      { data: noisyConversation, error: null },
      {
        data: [
          { id: "reply-old", phone: "5550000001", created_at: "2026-01-01T00:00:00.000Z", message: "Please call", direction: "inbound" },
          { id: "other", phone: "5550000002", created_at: "2026-01-02T00:00:00.000Z", message: "Sent", direction: "outbound" },
        ],
        error: null,
      }
    );

    const result = await loadConversationSummaries({ force: true, limit: 2 });

    expect(result.success).toBe(true);
    expect(result.data.map((item) => item.phone)).toEqual(["5550000001", "5550000000"]);
    expect(new Set(result.data.map((item) => item.compatibilityKey)).size).toBe(2);
    expect(result.metadata).toMatchObject({ hasMore: true, pages: 2, sourceRows: 252 });
    expect(range.mock.calls).toEqual([[0, 249], [250, 499]]);
  });

  it("derives direction from status when legacy rows have no direction column", async () => {
    queryResults.push({
      data: [
        {
          phone: "555",
          created_at: "2026-01-01T00:00:00.000Z",
          message: "Hello",
          status: "sent",
        },
      ],
      error: null,
    });

    const result = await loadConversationSummaries();

    expect(result.success).toBe(true);
    expect(select).toHaveBeenCalledWith("*");
    expect(result.data[0]).toMatchObject({
      phone: "555",
      direction: "outbound",
    });
  });
});
