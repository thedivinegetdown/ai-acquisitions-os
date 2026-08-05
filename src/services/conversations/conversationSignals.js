import { toSafeDate } from "../../utils/dates";
import { normalizePhone } from "../../utils/phone";
import { compactText } from "../../utils/text";
import { normalizeMessageRecord } from "./messageRepository";

const CANONICAL_ID_FIELDS = [
  "canonicalConversationId",
  "conversation_id",
  "conversationId",
];

const PHONE_FIELDS = [
  "phone",
  "participantIdentifier",
  "participant_identifier",
  "seller_phone",
];

function safeValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function firstValue(record, fields) {
  for (const field of fields) {
    const value = safeValue(record?.[field]);
    if (value) return value;
  }
  return "";
}

export function getCanonicalConversationId(record = {}) {
  return firstValue(record, CANONICAL_ID_FIELDS);
}

export function getConversationPhone(record = {}) {
  return firstValue(record, PHONE_FIELDS);
}

export function getConversationCompatibilityKey(record = {}) {
  const canonicalId = getCanonicalConversationId(record);
  if (canonicalId) return `conversation:${canonicalId}`;

  if (safeValue(record.compatibilityKey)) return safeValue(record.compatibilityKey);

  const normalizedPhone = normalizePhone(getConversationPhone(record));
  return normalizedPhone ? `phone:${normalizedPhone}` : "";
}

export function getConversationMessageBody(record = {}) {
  return compactText(
    record.lastMessagePreview || record.message || record.body || record.preview
  );
}

export function getConversationMessageTimestamp(record = {}) {
  const value =
    record.lastMessageTimestamp ||
    record.lastMessageAt ||
    record.created_at ||
    record.createdAt ||
    record.timestamp;
  return toSafeDate(value)?.toISOString() || "";
}

export function getConversationMessageDirection(record = {}) {
  const direction = record.lastMessageDirection || record.direction;
  if (direction === "inbound" || direction === "outbound") return direction;
  return normalizeMessageRecord(record).direction;
}

export function isValidConversationResponseSignal(record = {}) {
  return Boolean(
    getConversationCompatibilityKey(record) &&
      getConversationMessageBody(record) &&
      getConversationMessageTimestamp(record)
  );
}

export function conversationNeedsReply(record = {}) {
  return (
    isValidConversationResponseSignal(record) &&
    getConversationMessageDirection(record) === "inbound"
  );
}

export function getExplicitUnreadState(record = {}) {
  if (Object.prototype.hasOwnProperty.call(record, "unread")) {
    return typeof record.unread === "boolean" ? record.unread : null;
  }

  if (Object.prototype.hasOwnProperty.call(record, "is_unread")) {
    return typeof record.is_unread === "boolean" ? record.is_unread : null;
  }

  if (Object.prototype.hasOwnProperty.call(record, "is_read")) {
    return typeof record.is_read === "boolean" ? !record.is_read : null;
  }

  for (const field of ["unread_count", "unread_message_count"]) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) continue;
    const value = Number(record[field]);
    return Number.isFinite(value) ? value > 0 : null;
  }

  if (Object.prototype.hasOwnProperty.call(record, "read_at")) {
    if (record.read_at === null) return true;
    return toSafeDate(record.read_at) ? false : null;
  }

  return null;
}

export function conversationsMatch(left = {}, right = {}) {
  const leftCanonicalId = getCanonicalConversationId(left);
  const rightCanonicalId = getCanonicalConversationId(right);

  if (leftCanonicalId && rightCanonicalId) {
    return leftCanonicalId === rightCanonicalId;
  }

  const leftPhone = normalizePhone(getConversationPhone(left));
  const rightPhone = normalizePhone(getConversationPhone(right));
  return Boolean(leftPhone && leftPhone === rightPhone);
}
