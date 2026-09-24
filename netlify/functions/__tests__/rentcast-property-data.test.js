import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createHandler } = require("../property-data-rentcast.js");
const { fetchRentCastPropertyData, normalizeRentCastResult } = require("../_shared/rentcast.cjs");

const now = "2026-09-24T15:00:00.000Z";
const deal = { id: "deal-1", organization_id: "org-1", property_address: "123 Main St, Tampa, FL 33602", asset_type: "residential-home" };
const fixture = {
  propertyRecords: [{
    id: "rentcast-property-1", formattedAddress: deal.property_address,
    city: "Tampa", state: "FL", zipCode: "33602", county: "Hillsborough",
    propertyType: "Single Family", bedrooms: 3, bathrooms: 2, squareFootage: 1500,
    lotSize: 7200, yearBuilt: 1992, assessorID: "APN-100", zoning: "R-1",
    taxAssessments: { 2025: { year: 2025, value: 210000, land: 70000, improvements: 140000 } },
    propertyTaxes: { 2025: { year: 2025, total: 3200 } },
    history: { "2021-01-02": { event: "Sale", date: "2021-01-02T00:00:00.000Z", price: 180000 } },
  }],
  valuation: {
    price: 255000, priceRangeLow: 235000, priceRangeHigh: 275000,
    subjectProperty: { id: "rentcast-property-1", formattedAddress: deal.property_address },
    comparables: [{ id: "comp-1", formattedAddress: "125 Main St, Tampa, FL 33602", price: 250000, correlation: 0.94, distance: 0.2, status: "Inactive" }],
  },
};

function responseBody(response) { return JSON.parse(response.body); }
function event(action = "refresh", dealId = deal.id) {
  return { httpMethod: "POST", headers: {}, body: JSON.stringify({ action, dealId }) };
}
function authorize(adminClient = {}) {
  return vi.fn().mockResolvedValue({
    context: { organizationId: "org-1", role: "owner", userId: "owner-1" },
    clients: { adminClient },
  });
}
function evidence(overrides = {}) {
  return {
    id: "evidence-1", organization_id: "org-1", deal_id: deal.id,
    provider: "rentcast", property_identity: deal.property_address.toLowerCase(),
    provider_record_id: "rentcast-property-1", retrieved_at: now,
    expires_at: "2026-09-25T15:00:00.000Z",
    normalized_data: normalizeRentCastResult({ ...fixture, retrievedAt: now }),
    ...overrides,
  };
}
function repository({ policy = { provider: "rentcast", enabled: true, monthly_request_cap: 10 }, cached = null } = {}) {
  return {
    loadDeal: vi.fn().mockResolvedValue(deal),
    loadPolicy: vi.fn().mockResolvedValue(policy),
    loadEvidence: vi.fn().mockResolvedValue(cached),
    persistEvidence: vi.fn().mockImplementation(async (_client, value) => evidence({ ...value, id: "evidence-1" })),
  };
}

