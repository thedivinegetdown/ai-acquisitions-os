import { beforeEach, describe, expect, it, vi } from "vitest";

const query = {
  eq: vi.fn(() => query),
  in: vi.fn(() => query),
  limit: vi.fn(() => query),
  order: vi.fn(() => query),
  range: vi.fn(),
  select: vi.fn(() => query),
  insert: vi.fn(() => query),
  update: vi.fn(() => query),
};

const from = vi.fn(() => query);

vi.mock("../../../supabaseClient", () => ({
  supabase: {
    from,
  },
}));

vi.mock("../../organizations", () => ({
  requireActiveOrganizationContext: vi.fn().mockResolvedValue({ organizationId: "org-1" }),
  stripOrganizationOwnership: (payload = {}) =>
    Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "organization_id")),
}));

const recordOperationalFailure = vi.fn().mockResolvedValue({ success: true });
vi.mock("../operationalDiagnosticRepository", () => ({ recordOperationalFailure }));

describe("dealRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.order.mockReturnValue(query);
    query.range.mockResolvedValue({ data: [{ id: "1" }], error: null });
    query.limit.mockResolvedValue({ data: [{ id: "1" }], error: null });
    query.select.mockReturnValue(query);
    query.insert.mockReturnValue(query);
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
    expect(query.order).toHaveBeenCalledWith("id", { ascending: true });
    expect(query.eq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(query.range).toHaveBeenCalledWith(0, 199);
  });

  it("returns every tenant deal exactly once across deterministic pages", async () => {
    const firstPage = Array.from({ length: 200 }, (_, index) => ({ id: `deal-${String(index).padStart(3, "0")}` }));
    const secondPage = [{ id: "deal-200" }, { id: "deal-201" }];
    query.range
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({ data: secondPage, error: null });
    const { listDeals } = await import("../dealRepository");

    const result = await listDeals();

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(202);
    expect(new Set(result.data.map((row) => row.id)).size).toBe(202);
    expect(query.range.mock.calls).toEqual([[0, 199], [200, 399]]);
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

  it("scopes canonical writes to the active organization and expected stage", async () => {
    const { updateOwnedDeal } = await import("../dealRepository");
    const result = await updateOwnedDeal(
      "deal-1",
      { stage: "Contacted", organization_id: "attacker-org" },
      { expectedStage: "New Lead" }
    );

    expect(result.success).toBe(true);
    expect(query.update).toHaveBeenCalledWith({ stage: "Contacted" });
    expect(query.eq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(query.eq).toHaveBeenCalledWith("stage", "New Lead");
  });

  it("persists imports with organization ownership and classifies duplicate retries", async () => {
    query.limit
      .mockResolvedValueOnce({ data: [{ id: "deal-1" }], error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "23505", message: "duplicate" } })
      .mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "insert failed" } });
    const { persistImportedDeals } = await import("../dealRepository");

    const result = await persistImportedDeals([
      { rowNumber: 1, payload: { import_id: "lead-intake:v1:a", organization_id: "wrong" } },
      { rowNumber: 2, payload: { import_id: "lead-intake:v1:a" } },
      { rowNumber: 3, payload: { import_id: "lead-intake:v1:b" } },
    ]);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ importedCount: 1, duplicateCount: 1, failedCount: 1 });
    expect(recordOperationalFailure).toHaveBeenCalledWith(expect.objectContaining({
      errorClassification: "persistence-failed",
      operationType: "lead-import",
    }));
    expect(result.data.results[2].error).toBe("Record was rejected by persistence validation.");
    expect(result.data.results.map((row) => row.status)).toEqual([
      "imported",
      "duplicate",
      "failed",
    ]);
    expect(query.insert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ import_id: "lead-intake:v1:a", organization_id: "org-1" })
    );
  });
});
