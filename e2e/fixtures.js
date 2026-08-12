import { test as base, expect } from "@playwright/test";

const profiles = {
  owner: {
    email: "owner@eo-e2e.test",
    userId: "user-owner-a",
    organizationId: "org-a",
    serverRole: "owner",
    clientRole: "Owner",
  },
  analyst: {
    email: "analyst@eo-e2e.test",
    userId: "user-analyst-a",
    organizationId: "org-a",
    serverRole: "analyst",
    clientRole: "Acquisitions Manager",
  },
  viewer: {
    email: "viewer@eo-e2e.test",
    userId: "user-viewer-a",
    organizationId: "org-a",
    serverRole: "viewer",
    clientRole: "Viewer",
  },
  orgB: {
    email: "owner-b@eo-e2e.test",
    userId: "user-owner-b",
    organizationId: "org-b",
    serverRole: "owner",
    clientRole: "Owner",
  },
};

const baseDeals = [
  {
    id: "deal-a-residential",
    organization_id: "org-a",
    tenant_id: "tenant-a",
    asset_type: "residential-home",
    property_address: "123 Main Street",
    owner_name: "Alex Seller",
    phone: "+15555550100",
    email: "alex@example.test",
    stage: "New Lead",
    status: "Active",
    source: "Referral",
    acquisitions_rep: "Morgan",
    next_action: "Call seller",
    due_date: "2026-08-11",
    offer_ready: true,
    asking_price: 125000,
    price: 120000,
    arv: 210000,
    repairs: 30000,
    created_at: "2026-08-01T10:00:00.000Z",
    updated_at: "2026-08-10T10:00:00.000Z",
  },
  {
    id: "deal-a-land",
    organization_id: "org-a",
    tenant_id: "tenant-a",
    asset_type: "vacant-residential-land",
    property_address: "45 Meadow Lane",
    owner_name: "Land Owner",
    phone: "+15555550300",
    stage: "Contacted",
    status: "Active",
    source: "Direct Mail",
    next_action: "Review parcel",
    due_date: "2026-08-15",
    created_at: "2026-08-02T10:00:00.000Z",
    updated_at: "2026-08-09T10:00:00.000Z",
  },
  {
    id: "deal-a-opted-out",
    organization_id: "org-a",
    tenant_id: "tenant-a",
    asset_type: "residential-home",
    property_address: "99 Quiet Court",
    owner_name: "Opted Out Seller",
    phone: "+15555550999",
    stage: "Contacted",
    status: "Active",
    source: "Referral",
    next_action: "Do not text",
    created_at: "2026-08-03T10:00:00.000Z",
    updated_at: "2026-08-08T10:00:00.000Z",
  },
  {
    id: "deal-b-secret",
    organization_id: "org-b",
    tenant_id: "tenant-b",
    asset_type: "residential-home",
    property_address: "800 Other Org Road",
    owner_name: "Org B Seller",
    phone: "+15555550700",
    stage: "New Lead",
    status: "Active",
    source: "Referral",
    created_at: "2026-08-04T10:00:00.000Z",
    updated_at: "2026-08-07T10:00:00.000Z",
  },
];

const baseMessages = [
  {
    id: "message-a-inbound",
    organization_id: "org-a",
    deal_id: "deal-a-residential",
    phone: "+15555550100",
    message: "Can you call me this afternoon?",
    direction: "inbound",
    status: "received",
    created_at: "2026-08-11T14:00:00.000Z",
  },
  {
    id: "message-a-opted-out",
    organization_id: "org-a",
    deal_id: "deal-a-opted-out",
    phone: "+15555550999",
    message: "STOP",
    direction: "inbound",
    status: "received",
    consent_event: "opted-out",
    created_at: "2026-08-11T13:00:00.000Z",
  },
  {
    id: "message-b-inbound",
    organization_id: "org-b",
    deal_id: "deal-b-secret",
    phone: "+15555550700",
    message: "Org B private message",
    direction: "inbound",
    status: "received",
    created_at: "2026-08-11T12:00:00.000Z",
  },
];

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function tokenFor(profileName = "analyst") {
  const profile = profiles[profileName];
  return [
    encode({ alg: "none", typ: "JWT" }),
    encode({
      aud: "authenticated",
      exp: 4102444800,
      sub: profile.userId,
      email: profile.email,
      role: "authenticated",
      app_metadata: { role: profile.clientRole },
      user_metadata: { role: profile.clientRole },
    }),
    "eo-e2e-signature",
  ].join(".");
}

function profileFromToken(token = "") {
  if (!token) return null;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return Object.values(profiles).find((profile) => profile.userId === payload.sub) || null;
  } catch {
    return null;
  }
}

function profileFromRequest(request) {
  const authorization = request.headers().authorization || "";
  return profileFromToken(authorization.replace(/^Bearer\s+/i, ""));
}

