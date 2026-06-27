import { getDealAliasText } from "../../utils/dealFields";
import { safeTrim, uniqueStrings } from "../../utils/text";

export const CAMPAIGN_CHANNELS = [
  "Direct mail",
  "PPC",
  "SEO",
  "Cold calling",
  "SMS campaign",
  "Referral",
  "Agent",
  "Organic",
  "Other",
];

export function normalizeLeadSource(value = "") {
  return safeTrim(value) || "Unknown";
}

export function getLeadSourcesFromDeals(deals = []) {
  const sources = deals.map((deal) =>
    normalizeLeadSource(getDealAliasText(deal, "source") || deal.source)
  );

  return uniqueStrings(["Unknown", ...sources]);
}

export function buildLeadSourceSummary({ campaigns = [], deals = [] } = {}) {
  const sources = getLeadSourcesFromDeals(deals);
  const campaignSources = campaigns.map((campaign) =>
    normalizeLeadSource(campaign.leadSource)
  );

  return uniqueStrings([...sources, ...campaignSources]).map((source) => ({
    source,
    campaignCount: campaigns.filter(
      (campaign) => normalizeLeadSource(campaign.leadSource) === source
    ).length,
    dealCount: deals.filter(
      (deal) => normalizeLeadSource(getDealAliasText(deal, "source") || deal.source) === source
    ).length,
  }));
}
