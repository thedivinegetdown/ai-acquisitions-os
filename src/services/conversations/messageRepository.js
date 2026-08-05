import { supabase } from "../../supabaseClient";
import { toUserSafeError } from "../../utils/errors";
import { normalizePhone } from "../../utils/phone";
import { safeTrim } from "../../utils/text";
import {
  clearCacheByPrefix,
  getCachedValue,
  setCachedValue,
} from "../cache";

const MESSAGE_LOG_CACHE_PREFIX = "message_logs";
const CONVERSATION_SUMMARY_CACHE_PREFIX = "conversation-summaries";
const MESSAGE_LOG_CACHE_TTL_MS = 5000;
export const MESSAGE_LOG_DEFAULT_LIMIT = 100;
export const MESSAGE_LOG_MAX_LIMIT = 500;
const OUTBOUND_STATUSES = new Set([
  "accepted",
  "delivered",
  "failed",
  "queued",
  "sending",
  "sent",
  "test",
  "undelivered",
]);

export function isMissingDirectionColumnError(error = {}) {
  return (
    error?.code === "42703" ||
    String(error?.message || "")
      .toLowerCase()
      .includes("message_logs.direction")
  );
}

function deriveMessageDirection(record = {}) {
  if (record.direction === "outbound" || record.direction === "inbound") {
    return record.direction;
  }

  return OUTBOUND_STATUSES.has(String(record.status || "").toLowerCase())
    ? "outbound"
    : "inbound";
}

export function normalizeMessageRecord(record = {}) {
  const direction = deriveMessageDirection(record);
  const explicitDirection =
    record.direction === "outbound" || record.direction === "inbound";
  const explicitStatus = safeTrim(record.status);

  return {
    ...record,
    phone: record.phone || "",
    normalizedPhone: normalizePhone(record.phone),
    message: record.message || record.body || "",
    direction,
    directionSource:
      record.directionSource ||
      (explicitDirection
        ? "direction-column"
        : explicitStatus
          ? "legacy-status"
          : "legacy-default"),
    status: explicitStatus || (direction === "outbound" ? "sent" : "received"),
    statusWasExplicit:
      typeof record.statusWasExplicit === "boolean"
        ? record.statusWasExplicit
        : Boolean(explicitStatus),
    created_at: record.created_at || null,
  };
}

function normalizeLimit(value, fallback = MESSAGE_LOG_DEFAULT_LIMIT) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(MESSAGE_LOG_MAX_LIMIT, Math.max(1, Math.floor(parsed)));
}

function normalizeOffset(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

export function invalidateConversationCaches() {
  clearCacheByPrefix(MESSAGE_LOG_CACHE_PREFIX);
  clearCacheByPrefix(CONVERSATION_SUMMARY_CACHE_PREFIX);
}

export async function loadMessageLogs({
  phone,
  dealId,
  ascending = true,
  force = false,
  limit = MESSAGE_LOG_DEFAULT_LIMIT,
  offset = 0,
} = {}) {
  try {
    const safeLimit = normalizeLimit(limit);
    const safeOffset = normalizeOffset(offset);
    const cacheKey = `${MESSAGE_LOG_CACHE_PREFIX}:${phone || "all"}:${dealId || "all"}:${ascending ? "asc" : "desc"}:${safeOffset}:${safeLimit}`;
    const cached = force ? null : getCachedValue(cacheKey);

    if (cached) return cached;

    let query = supabase.from("message_logs").select("*");

    if (phone) {
      query = query.eq("phone", phone);
    }

    if (dealId) {
      query = query.eq("deal_id", dealId);
    }

    query = query.range(safeOffset, safeOffset + safeLimit - 1);
    const { data, error } = await query.order("created_at", { ascending });

    if (error) throw error;

    const result = {
      success: true,
      data: (data || []).map(normalizeMessageRecord),
      metadata: {
        limit: safeLimit,
        offset: safeOffset,
        returned: (data || []).length,
      },
    };

    setCachedValue(cacheKey, result, MESSAGE_LOG_CACHE_TTL_MS);
    return result;
  } catch (error) {
    return {
      success: false,
      error: {
        message: toUserSafeError(error, "Could not load message history."),
        cause: error,
      },
    };
  }
}

export async function loadAllMessageLogs({
  ascending = false,
  force = false,
  limit = MESSAGE_LOG_MAX_LIMIT,
  offset = 0,
} = {}) {
  return loadMessageLogs({ ascending, force, limit, offset });
}

export async function insertOutboundMessageLog({
  phone,
  message,
  dealId = null,
  status = "sent",
} = {}) {
  const trimmedMessage = safeTrim(message);

  if (!phone) {
    return {
      success: false,
      error: { message: "Missing recipient phone number." },
    };
  }

  if (!trimmedMessage) {
    return {
      success: false,
      error: { message: "Message cannot be empty." },
    };
  }

  try {
    const payload = {
      phone,
      message: trimmedMessage,
      direction: "outbound",
      status,
    };

    if (dealId) {
      payload.deal_id = dealId;
    }

    let { data, error } = await supabase
      .from("message_logs")
      .insert(payload)
      .select()
      .limit(1);

    if (error && isMissingDirectionColumnError(error)) {
      const legacyPayload = { ...payload };
      delete legacyPayload.direction;
      ({ data, error } = await supabase
        .from("message_logs")
        .insert(legacyPayload)
        .select()
        .limit(1));
    }

    if (error) throw error;
    invalidateConversationCaches();

    return {
      success: true,
      data: normalizeMessageRecord(data?.[0] || payload),
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: toUserSafeError(error, "Could not save outbound message."),
        cause: error,
      },
    };
  }
}

export function subscribeToMessageInserts(onMessage, onStatus) {
  const subscription = supabase
    .channel("sms-inbox")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "message_logs",
      },
      (payload) => {
        invalidateConversationCaches();
        onMessage?.(normalizeMessageRecord(payload.new));
      }
    )
    .subscribe((status) => onStatus?.(status));

  return () => {
    supabase.removeChannel(subscription);
  };
}
