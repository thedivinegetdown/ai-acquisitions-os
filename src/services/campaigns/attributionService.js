import { buildLeadSourceSummary } from "./leadSourceService";

export function buildAttributionSummary({ campaigns = [], deals = [] } = {}) {
  const leadSources = buildLeadSourceSummary({ campaigns, deals });
  const totalCampaignLeads = campaigns.reduce(
    (sum, campaign) => sum + Number(campaign.leadsGenerated || 0),
    0
  );
  const attributedDealCount = deals.filter((deal) => deal.source).length;
  const unattributedDealCount = deals.length - attributedDealCount;

  return {
    leadSources,
    totalCampaignLeads,
    attributedDealCount,
    unattributedDealCount,
    attributionCoverage:
      deals.length === 0
        ? 0
        : Math.round((attributedDealCount / deals.length) * 1000) / 10,
  };
}
