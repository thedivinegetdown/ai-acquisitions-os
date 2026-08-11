import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const twilio = require("twilio");
const {
  OPT_IN_COMMANDS,
  OPT_OUT_COMMANDS,
  buildWebhookUrl,
  classifyConsentCommand,
  normalizeProviderStatus,
  shouldApplyStatusTransition,
  validateTwilioWebhook,
} = require("../_shared/twilio.cjs");

const originalEnv = { ...process.env };
const authToken = "unit-test-auth-token";
const publicSiteUrl = "https://communications.example.test";
const webhookPath = "/.netlify/functions/inbound-v2";
const params = {
  Body: "Hello",
  From: "+15551112222",
  MessageSid: "SM00000000000000000000000000000001",
  To: "+15553334444",
};

function eventFor(bodyParams = params, headerName = "x-twilio-signature") {
  const canonicalUrl = `${publicSiteUrl}${webhookPath}`;
  const signature = twilio.getExpectedTwilioSignature(
    authToken,
    canonicalUrl,
    bodyParams
  );
  return {
    body: new URLSearchParams(bodyParams).toString(),
    headers: { [headerName]: signature, "x-forwarded-host": "attacker.test" },
  };
}

beforeEach(() => {
  process.env.TWILIO_AUTH_TOKEN = authToken;
  process.env.PUBLIC_SITE_URL = publicSiteUrl;
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.keys(process.env).forEach((key) => delete process.env[key]);
  Object.assign(process.env, originalEnv);
});

describe("Twilio webhook signature boundary", () => {
  it("accepts a valid signature with lowercase or canonical header casing", () => {
    for (const header of ["x-twilio-signature", "X-Twilio-Signature"]) {
      expect(
        validateTwilioWebhook(eventFor(params, header), {
          path: webhookPath,
          requiredFields: ["MessageSid", "From", "To", "Body"],
        })
      ).toMatchObject({ ok: true, canonicalUrl: `${publicSiteUrl}${webhookPath}` });
    }
  });

  it("fails closed for missing and invalid signatures", () => {
    const missing = validateTwilioWebhook(
      { body: new URLSearchParams(params).toString(), headers: {} },
      { path: webhookPath }
    );
    const invalid = validateTwilioWebhook(
      { ...eventFor(), headers: { "x-twilio-signature": "invalid" } },
      { path: webhookPath }
    );

    expect(missing.response.statusCode).toBe(403);
    expect(invalid.response.statusCode).toBe(403);
  });

  it("uses the configured canonical origin and ignores forwarded hosts", () => {
    expect(buildWebhookUrl(webhookPath)).toBe(`${publicSiteUrl}${webhookPath}`);
    expect(
      validateTwilioWebhook(eventFor(), { path: webhookPath }).canonicalUrl
    ).not.toContain("attacker.test");
  });

  it("validates Twilio parameter ordering and rejects tampering", () => {
    const reordered = {
      To: params.To,
      MessageSid: params.MessageSid,
      From: params.From,
      Body: params.Body,
    };
    expect(validateTwilioWebhook(eventFor(reordered), { path: webhookPath }).ok).toBe(true);

    const signed = eventFor(params);
    signed.body = new URLSearchParams({ ...params, Body: "Tampered" }).toString();
    expect(validateTwilioWebhook(signed, { path: webhookPath }).ok).toBe(false);
  });

  it("rejects malformed forms and missing required provider identity", () => {
    const malformed = validateTwilioWebhook(
      { body: "", headers: { "x-twilio-signature": "anything" } },
      { path: webhookPath, requiredFields: ["MessageSid"] }
    );
    const missingSidParams = { ...params, MessageSid: "" };
    const missingSid = validateTwilioWebhook(eventFor(missingSidParams), {
      path: webhookPath,
      requiredFields: ["MessageSid"],
    });

    expect(malformed.response.statusCode).toBe(400);
    expect(missingSid.response.statusCode).toBe(400);
  });

  it("never logs the signing token", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    validateTwilioWebhook(eventFor(), { path: webhookPath });

    expect(JSON.stringify(log.mock.calls)).not.toContain(authToken);
    expect(JSON.stringify(error.mock.calls)).not.toContain(authToken);
  });
});

describe("consent and delivery policies", () => {
  it.each(OPT_OUT_COMMANDS)("classifies exact %s as opted out", (command) => {
    expect(classifyConsentCommand(`  ${command.toLowerCase()}  `)).toBe("opted-out");
  });

  it.each(OPT_IN_COMMANDS)("classifies exact %s as opted in", (command) => {
    expect(classifyConsentCommand(`  ${command.toLowerCase()}  `)).toBe("opted-in");
  });

  it("does not use fuzzy consent matching", () => {
    expect(classifyConsentCommand("STOPPED")).toBe("ordinary");
    expect(classifyConsentCommand("please stop contacting me")).toBe("ordinary");
    expect(classifyConsentCommand("HELP")).toBe("help");
    expect(classifyConsentCommand("hello")).toBe("ordinary");
  });

  it("normalizes provider delivery states without inventing success", () => {
    expect(normalizeProviderStatus("Delivered")).toBe("delivered");
    expect(normalizeProviderStatus("mystery")).toBe("unknown");
  });

  it("prevents duplicate, terminal, and backward delivery transitions", () => {
    expect(shouldApplyStatusTransition("queued", "sent")).toBe(true);
    expect(shouldApplyStatusTransition("sent", "queued")).toBe(false);
    expect(shouldApplyStatusTransition("delivered", "queued")).toBe(false);
    expect(shouldApplyStatusTransition("delivered", "delivered")).toBe(false);
    expect(shouldApplyStatusTransition("failed", "delivered")).toBe(false);
  });
});
