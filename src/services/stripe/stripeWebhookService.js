import { mapStripeSubscriptionStatus } from "./stripePlanMapper";

export function normalizeStripeWebhookEvent(event = {}) {
  const dataObject = event.data?.object || {};

  return {
    id: event.id || "",
    type: event.type || "unknown",
    stripeCustomerId: dataObject.customer || "",
    stripeSubscriptionId: dataObject.subscription || dataObject.id || "",
    subscriptionStatus: mapStripeSubscriptionStatus(dataObject.status),
    createdAt: event.created ? new Date(event.created * 1000).toISOString() : "",
    raw: event,
  };
}
