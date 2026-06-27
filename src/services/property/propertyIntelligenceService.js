import {
  getDealAliasPositiveNumber,
} from "../../utils/dealFields";
import { clampScore } from "../../utils/numbers";
import { normalizeText, uniqueStrings } from "../../utils/text";
import {
  analyzeCompsConfidence,
  normalizePropertyInputs,
} from "./compsService";
import { analyzeExitStrategies } from "./exitStrategyService";

function getRepairRisk({ estimatedArv, estimatedRepairs, propertyCondition }) {
  const condition = normalizeText(propertyCondition);

  if (condition.includes("poor")) return "High";
  if (estimatedArv && estimatedRepairs && estimatedRepairs / estimatedArv > 0.2) {
    return "High";
  }
  if (condition.includes("fair") || estimatedRepairs) return "Medium";

  return "Low";
}

function getRentPotential({ estimatedRent, neighborhoodQuality }) {
  const neighborhood = normalizeText(neighborhoodQuality);

  if (estimatedRent && neighborhood.includes("strong")) return "High";
  if (estimatedRent) return "Medium";

  return "Low";
}

function getNeighborhoodStrength(neighborhoodQuality) {
  const neighborhood = normalizeText(neighborhoodQuality);

  if (neighborhood.includes("strong")) return "High";
  if (neighborhood.includes("average") || neighborhood.includes("emerging")) {
    return "Medium";
  }
  if (neighborhood.includes("weak")) return "Low";

  return "Unknown";
}

function scoreProperty({ inputs, arvConfidence, repairRisk, rentPotential, neighborhoodStrength }) {
  let score = 35;

  if (arvConfidence === "High") score += 20;
  else if (arvConfidence === "Medium") score += 10;

  if (repairRisk === "Low") score += 15;
  else if (repairRisk === "Medium") score += 5;
  else score -= 10;

  if (rentPotential === "High") score += 15;
  else if (rentPotential === "Medium") score += 8;

  if (neighborhoodStrength === "High") score += 15;
  else if (neighborhoodStrength === "Medium") score += 8;
  else if (neighborhoodStrength === "Low") score -= 8;

  if (normalizeText(inputs.occupancyStatus).includes("vacant")) score += 5;

  return clampScore(score);
}

export function analyzePropertyIntelligence({ deal, inputs } = {}) {
  const normalizedInputs = normalizePropertyInputs(inputs);
  const askingPrice = getDealAliasPositiveNumber(deal, "askingPrice");
  const mortgageBalance = getDealAliasPositiveNumber(deal, "mortgageBalance");
  const arvConfidence = analyzeCompsConfidence(normalizedInputs);
  const repairRisk = getRepairRisk(normalizedInputs);
  const rentPotential = getRentPotential(normalizedInputs);
  const neighborhoodStrength = getNeighborhoodStrength(
    normalizedInputs.neighborhoodQuality
  );
  const exitAnalysis = analyzeExitStrategies({
    ...normalizedInputs,
    askingPrice,
    mortgageBalance,
  });
  const risks = [];
  const opportunities = [];
  const missingData = [];

  if (!normalizedInputs.estimatedArv) {
    missingData.push("Estimated ARV");
    risks.push("ARV confidence is limited until comps or manual ARV are available.");
  }

  if (normalizedInputs.estimatedRepairs === null) {
    missingData.push("Estimated repairs");
  }

  if (!normalizedInputs.estimatedRent) {
    missingData.push("Estimated rent");
  }

  if (normalizedInputs.propertyCondition === "Unknown") {
    missingData.push("Property condition");
  }

  if (normalizedInputs.neighborhoodQuality === "Unknown") {
    missingData.push("Neighborhood quality");
  }

  if (repairRisk === "High") {
    risks.push("Repair exposure appears high and should be validated before offer planning.");
  }

  if (rentPotential !== "Low") {
    opportunities.push("Rental income may support a buy-and-hold or terms-based strategy.");
  }

  if (neighborhoodStrength === "High") {
    opportunities.push("Strong neighborhood quality may improve exit optionality.");
  }

  if (exitAnalysis.recommendedExitStrategy === "Subject-to") {
    opportunities.push("Existing mortgage data may support a subject-to review.");
  }

  const propertyScore = scoreProperty({
    inputs: normalizedInputs,
    arvConfidence,
    repairRisk,
    rentPotential,
    neighborhoodStrength,
  });

  return {
    propertyScore,
    arvConfidence,
    repairRisk,
    rentPotential,
    neighborhoodStrength,
    recommendedExitStrategy: exitAnalysis.recommendedExitStrategy,
    exitStrategyOptions: exitAnalysis.exitStrategyOptions,
    risks: uniqueStrings(risks),
    opportunities: uniqueStrings(
      opportunities.length
        ? opportunities
        : ["More property data may reveal additional exit opportunities."]
    ),
    missingData: uniqueStrings(missingData),
    summary:
      missingData.length > 0
        ? "Property intelligence is preliminary. Fill in missing ARV, repair, rent, and neighborhood data before relying on this analysis."
        : `Property intelligence supports ${exitAnalysis.recommendedExitStrategy} as the current leading exit strategy.`,
    generatedAt: new Date().toISOString(),
  };
}
