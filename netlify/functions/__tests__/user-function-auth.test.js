import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const aiAnalysis = require("../ai-analysis.js");
const aiChat = require("../ai-chat.js");
const aiSummary = require("../ai-summary.js");
const sendSms = require("../send-sms.cjs");
const sendEmail = require("../send-email.js");
const checkout = require("../create-checkout-session.js");
const portal = require("../create-billing-portal-session.js");
const { json } = require("../_shared/security.cjs");
const {
  FUNCTION_AUTHORIZATION_MATRIX,
} = require("../_shared/function-inventory.cjs");

const originalEnv = { ...process.env };

function event(body = {}, headers = {}) {
  return { httpMethod: "POST", body: JSON.stringify(body), headers };
}

function parsed(response) {
  return JSON.parse(response.body || "{}");
}

function authorized({ organizationId = "org-1", role = "analyst" } = {}) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const adminClient = {
    from: vi.fn(() => ({ insert })),
  };

  return {
    adminClient,
    insert,
    authorize: vi.fn().mockResolvedValue({
      context: {
        authenticated: true,
        userId: "user-1",
        organizationId,
        role,
        membershipStatus: "active",
      },
      clients: { adminClient },
    }),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  Object.keys(process.env).forEach((key) => delete process.env[key]);
  Object.assign(process.env, originalEnv);
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.keys(process.env).forEach((key) => delete process.env[key]);
  Object.assign(process.env, originalEnv);
});

