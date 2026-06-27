import {
  getDealAliasPositiveNumber,
  getDealAliasText,
} from "../../utils/dealFields";
import { normalizeText, uniqueStrings } from "../../utils/text";

function getLeverageLevel(score) {
  if (score >= 4) return "High";
  if (score >= 2) return "Medium";

  return "Low";
}

function hasUrgentTimeline(timeline) {
  const normalizedTimeline = normalizeText(timeline);

  return (
    normalizedTimeline.includes("asap") ||
    normalizedTimeline.includes("soon") ||
    normalizedTimeline.includes("week") ||
    normalizedTimeline.includes("30")
  );
}

export function analyzeOfferStrategy({ deal, messages = [] } = {}) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const motivation = getDealAliasPositiveNumber(deal, "motivation");
  const timeline = getDealAliasText(deal, "timeline");
  const askingPrice = getDealAliasPositiveNumber(deal, "askingPrice");
  const arv = getDealAliasPositiveNumber(deal, "arv");
  const repairs = getDealAliasPositiveNumber(deal, "repairs");
  const mortgageBalance = getDealAliasPositiveNumber(deal, "mortgageBalance");
  const occupancy = getDealAliasText(deal, "occupancy");
  const condition = getDealAliasText(deal, "condition");
  const maxOffer = arv ? arv * 0.7 - (repairs ?? 0) : null;
  const inboundCount = safeMessages.filter(
    (message) => message.direction !== "outbound"
  ).length;
  const outboundCount = safeMessages.filter(
    (message) => message.direction === "outbound"
  ).length;
  let buyerScore = 0;
  let sellerScore = 0;
  const factors = [];
  const missing = [];

  if (motivation && motivation >= 7) {
    buyerScore += 2;
    factors.push("High seller motivation increases buyer leverage.");
  } else if (!motivation) {
    missing.push("Motivation level");
  }

  if (timeline) {
    if (hasUrgentTimeline(timeline)) {
      buyerScore += 2;
      factors.push("Short seller timeline increases urgency.");
    }
  } else {
    missing.push("Seller timeline");
    sellerScore += 1;
  }

  if (askingPrice && maxOffer && askingPrice > maxOffer * 1.1) {
    sellerScore += 2;
    factors.push(
      "Seller expectations may be high compared to the current acquisition range."
    );
  }

  if (!condition || !repairs) {
    missing.push("Condition / repair detail");
    sellerScore += 1;
  }

  if (occupancy) {
    const normalizedOccupancy = normalizeText(occupancy);

    if (normalizedOccupancy.includes("vacant")) {
      buyerScore += 1;
      factors.push("Vacant property can increase buyer leverage.");
    } else if (normalizedOccupancy.includes("occupied") && !timeline) {
      sellerScore += 1;
      factors.push(
        "Occupied property with unclear timeline increases seller leverage."
      );
    }
  } else {
    missing.push("Occupancy status");
  }

  if (repairs && arv && repairs / arv >= 0.12 && motivation && motivation >= 6) {
    buyerScore += 1;
    factors.push(
      "High repairs with motivated seller can support a more conservative offer."
    );
  }

  if (mortgageBalance && maxOffer && mortgageBalance > maxOffer) {
    sellerScore += 1;
    factors.push("Mortgage balance may limit seller flexibility.");
  } else if (!mortgageBalance) {
    missing.push("Mortgage balance");
  }

  if (inboundCount > 0) {
    factors.push("Seller has engaged in the conversation.");
  }

  if (outboundCount > inboundCount + 2) {
    sellerScore += 1;
    factors.push("Seller has not replied consistently to outreach.");
  }

  if (!arv) missing.push("ARV / comps");
  if (!askingPrice) missing.push("Asking price");

  const buyerLeverage = getLeverageLevel(buyerScore);
  const sellerLeverage = getLeverageLevel(sellerScore);
  const uniqueMissing = uniqueStrings(missing);
  let posture = "Soft discovery";
  let summary =
    "Seller appears motivated but key repair details are missing. Continue discovery before making a firm offer.";

  if (buyerLeverage === "High" && uniqueMissing.length <= 2) {
    posture = "Prepare offer";
    summary = "Deal has enough data to prepare a respectful first offer.";
  } else if (sellerLeverage === "High") {
    posture = "Relationship-first";
    summary =
      "Seller expectations may be high compared to the current acquisition range.";
  } else if (buyerLeverage === "Medium" && sellerLeverage === "Low") {
    posture = "Firm but respectful";
    summary =
      "Buyer leverage is improving, but keep the conversation collaborative.";
  } else if (buyerLeverage === "Medium" || sellerLeverage === "Medium") {
    posture = "Balanced";
    summary = "Use a balanced posture while filling remaining information gaps.";
  }

  return {
    sellerLeverage,
    buyerLeverage,
    posture,
    factors: factors.length ? factors : ["Not enough leverage signals yet."],
    missing: uniqueMissing,
    summary,
  };
}
