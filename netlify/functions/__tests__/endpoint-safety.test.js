import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const aiChat = require("../ai-chat.js");
const sendSms = require("../send-sms.cjs");
const sendEmail = require("../send-email.js");
const createCheckout = require("../create-checkout-session.js");
const createBillingPortal = require("../create-billing-portal-session.js");
const stripeWebhook = require("../stripe-webhook.js");
const inboundSms = require("../inbound-v2.cjs");
const healthCheck = require("../health-check.js");

const originalEnv = { ...process.env };

function restoreEnv() {
  Object.keys(process.env).forEach((key) => delete process.env[key]);
  Object.assign(process.env, originalEnv);
}

function parseJsonBody(response) {
  return JSON.parse(response.body || "{}");
}

function commonSafeChecks(response) {
  expect(response).toHaveProperty("statusCode");
  expect(response).toHaveProperty("headers");
  expect(response).toHaveProperty("body");
  expect(String(response.body)).not.toContain("stack");
  expect(String(response.body)).not.toContain("Error:");
}

beforeEach(() => {
  restoreEnv();
  vi.restoreAllMocks();
});

afterEach(() => {
  restoreEnv();
  vi.restoreAllMocks();
});

describe("Netlify function endpoint safety", () => {
  it("returns safe 405 for non-POST AI requests", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const result = await aiChat.handler({ httpMethod: "GET", body: JSON.stringify({ user: "hi" }) });

    commonSafeChecks(result);
    expect(result.statusCode).toBe(405);
    expect(parseJsonBody(result)).toEqual({ success: false, error: "Method not allowed." });
  });

  it("returns safe 503 when AI API key is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await aiChat.handler({ httpMethod: "POST", body: JSON.stringify({ user: "Hello" }) });

    commonSafeChecks(result);
    expect(result.statusCode).toBe(503);
    expect(parseJsonBody(result)).toEqual({ success: false, error: "AI provider is not configured." });
  });

  it("returns safe 400 for invalid AI JSON body", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const result = await aiChat.handler({ httpMethod: "POST", body: "not-json" });

    commonSafeChecks(result);
    expect(result.statusCode).toBe(400);
    expect(parseJsonBody(result)).toEqual({ success: false, error: "Invalid JSON body." });
  });

  it("returns safe 405 for non-POST SMS requests", async () => {
    const result = await sendSms.handler({ httpMethod: "GET", body: JSON.stringify({ to: "+15551234567", message: "test" }) });

    commonSafeChecks(result);
    expect(result.statusCode).toBe(405);
    expect(parseJsonBody(result)).toEqual({ success: false, error: "Method not allowed." });
  });

  it("returns safe 400 for missing SMS body fields", async () => {
    const result = await sendSms.handler({ httpMethod: "POST", body: JSON.stringify({}) });

    commonSafeChecks(result);
    expect(result.statusCode).toBe(400);
    expect(parseJsonBody(result)).toEqual({ success: false, error: "Missing or invalid recipient phone number." });
  });

  it("handles missing Twilio/Supabase env without crashing", async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
    delete process.env.SMS_TEST_MODE;

    const result = await sendSms.handler({
      httpMethod: "POST",
      body: JSON.stringify({ to: "+15551234567", message: "Hello from test" }),
    });

    commonSafeChecks(result);
    expect(result.statusCode).toBe(200);
    expect(parseJsonBody(result)).toMatchObject({ success: true, mode: "test", status: "test" });
  });

  it("returns safe 405 for non-POST email requests", async () => {
    const result = await sendEmail.handler({ httpMethod: "GET", body: JSON.stringify({ to: "person@example.com", subject: "Hi", body: "Hello" }) });

    commonSafeChecks(result);
    expect(result.statusCode).toBe(405);
    expect(parseJsonBody(result)).toEqual({ success: false, error: "Method not allowed." });
  });

  it("returns provider-unavailable email response when env is missing", async () => {
    delete process.env.EMAIL_PROVIDER;
    delete process.env.EMAIL_API_KEY;

    const result = await sendEmail.handler({
      httpMethod: "POST",
      body: JSON.stringify({ to: "person@example.com", subject: "Test", body: "Hello" }),
    });

    commonSafeChecks(result);
    expect(result.statusCode).toBe(200);
    expect(parseJsonBody(result)).toMatchObject({ success: true, sent: false, status: "provider-unavailable" });
  });

  it("returns safe 400 for invalid email address", async () => {
    const result = await sendEmail.handler({
      httpMethod: "POST",
      body: JSON.stringify({ to: "invalid-email", subject: "Test", body: "Hello" }),
    });

    commonSafeChecks(result);
    expect(result.statusCode).toBe(400);
    expect(parseJsonBody(result)).toEqual({ success: false, error: "A valid recipient email is required." });
  });

  it("returns safe 405 for non-POST checkout requests", async () => {
    const result = await createCheckout.handler({ httpMethod: "GET", body: JSON.stringify({}) });

    commonSafeChecks(result);
    expect(result.statusCode).toBe(405);
    expect(parseJsonBody(result)).toEqual({ success: false, error: "Method not allowed." });
  });

  it("returns safe 503 for checkout when Stripe secret is missing", async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const result = await createCheckout.handler({ httpMethod: "POST", body: JSON.stringify({ planId: "starter" }) });

    commonSafeChecks(result);
    expect(result.statusCode).toBe(503);
    expect(parseJsonBody(result)).toEqual({ success: false, error: "Stripe test integration is not configured." });
  });

  it("returns safe 405 for non-POST billing portal requests", async () => {
    const result = await createBillingPortal.handler({ httpMethod: "GET", body: JSON.stringify({}) });

    commonSafeChecks(result);
    expect(result.statusCode).toBe(405);
    expect(parseJsonBody(result)).toEqual({ success: false, error: "Method not allowed." });
  });

  it("returns safe 503 for billing portal when Stripe secret is missing", async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const result = await createBillingPortal.handler({ httpMethod: "POST", body: JSON.stringify({ customerId: "cus_test" }) });

    commonSafeChecks(result);
    expect(result.statusCode).toBe(503);
    expect(parseJsonBody(result)).toEqual({ success: false, error: "Stripe test integration is not configured." });
  });

  it("returns safe 405 for non-POST Stripe webhook requests", async () => {
    const result = await stripeWebhook.handler({ httpMethod: "GET", body: "{}" });

    commonSafeChecks(result);
    expect(result.statusCode).toBe(405);
    expect(parseJsonBody(result)).toEqual({ success: false, error: "Method not allowed." });
  });

  it("returns safe 503 for Stripe webhook when secret is missing", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const result = await stripeWebhook.handler({
      httpMethod: "POST",
      body: JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: {} } }),
      headers: { "stripe-signature": "t=123,v1=abc" },
    });

    commonSafeChecks(result);
    expect(result.statusCode).toBe(503);
    expect(parseJsonBody(result)).toEqual({ success: false, error: "Stripe webhook is not configured." });
  });

  it("returns safe 405 for non-POST inbound SMS requests", async () => {
    const result = await inboundSms.handler({ httpMethod: "GET", body: "From=%2B15551234567&Body=Hi" });

    commonSafeChecks(result);
    expect(result.statusCode).toBe(405);
    expect(String(result.body)).toContain("Method not allowed");
  });

  it("returns safe 500 for inbound SMS when Supabase config is missing", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const result = await inboundSms.handler({ httpMethod: "POST", body: "From=%2B15551234567&Body=Hello" });

    commonSafeChecks(result);
    expect(result.statusCode).toBe(500);
    expect(String(result.body)).toContain("Server configuration error");
  });

  it("returns server-side health status without exposing secrets", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-secret";
    process.env.OPENAI_API_KEY = "openai-secret";
    process.env.TWILIO_ACCOUNT_SID = "twilio-sid";
    process.env.TWILIO_AUTH_TOKEN = "twilio-secret";
    process.env.TWILIO_PHONE_NUMBER = "+15551234567";
    process.env.STRIPE_SECRET_KEY = "stripe-secret";
    process.env.STRIPE_WEBHOOK_SECRET = "stripe-webhook-secret";

    const result = await healthCheck.handler({ httpMethod: "GET" });

    commonSafeChecks(result);
    expect(result.statusCode).toBe(200);
    expect(parseJsonBody(result)).toMatchObject({
      success: true,
      status: "ok",
      configured: true,
    });
    expect(String(result.body)).not.toContain("service-role-secret");
    expect(String(result.body)).not.toContain("openai-secret");
    expect(String(result.body)).not.toContain("twilio-secret");
    expect(String(result.body)).not.toContain("stripe-secret");
  });

  it("returns degraded health status when server configuration is missing", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const result = await healthCheck.handler({ httpMethod: "GET" });

    commonSafeChecks(result);
    expect(result.statusCode).toBe(503);
    expect(parseJsonBody(result)).toMatchObject({
      success: true,
      status: "degraded",
      configured: false,
    });
  });
});
