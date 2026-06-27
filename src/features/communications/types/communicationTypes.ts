export type CommunicationChannel =
  | "sms"
  | "email"
  | "call"
  | "voicemail"
  | "note"
  | "ai"
  | "workflow"
  | "transaction";

export type CommunicationDirection = "inbound" | "outbound" | "internal" | "system";

export type CommunicationStatus =
  | "draft"
  | "sent"
  | "received"
  | "failed"
  | "internal"
  | "recorded";

export interface CommunicationEvent {
  id: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  timestamp: string;
  formattedTimestamp: string;
  sender: string;
  status: CommunicationStatus | string;
  body: string;
  summary: string;
  relatedDealId?: string | number | null;
  relatedWorkflowId?: string | number | null;
  sellerName?: string;
  phone?: string;
  normalizedPhone?: string;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface CommunicationAnalytics {
  messagesSent: number;
  messagesReceived: number;
  averageResponseHours: number | null;
  averageResponseLabel: string;
  responseRate: number | null;
  responseRateLabel: string;
  conversationLength: number;
  mostActiveSellers: Array<{
    label: string;
    count: number;
    normalizedPhone?: string;
  }>;
  followUpFrequency: string;
  generatedAt: string;
}

export interface MessageDraft {
  channel: "sms" | "email" | "note" | "template";
  to: string;
  subject?: string;
  body: string;
  updatedAt: string;
}
