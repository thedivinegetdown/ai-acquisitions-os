import { callStripeFunction } from "./stripeClientService";

export async function createBillingPortalSession({
  customerId = "",
} = {}) {
  return callStripeFunction("create-billing-portal-session", {
    customerId,
  });
}
