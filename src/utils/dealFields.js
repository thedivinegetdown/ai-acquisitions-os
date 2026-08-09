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
  mortgageStatus: ["mortgage_status", "loan_status"],
  timeline: ["seller_timeline", "timeline", "timeline_to_sell"],
  occupancy: ["occupancy_status", "occupancy"],
  condition: ["property_condition", "condition"],
  rent: ["rent", "rent_estimate", "monthly_rent"],
  bedrooms: ["bedrooms", "beds"],
  bathrooms: ["bathrooms", "baths"],
  squareFootage: ["square_footage", "sqft", "living_area"],
  comparableSales: ["comps", "comparable_sales", "comparable_sale_evidence"],
  buyerMatches: ["buyer_matches", "matched_buyers"],
  parcelIdentity: ["parcel_id", "parcel_number", "apn", "parcel"],
  parcelNumber: ["parcel_number", "apn", "parcel_id"],
  acreage: ["acreage", "acres", "parcel_acres", "lot_acres"],
  landSquareFootage: [
    "land_square_feet",
    "parcel_square_feet",
    "lot_square_feet",
    "lot_size_sqft",
  ],
  legalAccess: ["legal_access", "access_status", "road_access"],
  roadFrontage: ["road_frontage", "frontage", "road_frontage_feet"],
  zoning: ["zoning", "zoning_code", "zoning_classification"],
  permittedUse: ["permitted_use", "permitted_uses", "allowed_use"],
  utilities: ["utilities", "utility_access", "utilities_available"],
  waterSewerSeptic: [
    "water_access",
    "sewer_access",
    "septic_feasibility",
    "perc_test",
    "water_sewer_septic",
  ],
  floodStatus: ["flood_zone", "flood_status", "flood_zone_status"],
  wetlandsStatus: ["wetlands", "wetlands_status", "wetland_status"],
  topography: ["topography", "slope", "terrain"],
  deedRestrictions: ["deed_restrictions", "restrictions", "covenants"],
  subdivisionPotential: [
    "subdivision_potential",
    "subdividable",
    "subdivision_status",
  ],
  taxesAndLiens: [
    "taxes_and_liens",
    "tax_status",
    "liens",
    "delinquent_taxes",
  ],
  landComps: ["land_comps", "comparable_land_sales", "land_sales_evidence"],
  comparableLandValue: [
    "comparable_land_value",
    "indicated_land_value",
    "land_value",
  ],
  builderDemand: ["builder_demand", "land_builder_demand"],
  landBuyerDemand: ["land_buyer_demand", "buyer_demand"],
  county: ["county", "property_county"],
  state: ["state", "property_state"],
  zip: ["zip", "zip_code", "postal_code"],
  legalDescription: ["legal_description", "parcel_legal_description"],
  latitude: ["latitude", "lat"],
  longitude: ["longitude", "lng", "lon"],
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
