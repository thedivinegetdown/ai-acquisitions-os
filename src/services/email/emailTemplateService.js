import { getDealAliasText } from "../../utils/dealFields";
import { safeTrim } from "../../utils/text";
import { normalizeEmailDraft } from "./emailParserService";

export const EMAIL_TEMPLATES = [
  {
    id: "seller-follow-up",
    name: "Seller follow-up",
    category: "follow-up",
    subject: "Following up about your property",
    body:
      "Hi {{sellerName}}, I wanted to follow up about {{propertyAddress}} and see if selling is still something you are considering.",
  },
  {
    id: "offer-follow-up",
    name: "Offer follow-up",
    category: "offer",
    subject: "Quick follow-up on the offer",
    body:
      "Hi {{sellerName}}, I wanted to check in on the offer conversation for {{propertyAddress}} and answer any questions you may have.",
  },
  {
    id: "nurture",
    name: "Warm seller nurture",
    category: "nurture",
    subject: "Checking in",
    body:
      "Hi {{sellerName}}, just checking in to see how things are going and whether your timeline has changed.",
  },
];

function applyTemplateVariables(templateText = "", deal = {}) {
  const sellerName =
    getDealAliasText(deal, "ownerName") ||
    safeTrim(deal.seller_name) ||
    "there";
  const propertyAddress =
    getDealAliasText(deal, "address") ||
    safeTrim(deal.property_address) ||
    "the property";

  return safeTrim(templateText)
    .replaceAll("{{sellerName}}", sellerName)
    .replaceAll("{{propertyAddress}}", propertyAddress);
}

export function getEmailTemplate(templateId = "seller-follow-up") {
  return (
    EMAIL_TEMPLATES.find((template) => template.id === templateId) ||
    EMAIL_TEMPLATES[0]
  );
}

export function buildEmailDraftFromTemplate({
  templateId = "seller-follow-up",
  deal = {},
  to = "",
  source = "template",
} = {}) {
  const template = getEmailTemplate(templateId);

  return normalizeEmailDraft({
    to,
    subject: applyTemplateVariables(template.subject, deal),
    body: applyTemplateVariables(template.body, deal),
    templateId: template.id,
    relatedDealId: deal?.id || deal?.deal_id || null,
    source,
  });
}

export function buildAiEmailDraftFallback({ deal = {}, to = "" } = {}) {
  return buildEmailDraftFromTemplate({
    templateId: "seller-follow-up",
    deal,
    to,
    source: "ai",
  });
}
