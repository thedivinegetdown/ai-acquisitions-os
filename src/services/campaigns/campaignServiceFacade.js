import {
  getCampaignMissingData,
  normalizeCampaign,
} from "./campaignService";
import { buildAttributionSummary } from "./attributionService";
import { calculateCampaignPortfolioMetrics } from "./campaignAnalyticsService";
import { buildLeadSourceSummary } from "./leadSourceService";

export function analyzeCampaignPerformance({ campaigns = [], deals = [] } = {}) {
  const normalizedCampaigns = campaigns.map(normalizeCampaign);
  const portfolio = calculateCampaignPortfolioMetrics(normalizedCampaigns);
  const attributionSummary = buildAttributionSummary({
    campaigns: portfolio.campaigns,
    deals,
  });
  const leadSources = buildLeadSourceSummary({
    campaigns: portfolio.campaigns,
    deals,
  });
  const missingData = [
    ...new Set(
      campaigns.flatMap((campaign) => getCampaignMissingData(campaign))
    ),
  ];
  const risks = [];

  if (portfolio.campaigns.length === 0) {
    risks.push("No campaigns are being tracked yet.");
  }

  if (attributionSummary.unattributedDealCount > 0) {
    risks.push(
      `${attributionSummary.unattributedDealCount} deals are missing source attribution.`
    );
  }

  if (missingData.length > 0) {
    risks.push("Some campaigns are missing planning or budget fields.");
  }

  return {
    campaigns: portfolio.campaigns,
    leadSources,
    attributionSummary,
    performanceMetrics: {
      bestPerformingSource: portfolio.bestPerformingSource,
      underperformingSource: portfolio.underperformingSource,
    },
    risks,
    missingData,
    recommendedNextAction:
      portfolio.campaigns.length === 0
        ? "Add a manual campaign to begin attribution tracking."
        : "Review campaign metrics and improve missing attribution before connecting paid platforms.",
    summary:
      portfolio.campaigns.length === 0
        ? "Campaign tracking is ready for manual/internal attribution."
        : `${portfolio.campaigns.length} campaigns tracked across ${leadSources.length} lead sources.`,
    generatedAt: new Date().toISOString(),
  };
}
