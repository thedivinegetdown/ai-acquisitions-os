import { updateDeal } from "./dealRepository";

export async function updateTransactionFields(dealId, payload) {
  return updateDeal(dealId, payload);
}
