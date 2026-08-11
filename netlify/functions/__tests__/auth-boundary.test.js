import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  MUTATION_ROLES,
  bearerToken,
  requireAuthenticatedRequest,
  requireDealInOrganization,
  requireTenantContext,
} = require("../_shared/auth.cjs");

function request(token = "valid-token", organizationId = "") {
  return {
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(organizationId ? { "x-organization-id": organizationId } : {}),
    },
  };
}

function queryResult(result) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

function clients({
  authError = null,
  memberships = [
    {
      organization_id: "org-1",
      role: "analyst",
      status: "active",
      organization: { status: "active" },
    },
  ],
  user = { id: "user-1", email: "user@example.com" },
} = {}) {
  const membershipQuery = queryResult({ data: memberships, error: null });
  return {
    membershipQuery,
    value: {
      authClient: {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: authError }) },
      },
      adminClient: { from: vi.fn(() => membershipQuery) },
    },
  };
}

function responseBody(result) {
  return JSON.parse(result.response.body);
}

describe("Netlify authenticated tenant boundary", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("rejects missing and malformed Authorization headers", async () => {
    const configured = clients();
    const missing = await requireAuthenticatedRequest(request(""), {
      clients: configured.value,
    });
    const malformed = await requireAuthenticatedRequest(
      { headers: { authorization: "Token invalid" } },
      { clients: configured.value }
    );

    expect(missing.response.statusCode).toBe(401);
    expect(malformed.response.statusCode).toBe(401);
    expect(configured.value.authClient.auth.getUser).not.toHaveBeenCalled();
    expect(bearerToken({ headers: { Authorization: "Bearer abc" } })).toBe("abc");
  });

  it("rejects invalid or expired tokens without returning token material", async () => {
    const configured = clients({ authError: new Error("expired") });
    const result = await requireAuthenticatedRequest(request("rejected-token"), {
      clients: configured.value,
    });

    expect(result.response.statusCode).toBe(401);
    expect(result.response.body).not.toContain("rejected-token");
    expect(result.response.body).not.toContain("service_role");
  });

  it("resolves a valid token to stable user identity without retaining the token", async () => {
    const configured = clients();
    const result = await requireAuthenticatedRequest(request(), {
      clients: configured.value,
    });

    expect(configured.value.authClient.auth.getUser).toHaveBeenCalledWith(
      "valid-token"
    );
    expect(result.auth).toEqual({
      authenticated: true,
      userId: "user-1",
      email: "user@example.com",
    });
    expect(result.auth).not.toHaveProperty("accessToken");
  });

  it("rejects users with no active membership, including inactive membership results", async () => {
    const none = clients({ memberships: [] });
    const inactive = clients({
      memberships: [{ organization_id: "org-1", role: "invalid", status: "active" }],
    });

    expect(
      (await requireTenantContext(request(), { clients: none.value })).response
        .statusCode
    ).toBe(403);
    expect(
      (await requireTenantContext(request(), { clients: inactive.value })).response
        .statusCode
    ).toBe(403);
  });

  it("denies viewer mutation and allows analyst, admin, and owner mutation", async () => {
    for (const [role, expected] of [
      ["viewer", 403],
      ["analyst", 200],
      ["admin", 200],
      ["owner", 200],
    ]) {
      const configured = clients({
        memberships: [
          { organization_id: "org-1", role, status: "active", organization: { status: "active" } },
        ],
      });
      const result = await requireTenantContext(request(), {
        allowedRoles: MUTATION_ROLES,
        clients: configured.value,
      });

      expect(result.response?.statusCode || 200, role).toBe(expected);
    }
  });

  it("does not trust a client-supplied unrelated organization", async () => {
    const configured = clients({ memberships: [] });
    const result = await requireTenantContext(request("valid-token", "org-other"), {
      clients: configured.value,
      requestedOrganizationId: "org-other",
    });

    expect(result.response.statusCode).toBe(403);
    expect(configured.membershipQuery.eq).toHaveBeenCalledWith(
      "organization_id",
      "org-other"
    );
  });

  it("rejects conflicting header/body organization scopes", async () => {
    const configured = clients();
    const result = await requireTenantContext(request("valid-token", "org-1"), {
      clients: configured.value,
      requestedOrganizationId: "org-2",
    });

    expect(result.response.statusCode).toBe(403);
    expect(responseBody(result).error).toMatch(/conflicting organization/i);
  });

  it("requires explicit selection for multiple memberships", async () => {
    const configured = clients({
      memberships: [
        { organization_id: "org-1", role: "owner", status: "active" },
        { organization_id: "org-2", role: "viewer", status: "active" },
      ],
    });
    const result = await requireTenantContext(request(), {
      clients: configured.value,
    });

    expect(result.response.statusCode).toBe(403);
    expect(responseBody(result).error).toMatch(/explicit organization/i);
  });

  it("validates an explicit organization and returns tenant context", async () => {
    const configured = clients();
    const result = await requireTenantContext(request("valid-token", "org-1"), {
      clients: configured.value,
    });

    expect(result.context).toMatchObject({
      userId: "user-1",
      organizationId: "org-1",
      role: "analyst",
      membershipStatus: "active",
    });
    expect(result.context).not.toHaveProperty("accessToken");
  });

  it("scopes deal authorization by both resource and organization", async () => {
    const dealQuery = queryResult({
      data: [{ id: "deal-1", organization_id: "org-1" }],
      error: null,
    });
    const adminClient = { from: vi.fn(() => dealQuery) };
    const result = await requireDealInOrganization(
      adminClient,
      "deal-1",
      "org-1"
    );

    expect(result.deal.id).toBe("deal-1");
    expect(dealQuery.eq).toHaveBeenCalledWith("id", "deal-1");
    expect(dealQuery.eq).toHaveBeenCalledWith("organization_id", "org-1");
  });

  it("hides cross-tenant or missing deals behind a 404", async () => {
    const dealQuery = queryResult({ data: [], error: null });
    const result = await requireDealInOrganization(
      { from: vi.fn(() => dealQuery) },
      "deal-other",
      "org-1"
    );

    expect(result.response.statusCode).toBe(404);
    expect(responseBody(result).error).toBe("Resource not found.");
  });

  it("does not log raw bearer tokens", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const configured = clients();

    await requireTenantContext(request("never-log-this-token"), {
      clients: configured.value,
    });

    const logged = [...log.mock.calls, ...warn.mock.calls, ...error.mock.calls]
      .flat()
      .join(" ");
    expect(logged).not.toContain("never-log-this-token");
  });
});
