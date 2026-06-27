import { getDealAliasPositiveNumber } from "../../utils/dealFields";
import { parseSafeNumber } from "../../utils/numbers";
import { safeTrim } from "../../utils/text";
import { analyzeOfferRange } from "./offerRangeService";
import { buildOfferScenario } from "./offerScenarioService";

export function buildInitialOfferDraft(deal) {
  const range = analyzeOfferRange(deal);
  const mortgageBalance = getDealAliasPositiveNumber(deal, "mortgageBalance");
  const amount = range.offers?.target ?? range.askingPrice ?? "";

  return {
    offerType: mortgageBalance ? "subjectTo" : "cash",
    amount: amount ? Math.round(amount) : "",
    downPayment: "",
    monthlyPayment: "",
    interestRate: "",
    termMonths: "",
    closingTimeline: "30 days",
    notes: "",
    internalRationale:
      "Internal planning only. Validate seller goals, property condition, and acquisition numbers before presenting any offer.",
  };
}

export function normalizeOfferDraft(draft = {}) {
  return {
    offerType: draft.offerType || "cash",
    amount: parseSafeNumber(draft.amount),
    downPayment: parseSafeNumber(draft.downPayment),
    monthlyPayment: parseSafeNumber(draft.monthlyPayment),
    interestRate: parseSafeNumber(draft.interestRate),
    termMonths: parseSafeNumber(draft.termMonths),
    closingTimeline: safeTrim(draft.closingTimeline),
    notes: safeTrim(draft.notes),
    internalRationale: safeTrim(draft.internalRationale),
  };
}

export function analyzeOfferDraft({ deal, draft } = {}) {
  const normalizedDraft = normalizeOfferDraft(draft);
  const scenario = buildOfferScenario({
    deal,
    ...normalizedDraft,
  });

  return {
    ...scenario,
    notes: normalizedDraft.notes,
    internalRationale: normalizedDraft.internalRationale,
  };
}