describe("RentCast property data endpoint", () => {
  const originalKey = process.env.RENTCAST_API_KEY;
  afterEach(() => {
    if (originalKey === undefined) delete process.env.RENTCAST_API_KEY;
    else process.env.RENTCAST_API_KEY = originalKey;
  });

  it("makes zero external calls when disabled and reports a safe unavailable state", async () => {
    const providerRequest = vi.fn();
    const providerAuthorization = vi.fn();
    const response = await createHandler({
      authorize: authorize(), dataRepository: repository({ policy: { provider: "rentcast", enabled: false, monthly_request_cap: null } }),
      providerRequest, providerAuthorization, clock: () => now, env: { RENTCAST_API_KEY: "server-key" },
    })(event());
    expect(response.statusCode).toBe(503);
    expect(responseBody(response).status).toBe("provider-disabled");
    expect(providerAuthorization).not.toHaveBeenCalled();
    expect(providerRequest).not.toHaveBeenCalled();
  });

  it("fails safely with no key, no usage reservation and no external call", async () => {
    const providerRequest = vi.fn();
    const providerAuthorization = vi.fn();
    const response = await createHandler({ authorize: authorize(), dataRepository: repository(), providerRequest, providerAuthorization, clock: () => now, env: {} })(event());
    expect(response.statusCode).toBe(503);
    expect(responseBody(response).status).toBe("provider-unconfigured");
    expect(providerAuthorization).not.toHaveBeenCalled();
    expect(providerRequest).not.toHaveBeenCalled();
  });

  it("reserves exactly two capped requests, persists normalized evidence, and never returns the key", async () => {
    const dataRepository = repository();
    const providerAuthorization = vi.fn().mockResolvedValue({ policy: { allowed: true, request_count: 2, monthly_request_cap: 10 } });
    const providerRequest = vi.fn().mockResolvedValue(normalizeRentCastResult({ ...fixture, retrievedAt: now }));
    const response = await createHandler({ authorize: authorize(), dataRepository, providerAuthorization, providerRequest, clock: () => now, env: { RENTCAST_API_KEY: "secret-test-key" } })(event());
    const body = responseBody(response);
    expect(response.statusCode).toBe(200);
    expect(providerAuthorization).toHaveBeenCalledWith(expect.anything(), { organizationId: "org-1", provider: "rentcast", requestCount: 2 });
    expect(providerRequest).toHaveBeenCalledTimes(1);
    expect(dataRepository.persistEvidence).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ organization_id: "org-1", deal_id: "deal-1", provider: "rentcast", retrieved_at: now }));
    expect(body.evidence.data).toMatchObject({ source: "rentcast", generatedAt: now, property: { assessorId: "APN-100" }, tax: { assessedValue: 210000 }, valuation: { estimatedValue: 255000, arvEstimate: null } });
    expect(body.evidence.data.comps).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain("secret-test-key");
  });

  it("reuses a fresh tenant-scoped cache without usage or provider calls", async () => {
    const providerAuthorization = vi.fn();
    const providerRequest = vi.fn();
    const response = await createHandler({ authorize: authorize(), dataRepository: repository({ cached: evidence() }), providerAuthorization, providerRequest, clock: () => now, env: { RENTCAST_API_KEY: "server-key" } })(event());
    expect(responseBody(response).cacheHit).toBe(true);
    expect(providerAuthorization).not.toHaveBeenCalled();
    expect(providerRequest).not.toHaveBeenCalled();
  });

  it("fails closed at the organization cap before making either provider request", async () => {
    const providerRequest = vi.fn();
    const providerAuthorization = vi.fn().mockResolvedValue({
      response: { statusCode: 429, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ success: false, status: "monthly-cap-reached", error: "Organization provider usage cap reached." }) },
    });
    const response = await createHandler({ authorize: authorize(), dataRepository: repository(), providerAuthorization, providerRequest, clock: () => now, env: { RENTCAST_API_KEY: "server-key" } })(event());
    expect(response.statusCode).toBe(429);
    expect(providerRequest).not.toHaveBeenCalled();
  });

  it("does not expose another tenant or another property identity cache entry", async () => {
    const dataRepository = repository({ cached: evidence({ organization_id: "org-2", property_identity: "999 other st" }) });
    const providerRequest = vi.fn().mockResolvedValue(normalizeRentCastResult({ ...fixture, retrievedAt: now }));
    await createHandler({ authorize: authorize(), dataRepository, providerAuthorization: vi.fn().mockResolvedValue({ policy: { allowed: true } }), providerRequest, clock: () => now, env: { RENTCAST_API_KEY: "server-key" } })(event());
    expect(dataRepository.loadEvidence).toHaveBeenCalledWith(expect.anything(), "deal-1", "org-1");
    expect(providerRequest).toHaveBeenCalledTimes(1);
  });

  it("uses status reads without provider calls and restricts refresh to owners", async () => {
    const auth = authorize();
    const providerRequest = vi.fn();
    const response = await createHandler({ authorize: auth, dataRepository: repository(), providerRequest, clock: () => now, env: { RENTCAST_API_KEY: "server-key" } })(event("status"));
    expect(response.statusCode).toBe(200);
    expect(auth).toHaveBeenCalledWith(expect.anything(), { allowedRoles: ["owner", "admin", "analyst", "viewer"] });
    expect(providerRequest).not.toHaveBeenCalled();
    const refreshAuth = authorize();
    await createHandler({ authorize: refreshAuth, dataRepository: repository({ cached: evidence() }), clock: () => now, env: { RENTCAST_API_KEY: "server-key" } })(event());
    expect(refreshAuth).toHaveBeenCalledWith(expect.anything(), { allowedRoles: ["owner"] });
  });
});

describe("RentCast official API adapter", () => {
  it("makes only the property-record and five-comp AVM requests with a bounded server-side key", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => fixture.propertyRecords })
      .mockResolvedValueOnce({ ok: true, json: async () => fixture.valuation });
    const result = await fetchRentCastPropertyData({ address: deal.property_address, apiKey: "server-only", fetchImpl, retrievedAt: now });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][0]).toMatch(/^https:\/\/api\.rentcast\.io\/v1\/properties\?/);
    expect(fetchImpl.mock.calls[1][0]).toMatch(/^https:\/\/api\.rentcast\.io\/v1\/avm\/value\?/);
    expect(fetchImpl.mock.calls[1][0]).toContain("compCount=5");
    expect(fetchImpl.mock.calls.every((call) => call[1].headers["X-Api-Key"] === "server-only")).toBe(true);
    expect(JSON.stringify(result)).not.toContain("server-only");
  });

  it("normalizes identical fixtures deterministically and bounds retained history and comps", () => {
    const crowded = {
      ...fixture,
      propertyRecords: [{ ...fixture.propertyRecords[0], history: Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`202${index}-01-01`, { event: "Sale", date: `202${index}-01-01T00:00:00.000Z`, price: 100000 + index }])) }],
      valuation: { ...fixture.valuation, comparables: Array.from({ length: 8 }, (_, index) => ({ id: `comp-${index}`, formattedAddress: `${index} Main St`, price: 200000 + index })) },
    };
    const first = normalizeRentCastResult({ ...crowded, retrievedAt: now });
    const second = normalizeRentCastResult({ ...crowded, retrievedAt: now });
    expect(second).toEqual(first);
    expect(first.saleHistory).toHaveLength(5);
    expect(first.comps).toHaveLength(5);
    expect(first).not.toHaveProperty("raw");
  });

  it("aborts a provider request at the bounded timeout", async () => {
    const fetchImpl = vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    }));
    await expect(fetchRentCastPropertyData({ address: deal.property_address, apiKey: "server-only", fetchImpl, retrievedAt: now, timeoutMs: 5 })).rejects.toThrow(/timed out/i);
  });
});
