import { getNextPlan } from "./planService";
import { normalizeSubscription, getStripeStatus } from "./subscriptionService";
import {
  buildPlaceholderUsage,
  buildUsageSummary,
  getUsageWarnings,
} from "./usageService";

function getMissingBillingSetup(subscription) {
  return [
    subscription.status === "Not configured" ? "Subscription status" : null,
    !subscription.stripeCustomerId ? "Stripe customer" : null,
    !subscription.stripeSubscriptionId ? "Stripe subscription" : null,
  ].filter(Boolean);
}

function getUpgradeRecommendation({ subscription, usageSummary }) {
  const overLimit = usageSummary.find((metric) => metric.overLimit);
  const warning = usageSummary.find((metric) => metric.warning);
  const nextPlan = getNextPlan(subscription.planId);

  if (!nextPlan) {
    return "Review enterprise billing requirements with the customer before enabling enforcement.";
  }

  if (overLimit) {
    return `Consider upgrading to ${nextPlan.name}; ${overLimit.label.toLowerCase()} is over the placeholder limit.`;
  }

  if (warning) {
    return `Monitor ${warning.label.toLowerCase()} usage and consider ${nextPlan.name} if growth continues.`;
  }

  return "Keep billing in foundation mode until Stripe and tenant enforcement are approved.";
}

export function buildBillingContext({
  subscription = {},
  usage,
  deals = [],
  teamMembers = [],
  activeMarkets = [],
  documents = [],
} = {}) {
  const normalizedSubscription = normalizeSubscription(subscription);
  const currentUsage =
    usage ||
    buildPlaceholderUsage({
      deals,
      teamMembers,
      activeMarkets,
      documents,
    });
  const usageSummary = buildUsageSummary(
    currentUsage,
    normalizedSubscription.plan.limits
  );
  const missingBillingSetup = getMissingBillingSetup(normalizedSubscription);
  const usageWarnings = getUsageWarnings(usageSummary);
  const stripeStatus = getStripeStatus(normalizedSubscription);

  return {
    currentPlan: normalizedSubscription.plan,
    subscriptionStatus: normalizedSubscription.status,
    subscription: normalizedSubscription,
    usageSummary,
    planLimits: normalizedSubscription.plan.limits,
    upgradeRecommendation: getUpgradeRecommendation({
      subscription: normalizedSubscription,
      usageSummary,
    }),
    missingBillingSetup,
    futureStripeStatus: stripeStatus,
    risks: [
      "Live payments are not active yet.",
      "Usage limits are advisory only and not globally enforced.",
      ...usageWarnings,
    ],
    summary:
      "Billing foundation is configured for planning only. Stripe and live payment collection are not active.",
    generatedAt: new Date().toISOString(),
  };
}
