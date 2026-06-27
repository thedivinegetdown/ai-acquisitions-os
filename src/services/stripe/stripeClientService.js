import { callNetlifyFunction } from "../api";

export async function callStripeFunction(functionName, payload = {}) {
  return callNetlifyFunction(functionName, {
    body: payload,
    retries: 0,
  });
}
