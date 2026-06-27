import type { ConfidenceLevel } from "./common";

export type OfferReadinessStatus =
  | "Ready to Offer"
  | "Ready to Analyze"
  | "Needs Info"
  | "Not Ready";

export type OfferReadinessItem = {
  label: string;
  complete: boolean;
};

export type OfferReadinessAnalysis = {
  score: number;
  status: OfferReadinessStatus;
  checklist: OfferReadinessItem[];
  recommendedNextStep: string;
};

export type OfferRange = {
  conservative: number;
  target: number;
  max: number;
};

export type OfferRangeAnalysis = {
  arv: number | null;
  repairs: number | null;
  askingPrice: number | null;
  rentEstimate: number | null;
  mortgageBalance: number | null;
  motivation: number | null;
  confidence: ConfidenceLevel;
  warning: string;
  offers: OfferRange | null;
};

export type OfferStrategyAnalysis = {
  sellerLeverage: ConfidenceLevel;
  buyerLeverage: ConfidenceLevel;
  posture: string;
  factors: string[];
  missing: string[];
  summary: string;
};
