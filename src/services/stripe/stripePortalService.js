import { callStripeFunction } from "./stripeClientService";

export async function createBillingPortalSession({
  customerId = "",
  organizationId = "local-org",
  tenantId = "local-tenant",
} = {}) {
  return callStripeFunction("create-billing-portal-session", {
    customerId,
    organizationId,
    tenantId,
  });
}
