import { describe, expect, it } from "vitest";
import {
  buildAuthGuardState,
  canAccessRole,
  getRoleFromUser,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  isAuthenticated,
  normalizeRole,
} from "../index";

function buildSession(overrides = {}) {
  return {
    access_token: "token",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

describe("authorizationService", () => {
  it("normalizes unknown roles to Viewer", () => {
    expect(normalizeRole("Owner")).toBe("Owner");
    expect(normalizeRole("Superuser")).toBe("Viewer");
  });

  it("reads trusted app metadata role before user metadata", () => {
    const user = {
      app_metadata: { role: "Admin" },
      user_metadata: { role: "Viewer" },
    };

    expect(getRoleFromUser(user)).toBe("Admin");
  });

  it("evaluates reusable permission helpers", () => {
    expect(hasPermission("Owner", "canManageSettings")).toBe(true);
    expect(hasPermission("Viewer", "canManageSettings")).toBe(false);
    expect(hasAnyPermission("Viewer", ["canManageSettings", "canViewDashboard"])).toBe(true);
    expect(hasAllPermissions("Viewer", ["canViewDashboard", "canSendMessages"])).toBe(false);
    expect(canAccessRole("Admin", ["Owner", "Admin"])).toBe(true);
  });
});

describe("authGuardService", () => {
  it("allows valid sessions and blocks expired sessions", () => {
    expect(isAuthenticated(buildSession())).toBe(true);
    expect(isAuthenticated(buildSession({ expires_at: 1 }))).toBe(false);
  });

  it("builds loading and unauthorized guard states", () => {
    expect(buildAuthGuardState({ loading: true, session: null })).toEqual({
      allowed: false,
      loading: true,
      unauthorizedReason: null,
    });

    expect(buildAuthGuardState({ loading: false, session: null })).toMatchObject({
      allowed: false,
      unauthorizedReason: "missing_session",
    });
  });
});
