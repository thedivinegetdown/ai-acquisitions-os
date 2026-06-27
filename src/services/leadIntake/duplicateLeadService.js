import { getDealAliasText } from "../../utils/dealFields";
import { normalizePhone, phonesMatch } from "../../utils/phone";
import { normalizeText } from "../../utils/text";
import { normalizeEmail, normalizePropertyAddress } from "./leadNormalizationService";

function addressKey(value = "") {
  return normalizeText(normalizePropertyAddress(value)).replace(/[^\w\s]/g, "");
}

function leadMatchesDeal(lead = {}, deal = {}) {
  const dealPhone = getDealAliasText(deal, "phone") || deal.phone;
  const dealAddress = getDealAliasText(deal, "address") || deal.property_address;
  const dealEmail = normalizeEmail(deal.email || deal.seller_email);

  return (
    (lead.phone && dealPhone && phonesMatch(lead.phone, dealPhone)) ||
    (lead.email && dealEmail && lead.email === dealEmail) ||
    (lead.propertyAddress &&
      dealAddress &&
      addressKey(lead.propertyAddress) === addressKey(dealAddress))
  );
}

function getLeadDuplicateKey(lead = {}) {
  return [
    lead.phone ? `phone:${normalizePhone(lead.phone)}` : "",
    lead.email ? `email:${lead.email}` : "",
    lead.propertyAddress ? `address:${addressKey(lead.propertyAddress)}` : "",
  ]
    .filter(Boolean)
    .join("|");
}

export function detectDuplicateLeads({ leads = [], existingDeals = [] } = {}) {
  const batchSeen = new Map();

  return leads.map((lead) => {
    const duplicateMatches = existingDeals.filter((deal) =>
      leadMatchesDeal(lead, deal)
    );
    const batchKey = getLeadDuplicateKey(lead);
    const batchDuplicate = batchKey && batchSeen.has(batchKey);

    if (batchKey && !batchSeen.has(batchKey)) {
      batchSeen.set(batchKey, lead.rowNumber || lead.sellerName || batchKey);
    }

    const duplicateReasons = [];
    if (duplicateMatches.length > 0) {
      duplicateReasons.push("possible duplicate with existing deal");
    }
    if (batchDuplicate) {
      duplicateReasons.push("possible duplicate within import preview");
    }

    return {
      ...lead,
      duplicate: duplicateReasons.length > 0,
      duplicateReasons,
      duplicateMatches,
    };
  });
}
