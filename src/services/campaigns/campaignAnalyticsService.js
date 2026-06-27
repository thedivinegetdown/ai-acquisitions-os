import { parseSafeNumber } from "../../utils/numbers";

function safeRate(numerator, denominator) {
  const top = parseSafeNumber(numerator) || 0;
  const bottom = parseSafeNumber(denominator) || 0;

  if (bottom <= 0) return 0;
  return Math.round((top / bottom) * 1000) / 10;
}

function safeCurrencyRatio(numerator, denominator) {
  const top = parseSafeNumber(numerator) || 0;
  const bottom = parseSafeNumber(denominator) || 0;

  if (bottom <= 0) return null;
  return Math.round((top / bottom) * 100) / 100;
}

export function calculateCampaignMetrics(campaign = {}) {
  const budget = parseSafeNumber(campaign.budget) || 0;
  const leadsGenerated = parseSafeNumber(campaign.leadsGenerated) || 0;
  const qualifiedLeads = parseSafeNumber(campaign.qualifiedLeads) || 0;
  const offersMade = parseSafeNumber(campaign.offersMade) || 0;
  const contractsSigned = parseSafeNumber(campaign.contractsSigned) || 0;
  const dealsClosed = parseSafeNumber(campaign.dealsClosed) || 0;
  const estimatedRevenue = parseSafeNumber(campaign.estimatedRevenue) || 0;
  const estimatedProfit = estimatedRevenue - budget;

  return {
    costPerLead: safeCurrencyRatio(budget, leadsGenerated),
    costPerQualifiedLead: safeCurrencyRatio(budget, qualifiedLeads),
    offerRate: safeRate(offersMade, qualifiedLeads || leadsGenerated),
    contractRate: safeRate(contractsSigned, offersMade || leadsGenerated),
    closeRate: safeRate(dealsClosed, contractsSigned || leadsGenerated),
    estimatedRoi: budget > 0 ? Math.round((estimatedProfit / budget) * 1000) / 10 : null,
    estimatedProfit,
  };
}

export function calculateCampaignPortfolioMetrics(campaigns = []) {
  const enriched = campaigns.map((campaign) => ({
    ...campaign,
    metrics: calculateCampaignMetrics(campaign),
  }));
  const campaignsWithRevenue = enriched.filter(
    (campaign) => (parseSafeNumber(campaign.estimatedRevenue) || 0) > 0
  );
  const bestPerformingSource = [...campaignsWithRevenue].sort(
    (left, right) =>
      (right.metrics.estimatedRoi ?? -Infinity) -
      (left.metrics.estimatedRoi ?? -Infinity)
  )[0];
  const underperformingSource = [...enriched]
    .filter((campaign) => (parseSafeNumber(campaign.leadsGenerated) || 0) > 0)
    .sort(
      (left, right) =>
        (left.metrics.estimatedRoi ?? -Infinity) -
        (right.metrics.estimatedRoi ?? -Infinity)
    )[0];

  return {
    campaigns: enriched,
    bestPerformingSource: bestPerformingSource?.leadSource || "Insufficient data",
    underperformingSource: underperformingSource?.leadSource || "Insufficient data",
  };
}
