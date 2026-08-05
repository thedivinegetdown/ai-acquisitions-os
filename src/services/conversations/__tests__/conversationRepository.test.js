import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, limit, order, queryResults, select } = vi.hoisted(() => {
  const queryResults = [];
  const order = vi.fn(() => Promise.resolve(queryResults.shift()));
  const limit = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ select }));

  return { from, limit, order, queryResults, select };
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
    limit.mockClear();
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
    expect(select).toHaveBeenCalledWith("*");
    expect(limit).toHaveBeenCalledWith(101);
    expect(result.data[0]).toMatchObject({
      phone: "555",
      direction: "outbound",
      lastMessagePreview: "Hello",
    });
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
