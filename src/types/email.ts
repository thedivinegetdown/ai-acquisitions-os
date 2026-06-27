import type { ServiceResult } from "./common";

export type EmailMessage = {
  id?: string;
  to: string;
  from?: string;
  subject: string;
  body: string;
  status: "draft" | "queued" | "sent" | "failed" | "provider-unavailable";
  direction: "inbound" | "outbound" | "internal";
  relatedDealId?: string | number | null;
  createdAt: string;
  provider?: string;
};

export type EmailDraft = {
  to: string;
  subject: string;
  body: string;
  templateId?: string;
  relatedDealId?: string | number | null;
  generatedAt: string;
  source: "manual" | "template" | "ai" | "mock";
};

export type EmailSendResult = {
  messageId?: string;
  provider: string;
  status: EmailMessage["status"];
  sentAt?: string;
  fallbackMessage?: string;
};

export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: "follow-up" | "offer" | "nurture" | "closing" | "custom";
};

export type EmailThread = {
  id: string;
  subject: string;
  participants: string[];
  messages: EmailMessage[];
  updatedAt: string;
};

export type EmailProvider = {
  id: string;
  label: string;
  configured: boolean;
  sendEmail: (draft: EmailDraft) => Promise<ServiceResult<EmailSendResult>>;
};