describe("user-originated Netlify API authorization", () => {
  it("rejects unauthenticated requests for every browser business endpoint", async () => {
    const cases = [
      [aiAnalysis.handler, { user: "analyze" }],
      [aiChat.handler, { user: "chat" }],
      [aiSummary.handler, { user: "summarize" }],
      [sendSms.handler, { to: "+15551234567", message: "Hello" }],
      [sendEmail.handler, { to: "person@example.com", subject: "Hi", body: "Hello" }],
      [checkout.handler, { planId: "starter" }],
      [portal.handler, { customerId: "cus_1" }],
    ];

    for (const [handler, body] of cases) {
      const response = await handler(event(body));
      expect(response.statusCode).toBe(401);
      expect(parsed(response).success).toBe(false);
    }
  });

  it("authorizes AI requests without forwarding the user token to the provider", async () => {
    process.env.OPENAI_API_KEY = "provider-test-key";
    const context = authorized({ role: "viewer" });
    const providerRequest = vi.fn().mockResolvedValue({ output_text: "safe" });
    const handler = aiChat.createHandler({
      authorize: context.authorize,
      providerRequest,
    });

    const response = await handler(
      event(
        { user: "Summarize this deal", system: "Be concise" },
        { authorization: "Bearer user-access-token" }
      )
    );

    expect(response.statusCode).toBe(200);
    expect(context.authorize).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ allowedRoles: ["owner", "admin", "analyst", "viewer"] })
    );
    const providerPayload = JSON.stringify(providerRequest.mock.calls);
    expect(providerPayload).not.toContain("user-access-token");
    expect(providerPayload).not.toContain("service_role");
  });

  it("allows authorized same-tenant SMS in test mode and persists organization scope", async () => {
    process.env.SMS_TEST_MODE = "true";
    const context = authorized();
    const verifyDeal = vi.fn().mockResolvedValue({
      deal: { id: "deal-1", organization_id: "org-1" },
    });
    const twilioFactory = vi.fn();
    const handler = sendSms.createSendSmsHandler({
      authorize: context.authorize,
      verifyDeal,
      twilioFactory,
    });

    const response = await handler(
      event({ to: "+15551234567", message: "Hello", deal_id: "deal-1" })
    );

    expect(response.statusCode).toBe(200);
    expect(parsed(response)).toMatchObject({ mode: "test", status: "test" });
    expect(verifyDeal).toHaveBeenCalledWith(
      context.adminClient,
      "deal-1",
      "org-1"
    );
    expect(context.adminClient.from).toHaveBeenCalledWith("message_logs");
    expect(context.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-1",
        deal_id: "deal-1",
        direction: "outbound",
      })
    );
    expect(twilioFactory).not.toHaveBeenCalled();
  });

  it("rejects cross-tenant SMS before provider or persistence access", async () => {
    const context = authorized();
    const verifyDeal = vi.fn().mockResolvedValue({
      response: json(404, { success: false, error: "Resource not found." }),
    });
    const twilioFactory = vi.fn();
    const handler = sendSms.createSendSmsHandler({
      authorize: context.authorize,
      verifyDeal,
      twilioFactory,
    });

    const response = await handler(
      event({ to: "+15551234567", message: "Hello", deal_id: "deal-other" })
    );

    expect(response.statusCode).toBe(404);
    expect(context.adminClient.from).not.toHaveBeenCalled();
    expect(twilioFactory).not.toHaveBeenCalled();
  });

  it("denies viewer SMS mutation", async () => {
    const authorize = vi.fn().mockResolvedValue({
      response: json(403, { success: false, error: "Insufficient organization role." }),
    });
    const handler = sendSms.createSendSmsHandler({ authorize });
    const response = await handler(
      event({ to: "+15551234567", message: "Hello" })
    );

    expect(response.statusCode).toBe(403);
  });

  it("keeps email provider behavior disabled after tenant authorization", async () => {
    delete process.env.EMAIL_PROVIDER;
    delete process.env.EMAIL_API_KEY;
    const context = authorized();
    const verifyDeal = vi.fn().mockResolvedValue({ deal: { id: "deal-1" } });
    const handler = sendEmail.createSendEmailHandler({
      authorize: context.authorize,
      verifyDeal,
    });

    const response = await handler(
      event({
        to: "person@example.com",
        subject: "Test",
        body: "Hello",
        dealId: "deal-1",
      })
    );

    expect(response.statusCode).toBe(200);
    expect(parsed(response)).toMatchObject({
      sent: false,
      status: "provider-unavailable",
    });
    expect(verifyDeal).toHaveBeenCalledWith(
      context.adminClient,
      "deal-1",
      "org-1"
    );
  });

  it("derives checkout metadata from authorized context, not caller input", async () => {
    process.env.STRIPE_SECRET_KEY = "stripe-test-key";
    process.env.STRIPE_PRICE_STARTER = "price_test";
    const context = authorized({ role: "owner" });
    const createCheckout = vi.fn().mockResolvedValue({ id: "cs_1", url: "https://stripe.test" });
    const handler = checkout.createCheckoutHandler({
      authorize: context.authorize,
      createCheckout,
    });

    const response = await handler(
      event({ planId: "starter", organizationId: "attacker-org", tenantId: "attacker" })
    );

    expect(response.statusCode).toBe(200);
    expect(createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        "metadata[organization_id]": "org-1",
        "metadata[tenant_id]": "org-1",
        "subscription_data[metadata][organization_id]": "org-1",
      })
    );
  });

  it("requires billing portal customer metadata to match the organization", async () => {
    process.env.STRIPE_SECRET_KEY = "stripe-test-key";
    const context = authorized({ role: "owner" });
    const createPortal = vi.fn();
    const mismatched = portal.createBillingPortalHandler({
      authorize: context.authorize,
      createPortal,
      loadCustomer: vi.fn().mockResolvedValue({
        metadata: { organization_id: "org-other" },
      }),
    });

    const response = await mismatched(event({ customerId: "cus_other" }));
    expect(response.statusCode).toBe(404);
    expect(createPortal).not.toHaveBeenCalled();
  });

  it("classifies external webhooks without falsely applying bearer auth", () => {
    expect(FUNCTION_AUTHORIZATION_MATRIX["inbound-v2"]).toMatchObject({
      classification: "external-webhook",
      bearerAuth: false,
      signatureValidation: "pending-eo-comm-01",
    });
    expect(FUNCTION_AUTHORIZATION_MATRIX["stripe-webhook"]).toMatchObject({
      classification: "external-webhook",
      bearerAuth: false,
      signatureValidation: "stripe-signature",
    });
  });
  it("propagates invalid-token and missing-membership denial for every migrated API", async () => {
    const handlerCases = [
      ["ai-analysis", (authorize) => aiAnalysis.createHandler({ authorize }), { user: "analyze" }],
      ["ai-chat", (authorize) => aiChat.createHandler({ authorize }), { user: "chat" }],
      ["ai-summary", (authorize) => aiSummary.createHandler({ authorize }), { user: "summarize" }],
      ["send-sms", (authorize) => sendSms.createSendSmsHandler({ authorize }), { to: "+15551234567", message: "Hello" }],
      ["send-email", (authorize) => sendEmail.createSendEmailHandler({ authorize }), { to: "person@example.com", subject: "Hi", body: "Hello" }],
      ["create-checkout-session", (authorize) => checkout.createCheckoutHandler({ authorize }), { planId: "starter" }],
      ["create-billing-portal-session", (authorize) => portal.createBillingPortalHandler({ authorize }), { customerId: "cus_1" }],
    ];

    for (const [name, createHandler, body] of handlerCases) {
      const invalidToken = vi.fn().mockResolvedValue({
        response: json(401, { success: false, error: "Invalid or expired authentication." }),
      });
      const noMembership = vi.fn().mockResolvedValue({
        response: json(403, { success: false, error: "Organization access denied." }),
      });

      const invalidResponse = await createHandler(invalidToken)(event(body));
      const membershipResponse = await createHandler(noMembership)(event(body));

      expect(invalidResponse.statusCode, name).toBe(401);
      expect(membershipResponse.statusCode, name).toBe(403);
    }
  });

  it("denies viewer access across every migrated mutation API", async () => {
    const deniedViewer = () =>
      vi.fn().mockResolvedValue({
        response: json(403, {
          success: false,
          error: "Insufficient organization role.",
        }),
      });
    const mutationCases = [
      [sendSms.createSendSmsHandler({ authorize: deniedViewer() }), { to: "+15551234567", message: "Hello" }],
      [sendEmail.createSendEmailHandler({ authorize: deniedViewer() }), { to: "person@example.com", subject: "Hi", body: "Hello" }],
      [checkout.createCheckoutHandler({ authorize: deniedViewer() }), { planId: "starter" }],
      [portal.createBillingPortalHandler({ authorize: deniedViewer() }), { customerId: "cus_1" }],
    ];

    for (const [handler, body] of mutationCases) {
      const response = await handler(event(body));
      expect(response.statusCode).toBe(403);
    }
  });

  it("rejects a cross-tenant email deal before provider behavior", async () => {
    const context = authorized();
    const verifyDeal = vi.fn().mockResolvedValue({
      response: json(404, { success: false, error: "Resource not found." }),
    });
    const handler = sendEmail.createSendEmailHandler({
      authorize: context.authorize,
      verifyDeal,
    });

    const response = await handler(
      event({
        to: "person@example.com",
        subject: "Test",
        body: "Hello",
        dealId: "deal-other",
      })
    );

    expect(response.statusCode).toBe(404);
    expect(verifyDeal).toHaveBeenCalledWith(
      context.adminClient,
      "deal-other",
      "org-1"
    );
  });

});
