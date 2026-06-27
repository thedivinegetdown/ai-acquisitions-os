import type { EntityId } from "./common";

export type MessageDirection = "inbound" | "outbound" | string;

export type MessageStatus =
  | "received"
  | "sent"
  | "failed"
  | "test"
  | string;

export type MessageLog = {
  id?: EntityId;
  deal_id?: EntityId | null;
  phone: string;
  message?: string | null;
  body?: string | null;
  direction?: MessageDirection | null;
  status?: MessageStatus | null;
  provider_sid?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
};

export type Conversation = {
  phone: string;
  lastMessageAt: string | null;
  messages: MessageLog[];
};

export type ConversationSummary = {
  phone: string;
  lastMessageAt: string | null;
  lastMessagePreview?: string;
};
