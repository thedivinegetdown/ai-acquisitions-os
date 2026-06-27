import { getDealAliasPositiveNumber, getDealAliasText } from "../../utils/dealFields";
import { formatSafeDate } from "../../utils/dates";
import { normalizePhone } from "../../utils/phone";
import { compactText, normalizeText, safeTrim } from "../../utils/text";

export const SEARCH_ENTITY_TYPES = [
  "seller",
  "deal",
  "phone",
  "property",
  "conversation",
  "task",
  "buyer",
  "transaction",
  "document",
  "campaign",
  "ai",
  "workflow",
];

function getDealId(deal = {}, fallback = "") {
  return deal.id || deal.deal_id || deal.lead_id || fallback;
}

function buildSearchText(values = []) {
  return normalizeText(values.filter(Boolean).join(" "));
}

function buildResult({
  id,
  type,
  title,
  subtitle = "",
  description = "",
  status = "",
  priority = "",
  stage = "",
  market = "",
  leadSource = "",
  date = "",
  deal = null,
  action = "view",
} = {}) {
  return {
    id,
    type,
    title: compactText(title),
    subtitle: compactText(subtitle),
    description: compactText(description),
    status: safeTrim(status),
    priority: safeTrim(priority),
    stage: safeTrim(stage),
    market: safeTrim(market),
    leadSource: safeTrim(leadSource),
    date: safeTrim(date),
    formattedDate: date ? formatSafeDate(date, "") : "",
    dealId: deal ? getDealId(deal) : null,
    deal,
    action,
    searchText: buildSearchText([
      title,
      subtitle,
      description,
      status,
      priority,
      stage,
      market,
      leadSource,
      date,
      deal?.phone,
      deal?.property_address,
      deal?.owner_name,
      deal?.notes,
    ]),
  };
}

function getPriority(deal = {}) {
  const score = getDealAliasPositiveNumber(deal, "leadScore") || 0;
  if (score >= 80 || score >= 8) return "High";
  if (score >= 50 || score >= 5) return "Medium";
  return "Normal";
}

export function buildSearchIndex({ deals = [], campaigns = [] } = {}) {
  const safeDeals = Array.isArray(deals) ? deals : [];
  const dealResults = safeDeals.flatMap((deal, index) => {
    const dealId = getDealId(deal, index);
    const sellerName = getDealAliasText(deal, "ownerName") || "Unknown seller";
    const address = getDealAliasText(deal, "address") || "Unknown property";
    const phone = getDealAliasText(deal, "phone");
    const stage = getDealAliasText(deal, "stage") || "Unknown";
    const market = safeTrim(deal.market || deal.city || "");
    const leadSource = getDealAliasText(deal, "source") || "Unknown";
    const priority = getPriority(deal);
    const updatedAt = deal.updated_at || deal.created_at || "";

    return [
      buildResult({
        id: `seller-${dealId}`,
        type: "seller",
        title: sellerName,
        subtitle: address,
        description: `Seller record in ${stage}.`,
        status: stage,
        priority,
        stage,
        market,
        leadSource,
        date: updatedAt,
        deal,
        action: "open-seller-workspace",
      }),
      buildResult({
        id: `deal-${dealId}`,
        type: "deal",
        title: address,
        subtitle: sellerName,
        description: `Deal stage: ${stage}.`,
        status: stage,
        priority,
        stage,
        market,
        leadSource,
        date: updatedAt,
        deal,
        action: "open-deal",
      }),
      buildResult({
        id: `phone-${dealId}`,
        type: "phone",
        title: phone || "Missing phone",
        subtitle: sellerName,
        description: phone
          ? `Normalized phone: ${normalizePhone(phone)}`
          : "No phone number on this deal.",
        status: phone ? "Available" : "Missing",
        priority,
        stage,
        market,
        leadSource,
        date: updatedAt,
        deal,
        action: "open-conversation",
      }),
      buildResult({
        id: `property-${dealId}`,
        type: "property",
        title: address,
        subtitle: market || sellerName,
        description: "Property address and deal context.",
        status: stage,
        priority,
        stage,
        market,
        leadSource,
        date: updatedAt,
        deal,
        action: "open-deal",
      }),
      buildResult({
        id: `conversation-${dealId}`,
        type: "conversation",
        title: `Conversation with ${sellerName}`,
        subtitle: phone || "No phone linked",
        description: "Open conversation timeline and communication history.",
        status: phone ? "Ready" : "Missing phone",
        priority,
        stage,
        market,
        leadSource,
        date: updatedAt,
        deal,
        action: "open-conversation",
      }),
      buildResult({
        id: `task-${dealId}`,
        type: "task",
        title: deal.next_action || "Review next best action",
        subtitle: sellerName,
        description: "Task and next action context.",
        status: deal.next_action ? "Planned" : "Needs review",
        priority,
        stage,
        market,
        leadSource,
        date: deal.due_date || updatedAt,
        deal,
        action: "view-next-best-action",
      }),
      buildResult({
        id: `transaction-${dealId}`,
        type: "transaction",
        title: `Transaction checklist: ${address}`,
        subtitle: stage,
        description: "View transaction and closing readiness.",
        status: stage === "Under Contract" ? "Active" : "Foundation",
        priority,
        stage,
        market,
        leadSource,
        date: updatedAt,
        deal,
        action: "view-transaction-checklist",
      }),
      buildResult({
        id: `document-${dealId}`,
        type: "document",
        title: `Documents: ${address}`,
        subtitle: sellerName,
        description: "View document and contract prep foundation.",
        status: "Foundation",
        priority,
        stage,
        market,
        leadSource,
        date: updatedAt,
        deal,
        action: "view-documents",
      }),
      buildResult({
        id: `buyer-${dealId}`,
        type: "buyer",
        title: `Buyer matches: ${address}`,
        subtitle: market || "Market unknown",
        description: "View buyer matching and dispositions foundation.",
        status: "Foundation",
        priority,
        stage,
        market,
        leadSource,
        date: updatedAt,
        deal,
        action: "view-buyer-matches",
      }),
      buildResult({
        id: `ai-${dealId}`,
        type: "ai",
        title: `AI recommendation: ${sellerName}`,
        subtitle: deal.next_action || "Review acquisition intelligence",
        description: "View AI recommendation and next best action.",
        status: "Available",
        priority,
        stage,
        market,
        leadSource,
        date: updatedAt,
        deal,
        action: "view-ai-recommendation",
      }),
      buildResult({
        id: `workflow-${dealId}`,
        type: "workflow",
        title: `Workflow items: ${sellerName}`,
        subtitle: stage,
        description: "View workflow recommendations and approvals.",
        status: "Foundation",
        priority,
        stage,
        market,
        leadSource,
        date: updatedAt,
        deal,
        action: "view-workflow-items",
      }),
    ];
  });

  const campaignResults = campaigns.map((campaign) =>
    buildResult({
      id: `campaign-${campaign.id || campaign.campaignName}`,
      type: "campaign",
      title: campaign.campaignName || "Campaign",
      subtitle: campaign.leadSource || campaign.channel || "Lead source",
      description: "View campaign performance and attribution.",
      status: "Manual tracking",
      market: campaign.market || "",
      leadSource: campaign.leadSource || "",
      date: campaign.startDate || "",
      action: "view-campaign-performance",
    })
  );

  return [...dealResults, ...campaignResults];
}
