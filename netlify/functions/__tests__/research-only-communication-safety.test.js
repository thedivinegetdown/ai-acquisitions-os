import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { json } = require("../_shared/security.cjs");
const sendSms = require("../send-sms.cjs");
const sendEmail = require("../send-email.js");

const originalEnv = { ...process.env };

function event(body) {
  return { httpMethod: "POST", body: JSON.stringify(body), headers: {} };
}

function authorized() {
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

function verifiedDeal(operatingScope = "active_acquisition") {
  return vi.fn().mockResolvedValue({
    deal: {
      id: "deal-1",
      organization_id: "org-1",
      operating_scope: operatingScope,
    },
  });
}

beforeEach(() => {
  process.env.SMS_TEST_MODE = "true";
  delete process.env.EMAIL_PROVIDER;
  delete process.env.EMAIL_API_KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.keys(process.env).forEach((key) => delete process.env[key]);
  Object.assign(process.env, originalEnv);
});

describe("authoritative research-only communication enforcement", () => {
  it("rejects stale-client SMS before consent, persistence, or provider access", async () => {
    const context = authorized();
    const loadConsent = vi.fn();
    const twilioFactory = vi.fn();
    const handler = sendSms.createSendSmsHandler({
      authorize: context.authorize,
      loadConsent,
      twilioFactory,
      verifyDeal: verifiedDeal("research_only"),
    });

    const response = await handler(
      event({ dealId: "deal-1", to: "+15551112222", message: "Hello" })
    );

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toMatchObject({
      success: false,
      status: "blocked-by-operating-scope",
    });
    expect(loadConsent).not.toHaveBeenCalled();
    expect(context.insert).not.toHaveBeenCalled();
    expect(twilioFactory).not.toHaveBeenCalled();
  });

  it("requires deal context so a direct caller cannot omit scope enforcement", async () => {
    const context = authorized();
    const verifyDeal = verifiedDeal();
    const handler = sendSms.createSendSmsHandler({
      authorize: context.authorize,
      verifyDeal,
    });

    const response = await handler(event({ to: "+15551112222", message: "Hello" }));

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toMatch(/deal is required/i);
    expect(verifyDeal).not.toHaveBeenCalled();
    expect(context.insert).not.toHaveBeenCalled();
  });

  it("preserves active-acquisition SMS behavior without a real provider call", async () => {
    const context = authorized();
    const handler = sendSms.createSendSmsHandler({
      authorize: context.authorize,
      loadConsent: vi.fn().mockResolvedValue({ status: "opted-in" }),
      twilioFactory: vi.fn(),
      verifyDeal: verifiedDeal(),
    });

    const response = await handler(
      event({ dealId: "deal-1", to: "+15551112222", message: "Hello" })
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ mode: "test", status: "test" });
    expect(context.insert).toHaveBeenCalledTimes(1);
  });

  it("preserves cross-tenant denial before communication work", async () => {
    const context = authorized();
    const verifyDeal = vi.fn().mockResolvedValue({
      response: json(404, { success: false, error: "Resource not found." }),
    });
    const loadConsent = vi.fn();
    const handler = sendSms.createSendSmsHandler({
      authorize: context.authorize,
      loadConsent,
      verifyDeal,
    });

    const response = await handler(
      event({ dealId: "deal-other", to: "+15551112222", message: "Hello" })
    );

    expect(response.statusCode).toBe(404);
    expect(loadConsent).not.toHaveBeenCalled();
    expect(context.insert).not.toHaveBeenCalled();
  });

  it("rejects research-only email endpoint calls even while live email is dormant", async () => {
    const context = authorized();
    const handler = sendEmail.createSendEmailHandler({
      authorize: context.authorize,
      verifyDeal: verifiedDeal("research_only"),
    });

    const response = await handler(
      event({
        dealId: "deal-1",
        to: "seller@example.com",
        subject: "Hello",
        body: "Message",
      })
    );

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body).status).toBe("blocked-by-operating-scope");
  });

  it("preserves the active-acquisition email foundation", async () => {
    const context = authorized();
    const handler = sendEmail.createSendEmailHandler({
      authorize: context.authorize,
      verifyDeal: verifiedDeal(),
    });

    const response = await handler(
      event({
        dealId: "deal-1",
        to: "seller@example.com",
        subject: "Hello",
        body: "Message",
      })
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      sent: false,
      status: "provider-unavailable",
    });
  });
});
