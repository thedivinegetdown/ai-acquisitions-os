import { parseSafeNumber } from "../../utils/numbers";
import { safeTrim } from "../../utils/text";

export const LEAD_SOURCE_OPTIONS = [
  "Direct mail",
  "PPC",
  "SEO",
  "Cold calling",
  "SMS campaign",
  "Referral",
  "Agent",
  "Other",
];

export const PIPELINE_STAGE_OPTIONS = [
  "New Lead",
  "Contacted",
  "Nurture",
  "Offer Ready",
  "Under Contract",
  "Dead Lead",
];

export const FOLLOW_UP_CADENCE_OPTIONS = [
  "Same day",
  "Daily",
  "Every 2 days",
  "Weekly",
  "Manual review",
];

export const OFFER_FORMULA_OPTIONS = [
  "70% ARV minus repairs",
  "75% ARV minus repairs",
  "MAO by market",
  "Seller finance review",
  "Manual underwriting",
];

export function buildInitialPreferences() {
  return {
    leadSources: ["Direct mail", "PPC", "Referral"],
    defaultFollowUpCadence: "Every 2 days",
    defaultOfferFormula: "70% ARV minus repairs",
    defaultAssignmentFeeTarget: 15000,
    defaultRepairEstimateBuffer: 10,
    defaultPipelineStage: "New Lead",
    defaultTimezone: "America/New_York",
    aiAssistanceEnabled: true,
  };
}

export function normalizeLeadSourceSettings(leadSources = []) {
  const selectedSources = Array.isArray(leadSources) ? leadSources : [];

  return LEAD_SOURCE_OPTIONS.reduce((settings, source) => {
    settings[source] = selectedSources.includes(source);
    return settings;
  }, {});
}

export function normalizeSystemPreferences(preferences = {}) {
  return {
    defaultFollowUpCadence:
      safeTrim(preferences.defaultFollowUpCadence) || "Every 2 days",
    defaultOfferFormula:
      safeTrim(preferences.defaultOfferFormula) || "70% ARV minus repairs",
    defaultAssignmentFeeTarget:
      parseSafeNumber(preferences.defaultAssignmentFeeTarget) ?? 0,
    defaultRepairEstimateBuffer:
      parseSafeNumber(preferences.defaultRepairEstimateBuffer) ?? 0,
    defaultPipelineStage:
      safeTrim(preferences.defaultPipelineStage) || "New Lead",
    defaultTimezone:
      safeTrim(preferences.defaultTimezone) || "America/New_York",
    aiAssistanceEnabled: Boolean(preferences.aiAssistanceEnabled),
  };
}
