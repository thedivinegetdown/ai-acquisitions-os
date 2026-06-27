import {
  getDealAliasPositiveNumber,
  getDealAliasText,
} from "../../utils/dealFields";
import { parseSafeNumber } from "../../utils/numbers";
import { analyzeOfferRange } from "./offerRangeService";

export const OFFER_TYPES = {
  cash: "Cash offer",
  sellerFinance: "Seller finance offer",
  subjectTo: "Subject-to offer",
  custom: "Creative / custom structure",
};

function getScenarioBase(type) {
  if (type === "sellerFinance") {
    return {
      pros: [
        "Can bridge a gap when seller wants more than the cash range.",
        "May preserve cash while creating seller income.",
      ],
      cons: [
        "Requires seller flexibility and clear payment terms.",
        "Longer negotiation cycle than a simple cash offer.",
      ],
      risks: [
        "Seller may not understand or accept installment-based terms.",
      ],
      recommendedUseCase:
        "Best when the seller has flexibility, meaningful equity, and is open to payments over time.",
    };
  }

  if (type === "subjectTo") {
    return {
      pros: [
        "Can help a seller who needs mortgage relief.",
        "May reduce cash needed at closing.",
      ],
      cons: [
        "Depends on existing loan details and seller trust.",
        "Requires careful legal and servicing review before use.",
      ],
      risks: [
        "Existing loan terms, arrears, insurance, and due-on-sale risk must be reviewed.",
      ],
      recommendedUseCase:
        "Best when a mortgage balance exists and the seller needs payment relief more than a full cash payoff.",
    };
  }

  if (type === "custom") {
    return {
      pros: [
        "Flexible structure when standard offers do not solve the seller's problem.",
        "Can combine cash, terms, timing, and contingencies.",
      ],
      cons: [
        "More moving parts to explain and underwrite.",
        "Harder to compare without complete seller and property data.",
      ],
      risks: [
        "Custom terms can create ambiguity if not documented carefully later.",
      ],
      recommendedUseCase:
        "Best when a standard cash offer does not work and the seller's goals require a tailored structure.",
    };
  }

  return {
    pros: [
      "Fastest and simplest structure to explain.",
      "Cleanest path for sellers who prioritize certainty.",
    ],
    cons: [
      "Usually requires the deepest discount.",
      "May not work if seller expectations are above the acquisition range.",
    ],
    risks: [
      "Low cash price may create seller resistance if expectations are high.",
    ],
    recommendedUseCase:
      "Best for speed, simplicity, and sellers who value a clean closing over creative terms.",
  };
}

function getConfidence({ type, deal, amount }) {
  const arv = getDealAliasPositiveNumber(deal, "arv");
  const repairs = getDealAliasPositiveNumber(deal, "repairs");
  const mortgageBalance = getDealAliasPositiveNumber(deal, "mortgageBalance");

  if (type === "subjectTo") {
    return mortgageBalance ? "Medium" : "Low";
  }

  if (type === "cash") {
    return arv && repairs && amount ? "High" : arv && amount ? "Medium" : "Low";
  }

  if (type === "sellerFinance") {
    return amount ? "Medium" : "Low";
  }

  return amount || arv ? "Medium" : "Low";
}

function getRiskLevel({ type, deal, amount }) {
  const askingPrice = getDealAliasPositiveNumber(deal, "askingPrice");
  const mortgageBalance = getDealAliasPositiveNumber(deal, "mortgageBalance");

  if (type === "subjectTo" && !mortgageBalance) return "High";
  if (askingPrice && amount && amount > askingPrice * 1.05) return "High";
  if (type === "custom" || type === "sellerFinance") return "Medium";

  return "Low";
}

export function buildOfferScenario({
  deal,
  offerType = "cash",
  amount,
  downPayment,
  monthlyPayment,
  interestRate,
  termMonths,
  closingTimeline,
} = {}) {
  const type = OFFER_TYPES[offerType] ? offerType : "cash";
  const base = getScenarioBase(type);
  const offerRange = analyzeOfferRange(deal);
  const scenarioAmount =
    parseSafeNumber(amount) ??
    (type === "cash"
      ? offerRange.offers?.target
      : offerRange.offers?.max) ??
    null;
  const timeline =
    closingTimeline ||
    getDealAliasText(deal, "timeline") ||
    (type === "cash" ? "14-30 days" : "30-60 days");
  const riskLevel = getRiskLevel({
    type,
    deal,
    amount: scenarioAmount,
  });

  return {
    offerType: type,
    label: OFFER_TYPES[type],
    amount: scenarioAmount,
    downPayment: parseSafeNumber(downPayment),
    monthlyPayment: parseSafeNumber(monthlyPayment),
    interestRate: parseSafeNumber(interestRate),
    termMonths: parseSafeNumber(termMonths),
    closingTimeline: timeline,
    pros: base.pros,
    cons: base.cons,
    risks: base.risks,
    riskLevel,
    recommendedUseCase: base.recommendedUseCase,
    confidence: getConfidence({
      type,
      deal,
      amount: scenarioAmount,
    }),
    generatedAt: new Date().toISOString(),
  };
}

export function compareOfferScenarios({ deal, draft = {} } = {}) {
  const scenarios = Object.keys(OFFER_TYPES).map((offerType) =>
    buildOfferScenario({
      deal,
      offerType,
      amount: offerType === draft.offerType ? draft.amount : undefined,
      downPayment:
        offerType === draft.offerType ? draft.downPayment : undefined,
      monthlyPayment:
        offerType === draft.offerType ? draft.monthlyPayment : undefined,
      interestRate:
        offerType === draft.offerType ? draft.interestRate : undefined,
      termMonths: offerType === draft.offerType ? draft.termMonths : undefined,
      closingTimeline:
        offerType === draft.offerType ? draft.closingTimeline : undefined,
    })
  );
  const mortgageBalance = getDealAliasPositiveNumber(deal, "mortgageBalance");
  const askingPrice = getDealAliasPositiveNumber(deal, "askingPrice");
  let recommendedType = "cash";

  if (mortgageBalance) {
    recommendedType = "subjectTo";
  } else if (askingPrice && scenarios[0].amount && askingPrice > scenarios[0].amount * 1.15) {
    recommendedType = "sellerFinance";
  } else if (!scenarios[0].amount) {
    recommendedType = "custom";
  }

  return {
    scenarios,
    recommendedType,
    recommendedScenario:
      scenarios.find((scenario) => scenario.offerType === recommendedType) ||
      scenarios[0],
  };
}