function userFor(profile) {
  return {
    id: profile.userId,
    aud: "authenticated",
    role: "authenticated",
    email: profile.email,
    app_metadata: { role: profile.clientRole, provider: "email", providers: ["email"] },
    user_metadata: { role: profile.clientRole },
    created_at: "2026-08-01T00:00:00.000Z",
  };
}

function sessionFor(profile) {
  return {
    access_token: tokenFor(Object.keys(profiles).find((key) => profiles[key] === profile)),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: 4102444800,
    refresh_token: "eo-e2e-refresh-" + profile.userId,
    user: userFor(profile),
  };
}

function corsHeaders(extra = {}) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-organization-id",
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    ...extra,
  };
}

async function json(route, status, body, headers = {}) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders(headers),
    body: JSON.stringify(body),
  });
}

async function secureJson(route, status, body, headers = {}) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers,
    body: JSON.stringify(body),
  });
}

function bodyFrom(request) {
  try {
    return request.postDataJSON();
  } catch {
    return {};
  }
}

function requestedEquality(url, field) {
  const value = url.searchParams.get(field);
  if (!value || !value.startsWith("eq.")) return "";
  return decodeURIComponent(value.slice(3));
}

function visibleDeals(profile, state) {
  const source = state.dealsOverride === null ? state.deals : state.dealsOverride;
  return source.filter((deal) => deal.organization_id === profile.organizationId);
}

function visibleMessages(profile, state, url) {
  const source = state.messagesOverride === null ? state.messages : state.messagesOverride;
  const phone = requestedEquality(url, "phone");
  const dealId = requestedEquality(url, "deal_id");
  return source
    .filter((message) => message.organization_id === profile.organizationId)
    .filter((message) => !phone || message.phone === phone)
    .filter((message) => !dealId || message.deal_id === dealId);
}

async function handleAuth(route, state) {
  const request = route.request();
  const url = new URL(request.url());
  if (request.method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers: corsHeaders() });
    return;
  }

  if (url.pathname.endsWith("/token")) {
    const payload = bodyFrom(request);
    const profile = Object.values(profiles).find((candidate) => candidate.email === payload.email);
    if (!profile || payload.password !== "eo-e2e-password") {
      await json(route, 400, { code: "invalid_credentials", msg: "Invalid login credentials." });
      return;
    }
    state.lastAuthenticatedProfile = profile;
    await json(route, 200, sessionFor(profile));
    return;
  }

  if (url.pathname.endsWith("/user")) {
    const profile = profileFromRequest(request);
    if (!profile) {
      await json(route, 401, { code: "bad_jwt", msg: "Invalid or expired authentication." });
      return;
    }
    await json(route, 200, userFor(profile));
    return;
  }

  if (url.pathname.endsWith("/logout")) {
    await json(route, 204, {});
    return;
  }

  await json(route, 404, { message: "Unknown local auth fixture route." });
}

async function handleRest(route, state) {
  const request = route.request();
  const url = new URL(request.url());
  if (request.method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers: corsHeaders() });
    return;
  }

  const profile = profileFromRequest(request);
  if (!profile) {
    await json(route, 401, { message: "Authentication required." });
    return;
  }

  const table = url.pathname.split("/rest/v1/")[1]?.split("/")[0] || "";
  state.databaseRequests.push({ method: request.method(), table, profile: profile.userId });

  if (state.malformedTable === table) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: corsHeaders(),
      body: "{not-valid-json",
    });
    return;
  }

  if (request.method() !== "GET" && request.method() !== "HEAD") {
    if (profile.serverRole === "viewer") {
      await json(route, 403, { message: "Insufficient organization role." });
      return;
    }
    const payload = bodyFrom(request);
    const rows = Array.isArray(payload) ? payload : [payload];
    if (table === "message_logs") {
      rows.forEach((row, index) => state.messages.push({
        id: row.id || "local-message-" + (state.messages.length + index + 1),
        ...row,
        organization_id: profile.organizationId,
      }));
    }
    await json(route, 201, rows, { "content-range": "0-" + Math.max(0, rows.length - 1) + "/" + rows.length });
    return;
  }

  let rows = [];
  if (table === "deals") rows = visibleDeals(profile, state);
  if (table === "message_logs") rows = visibleMessages(profile, state, url);
  if (table === "organization_memberships") {
    state.membershipReads += 1;
    rows = [{
      organization_id: profile.organizationId,
      role: profile.serverRole,
      status: "active",
      created_at: "2026-08-01T00:00:00.000Z",
      organization: {
        id: profile.organizationId,
        name: profile.organizationId === "org-a" ? "Acme Acquisitions" : "Other Organization",
        slug: profile.organizationId,
        status: "active",
      },
    }];
  }

  const phone = requestedEquality(url, "phone");
  const id = requestedEquality(url, "id");
  if (phone) rows = rows.filter((row) => row.phone === phone);
  if (id) rows = rows.filter((row) => row.id === id);
  await json(route, 200, rows, {
    "content-range": rows.length ? "0-" + (rows.length - 1) + "/" + rows.length : "*/0",
  });
}

