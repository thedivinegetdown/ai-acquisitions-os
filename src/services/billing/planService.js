export const BILLING_PLANS = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 99,
    description: "Foundation plan for small acquisition teams.",
    limits: {
      leads: 500,
      smsMessages: 1000,
      aiRequests: 250,
      teamMembers: 3,
      activeMarkets: 2,
      storageDocuments: 250,
    },
  },
  {
    id: "growth",
    name: "Growth",
    monthlyPrice: 299,
    description: "Growth plan for active local teams.",
    limits: {
      leads: 2500,
      smsMessages: 5000,
      aiRequests: 1500,
      teamMembers: 10,
      activeMarkets: 8,
      storageDocuments: 2000,
    },
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 799,
    description: "Professional plan for scaled acquisitions operations.",
    limits: {
      leads: 10000,
      smsMessages: 20000,
      aiRequests: 7500,
      teamMembers: 30,
      activeMarkets: 25,
      storageDocuments: 10000,
    },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: null,
    description: "Enterprise plan for custom operations and support.",
    limits: {
      leads: null,
      smsMessages: null,
      aiRequests: null,
      teamMembers: null,
      activeMarkets: null,
      storageDocuments: null,
    },
  },
];

export function getBillingPlan(planId = "starter") {
  return (
    BILLING_PLANS.find((plan) => plan.id === planId) || BILLING_PLANS[0]
  );
}

export function getNextPlan(currentPlanId = "starter") {
  const currentIndex = BILLING_PLANS.findIndex((plan) => plan.id === currentPlanId);

  if (currentIndex === -1 || currentIndex >= BILLING_PLANS.length - 1) {
    return null;
  }

  return BILLING_PLANS[currentIndex + 1];
}

export function formatPlanPrice(plan) {
  if (!plan) return "Unknown";
  if (plan.monthlyPrice === null) return "Custom";
  return `$${plan.monthlyPrice}/mo`;
}
