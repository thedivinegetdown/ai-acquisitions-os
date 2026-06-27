import { parsePositiveNumber, parseSafeNumber } from "./numbers";
import { hasText, safeTrim } from "./text";

export const DEAL_FIELD_ALIASES = {
  id: ["id", "deal_id", "lead_id", "property_id"],
  address: ["property_address", "address", "street_address"],
  ownerName: ["owner_name", "seller_name", "owner"],
  phone: ["phone", "seller_phone", "owner_phone"],
  stage: ["stage", "pipeline_stage"],
  source: ["source", "lead_source"],
  leadScore: ["lead_score", "score"],
  motivation: ["motivation_score", "motivation"],
  askingPrice: ["price", "asking_price", "askingPrice"],
  arv: ["arv", "after_repair_value", "afterRepairValue"],
  repairs: [
    "repairs",
    "estimated_repairs",
    "repairs_needed",
    "repair_estimate",
  ],
  mortgageBalance: ["mortgage_balance", "mortgage", "loan_balance"],
  timeline: ["seller_timeline", "timeline", "timeline_to_sell"],
  occupancy: ["occupancy_status", "occupancy"],
  condition: ["property_condition", "condition"],
  rent: ["rent", "rent_estimate", "monthly_rent"],
};

export function getDealField(deal, keys, fallback = null) {
  for (const key of keys) {
    const value = deal?.[key];

    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  return fallback;
}

export function getDealText(deal, keys, fallback = "") {
  for (const key of keys) {
    const value = deal?.[key];

    if (hasText(value)) {
      return safeTrim(value);
    }
  }

  return fallback;
}

export function getDealNumber(deal, keys, fallback = null) {
  for (const key of keys) {
    const parsed = parseSafeNumber(deal?.[key]);

    if (parsed !== null) return parsed;
  }

  return fallback;
}

export function getDealPositiveNumber(deal, keys, fallback = null) {
  for (const key of keys) {
    const parsed = parsePositiveNumber(deal?.[key]);

    if (parsed !== null) return parsed;
  }

  return fallback;
}

export function getDealAlias(deal, alias, fallback = null) {
  return getDealField(deal, DEAL_FIELD_ALIASES[alias] || [alias], fallback);
}

export function getDealAliasText(deal, alias, fallback = "") {
  return getDealText(deal, DEAL_FIELD_ALIASES[alias] || [alias], fallback);
}

export function getDealAliasNumber(deal, alias, fallback = null) {
  return getDealNumber(deal, DEAL_FIELD_ALIASES[alias] || [alias], fallback);
}

export function getDealAliasPositiveNumber(deal, alias, fallback = null) {
  return getDealPositiveNumber(
    deal,
    DEAL_FIELD_ALIASES[alias] || [alias],
    fallback
  );
}
