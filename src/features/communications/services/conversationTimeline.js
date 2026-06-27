import { formatSafeDate, toSafeDate } from "../../../utils/dates";
import { normalizePhone } from "../../../utils/phone";
import { compactText, safeTrim } from "../../../utils/text";

export const COMMUNICATION_CHANNELS = {
  SMS: "sms",
  EMAIL: "email",
  CALL: "call",
  VOICEMAIL: "voicemail",
  NOTE: "note",
  AI: "ai",
  WORKFLOW: "workflow",
  TRANSACTION: "transaction",
};

export const COMMUNICATION_DIRECTIONS = {
  INBOUND: "inbound",
  OUTBOUND: "outbound",
  INTERNAL: "internal",
  SYSTEM: "system",
};

function buildEventId(prefix, value, fallback) {
  return `${prefix}-${value || fallback || Math.random().toString(36).slice(2)}`;
}

export function normalizeCommunicationEvent(event = {}) {
  const channel = event.channel || event.type || COMMUNICATION_CHANNELS.NOTE;
  const direction = event.direction || COMMUNICATION_DIRECTIONS.INTERNAL;
  const timestamp =
    event.timestamp ||
    event.created_at ||
    event.createdAt ||
    event.date ||
    new Date().toISOString();
  const body = compactText(event.body || event.message || event.preview || event.note);

  return {
    id: event.id || buildEventId(channel, event.sourceId, timestamp),
    channel,
    direction,
    timestamp,
    formattedTimestamp: formatSafeDate(timestamp, "No timestamp"),
    sender: event.sender || event.actor || (direction === "inbound" ? "Seller" : "Team"),
    status: event.status || (direction === "outbound" ? "sent" : "recorded"),
    body,
    summary: safeTrim(event.summary) || "AI summary pending.",
    relatedDealId: event.relatedDealId || event.deal_id || event.dealId || null,
    relatedWorkflowId:
      event.relatedWorkflowId || event.workflow_id || event.workflowId || null,
    sellerName: event.sellerName || event.owner_name || "",
    phone: event.phone || "",
    normalizedPhone: normalizePhone(event.phone),
    metadata: event.metadata || {},
    source: event.source || "communications",
  };
}

export function buildSmsCommunicationEvent(message = {}, deal = null) {
  const direction =
    message.direction === COMMUNICATION_DIRECTIONS.OUTBOUND
      ? COMMUNICATION_DIRECTIONS.OUTBOUND
      : COMMUNICATION_DIRECTIONS.INBOUND;

  return normalizeCommunicationEvent({
    id: buildEventId("sms", message.id, `${direction}-${message.created_at || ""}`),
    channel: COMMUNICATION_CHANNELS.SMS,
    direction,
    timestamp: message.created_at,
    sender: direction === "outbound" ? "Team" : deal?.owner_name || "Seller",
    status: message.status || (direction === "outbound" ? "sent" : "received"),
    body: message.message || message.body,
    relatedDealId: message.deal_id || deal?.id || null,
    sellerName: deal?.owner_name || "",
    phone: message.phone || deal?.phone || "",
    source: "message_logs",
    metadata: { rawMessage: message },
  });
}

export function buildInternalNoteEvent(note = {}, deal = null) {
  return normalizeCommunicationEvent({
    ...note,
    id: note.id || buildEventId("note", null, note.timestamp),
    channel: COMMUNICATION_CHANNELS.NOTE,
    direction: COMMUNICATION_DIRECTIONS.INTERNAL,
    sender: note.sender || "Internal",
    relatedDealId: note.relatedDealId || deal?.id || null,
    sellerName: deal?.owner_name || "",
    phone: note.phone || deal?.phone || "",
    status: "internal",
    source: "local_notes",
  });
}

export function sortTimelineEvents(events = []) {
  return [...events].sort((left, right) => {
    const leftDate = toSafeDate(left.timestamp)?.getTime() || 0;
    const rightDate = toSafeDate(right.timestamp)?.getTime() || 0;
    return rightDate - leftDate;
  });
}

export function buildCommunicationTimeline({
  messages = [],
  notes = [],
  systemEvents = [],
  deal = null,
} = {}) {
  const smsEvents = messages.map((message) =>
    buildSmsCommunicationEvent(message, deal)
  );
  const noteEvents = notes.map((note) => buildInternalNoteEvent(note, deal));
  const normalizedSystemEvents = systemEvents.map(normalizeCommunicationEvent);

  return sortTimelineEvents([
    ...smsEvents,
    ...noteEvents,
    ...normalizedSystemEvents,
  ]);
}
