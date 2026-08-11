import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const inbound = require("../inbound-v2.cjs");
const { OPT_IN_COMMANDS, OPT_OUT_COMMANDS } = require("../_shared/twilio.cjs");

const originalEnv = { ...process.env };
const fixedNow = "2026-08-11T16:00:00.000Z";

function params(overrides = {}) {
  return {
    MessageSid: "SM00000000000000000000000000000001",
    From: "+15551112222",
    To: "+15553334444",
    Body: "Hello",
    ...overrides,
  };
}

function acceptedValidation(webhookParams = params()) {
  return vi.fn().mockReturnValue({ ok: true, params: webhookParams });
}

function fluent(result) {
  const query = {
    eq: vi.fn(() => query),
    limit: vi.fn(() => Promise.resolve(result)),
  };
  return query;
}

function adminFixture({ duplicate = false, deal = { id: "deal-1" } } = {}) {
  const duplicateQuery = fluent({
    data: duplicate ? [{ id: "message-1" }] : [],
    error: null,
  });
  const dealQuery = fluent({ data: deal ? [deal] : [], error: null });
  const insert = vi.fn().mockResolvedValue({ error: null });
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const messageTable = { select: vi.fn(() => duplicateQuery), insert };
  const dealTable = { select: vi.fn(() => dealQuery) };
  const consentTable = { upsert };
  const adminClient = {
    from: vi.fn((table) => {
      if (table === "message_logs") return messageTable;
      if (table === "deals") return dealTable;
      if (table === "communication_consents") return consentTable;
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return { adminClient, dealQuery, duplicateQuery, insert, upsert };
}

function createHandler(webhookParams = params(), fixture = adminFixture()) {
  return {
    fixture,
    handler: inbound.createInboundHandler({
      createClientImpl: vi.fn(() => fixture.adminClient),
      now: () => fixedNow,
      validateWebhook: acceptedValidation(webhookParams),
    }),
  };
}

beforeEach(() => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-placeholder";
  process.env.TWILIO_ORGANIZATION_ID = "org-1";
  process.env.TWILIO_PHONE_NUMBER = "+15553334444";
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.keys(process.env).forEach((key) => delete process.env[key]);
  Object.assign(process.env, originalEnv);
});

describe("hardened Twilio inbound webhook", () => {
  it("persists the first provider event once with trusted tenant scope", async () => {
    const { handler, fixture } = createHandler(
      params({ OrganizationId: "attacker-org" })
    );
    const response = await handler({ httpMethod: "POST", headers: {}, body: "ignored" });

    expect(response.statusCode).toBe(200);
    expect(fixture.insert).toHaveBeenCalledTimes(1);
    expect(fixture.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-1",
        deal_id: "deal-1",
        provider: "twilio",
        provider_message_id: "SM00000000000000000000000000000001",
      })
    );
  });

  it("treats a replayed MessageSid as idempotent", async () => {
    const fixture = adminFixture({ duplicate: true });
    const { handler } = createHandler(params(), fixture);
    const response = await handler({ httpMethod: "POST", body: "ignored" });

    expect(response.statusCode).toBe(200);
    expect(fixture.insert).not.toHaveBeenCalled();
    expect(fixture.upsert).not.toHaveBeenCalled();
  });

  it.each(OPT_OUT_COMMANDS)("persists exact %s as opted out before the message", async (command) => {
    const { handler, fixture } = createHandler(params({ Body: ` ${command.toLowerCase()} ` }));
    const response = await handler({ httpMethod: "POST", body: "ignored" });

    expect(response.statusCode).toBe(200);
    expect(fixture.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-1",
        normalized_phone: "+15551112222",
        status: "opted-out",
      }),
      expect.objectContaining({ onConflict: "organization_id,normalized_phone,channel" })
    );
    expect(fixture.upsert.mock.invocationCallOrder[0]).toBeLessThan(
      fixture.insert.mock.invocationCallOrder[0]
    );
  });

  it.each(OPT_IN_COMMANDS)("persists exact %s as opted in", async (command) => {
    const { handler, fixture } = createHandler(params({ Body: command }));
    await handler({ httpMethod: "POST", body: "ignored" });

    expect(fixture.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "opted-in" }),
      expect.anything()
    );
  });

  it("does not change consent for an ordinary message", async () => {
    const { handler, fixture } = createHandler(params({ Body: "please stop contacting me" }));
    await handler({ httpMethod: "POST", body: "ignored" });

    expect(fixture.upsert).not.toHaveBeenCalled();
    expect(fixture.insert).toHaveBeenCalledWith(
      expect.objectContaining({ consent_event: null })
    );
  });

  it("rejects the wrong destination number before database access", async () => {
    const fixture = adminFixture();
    const { handler } = createHandler(params({ To: "+15559990000" }), fixture);
    const response = await handler({ httpMethod: "POST", body: "ignored" });

    expect(response.statusCode).toBe(403);
    expect(fixture.adminClient.from).not.toHaveBeenCalled();
  });

  it("scopes sender-phone deal lookup to the configured organization", async () => {
    const { handler, fixture } = createHandler();
    await handler({ httpMethod: "POST", body: "ignored" });

    expect(fixture.dealQuery.eq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(fixture.dealQuery.eq).toHaveBeenCalledWith("phone", "5551112222");
  });

  it("uses the tenant-owned unassigned path when no deal matches", async () => {
    const fixture = adminFixture({ deal: null });
    const { handler } = createHandler(params(), fixture);
    await handler({ httpMethod: "POST", body: "ignored" });

    expect(fixture.insert).toHaveBeenCalledWith(
      expect.objectContaining({ organization_id: "org-1", deal_id: null })
    );
  });

  it("remains an external webhook without Supabase bearer authentication", async () => {
    const { handler } = createHandler();
    const response = await handler({ httpMethod: "POST", headers: {}, body: "ignored" });
    expect(response.statusCode).toBe(200);
  });
});
