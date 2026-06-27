import {
  getDealAliasPositiveNumber,
  getDealAliasText,
} from "../../utils/dealFields";
import { clampScore } from "../../utils/numbers";
import { normalizeText, uniqueStrings } from "../../utils/text";
import { matchBuyersToDeal } from "./buyerMatchService";

function getBuyerDemandLevel(matchScore, buyerCount) {
  if (buyerCount >= 3 && matchScore >= 70) return "High";
  if (buyerCount >= 1 && matchScore >= 45) return "Medium";

  return "Low";
}

function getWholesalePotential({ deal, matchScore }) {
  const arv = getDealAliasPositiveNumber(deal, "arv");
  const repairs = getDealAliasPositiveNumber(deal, "repairs") || 0;
  const askingPrice = getDealAliasPositiveNumber(deal, "askingPrice");
  const spread = arv && askingPrice ? arv * 0.7 - repairs - askingPrice : null;

  if (spread && spread > 25000 && matchScore >= 50) return "High";
  if (spread && spread > 10000) return "Medium";

  return "Low";
}

function getRecommendedDispositionStrategy({ buyerDemandLevel, wholesalePotential, exitStrategy }) {
  const normalizedExit = normalizeText(exitStrategy);

  if (buyerDemandLevel === "High" && wholesalePotential !== "Low") {
    return "Prepare internal buyer shortlist";
  }

  if (normalizedExit.includes("hold") || normalizedExit.includes("subject")) {
    return "Target landlord and terms-friendly buyers";
  }

  if (buyerDemandLevel === "Low") {
    return "Expand buyer discovery before marketing";
  }

  return "Review matched buyers manually";
}

function getMarketingAngle({ deal, wholesalePotential, buyerDemandLevel }) {
  const condition = getDealAliasText(deal, "condition");
  const rent = getDealAliasPositiveNumber(deal, "rent");

  if (rent && buyerDemandLevel !== "Low") {
    return "Position around rental upside and buyer demand.";
  }

  if (wholesalePotential === "High") {
    return "Lead with spread, ARV, and speed-to-close opportunity.";
  }

  if (condition) {
    return `Lead with condition profile and clear next-step diligence.`;
  }

  return "Lead with location, pricing, and remaining diligence items.";
}

export function analyzeDisposition({ deal, buyers = [], exitStrategy = "" } = {}) {
  const buyerMatch = matchBuyersToDeal({ buyers, deal, exitStrategy });
  const buyerDemandLevel = getBuyerDemandLevel(
    buyerMatch.matchScore,
    buyerMatch.matchedBuyers.length
  );
  const wholesalePotential = getWholesalePotential({
    deal,
    matchScore: buyerMatch.matchScore,
  });
  const assignmentRisk =
    buyerDemandLevel === "Low" || wholesalePotential === "Low"
      ? "High"
      : buyerDemandLevel === "Medium"
        ? "Medium"
        : "Low";
  const risks = [];
  const missingData = [];

  if (buyerMatch.matchedBuyers.length === 0) {
    missingData.push("Buyer list");
    risks.push("No buyer data is available for matching.");
  }

  if (!getDealAliasPositiveNumber(deal, "arv")) {
    missingData.push("ARV");
  }

  if (!getDealAliasPositiveNumber(deal, "askingPrice")) {
    missingData.push("Asking price");
  }

  if (assignmentRisk === "High") {
    risks.push("Assignment risk is elevated until buyer demand and pricing are validated.");
  }

  const recommendedDispositionStrategy = getRecommendedDispositionStrategy({
    buyerDemandLevel,
    wholesalePotential,
    exitStrategy,
  });

  return {
    ...buyerMatch,
    recommendedDispositionStrategy,
    buyerDemandLevel,
    wholesalePotential,
    assignmentRisk,
    suggestedMarketingAngle: getMarketingAngle({
      deal,
      wholesalePotential,
      buyerDemandLevel,
    }),
    recommendedNextDispositionAction:
      buyerMatch.matchedBuyers.length > 0
        ? "Review top matched buyers before any outreach."
        : "Add qualified buyers manually before planning outreach.",
    risks: uniqueStrings(risks),
    missingData: uniqueStrings(missingData),
    summary:
      buyerMatch.matchedBuyers.length > 0
        ? `${buyerMatch.matchedBuyers.length} buyer(s) are available for internal matching. Buyer demand is ${buyerDemandLevel.toLowerCase()}.`
        : "No buyers have been added yet. Add manual buyer records to evaluate disposition fit.",
    generatedAt: new Date().toISOString(),
    dispositionScore: clampScore(
      buyerMatch.matchScore +
        (wholesalePotential === "High" ? 10 : wholesalePotential === "Medium" ? 5 : 0)
    ),
  };
}
