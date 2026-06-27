import { clampScore } from "../../utils/numbers";
import { getDealField } from "../../utils/dealFields";

export const OFFER_READINESS_CHECKLIST = [
  {
    label: "Asking price",
    keys: ["price", "asking_price", "askingPrice"],
  },
  {
    label: "Property condition",
    keys: ["property_condition", "condition"],
  },
  {
    label: "Motivation level",
    keys: ["motivation_score", "motivation"],
  },
  {
    label: "Seller timeline",
    keys: ["seller_timeline", "timeline", "timeline_to_sell"],
  },
  {
    label: "Mortgage status",
    keys: ["mortgage_status", "mortgage"],
  },
  {
    label: "Repairs needed",
    keys: ["repairs_needed", "repairs"],
  },
  {
    label: "Occupancy status",
    keys: ["occupancy_status", "occupancy"],
  },
  {
    label: "ARV / comps status",
    keys: ["arv", "comps_status", "comps"],
  },
];

function hasDealValue(deal, keys) {
  const value = getDealField(deal, keys);

  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return value > 0;

  return Boolean(value);
}

export function getOfferReadinessStatus(score, missingCount) {
  if (score >= 88 && missingCount === 0) return "Ready to Offer";
  if (score >= 65) return "Ready to Analyze";
  if (score >= 35) return "Needs Info";

  return "Not Ready";
}

export function getOfferReadinessNextStep(checklist = []) {
  const conditionMissing = checklist.some(
    (item) =>
      !item.complete &&
      ["Property condition", "Repairs needed"].includes(item.label)
  );

  if (conditionMissing) {
    return "Ask about repairs and current property condition.";
  }

  if (
    checklist.some(
      (item) => !item.complete && item.label === "Motivation level"
    )
  ) {
    return "Ask what is motivating the seller to consider an offer.";
  }

  if (
    checklist.some(
      (item) => !item.complete && item.label === "Seller timeline"
    )
  ) {
    return "Ask about the seller's ideal timeline.";
  }

  if (
    checklist.some((item) => !item.complete && item.label === "Asking price")
  ) {
    return "Ask for the seller's asking price or target number.";
  }

  if (
    checklist.some(
      (item) => !item.complete && item.label === "ARV / comps status"
    )
  ) {
    return "Run comps before preparing an offer.";
  }

  return "Prepare an offer range.";
}

export function analyzeOfferReadiness(deal) {
  const checklist = OFFER_READINESS_CHECKLIST.map((item) => ({
    label: item.label,
    complete: hasDealValue(deal, item.keys),
  }));

  const completeCount = checklist.filter((item) => item.complete).length;
  const missingCount = checklist.length - completeCount;
  const score = clampScore((completeCount / checklist.length) * 100);

  return {
    score,
    status: getOfferReadinessStatus(score, missingCount),
    checklist,
    recommendedNextStep: getOfferReadinessNextStep(checklist),
  };
}
