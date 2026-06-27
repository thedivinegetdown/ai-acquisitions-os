import { beforeEach, describe, expect, it, vi } from "vitest";

const query = {
  eq: vi.fn(() => query),
  in: vi.fn(() => query),
  limit: vi.fn(() => query),
  order: vi.fn(() => query),
  select: vi.fn(() => query),
  update: vi.fn(() => query),
};

const from = vi.fn(() => query);

vi.mock("../../../supabaseClient", () => ({
  supabase: {
    from,
  },
}));

describe("dealRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.order.mockResolvedValue({ data: [{ id: "1" }], error: null });
    query.limit.mockResolvedValue({ data: [{ id: "1" }], error: null });
    query.select.mockReturnValue(query);
    query.update.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.in.mockReturnValue(query);
  });

  it("lists deals ordered by property address", async () => {
    const { listDeals } = await import("../dealRepository");
    const result = await listDeals();

    expect(result.success).toBe(true);
    expect(from).toHaveBeenCalledWith("deals");
    expect(query.select).toHaveBeenCalledWith("*");
    expect(query.order).toHaveBeenCalledWith("property_address", { ascending: true });
  });

  it("rejects updates without a deal id before calling Supabase", async () => {
    const { updateDeal } = await import("../dealRepository");
    const result = await updateDeal("", { stage: "Closed" });

    expect(result.success).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("updates selected deal fields by id", async () => {
    const { updateDeal } = await import("../dealRepository");
    const result = await updateDeal("deal-1", { stage: "Contacted" });

    expect(result.success).toBe(true);
    expect(query.update).toHaveBeenCalledWith({ stage: "Contacted" });
    expect(query.eq).toHaveBeenCalledWith("id", "deal-1");
  });
});
