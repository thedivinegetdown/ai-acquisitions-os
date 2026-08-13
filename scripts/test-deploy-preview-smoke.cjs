const assert = require("node:assert/strict");

const classifyInvalidTwilioWebhookStatus = (status) => {
  if (status === 400) return "safe-bad-request";
  if (status === 403) return "safe-signature-rejection";
  if (status === 503) return "safe-configuration-unavailable";

  assert.fail(
    `Twilio webhook must fail closed with 400, 403, or configuration-unavailable 503; received ${status}`
  );
};

const runDeployPreviewSmoke = async (target) => {
  if (!target) {
    throw new Error("DEPLOY_PREVIEW_URL or a deploy-preview URL argument is required.");
  }

  const baseUrl = new URL(target);
  if (
    baseUrl.protocol !== "https:" ||
    !baseUrl.hostname.toLowerCase().startsWith("deploy-preview-") ||
    !baseUrl.hostname.toLowerCase().endsWith(".netlify.app")
  ) {
    throw new Error("Refusing smoke checks: target must be a Netlify deploy-preview URL.");
  }

  const request = async (path, options = {}) => {
    const response = await fetch(new URL(path, baseUrl), {
      ...options,
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
    });
    return { response, text: await response.text() };
  };

  for (const route of [
    "/",
    "/today",
    "/pipeline",
    "/inbox",
    "/approvals",
    "/deals/eo-e2e-nonexistent",
    "/buyers",
    "/reports",
    "/settings",
  ]) {
    const { response } = await request(route);
    assert.equal(response.status, 200, route + " must use the SPA fallback");
  }

  const health = await request("/.netlify/functions/health-check");
  assert.ok([200, 503].includes(health.response.status), "health-check must respond safely");
  assert.doesNotMatch(
    health.text,
    /-----BEGIN .*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.|sk_live_|sb_secret_/,
    "health-check must not expose credential values"
  );

  const protectedApi = await request("/.netlify/functions/send-sms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(protectedApi.response.status, 401, "protected function must reject no-token calls");

  const inbound = await request("/.netlify/functions/inbound-v2", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "MessageSid=SM_EO_E2E_INVALID&From=%2B15555550100&To=%2B15555550200&Body=test",
  });
  classifyInvalidTwilioWebhookStatus(inbound.response.status);

  const stripe = await request("/.netlify/functions/stripe-webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.ok([400, 503].includes(stripe.response.status), "Stripe webhook must fail closed");

  console.log("Deploy-preview smoke gates passed without authenticated or mutating requests.");
};

module.exports = { classifyInvalidTwilioWebhookStatus, runDeployPreviewSmoke };

if (require.main === module) {
  const target = process.env.DEPLOY_PREVIEW_URL || process.argv[2] || "";
  runDeployPreviewSmoke(target).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
