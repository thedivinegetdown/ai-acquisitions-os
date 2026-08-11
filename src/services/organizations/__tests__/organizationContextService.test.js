import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../auth", () => ({ getValidatedUser: vi.fn() }));
vi.mock("../../repositories/organizationRepository", () => ({
  listCurrentUserMemberships: vi.fn(),
}));

import { getValidatedUser } from "../../auth";
import { listCurrentUserMemberships } from "../../repositories/organizationRepository";
import {
  addCurrentOrganizationOwnership,
  requireActiveOrganizationContext,
  stripOrganizationOwnership,
} from "../organizationContextService";

describe("organization context service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getValidatedUser.mockResolvedValue({ user: { id: "user-1" }, error: null });
  });

  it("derives organization and role only from active membership data", async () => {
    listCurrentUserMemberships.mockResolvedValue({
      success: true,
      data: [
        {
          organization_id: "org-1",
          role: "analyst",
          status: "active",
          organization: { id: "org-1", name: "Acme" },
        },
      ],
    });

    await expect(requireActiveOrganizationContext()).resolves.toMatchObject({
      organizationId: "org-1",
      userId: "user-1",
      role: "analyst",
      status: "active",
    });
    expect(listCurrentUserMemberships).toHaveBeenCalledWith("user-1");
  });

  it("fails closed without an authenticated user or membership", async () => {
    getValidatedUser.mockResolvedValueOnce({ user: null, error: null });
    await expect(requireActiveOrganizationContext()).rejects.toThrow(
      "authenticated user"
    );

    getValidatedUser.mockResolvedValueOnce({ user: { id: "user-1" }, error: null });
    listCurrentUserMemberships.mockResolvedValueOnce({ success: true, data: [] });
    await expect(requireActiveOrganizationContext()).rejects.toThrow(
      "No active organization membership"
    );
  });

  it("overrides caller ownership and warns when deterministic fallback is used", async () => {
    listCurrentUserMemberships.mockResolvedValue({
      success: true,
      data: [
        { organization_id: "org-a", role: "owner", status: "active" },
        { organization_id: "org-b", role: "viewer", status: "active" },
      ],
    });

    const context = await requireActiveOrganizationContext();
    expect(context.organizationId).toBe("org-a");
    expect(context.warning).toMatch(/multiple active memberships/i);
    await expect(
      addCurrentOrganizationOwnership({ organization_id: "attacker-org", name: "Lead" })
    ).resolves.toEqual({ organization_id: "org-a", name: "Lead" });
  });

  it("strips every supported ownership alias from update payloads", () => {
    expect(
      stripOrganizationOwnership({
        organization_id: "a",
        organizationId: "b",
        tenant_id: "c",
        tenantId: "d",
        status: "open",
      })
    ).toEqual({ status: "open" });
  });
});
