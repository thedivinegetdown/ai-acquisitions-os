const assert = require("node:assert/strict");

const target = process.env.DEPLOY_PREVIEW_URL || process.argv[2] || "";
if (!target) {
  console.error("DEPLOY_PREVIEW_URL or a deploy-preview URL argument is required.");
  process.exit(2);
}

const baseUrl = new URL(target);
if (
  baseUrl.protocol !== "https:" ||
  !baseUrl.hostname.toLowerCase().startsWith("deploy-preview-") ||
  !baseUrl.hostname.toLowerCase().endsWith(".netlify.app")
) {
  console.error("Refusing smoke checks: target must be a Netlify deploy-preview URL.");
  process.exit(2);
}

const request = async (path, options = {}) => {
  const response = await fetch(new URL(path, baseUrl), {
    ...options,
    signal: AbortSignal.timeout(15_000),
    redirect: "follow",
  });
  return { response, text: await response.text() };
};

(async () => {
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
  assert.ok([400, 403].includes(inbound.response.status), "Twilio webhook must fail closed");

  const stripe = await request("/.netlify/functions/stripe-webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.ok([400, 503].includes(stripe.response.status), "Stripe webhook must fail closed");

  console.log("Deploy-preview smoke gates passed without authenticated or mutating requests.");
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
