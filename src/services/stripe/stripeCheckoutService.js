import { mapBillingPlanToStripePlan } from "./stripePlanMapper";
import { callStripeFunction } from "./stripeClientService";

export async function createCheckoutSession({
  planId = "starter",
  customerEmail = "",
} = {}) {
  const mappedPlan = mapBillingPlanToStripePlan(planId);

  return callStripeFunction("create-checkout-session", {
    ...mappedPlan,
    customerEmail,
  });
}
