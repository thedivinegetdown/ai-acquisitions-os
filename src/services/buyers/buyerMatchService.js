import {
  getDealAliasPositiveNumber,
  getDealAliasText,
} from "../../utils/dealFields";
import { clampScore, parseSafeNumber } from "../../utils/numbers";
import { normalizeText, safeTrim, uniqueStrings } from "../../utils/text";

export const BUYER_TYPES = [
  "Cash buyer",
  "Landlord",
  "Flipper",
  "Hedge fund",
  "Agent",
  "Other",
];

function splitList(value) {
  return safeTrim(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractZip(address) {
  return safeTrim(address).match(/\b\d{5}(?:-\d{4})?\b/)?.[0] || "";
}

function extractCity(address) {
  const parts = safeTrim(address)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length >= 2 ? parts[1] : "";
}

function getDealMarketTerms(deal) {
  const address = getDealAliasText(deal, "address");
  const city = getDealAliasText(deal, "city") || extractCity(address);
  const zip = getDealAliasText(deal, "zip") || extractZip(address);

  return [address, city, zip].map(normalizeText).filter(Boolean);
}

function getBuyerExitFit(buyerType, exitStrategy) {
  const type = normalizeText(buyerType);
  const strategy = normalizeText(exitStrategy);

  if (!strategy) return null;
  if (type.includes("landlord") && strategy.includes("hold")) return true;
  if (type.includes("flipper") && strategy.includes("flip")) return true;
  if (type.includes("cash") && strategy.includes("wholesale")) return true;
  if (type.includes("hedge") && strategy.includes("hold")) return true;
  if (type.includes("agent")) return true;

  return false;
}

export function normalizeBuyerRecord(buyer = {}) {
  return {
    id:
      buyer.id ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : buyer.name || "buyer"),
    name: safeTrim(buyer.name || buyer.buyerName),
    buyerType: safeTrim(buyer.buyerType || buyer.type || "Cash buyer"),
    targetMarkets: safeTrim(buyer.targetMarkets || buyer.target_areas),
    maxPurchasePrice: parseSafeNumber(
      buyer.maxPurchasePrice ?? buyer.max_price
    ),
    preferredPropertyType: safeTrim(buyer.preferredPropertyType),
    preferredCondition: safeTrim(buyer.preferredCondition),
    minBeds: parseSafeNumber(buyer.minBeds),
    minBaths: parseSafeNumber(buyer.minBaths),
    buyBoxNotes: safeTrim(buyer.buyBoxNotes),
    fundingProofStatus: safeTrim(buyer.fundingProofStatus || "Unknown"),
    lastContactDate: safeTrim(buyer.lastContactDate),
    notes: safeTrim(buyer.notes),
  };
}

export function matchBuyerToDeal({ buyer, deal, exitStrategy } = {}) {
  const normalizedBuyer = normalizeBuyerRecord(buyer);
  const marketTerms = getDealMarketTerms(deal);
  const buyerMarkets = splitList(normalizedBuyer.targetMarkets).map(normalizeText);
  const targetPrice =
    getDealAliasPositiveNumber(deal, "askingPrice") ||
    getDealAliasPositiveNumber(deal, "arv");
  const propertyType =
    safeTrim(deal?.property_type || deal?.propertyType || deal?.type) || "";
  const condition = getDealAliasText(deal, "condition");
  const beds = parseSafeNumber(deal?.beds || deal?.bedrooms);
  const baths = parseSafeNumber(deal?.baths || deal?.bathrooms);
  const matchReasons = [];
  const mismatchReasons = [];
  let score = 20;

  if (buyerMarkets.length === 0) {
    score += 8;
    matchReasons.push("Buyer has no market restriction.");
  } else if (
    buyerMarkets.some((market) =>
      marketTerms.some((term) => term.includes(market) || market.includes(term))
    )
  ) {
    score += 25;
    matchReasons.push("Target market appears to match the deal location.");
  } else {
    mismatchReasons.push("Target market does not clearly match the deal location.");
  }

  if (!normalizedBuyer.maxPurchasePrice || !targetPrice) {
    score += 8;
    matchReasons.push("Price fit needs confirmation.");
  } else if (normalizedBuyer.maxPurchasePrice >= targetPrice) {
    score += 25;
    matchReasons.push("Buyer max purchase price supports this deal.");
  } else {
    score -= 15;
    mismatchReasons.push("Buyer max purchase price may be below deal pricing.");
  }

  if (!normalizedBuyer.preferredPropertyType || !propertyType) {
    score += 5;
  } else if (
    normalizeText(propertyType).includes(
      normalizeText(normalizedBuyer.preferredPropertyType)
    )
  ) {
    score += 12;
    matchReasons.push("Property type matches buyer preference.");
  } else {
    mismatchReasons.push("Property type may not match buyer preference.");
  }

  if (!normalizedBuyer.preferredCondition || !condition) {
    score += 5;
  } else if (
    normalizeText(condition).includes(
      normalizeText(normalizedBuyer.preferredCondition)
    )
  ) {
    score += 10;
    matchReasons.push("Condition preference appears compatible.");
  } else {
    mismatchReasons.push("Condition preference may not match.");
  }

  if (normalizedBuyer.minBeds && beds && beds < normalizedBuyer.minBeds) {
    score -= 8;
    mismatchReasons.push("Bedroom count may be below buyer minimum.");
  }

  if (normalizedBuyer.minBaths && baths && baths < normalizedBuyer.minBaths) {
    score -= 8;
    mismatchReasons.push("Bathroom count may be below buyer minimum.");
  }

  const exitFit = getBuyerExitFit(normalizedBuyer.buyerType, exitStrategy);

  if (exitFit === true) {
    score += 12;
    matchReasons.push("Buyer type aligns with the current exit strategy.");
  } else if (exitFit === false) {
    mismatchReasons.push("Buyer type does not clearly align with the exit strategy.");
  }

  if (normalizeText(normalizedBuyer.fundingProofStatus).includes("verified")) {
    score += 8;
    matchReasons.push("Funding proof is verified.");
  }

  return {
    buyer: normalizedBuyer,
    matchScore: clampScore(score),
    matchReasons: matchReasons.length
      ? matchReasons
      : ["Buyer may be worth reviewing manually."],
    mismatchReasons: uniqueStrings(mismatchReasons),
  };
}

export function matchBuyersToDeal({ buyers = [], deal, exitStrategy } = {}) {
  const matchedBuyers = buyers
    .map((buyer) => matchBuyerToDeal({ buyer, deal, exitStrategy }))
    .sort((left, right) => right.matchScore - left.matchScore);

  const averageScore = matchedBuyers.length
    ? matchedBuyers.reduce((sum, match) => sum + match.matchScore, 0) /
      matchedBuyers.length
    : 0;

  return {
    matchedBuyers,
    matchScore: clampScore(averageScore),
  };
}
