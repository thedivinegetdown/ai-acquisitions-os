import { mapBillingPlanToStripePlan } from "./stripePlanMapper";
import { callStripeFunction } from "./stripeClientService";

export async function createCheckoutSession({
  planId = "starter",
  organizationId = "local-org",
  tenantId = "local-tenant",
  customerEmail = "",
} = {}) {
  const mappedPlan = mapBillingPlanToStripePlan(planId);

  return callStripeFunction("create-checkout-session", {
    ...mappedPlan,
    organizationId,
    tenantId,
    customerEmail,
  });
}
