const {
  json,
  logError,
  parseJsonBody,
  requirePost,
  safeTrim,
} = require("./_shared/security.cjs");

const { requireTenantContext } = require("./_shared/auth.cjs");
const STRIPE_API_BASE = "https://api.stripe.com/v1";

function getAppUrl(event) {
  return (
    process.env.APP_URL ||
    process.env.URL ||
    event.headers?.origin ||
    "http://localhost:8888"
  );
}

async function createStripePortalSession(payload) {
  const response = await fetch(`${STRIPE_API_BASE}/billing_portal/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(payload),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    logError("[stripe] billing portal session failed", {
      message: data.error?.message || "Stripe billing portal session failed.",
      status: response.status,
      type: data.error?.type,
      code: data.error?.code,
    });
    throw new Error("Stripe billing portal session failed.");
  }

  return data;
}
async function loadStripeCustomer(customerId) {
  const response = await fetch(
    `${STRIPE_API_BASE}/customers/${encodeURIComponent(customerId)}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      },
    }
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error("Stripe customer lookup failed.");
  }

  return data;
}


function createBillingPortalHandler({
  authorize = requireTenantContext,
  createPortal = createStripePortalSession,
  loadCustomer = loadStripeCustomer,
} = {}) {
  return async (event) => {
    const methodResponse = requirePost(event);
    if (methodResponse) return methodResponse;

    const parsed = parseJsonBody(event);
    if (parsed.error) return json(400, { success: false, error: parsed.error });

    const authorization = await authorize(event, {
      allowedRoles: ["owner"],
      requestedOrganizationId:
        parsed.body.organization_id || parsed.body.organizationId,
    });
    if (authorization.response) return authorization.response;

    if (!process.env.STRIPE_SECRET_KEY) {
      return json(503, {
        success: false,
        error: "Stripe test integration is not configured.",
      });
    }

    const customerId = safeTrim(parsed.body.customerId);

    if (!customerId) {
      return json(400, {
        success: false,
        error: "Stripe customer ID is required for the billing portal.",
      });
    }

    try {
      const customer = await loadCustomer(customerId);
      if (
        safeTrim(customer?.metadata?.organization_id) !==
        authorization.context.organizationId
      ) {
        return json(404, { success: false, error: "Resource not found." });
      }

      const session = await createPortal({
        customer: customerId,
        return_url: `${getAppUrl(event)}/?billing=portal-return`,
      });

      return json(200, {
        success: true,
        mode: "test",
        url: session.url,
        customerId,
      });
    } catch {
      return json(502, {
        success: false,
        error: "Stripe billing portal session failed.",
      });
    }
  };
}

exports.createBillingPortalHandler = createBillingPortalHandler;
exports.handler = createBillingPortalHandler();
