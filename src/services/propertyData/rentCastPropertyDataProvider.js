import { createFailure, createSuccess } from "../api/serviceResult";
import { callNetlifyFunction } from "../api/netlifyClient";

async function request(action, deal) {
  if (!deal?.id) return createFailure(new Error("A deal is required."), "A deal is required.");
  const result = await callNetlifyFunction("property-data-rentcast", {
    body: { action, dealId: deal.id },
    retries: 0,
  });
  if (!result.success) return result;
  return createSuccess(result.data);
}

export const rentCastPropertyDataProvider = {
  id: "rentcast",
  label: "RentCast",
  serverOnly: true,
  getStatus({ deal } = {}) {
    return request("status", deal);
  },
  async lookupPropertyData({ deal } = {}) {
    const result = await request("refresh", deal);
    if (!result.success) return result;
    return createSuccess(result.data.evidence?.data || null, {
      evidence: result.data.evidence,
      provider: result.data.provider,
      cacheHit: result.data.cacheHit,
    });
  },
};

export function getRentCastPropertyDataStatus(deal) {
  return rentCastPropertyDataProvider.getStatus({ deal });
}

export function refreshRentCastPropertyData(deal) {
  return request("refresh", deal);
}
