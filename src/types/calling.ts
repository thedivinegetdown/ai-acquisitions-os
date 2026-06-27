import type { ServiceResult } from "./common";

export type CallDirection = "inbound" | "outbound";

export type CallStatus =
  | "planned"
  | "logged"
  | "completed"
  | "missed"
  | "voicemail"
  | "no-answer"
  | "provider-unavailable";

export type CallNote = {
  id?: string;
  body: string;
  createdAt: string;
  author?: string;
};

export type CallSummary = {
  summary: string;
  objections: string[];
  sentiment: "Positive" | "Neutral" | "Negative" | "Unknown";
  recommendedNextAction: string;
  talkingPoints: string[];
  generatedAt: string;
  source: "manual" | "ai" | "mock";
};

export type CallRecord = {
  id?: string;
  phone: string;
  direction: CallDirection;
  status: CallStatus;
  outcome: string;
  notes: CallNote[];
  nextCallDate?: string;
  durationSeconds?: number | null;
  relatedDealId?: string | number | null;
  summary?: CallSummary;
  createdAt: string;
  provider?: string;
};

export type CallResult = {
  callId?: string;
  provider: string;
  status: CallStatus;
  message: string;
  record?: CallRecord;
};

export type CallProvider = {
  id: string;
  label: string;
  configured: boolean;
  placeCall: (input: {
    phone: string;
    dealId?: string | number | null;
  }) => Promise<ServiceResult<CallResult>>;
};
