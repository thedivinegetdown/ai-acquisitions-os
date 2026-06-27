import { safeTrim } from "../../utils/text";

function splitList(value) {
  if (Array.isArray(value)) return value.map(safeTrim).filter(Boolean);
  return String(value || "")
    .split(",")
    .map(safeTrim)
    .filter(Boolean);
}

export function buildInitialOrganizationSettings() {
  return {
    organizationName: "AI Acquisitions OS",
    businessPhone: "",
    businessEmail: "",
    website: "",
    defaultMarket: "",
    activeMarkets: "",
    defaultAcquisitionsRep: "",
    defaultDispositionsRep: "",
    defaultTitleCompany: "",
    defaultClosingTimeline: "30 days",
    notes: "Local settings foundation. Not persisted.",
  };
}

export function normalizeOrganizationProfile(settings = {}) {
  return {
    organizationName: safeTrim(settings.organizationName),
    businessPhone: safeTrim(settings.businessPhone),
    businessEmail: safeTrim(settings.businessEmail),
    website: safeTrim(settings.website),
    defaultAcquisitionsRep: safeTrim(settings.defaultAcquisitionsRep),
    defaultDispositionsRep: safeTrim(settings.defaultDispositionsRep),
    defaultTitleCompany: safeTrim(settings.defaultTitleCompany),
    defaultClosingTimeline: safeTrim(settings.defaultClosingTimeline),
    notes: safeTrim(settings.notes),
  };
}

export function buildMarketSettings(settings = {}) {
  const activeMarkets = splitList(settings.activeMarkets);
  const defaultMarket = safeTrim(settings.defaultMarket);

  return {
    defaultMarket,
    activeMarkets,
    hasDefaultMarketInActiveMarkets:
      !defaultMarket || activeMarkets.includes(defaultMarket),
  };
}
