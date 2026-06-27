import { parseSafeNumber } from "../../utils/numbers";
import { safeTrim } from "../../utils/text";
import { CAMPAIGN_CHANNELS, normalizeLeadSource } from "./leadSourceService";

export function buildDefaultCampaign() {
  return {
    id: `campaign-${Date.now()}`,
    campaignName: "",
    leadSource: "Direct mail",
    market: "",
    channel: CAMPAIGN_CHANNELS[0],
    startDate: "",
    endDate: "",
    budget: "",
    leadsGenerated: "",
    qualifiedLeads: "",
    offersMade: "",
    contractsSigned: "",
    dealsClosed: "",
    estimatedRevenue: "",
    notes: "",
  };
}

export function normalizeCampaign(campaign = {}) {
  return {
    id: campaign.id || `campaign-${Date.now()}`,
    campaignName: safeTrim(campaign.campaignName) || "Untitled campaign",
    leadSource: normalizeLeadSource(campaign.leadSource),
    market: safeTrim(campaign.market),
    channel: CAMPAIGN_CHANNELS.includes(campaign.channel)
      ? campaign.channel
      : "Other",
    startDate: safeTrim(campaign.startDate),
    endDate: safeTrim(campaign.endDate),
    budget: parseSafeNumber(campaign.budget) || 0,
    leadsGenerated: parseSafeNumber(campaign.leadsGenerated) || 0,
    qualifiedLeads: parseSafeNumber(campaign.qualifiedLeads) || 0,
    offersMade: parseSafeNumber(campaign.offersMade) || 0,
    contractsSigned: parseSafeNumber(campaign.contractsSigned) || 0,
    dealsClosed: parseSafeNumber(campaign.dealsClosed) || 0,
    estimatedRevenue: parseSafeNumber(campaign.estimatedRevenue) || 0,
    notes: safeTrim(campaign.notes),
  };
}

export function getCampaignMissingData(campaign = {}) {
  return [
    !safeTrim(campaign.campaignName) ? "Campaign name" : null,
    !safeTrim(campaign.leadSource) ? "Lead source" : null,
    !safeTrim(campaign.market) ? "Market" : null,
    !safeTrim(campaign.channel) ? "Channel" : null,
    !safeTrim(campaign.startDate) ? "Start date" : null,
    parseSafeNumber(campaign.budget) === null ? "Budget" : null,
  ].filter(Boolean);
}

export function buildSeedCampaignsFromDeals(deals = []) {
  const grouped = deals.reduce((groups, deal) => {
    const source = normalizeLeadSource(deal.source);
    if (!groups[source]) {
      groups[source] = {
        ...buildDefaultCampaign(),
        campaignName: `${source} baseline`,
        leadSource: source,
        channel: CAMPAIGN_CHANNELS.includes(source) ? source : "Other",
        market: deal.market || "All markets",
        leadsGenerated: 0,
        qualifiedLeads: 0,
        offersMade: 0,
        contractsSigned: 0,
        dealsClosed: 0,
      };
    }

    groups[source].leadsGenerated += 1;
    if (deal.stage && deal.stage !== "New Lead") groups[source].qualifiedLeads += 1;
    if (deal.stage === "Offer Sent") groups[source].offersMade += 1;
    if (deal.stage === "Under Contract") groups[source].contractsSigned += 1;
    if (deal.stage === "Closed") groups[source].dealsClosed += 1;

    return groups;
  }, {});

  return Object.values(grouped);
}
