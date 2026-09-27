import { callNetlifyFunction } from "../api/netlifyClient";

export const VOLUSIA_CODE_COMPLIANCE_SOURCE = "volusia-code-compliance";
export const VOLUSIA_CODE_COMPLIANCE_DEFAULT_WINDOW_DAYS = 30;

export function checkVolusiaCodeComplianceAvailability() {
  return callNetlifyFunction("volusia-code-compliance", {
    body: { action: "availability" },
    retries: 0,
  });
}

export function fetchVolusiaCodeComplianceCandidates(
  windowDays = VOLUSIA_CODE_COMPLIANCE_DEFAULT_WINDOW_DAYS
) {
  return callNetlifyFunction("volusia-code-compliance", {
    body: { action: "discover", windowDays },
    retries: 0,
  });
}
