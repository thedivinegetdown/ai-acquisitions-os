import {
  buildMarketSettings,
  normalizeOrganizationProfile,
} from "./organizationService";
import {
  normalizeLeadSourceSettings,
  normalizeSystemPreferences,
} from "./preferenceService";

function analyzeSettingsRisks({
  organizationProfile,
  marketSettings,
  leadSourceSettings,
  systemPreferences,
}) {
  const activeLeadSources = Object.entries(leadSourceSettings)
    .filter(([, enabled]) => enabled)
    .map(([source]) => source);

  const missingData = [
    !organizationProfile.organizationName ? "Organization name" : null,
    !organizationProfile.businessPhone ? "Business phone" : null,
    !organizationProfile.businessEmail ? "Business email" : null,
    !marketSettings.defaultMarket ? "Default market" : null,
    marketSettings.activeMarkets.length === 0 ? "Active markets" : null,
    !organizationProfile.defaultTitleCompany ? "Default title company" : null,
    activeLeadSources.length === 0 ? "Lead sources" : null,
  ].filter(Boolean);

  const risks = [
    !marketSettings.hasDefaultMarketInActiveMarkets
      ? "Default market is not listed in active markets."
      : null,
    !systemPreferences.defaultTimezone
      ? "Default timezone is missing and follow-up timing may be inconsistent."
      : null,
    systemPreferences.defaultAssignmentFeeTarget <= 0
      ? "Default assignment fee target is missing or zero."
      : null,
    systemPreferences.defaultRepairEstimateBuffer < 0
      ? "Repair estimate buffer cannot be negative."
      : null,
    !systemPreferences.aiAssistanceEnabled
      ? "AI assistance is disabled for future AI-assisted workflows."
      : null,
  ].filter(Boolean);

  return {
    activeLeadSources,
    missingData,
    risks,
  };
}

function getRecommendedNextAction({ missingData, risks }) {
  if (missingData.includes("Organization name")) {
    return "Set the organization name before future tenant configuration.";
  }

  if (missingData.includes("Default market")) {
    return "Configure a default market for new lead workflows.";
  }

  if (missingData.includes("Lead sources")) {
    return "Enable at least one lead source for reporting defaults.";
  }

  if (risks.includes("Default market is not listed in active markets.")) {
    return "Add the default market to active markets or choose a different default.";
  }

  return "Review settings before enabling persistence, enforcement, or tenant-level defaults.";
}

export function analyzeSettingsFoundation({
  organization = {},
  preferences = {},
  leadSources = [],
} = {}) {
  const organizationProfile = normalizeOrganizationProfile(organization);
  const marketSettings = buildMarketSettings(organization);
  const leadSourceSettings = normalizeLeadSourceSettings(leadSources);
  const systemPreferences = normalizeSystemPreferences(preferences);
  const riskAnalysis = analyzeSettingsRisks({
    organizationProfile,
    marketSettings,
    leadSourceSettings,
    systemPreferences,
  });

  return {
    organizationProfile,
    marketSettings,
    leadSourceSettings,
    systemPreferences,
    risks: riskAnalysis.risks,
    missingData: riskAnalysis.missingData,
    recommendedNextAction: getRecommendedNextAction(riskAnalysis),
    summary:
      "Settings foundation is configured for planning only. Not all settings are enforced yet.",
    generatedAt: new Date().toISOString(),
  };
}
