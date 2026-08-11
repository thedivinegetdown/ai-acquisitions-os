import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const statusFunction = require("../twilio-status.cjs");
const { webhookResponse } = require("../_shared/twilio.cjs");

const originalEnv = { ...process.env };
const fixedNow = "2026-08-11T17:00:00.000Z";

function fluent(result) {
  const query = {
    eq: vi.fn(() => query),
    limit: vi.fn(() => Promise.resolve(result)),
  };
  return query;
}

function fixture(currentStatus = "queued") {
  const selectQuery = fluent({
    data: [
      {
        id: "message-1",
        organization_id: "org-1",
        provider_status: currentStatus,
        status: currentStatus,
      },
    ],
    error: null,
  });
  const updateQuery = {
    eq: vi.fn(() => updateQuery),
    then: (resolve) => resolve({ error: null }),
  };
  const update = vi.fn(() => updateQuery);
  const table = { select: vi.fn(() => selectQuery), update };
  const adminClient = { from: vi.fn(() => table) };
  return { adminClient, selectQuery, update, updateQuery };
}

function handlerFor({
  currentStatus = "queued",
  nextStatus = "delivered",
  messageSid = "SM00000000000000000000000000000001",
  validationResponse,
} = {}) {
  const configured = fixture(currentStatus);
  const validateWebhook = vi.fn().mockReturnValue(
    validationResponse || {
      ok: true,
      params: {
        MessageSid: messageSid,
        MessageStatus: nextStatus,
        ErrorCode: nextStatus === "failed" ? "30001" : "",
      },
    }
  );
  return {
    ...configured,
    handler: statusFunction.createStatusHandler({
      createClientImpl: vi.fn(() => configured.adminClient),
      now: () => fixedNow,
      validateWebhook,
    }),
    validateWebhook,
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

describe("Twilio delivery status callback", () => {
  it("requires a valid Twilio signature boundary", async () => {
    const denied = handlerFor({
      validationResponse: {
        ok: false,
        response: webhookResponse(403, "Invalid webhook signature."),
      },
    });
    const response = await denied.handler({ httpMethod: "POST", body: "ignored" });

    expect(response.statusCode).toBe(403);
    expect(denied.adminClient.from).not.toHaveBeenCalled();
  });

  it("updates the existing provider row without inserting a callback row", async () => {
    const configured = handlerFor({ currentStatus: "sent", nextStatus: "delivered" });
    const response = await configured.handler({ httpMethod: "POST", body: "ignored" });

    expect(response.statusCode).toBe(200);
    expect(configured.selectQuery.eq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(configured.selectQuery.eq).toHaveBeenCalledWith("provider", "twilio");
    expect(configured.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "delivered",
        provider_status: "delivered",
        provider_status_updated_at: fixedNow,
      })
    );
  });

  it("treats duplicate callbacks as idempotent", async () => {
    const configured = handlerFor({ currentStatus: "sent", nextStatus: "sent" });
    const response = await configured.handler({ httpMethod: "POST", body: "ignored" });

    expect(response.statusCode).toBe(200);
    expect(configured.update).not.toHaveBeenCalled();
  });

  it("does not downgrade delivered after an out-of-order callback", async () => {
    const configured = handlerFor({ currentStatus: "delivered", nextStatus: "queued" });
    await configured.handler({ httpMethod: "POST", body: "ignored" });
    expect(configured.update).not.toHaveBeenCalled();
  });

  it("persists a terminal failure and its bounded provider error code", async () => {
    const configured = handlerFor({ currentStatus: "sent", nextStatus: "failed" });
    await configured.handler({ httpMethod: "POST", body: "ignored" });

    expect(configured.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", error_code: "30001" })
    );
  });

  it("rejects a missing provider SID as malformed", async () => {
    const configured = handlerFor({
      validationResponse: {
        ok: false,
        response: webhookResponse(400, "Malformed webhook request."),
      },
    });
    const response = await configured.handler({ httpMethod: "POST", body: "ignored" });
    expect(response.statusCode).toBe(400);
  });
});
