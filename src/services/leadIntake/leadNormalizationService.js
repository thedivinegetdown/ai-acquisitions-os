import { parseSafeNumber } from "../../utils/numbers";
import { normalizePhone } from "../../utils/phone";
import { compactText, safeTrim } from "../../utils/text";

const FIELD_ALIASES = {
  sellerName: ["seller name", "seller_name", "owner name", "owner_name", "name"],
  phone: ["phone", "seller phone", "seller_phone", "mobile", "cell"],
  email: ["email", "seller email", "seller_email"],
  propertyAddress: [
    "property address",
    "property_address",
    "address",
    "street address",
    "street_address",
  ],
  city: ["city"],
  state: ["state"],
  zip: ["zip", "zipcode", "postal code", "postal_code"],
  leadSource: ["lead source", "lead_source", "source"],
  market: ["market", "target market"],
  askingPrice: ["asking price", "asking_price", "price"],
  notes: ["notes", "note", "comments"],
};

function normalizeKey(key = "") {
  return safeTrim(key)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[_-]+/g, " ");
}

function getAliasedValue(row = {}, aliases = []) {
  const entries = Object.entries(row).reduce((map, [key, value]) => {
    map[normalizeKey(key)] = value;
    return map;
  }, {});

  for (const alias of aliases) {
    const value = entries[normalizeKey(alias)];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

export function normalizeSellerName(value = "") {
  return compactText(value)
    .split(" ")
    .map((part) =>
      part ? `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}` : ""
    )
    .join(" ")
    .trim();
}

export function normalizePropertyAddress(value = "") {
  return compactText(value)
    .replace(/\s+,/g, ",")
    .replace(/,\s+/g, ", ");
}

export function normalizeEmail(value = "") {
  return safeTrim(value).toLowerCase();
}

export function normalizeLead(row = {}, { fallbackSource = "", fallbackMarket = "" } = {}) {
  const sellerName = normalizeSellerName(
    getAliasedValue(row, FIELD_ALIASES.sellerName)
  );
  const phoneRaw = safeTrim(getAliasedValue(row, FIELD_ALIASES.phone));
  const email = normalizeEmail(getAliasedValue(row, FIELD_ALIASES.email));
  const propertyAddress = normalizePropertyAddress(
    getAliasedValue(row, FIELD_ALIASES.propertyAddress)
  );
  const city = compactText(getAliasedValue(row, FIELD_ALIASES.city));
  const state = safeTrim(getAliasedValue(row, FIELD_ALIASES.state)).toUpperCase();
  const zip = safeTrim(getAliasedValue(row, FIELD_ALIASES.zip));
  const leadSource =
    compactText(getAliasedValue(row, FIELD_ALIASES.leadSource)) ||
    fallbackSource;
  const market = compactText(getAliasedValue(row, FIELD_ALIASES.market)) || fallbackMarket;
  const askingPrice = parseSafeNumber(getAliasedValue(row, FIELD_ALIASES.askingPrice));
  const notes = compactText(getAliasedValue(row, FIELD_ALIASES.notes));

  return {
    sellerName,
    phone: normalizePhone(phoneRaw),
    phoneRaw,
    email,
    propertyAddress,
    city,
    state,
    zip,
    leadSource,
    market,
    askingPrice,
    notes,
    stage: "New Lead",
    normalizedAt: new Date().toISOString(),
    raw: row,
  };
}

export function toDealPreviewPayload(lead = {}) {
  return {
    owner_name: lead.sellerName || null,
    phone: lead.phone || null,
    email: lead.email || null,
    property_address: lead.propertyAddress || null,
    city: lead.city || null,
    state: lead.state || null,
    zip: lead.zip || null,
    source: lead.leadSource || null,
    market: lead.market || null,
    asking_price: lead.askingPrice,
    notes: lead.notes || null,
    stage: lead.stage || "New Lead",
  };
}
