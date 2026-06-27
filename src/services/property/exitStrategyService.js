import { normalizeText } from "../../utils/text";

export const EXIT_STRATEGIES = [
  "Wholesale",
  "Fix and flip",
  "Buy and hold",
  "Seller finance",
  "Subject-to",
  "Pass / review manually",
];

function getStrategyScore(strategy, context) {
  const {
    estimatedArv,
    estimatedRepairs,
    estimatedRent,
    askingPrice,
    mortgageBalance,
    propertyCondition,
    neighborhoodQuality,
  } = context;
  const normalizedCondition = normalizeText(propertyCondition);
  const normalizedNeighborhood = normalizeText(neighborhoodQuality);
  const spread =
    estimatedArv && askingPrice ? estimatedArv - askingPrice - (estimatedRepairs || 0) : null;
  let score = 30;

  if (strategy === "Wholesale") {
    if (spread && spread > 25000) score += 30;
    if (estimatedRepairs && estimatedRepairs > estimatedArv * 0.12) score += 10;
  }

  if (strategy === "Fix and flip") {
    if (spread && spread > 40000) score += 25;
    if (normalizedCondition.includes("poor")) score += 10;
    if (normalizedNeighborhood.includes("strong")) score += 15;
  }

  if (strategy === "Buy and hold") {
    if (estimatedRent) score += 25;
    if (normalizedNeighborhood.includes("strong")) score += 15;
    if (estimatedRepairs && estimatedArv && estimatedRepairs < estimatedArv * 0.1) score += 10;
  }

  if (strategy === "Seller finance") {
    if (askingPrice && spread !== null && spread < 25000) score += 20;
    if (!mortgageBalance) score += 15;
  }

  if (strategy === "Subject-to") {
    if (mortgageBalance) score += 35;
    if (estimatedRent) score += 10;
  }

  if (strategy === "Pass / review manually") {
    if (!estimatedArv) score += 30;
    if (estimatedRepairs && estimatedArv && estimatedRepairs > estimatedArv * 0.25) score += 20;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function analyzeExitStrategies(context = {}) {
  const exitStrategyOptions = EXIT_STRATEGIES.map((strategy) => ({
    strategy,
    score: getStrategyScore(strategy, context),
  })).sort((left, right) => right.score - left.score);

  const selectedStrategy =
    EXIT_STRATEGIES.includes(context.exitStrategy) &&
    context.exitStrategy !== "Review manually"
      ? context.exitStrategy
      : exitStrategyOptions[0]?.strategy || "Pass / review manually";

  return {
    recommendedExitStrategy: selectedStrategy,
    exitStrategyOptions,
  };
}
