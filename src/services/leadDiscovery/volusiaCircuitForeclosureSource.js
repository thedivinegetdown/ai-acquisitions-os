import { callNetlifyFunction } from "../api/netlifyClient";

export const VOLUSIA_CIRCUIT_FORECLOSURE_SOURCE = "volusia-circuit-foreclosure";
export const VOLUSIA_CIRCUIT_FORECLOSURE_REPORT_LIMIT = 4;

export function fetchVolusiaCircuitForeclosureCandidates() {
  return callNetlifyFunction("volusia-circuit-foreclosure", {
    body: { reportLimit: VOLUSIA_CIRCUIT_FORECLOSURE_REPORT_LIMIT },
    retries: 0,
  });
}
