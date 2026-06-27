const crypto = require("crypto");
const { json } = require("./_shared/security.cjs");

const MAX_SIGNATURE_AGE_SECONDS = 300;

function getRawBody(event) {
  if (event.isBase64Encoded) {
    return Buffer.from(event.body || "", "base64").toString("utf8");
  }

  return event.body || "";
}

function parseStripeSignature(signature = "") {
  return signature.split(",").reduce((parts, part) => {
    const [key, value] = part.split("=");
    if (!parts[key]) parts[key] = [];
    parts[key].push(value);
    return parts;
  }, {});
}

function verifyStripeSignature({ rawBody, signature, secret }) {
  if (!signature || !secret) return false;

  const parts = parseStripeSignature(signature);
  const timestamp = parts.t?.[0];
  const signatures = parts.v1 || [];

  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > MAX_SIGNATURE_AGE_SECONDS) {
    return false;
  }

  const payload = `${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex");

  return signatures.some((value) => {
    if (!value) return false;

    const left = Buffer.from(value, "hex");
    const right = Buffer.from(expected, "hex");
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  });
}

function normalizeWebhookEvent(event = {}) {
  const dataObject = event.data?.object || {};

  return {
    id: event.id || "",
    type: event.type || "unknown",
    stripeCustomerId: dataObject.customer || "",
    stripeSubscriptionId: dataObject.subscription || dataObject.id || "",
    status: dataObject.status || "",
    planId: dataObject.metadata?.plan_id || "",
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { success: false, error: "Method not allowed." });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return json(503, {
      success: false,
      error: "Stripe webhook is not configured.",
    });
  }

  const rawBody = getRawBody(event);
  const signature =
    event.headers?.["stripe-signature"] || event.headers?.["Stripe-Signature"];

  if (
    !verifyStripeSignature({
      rawBody,
      signature,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    })
  ) {
    return json(400, {
      success: false,
      error: "Invalid Stripe webhook signature.",
    });
  }

  let stripeEvent = null;

  try {
    stripeEvent = JSON.parse(rawBody);
  } catch {
    return json(400, { success: false, error: "Invalid webhook payload." });
  }

  const normalizedEvent = normalizeWebhookEvent(stripeEvent);

  return json(200, {
    success: true,
    received: true,
    mode: "test",
    event: normalizedEvent,
    message:
      "Stripe webhook received. Persistence and billing enforcement are not active yet.",
  });
};
