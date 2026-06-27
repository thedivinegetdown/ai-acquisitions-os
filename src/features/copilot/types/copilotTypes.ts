export type CopilotPriority = "Low" | "Medium" | "High" | "Critical";
export type CopilotConfidence = "Low" | "Medium" | "High";

export type CopilotRecommendation = {
  summary: string;
  priority: CopilotPriority | string;
  confidence: CopilotConfidence | string;
  recommendation: string;
  reasoning: string;
  source: string;
  category: string;
  relatedDealSection?: string;
  generatedAt: string;
};

export type CopilotResult = CopilotRecommendation & {
  recommendations: CopilotRecommendation[];
  feed: string[];
  agenda: Record<string, CopilotRecommendation[]>;
  timeline: Array<{
    label: string;
    date: string;
    detail: string;
  }>;
  score: number;
};
