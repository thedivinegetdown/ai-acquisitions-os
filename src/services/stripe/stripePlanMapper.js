export const STRIPE_PLAN_PRICE_ENV_KEYS = {
  starter: "STRIPE_PRICE_STARTER",
  growth: "STRIPE_PRICE_GROWTH",
  pro: "STRIPE_PRICE_PRO",
  enterprise: "STRIPE_PRICE_ENTERPRISE",
};

export function mapBillingPlanToStripePlan(planId = "starter") {
  const normalizedPlanId = String(planId || "starter").toLowerCase();

  return {
    planId: normalizedPlanId,
    priceEnvKey:
      STRIPE_PLAN_PRICE_ENV_KEYS[normalizedPlanId] ||
      STRIPE_PLAN_PRICE_ENV_KEYS.starter,
  };
}

export function mapStripeSubscriptionStatus(status = "") {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "active") return "Active";
  if (normalized === "trialing") return "Trial";
  if (normalized === "past_due") return "Past due";
  if (normalized === "canceled") return "Canceled";
  if (normalized === "incomplete") return "Incomplete";

  return "Not configured";
}
