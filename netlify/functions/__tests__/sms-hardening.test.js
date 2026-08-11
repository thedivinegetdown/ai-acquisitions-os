import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sendSms = require("../send-sms.cjs");

const originalEnv = { ...process.env };
const fixedNow = "2026-08-11T18:00:00.000Z";

function event(body = {}) {
  return { httpMethod: "POST", body: JSON.stringify(body), headers: {} };
}

function context() {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const adminClient = { from: vi.fn(() => ({ insert })) };
  return {
    adminClient,
    authorize: vi.fn().mockResolvedValue({
      context: {
        authenticated: true,
        userId: "user-1",
        organizationId: "org-1",
        role: "analyst",
        membershipStatus: "active",
      },
      clients: { adminClient },
    }),
    insert,
  };
}

function createHandler({ consent = "unknown", twilioFactory = vi.fn() } = {}) {
  const authorized = context();
  const loadConsent = vi.fn().mockResolvedValue({ status: consent });
  return {
    ...authorized,
    loadConsent,
    twilioFactory,
    handler: sendSms.createSendSmsHandler({
      authorize: authorized.authorize,
      loadConsent,
      now: () => fixedNow,
      twilioFactory,
    }),
  };
}

beforeEach(() => {
  process.env.SMS_TEST_MODE = "true";
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_PHONE_NUMBER;
  delete process.env.PUBLIC_SITE_URL;
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.keys(process.env).forEach((key) => delete process.env[key]);
  Object.assign(process.env, originalEnv);
});

describe("outbound SMS consent and live-mode safety", () => {
  it("blocks an opted-out number before Twilio or message persistence", async () => {
    const configured = createHandler({ consent: "opted-out" });
    const response = await configured.handler(
      event({ to: "+15551112222", message: "Hello" })
    );

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body).status).toBe("blocked-by-opt-out");
    expect(configured.twilioFactory).not.toHaveBeenCalled();
    expect(configured.insert).not.toHaveBeenCalled();
  });

  it.each(["opted-in", "unknown"])("allows %s consent in test mode without a provider call", async (consent) => {
    const configured = createHandler({ consent });
    const response = await configured.handler(
      event({ to: "+15551112222", message: "Hello" })
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ mode: "test", status: "test" });
    expect(configured.twilioFactory).not.toHaveBeenCalled();
    expect(configured.insert).toHaveBeenCalledTimes(1);
    expect(configured.insert).toHaveBeenCalledWith(
      expect.objectContaining({ provider: null, provider_message_id: null })
    );
  });

  it("requires an explicit false test flag and complete live configuration", async () => {
    process.env.SMS_TEST_MODE = "false";
    const configured = createHandler({ consent: "opted-in" });
    const response = await configured.handler(
      event({ to: "+15551112222", message: "Hello" })
    );

    expect(response.statusCode).toBe(503);
    expect(configured.twilioFactory).not.toHaveBeenCalled();
  });

  it("persists provider identity and accepted state without claiming delivery", async () => {
    process.env.SMS_TEST_MODE = "false";
    process.env.TWILIO_ACCOUNT_SID = "account-test-placeholder";
    process.env.TWILIO_AUTH_TOKEN = "auth-test-placeholder";
    process.env.TWILIO_PHONE_NUMBER = "+15553334444";
    process.env.TWILIO_ORGANIZATION_ID = "org-1";
    process.env.PUBLIC_SITE_URL = "https://communications.example.test";
    const create = vi.fn().mockResolvedValue({
      sid: "SM00000000000000000000000000000002",
      status: "queued",
    });
    const twilioFactory = vi.fn(() => ({ messages: { create } }));
    const configured = createHandler({ consent: "opted-in", twilioFactory });
    const response = await configured.handler(
      event({ to: "+15551112222", message: "Hello" })
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ mode: "live", status: "queued" });
    expect(JSON.parse(response.body).status).not.toBe("delivered");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCallback: "https://communications.example.test/.netlify/functions/twilio-status",
      })
    );
    expect(configured.insert).toHaveBeenCalledTimes(1);
    expect(configured.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "twilio",
        provider_message_id: "SM00000000000000000000000000000002",
        provider_status: "queued",
      })
    );
  });

  it("does not call Twilio when test mode is explicit even with credentials present", async () => {
    process.env.TWILIO_ACCOUNT_SID = "account-test-placeholder";
    process.env.TWILIO_AUTH_TOKEN = "auth-test-placeholder";
    process.env.TWILIO_PHONE_NUMBER = "+15553334444";
    process.env.PUBLIC_SITE_URL = "https://communications.example.test";
    const configured = createHandler({ consent: "opted-in" });
    await configured.handler(event({ to: "+15551112222", message: "Hello" }));
    expect(configured.twilioFactory).not.toHaveBeenCalled();
  });

  it("rejects live use when the configured Twilio number belongs to another organization", async () => {
    process.env.SMS_TEST_MODE = "false";
    process.env.TWILIO_ACCOUNT_SID = "account-test-placeholder";
    process.env.TWILIO_AUTH_TOKEN = "auth-test-placeholder";
    process.env.TWILIO_PHONE_NUMBER = "+15553334444";
    process.env.TWILIO_ORGANIZATION_ID = "org-other";
    process.env.PUBLIC_SITE_URL = "https://communications.example.test";
    const configured = createHandler({ consent: "opted-in" });

    const response = await configured.handler(
      event({ to: "+15551112222", message: "Hello" })
    );

    expect(response.statusCode).toBe(503);
    expect(configured.twilioFactory).not.toHaveBeenCalled();
    expect(configured.insert).not.toHaveBeenCalled();
  });
});
