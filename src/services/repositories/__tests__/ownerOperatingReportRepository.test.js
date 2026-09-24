import { beforeEach, describe, expect, it, vi } from "vitest";

const query = {
  eq: vi.fn(() => query),
  order: vi.fn(() => query),
  range: vi.fn(),
  select: vi.fn(() => query),
};
const from = vi.fn(() => query);

vi.mock("../../../supabaseClient", () => ({
  supabase: { from },
}));

vi.mock("../../organizations", () => ({
  requireActiveOrganizationContext: vi.fn().mockResolvedValue({ organizationId: "org-1" }),
}));

describe("ownerOperatingReportRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.range.mockResolvedValue({ data: [], error: null });
  });

  it("loads every canonical source with an explicit active-tenant predicate", async () => {
    const { loadOwnerOperatingReportSources } = await import("../ownerOperatingReportRepository");
    const result = await loadOwnerOperatingReportSources();

    expect(result.success).toBe(true);
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "deals",
      "seller_tasks",
      "sequences",
      "offer_revisions",
      "deal_closing_revisions",
      "message_logs",
    ]);
    expect(query.eq).toHaveBeenCalledTimes(6);
    query.eq.mock.calls.forEach((call) => {
      expect(call).toEqual(["organization_id", "org-1"]);
    });
  });
});
