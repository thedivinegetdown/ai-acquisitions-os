import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { classifyInvalidTwilioWebhookStatus } = require("../test-deploy-preview-smoke.cjs");

describe("deploy-preview Twilio inbound smoke contract", () => {
  it.each([
    [400, "safe-bad-request"],
    [403, "safe-signature-rejection"],
    [503, "safe-configuration-unavailable"],
  ])("classifies HTTP %i as %s", (status, classification) => {
    expect(classifyInvalidTwilioWebhookStatus(status)).toBe(classification);
  });

  it.each([200, 201, 204])("rejects invalid unsigned webhook success status HTTP %i", (status) => {
    expect(() => classifyInvalidTwilioWebhookStatus(status)).toThrow("must fail closed");
  });

  it.each([500, 501, 502, 504])("rejects unexpected server error HTTP %i", (status) => {
    expect(() => classifyInvalidTwilioWebhookStatus(status)).toThrow("must fail closed");
  });
});
