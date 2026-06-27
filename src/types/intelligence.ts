import type { ConfidenceLevel, ScoreLabel } from "./common";

export type IntelligenceSource = "rules" | "openai" | "hybrid" | string;

export type IntelligenceMetadata = {
  source: IntelligenceSource;
  confidence: ConfidenceLevel;
  generatedAt: string;
};

export type ConversationAnalysis = {
  hasData: boolean;
  sentiment: "Positive" | "Neutral" | "Negative" | "Unknown" | string;
  urgency: "Low" | "Medium" | "High" | "Unknown" | string;
  engagement: "Cold" | "Warm" | "Hot" | "Unknown" | string;
  detectedIntent: string[];
  keyPhrases: string[];
  redFlags: string[];
  suggestedTone: string;
};

export type DealAnalysis = {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F" | string;
  indicator: ScoreLabel;
  strengths: string[];
  weaknesses: string[];
  risks: string[];
  opportunities: string[];
  missingInformation: string[];
  summary: string;
  offerReadinessScore: number;
  offerConfidence: ConfidenceLevel;
};

export type LeadPriorityAnalysis = {
  priorityScore: number;
  priorityLabel: "Low" | "Medium" | "High" | "Critical" | string;
  whyThisLeadMatters: string;
  suggestedAction: string;
  factors: string[];
  missingData: string[];
};

export type NextBestActionRecommendation = {
  action: string;
  priority: "Low" | "Medium" | "High" | "Critical" | string;
  reason: string;
};

export type IntelligenceResult<T> = T & {
  metadata?: IntelligenceMetadata;
};