async function handleFunction(route, state) {
  const request = route.request();
  const url = new URL(request.url());
  const name = url.pathname.split("/").pop();

  if (name === "health-check") {
    await secureJson(route, 200, {
      success: true,
      status: "ok",
      configured: false,
      checkedAt: "2026-08-11T12:00:00.000Z",
      integrations: [],
    }, { "cache-control": "no-store" });
    return;
  }
  if (name === "inbound-v2") {
    await route.fulfill({ status: 403, contentType: "text/plain", body: "Invalid webhook signature." });
    return;
  }
  if (name === "stripe-webhook") {
    await secureJson(route, 400, { success: false, error: "Invalid Stripe webhook signature." });
    return;
  }

  const profile = profileFromRequest(request);
  if (!profile) {
    await secureJson(route, 401, { success: false, error: "Authentication required." });
    return;
  }

  const requestedOrganizationId = request.headers()["x-organization-id"] || "";
  if (!requestedOrganizationId || requestedOrganizationId !== profile.organizationId) {
    await secureJson(route, 403, { success: false, error: "Organization access denied." });
    return;
  }
  if (profile.serverRole === "viewer") {
    await secureJson(route, 403, { success: false, error: "Insufficient organization role." });
    return;
  }

  const payload = bodyFrom(request);
  if (payload.deal_id) {
    const deal = state.deals.find((candidate) => candidate.id === payload.deal_id);
    if (!deal || deal.organization_id !== profile.organizationId) {
      await secureJson(route, 404, { success: false, error: "Resource not found." });
      return;
    }
  }

  if (state.apiMode === "network-failure") {
    state.failuresRemaining = Math.max(0, (state.failuresRemaining || 1) - 1);
    if (state.failuresRemaining === 0) state.apiMode = "normal";
    await route.abort("connectionfailed");
    return;
  }
  if (state.apiMode === "malformed") {
    state.failuresRemaining = Math.max(0, (state.failuresRemaining || 1) - 1);
    if (state.failuresRemaining === 0) state.apiMode = "normal";
    await route.fulfill({ status: 200, contentType: "application/json", body: "{invalid" });
    return;
  }
  if (state.apiMode === "server-error") {
    state.failuresRemaining = Math.max(0, (state.failuresRemaining || 1) - 1);
    if (state.failuresRemaining === 0) state.apiMode = "normal";
    await secureJson(route, 500, { success: false, error: "The service is temporarily unavailable." });
    return;
  }

  if (name === "send-sms") {
    state.securedFunctionRequests.push({
      authorizationPresent: Boolean(request.headers().authorization),
      organizationId: requestedOrganizationId,
      role: profile.serverRole,
      payload,
    });
    if (payload.to === "+15555550999") {
      await secureJson(route, 409, { success: false, error: "Recipient has opted out of SMS." });
      return;
    }
    state.persistedMessages.push({
      organization_id: profile.organizationId,
      deal_id: payload.deal_id || null,
      phone: payload.to,
      message: payload.message,
      status: "test",
      direction: "outbound",
    });
    state.messages.push({
      id: "test-message-" + state.persistedMessages.length,
      organization_id: profile.organizationId,
      deal_id: payload.deal_id || null,
      phone: payload.to,
      message: payload.message,
      status: "test",
      direction: "outbound",
      created_at: "2026-08-11T15:00:00.000Z",
    });
    await secureJson(route, 200, {
      success: true,
      mode: "test",
      status: "test",
      sid: "TEST_MESSAGE",
      message: "Message saved in test mode.",
    });
    return;
  }

  await secureJson(route, 200, { success: true, mode: "test" });
}

async function installRoutes(page, state) {
  page.on("request", (request) => {
    state.browserRequests.push({
      url: request.url(),
      headers: request.headers(),
      postData: request.postData() || "",
    });
  });
  await page.route("**/e2e-supabase/auth/v1/**", (route) => handleAuth(route, state));
  await page.route("**/e2e-supabase/rest/v1/**", (route) => handleRest(route, state));
  await page.route("**/.netlify/functions/**", (route) => handleFunction(route, state));
}

export const test = base.extend({
  e2eState: async ({}, use) => {
    await use({
      apiMode: "normal",
      failuresRemaining: 0,
      browserRequests: [],
      databaseRequests: [],
      deals: structuredClone(baseDeals),
      dealsOverride: null,
      malformedTable: "",
      membershipReads: 0,
      messages: structuredClone(baseMessages),
      messagesOverride: null,
      persistedMessages: [],
      providerCalls: 0,
      securedFunctionRequests: [],
    });
  },
  page: async ({ page, e2eState }, use) => {
    await installRoutes(page, e2eState);
    await use(page);
  },
});

export async function loginAs(page, profileName = "analyst") {
  const profile = profiles[profileName];
  await page.goto("/today");
  await page.getByLabel("Email").fill(profile.email);
  await page.getByLabel("Password").fill("eo-e2e-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation", { name: "Workspaces" })).toBeVisible();
  return profile;
}

export { expect, profiles };
