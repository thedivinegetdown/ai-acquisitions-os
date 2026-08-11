import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../auth", () => ({ getValidatedSession: vi.fn() }));
vi.mock("../../organizations", () => ({
  requireActiveOrganizationContext: vi.fn(),
}));

import { getValidatedSession } from "../../auth";
import { requireActiveOrganizationContext } from "../../organizations";
import { authenticatedFunctionFetch } from "../authenticatedFunctionFetch";

describe("authenticatedFunctionFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    getValidatedSession.mockResolvedValue({
      session: { access_token: "user-access-token" },
      error: null,
    });
    requireActiveOrganizationContext.mockResolvedValue({
      organizationId: "org-1",
    });
  });

  it("attaches the current access token and validated organization scope", async () => {
    await authenticatedFunctionFetch("/.netlify/functions/send-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "ignored" },
      body: "{}",
    });

    expect(fetch).toHaveBeenCalledWith(
      "/.netlify/functions/send-sms",
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer user-access-token",
          "X-Organization-Id": "org-1",
        },
      })
    );
  });

  it("fails closed without a valid current session", async () => {
    getValidatedSession.mockResolvedValue({ session: null, error: null });

    await expect(authenticatedFunctionFetch("/test")).rejects.toThrow(
      "Authentication is required"
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fails closed without active organization context", async () => {
    requireActiveOrganizationContext.mockRejectedValue(
      new Error("No active organization membership is available.")
    );

    await expect(authenticatedFunctionFetch("/test")).rejects.toThrow(
      "No active organization membership"
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fails closed until one organization is explicitly selected", async () => {
    requireActiveOrganizationContext.mockResolvedValue({
      organizationId: "org-1",
      warning: "Multiple active memberships found.",
    });

    await expect(authenticatedFunctionFetch("/test")).rejects.toThrow(
      "Explicit organization selection is required"
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
