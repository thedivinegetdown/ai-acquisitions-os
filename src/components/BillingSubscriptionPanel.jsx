import { useMemo, useState } from "react";
import {
  BILLING_PLANS,
  SUBSCRIPTION_STATUSES,
  buildBillingContext,
  buildDefaultSubscription,
  formatPlanPrice,
} from "../services/billing";
import {
  createBillingPortalSession,
  createCheckoutSession,
} from "../services/stripe";

const fieldStyle = {
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: 10,
  width: "100%",
};

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 12,
};

function Field({ label, children }) {
  return (
    <label>
      <div
        style={{
          color: "#64748b",
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      {children}
    </label>
  );
}

function DetailList({ title, items, emptyText }) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

  return (
    <div style={cardStyle}>
      <strong>{title}</strong>
      {safeItems.length === 0 ? (
        <p style={{ marginBottom: 0 }}>{emptyText}</p>
      ) : (
        <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
          {safeItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UsageRow({ metric }) {
  const limitLabel = metric.limit === null ? "Unlimited" : metric.limit;
  const usageLabel =
    metric.percentUsed === null ? "No limit" : `${metric.percentUsed}% used`;

  return (
    <div
      style={{
        ...cardStyle,
        borderColor: metric.overLimit
          ? "#fecaca"
          : metric.warning
            ? "#fde68a"
            : "#e5e7eb",
      }}
    >
      <strong>{metric.label}</strong>
      <div style={{ color: "#334155", marginTop: 4 }}>
        {metric.used} / {limitLabel}
      </div>
      <div style={{ color: "#64748b", fontSize: 12 }}>{usageLabel}</div>
    </div>
  );
}

export default function BillingSubscriptionPanel({ deals = [] }) {
  const [subscription, setSubscription] = useState(() => buildDefaultSubscription());
  const [stripeAction, setStripeAction] = useState({
    loading: false,
    error: "",
    checkoutUrl: "",
    portalUrl: "",
    message: "",
  });
  const [usage, setUsage] = useState({
    leads: Array.isArray(deals) ? deals.length : 0,
    smsMessages: 0,
    aiRequests: 0,
    teamMembers: 1,
    activeMarkets: 0,
    storageDocuments: 0,
  });

  const billing = useMemo(
    () =>
      buildBillingContext({
        subscription,
        usage: {
          ...usage,
          leads: Array.isArray(deals) ? deals.length : usage.leads,
        },
      }),
    [deals, subscription, usage]
  );

  function updateSubscription(field, value) {
    setSubscription((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateUsage(field, value) {
    setUsage((current) => ({
      ...current,
      [field]: Number(value) || 0,
    }));
  }

  async function handleCreateCheckoutSession() {
    setStripeAction({
      loading: true,
      error: "",
      checkoutUrl: "",
      portalUrl: "",
      message: "Preparing Stripe test checkout session...",
    });

    const result = await createCheckoutSession({
      planId: subscription.planId,
      organizationId: "local-org",
      tenantId: "local-tenant",
    });

    if (!result.success) {
      setStripeAction({
        loading: false,
        error:
          result.error?.message ||
          "Stripe test checkout is not available right now.",
        checkoutUrl: "",
        portalUrl: "",
        message: "",
      });
      return;
    }

    setStripeAction({
      loading: false,
      error: "",
      checkoutUrl: result.data?.url || "",
      portalUrl: "",
      message: "Stripe test checkout session is ready.",
    });
  }

  async function handleCreatePortalSession() {
    setStripeAction({
      loading: true,
      error: "",
      checkoutUrl: "",
      portalUrl: "",
      message: "Preparing Stripe test billing portal session...",
    });

    const result = await createBillingPortalSession({
      customerId: subscription.stripeCustomerId,
      organizationId: "local-org",
      tenantId: "local-tenant",
    });

    if (!result.success) {
      setStripeAction({
        loading: false,
        error:
          result.error?.message ||
          "Stripe test billing portal is not available right now.",
        checkoutUrl: "",
        portalUrl: "",
        message: "",
      });
      return;
    }

    setStripeAction({
      loading: false,
      error: "",
      checkoutUrl: "",
      portalUrl: result.data?.url || "",
      message: "Stripe test billing portal session is ready.",
    });
  }

  return (
    <section
      style={{
        background: "#f8fafc",
        border: "1px solid #dbe3ef",
        borderRadius: 14,
        padding: 18,
        marginBottom: 24,
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              color: "#64748b",
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 4,
              textTransform: "uppercase",
            }}
          >
            Billing / Subscription
          </div>
          <strong style={{ color: "#0f172a", fontSize: 22 }}>
            Billing Foundation
          </strong>
        </div>

        <span
          style={{
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: 999,
            color: "#9a3412",
            fontSize: 13,
            fontWeight: 800,
            padding: "7px 12px",
          }}
        >
          Billing foundation only - live payments are not active yet.
        </span>
      </div>

      <div
        style={{
          ...cardStyle,
          borderColor: "#bae6fd",
          background: "#f0f9ff",
          marginBottom: 12,
        }}
      >
        <strong>Stripe test integration only - billing enforcement is not active.</strong>
        <p style={{ color: "#334155", marginBottom: 10 }}>
          Hosted Stripe checkout and portal sessions can be prepared for test mode.
          Payment details are handled by Stripe, and plan limits remain warning-only.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            onClick={handleCreateCheckoutSession}
            disabled={stripeAction.loading}
            style={{
              background: "#0f172a",
              border: "1px solid #0f172a",
              borderRadius: 8,
              color: "#ffffff",
              cursor: stripeAction.loading ? "not-allowed" : "pointer",
              fontWeight: 800,
              padding: "9px 12px",
            }}
          >
            Create test checkout
          </button>
          <button
            type="button"
            onClick={handleCreatePortalSession}
            disabled={stripeAction.loading || !subscription.stripeCustomerId}
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              color: "#0f172a",
              cursor:
                stripeAction.loading || !subscription.stripeCustomerId
                  ? "not-allowed"
                  : "pointer",
              fontWeight: 800,
              padding: "9px 12px",
            }}
          >
            Create test portal
          </button>
        </div>
        {stripeAction.message && (
          <div style={{ color: "#0369a1", fontSize: 13, marginTop: 8 }}>
            {stripeAction.message}
          </div>
        )}
        {stripeAction.error && (
          <div style={{ color: "#b91c1c", fontSize: 13, marginTop: 8 }}>
            {stripeAction.error}
          </div>
        )}
        {(stripeAction.checkoutUrl || stripeAction.portalUrl) && (
          <a
            href={stripeAction.checkoutUrl || stripeAction.portalUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              color: "#075985",
              display: "inline-block",
              fontSize: 13,
              fontWeight: 800,
              marginTop: 8,
            }}
          >
            Open hosted Stripe test session
          </a>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          marginBottom: 12,
        }}
      >
        <Field label="Current Plan">
          <select
            value={subscription.planId}
            onChange={(event) => updateSubscription("planId", event.target.value)}
            style={fieldStyle}
          >
            {BILLING_PLANS.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} - {formatPlanPrice(plan)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Subscription Status">
          <select
            value={subscription.status}
            onChange={(event) => updateSubscription("status", event.target.value)}
            style={fieldStyle}
          >
            {SUBSCRIPTION_STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </Field>
        <Field label="Future Stripe Customer">
          <input
            value={subscription.stripeCustomerId}
            onChange={(event) =>
              updateSubscription("stripeCustomerId", event.target.value)
            }
            placeholder="Not connected"
            style={fieldStyle}
          />
        </Field>
        <Field label="Future Stripe Subscription">
          <input
            value={subscription.stripeSubscriptionId}
            onChange={(event) =>
              updateSubscription("stripeSubscriptionId", event.target.value)
            }
            placeholder="Not connected"
            style={fieldStyle}
          />
        </Field>
      </div>

      <div style={{ ...cardStyle, marginBottom: 12 }}>
        <strong>{billing.currentPlan.name}</strong>
        <p style={{ color: "#334155", marginBottom: 6 }}>
          {billing.currentPlan.description}
        </p>
        <div style={{ color: "#64748b", fontSize: 12 }}>
          Subscription status: {billing.subscriptionStatus} - Future Stripe status:{" "}
          {billing.futureStripeStatus}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          marginBottom: 12,
        }}
      >
        {billing.usageSummary.map((metric) => (
          <UsageRow key={metric.key} metric={metric} />
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          marginBottom: 12,
        }}
      >
        {billing.usageSummary
          .filter((metric) => metric.key !== "leads")
          .map((metric) => (
            <Field key={metric.key} label={`Placeholder ${metric.label}`}>
              <input
                type="number"
                value={usage[metric.key]}
                onChange={(event) => updateUsage(metric.key, event.target.value)}
                style={fieldStyle}
              />
            </Field>
          ))}
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginBottom: 12,
        }}
      >
        <DetailList
          title="Missing Billing Setup"
          items={billing.missingBillingSetup}
          emptyText="No missing billing setup items identified."
        />
        <DetailList
          title="Billing Risks / Warnings"
          items={billing.risks}
          emptyText="No billing risks identified."
        />
      </div>

      <div style={cardStyle}>
        <strong>Upgrade Recommendation</strong>
        <p style={{ color: "#334155", marginBottom: 6 }}>
          {billing.upgradeRecommendation}
        </p>
        <div style={{ color: "#64748b", fontSize: 12 }}>
          {billing.summary} Usage limits are warning-only and not enforced.
        </div>
      </div>
    </section>
  );
}
