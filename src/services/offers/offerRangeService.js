import { getDealAliasPositiveNumber } from "../../utils/dealFields";

export function analyzeOfferRange(deal) {
  const arv = getDealAliasPositiveNumber(deal, "arv");
  const repairs = getDealAliasPositiveNumber(deal, "repairs");
  const askingPrice = getDealAliasPositiveNumber(deal, "askingPrice");
  const rentEstimate = getDealAliasPositiveNumber(deal, "rent");
  const mortgageBalance = getDealAliasPositiveNumber(deal, "mortgageBalance");
  const motivation = getDealAliasPositiveNumber(deal, "motivation");
  const repairsForMath = repairs ?? 0;

  if (!arv) {
    return {
      arv,
      repairs,
      askingPrice,
      rentEstimate,
      mortgageBalance,
      motivation,
      confidence: "Low",
      warning: "ARV needed",
      offers: null,
    };
  }

  return {
    arv,
    repairs,
    askingPrice,
    rentEstimate,
    mortgageBalance,
    motivation,
    confidence: repairs ? "High" : "Medium",
    warning: repairs
      ? ""
      : "Repairs missing; assuming $0 for this preliminary range.",
    offers: {
      conservative: arv * 0.6 - repairsForMath,
      target: arv * 0.65 - repairsForMath,
      max: arv * 0.7 - repairsForMath,
    },
  };
}
