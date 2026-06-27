const {
  isLikelyEmail,
  json,
  logError,
  parseJsonBody,
  requirePost,
  safeTrim,
} = require("./_shared/security.cjs");

const STRIPE_API_BASE = "https://api.stripe.com/v1";

const PRICE_ENV_KEYS = {
  starter: "STRIPE_PRICE_STARTER",
  growth: "STRIPE_PRICE_GROWTH",
  pro: "STRIPE_PRICE_PRO",
  enterprise: "STRIPE_PRICE_ENTERPRISE",
};

function getAppUrl(event) {
  return (
    process.env.APP_URL ||
    process.env.URL ||
    event.headers?.origin ||
    "http://localhost:8888"
  );
}

async function createStripeCheckoutSession(payload) {
  const response = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(payload),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    logError("[stripe] checkout session failed", {
      message: data.error?.message || "Stripe checkout session failed.",
      status: response.status,
      type: data.error?.type,
      code: data.error?.code,
    });
    throw new Error("Stripe checkout session failed.");
  }

  return data;
}

exports.handler = async (event) => {
  const methodResponse = requirePost(event);
  if (methodResponse) return methodResponse;

  if (!process.env.STRIPE_SECRET_KEY) {
    return json(503, {
      success: false,
      error: "Stripe test integration is not configured.",
    });
  }

  const parsed = parseJsonBody(event);
  if (parsed.error) return json(400, { success: false, error: parsed.error });

  const planId = safeTrim(parsed.body.planId || "starter").toLowerCase();
  const priceEnvKey = PRICE_ENV_KEYS[planId];
  const priceId = process.env[priceEnvKey];

  if (!priceId) {
    return json(400, {
      success: false,
      error: "Stripe price is not configured for this plan.",
    });
  }

  const customerEmail = safeTrim(parsed.body.customerEmail);
  if (customerEmail && !isLikelyEmail(customerEmail)) {
    return json(400, {
      success: false,
      error: "A valid customer email is required.",
    });
  }

  try {
    const appUrl = getAppUrl(event);
    const session = await createStripeCheckoutSession({
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: `${appUrl}/?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?billing=cancelled`,
      "metadata[plan_id]": planId,
      "metadata[tenant_id]": safeTrim(parsed.body.tenantId) || "local-tenant",
      "metadata[organization_id]": safeTrim(parsed.body.organizationId) || "local-org",
      ...(customerEmail ? { customer_email: customerEmail } : {}),
    });

    return json(200, {
      success: true,
      mode: "test",
      sessionId: session.id,
      url: session.url,
      planId,
    });
  } catch {
    return json(502, {
      success: false,
      error: "Stripe checkout session failed.",
    });
  }
};
