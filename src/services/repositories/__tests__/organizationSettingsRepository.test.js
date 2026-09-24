import { beforeEach, describe, expect, it, vi } from "vitest";

const query = {
  eq: vi.fn(() => query),
  limit: vi.fn(() => query),
  order: vi.fn(() => query),
  select: vi.fn(() => query),
  update: vi.fn(() => query),
};
const from = vi.fn(() => query);

vi.mock("../../../supabaseClient", () => ({ supabase: { from } }));
vi.mock("../../organizations", () => ({
  requireActiveOrganizationContext: vi.fn().mockResolvedValue({ organizationId: "org-1" }),
}));

describe("organizationSettingsRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.eq.mockReturnValue(query);
    query.select.mockReturnValue(query);
    query.update.mockReturnValue(query);
    query.order.mockResolvedValue({ data: [], error: null });
    query.limit.mockResolvedValue({
      data: [{ organization_id: "org-1", default_market: "Phoenix" }],
      error: null,
    });
  });

  it("reloads settings only from the active organization", async () => {
    const { loadOrganizationSettings } = await import("../organizationSettingsRepository");
    const result = await loadOrganizationSettings();

    expect(result.success).toBe(true);
    expect(from).toHaveBeenCalledWith("organization_settings");
    expect(query.eq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(result.data.default_market).toBe("Phoenix");
  });

  it("persists only allowlisted operational fields in the active organization", async () => {
    const { saveOrganizationSettings } = await import("../organizationSettingsRepository");
    const result = await saveOrganizationSettings({
      default_market: "Tampa",
      organization_id: "attacker-org",
      local_theme: "dark",
    });

    expect(result.success).toBe(true);
    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({ default_market: "Tampa" })
    );
    expect(query.update.mock.calls[0][0]).not.toHaveProperty("organization_id");
    expect(query.update.mock.calls[0][0]).not.toHaveProperty("local_theme");
    expect(query.eq).toHaveBeenCalledWith("organization_id", "org-1");
  });
});
