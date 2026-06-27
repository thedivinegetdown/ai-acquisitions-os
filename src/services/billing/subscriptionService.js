import { safeTrim } from "../../utils/text";
import { getBillingPlan } from "./planService";

export const SUBSCRIPTION_STATUSES = [
  "Trial",
  "Active",
  "Past due",
  "Canceled",
  "Incomplete",
  "Not configured",
];

export function buildDefaultSubscription() {
  return {
    planId: "starter",
    status: "Not configured",
    stripeCustomerId: "",
    stripeSubscriptionId: "",
    currentPeriodEnd: "",
    trialEndsAt: "",
  };
}

export function normalizeSubscription(subscription = {}) {
  const fallback = buildDefaultSubscription();
  const planId = safeTrim(subscription.planId || subscription.plan_id) || fallback.planId;

  return {
    planId,
    plan: getBillingPlan(planId),
    status: safeTrim(subscription.status) || fallback.status,
    stripeCustomerId: safeTrim(subscription.stripeCustomerId || subscription.stripe_customer_id),
    stripeSubscriptionId: safeTrim(
      subscription.stripeSubscriptionId || subscription.stripe_subscription_id
    ),
    currentPeriodEnd: safeTrim(subscription.currentPeriodEnd || subscription.current_period_end),
    trialEndsAt: safeTrim(subscription.trialEndsAt || subscription.trial_ends_at),
  };
}

export function getStripeStatus(subscription = {}) {
  const normalized = normalizeSubscription(subscription);

  if (!normalized.stripeCustomerId && !normalized.stripeSubscriptionId) {
    return "Stripe not connected";
  }

  if (!normalized.stripeSubscriptionId) {
    return "Customer connected, subscription missing";
  }

  return "Stripe subscription connected";
}
