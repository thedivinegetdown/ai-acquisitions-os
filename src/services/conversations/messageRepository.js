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
const MESSAGE_LOG_CACHE_TTL_MS = 5000;
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

  return {
    ...record,
    phone: record.phone || "",
    normalizedPhone: normalizePhone(record.phone),
    message: record.message || record.body || "",
    direction,
    status: record.status || (direction === "outbound" ? "sent" : "received"),
    created_at: record.created_at || null,
  };
}

export async function loadMessageLogs({
  phone,
  dealId,
  ascending = true,
} = {}) {
  try {
    const cacheKey = `${MESSAGE_LOG_CACHE_PREFIX}:${phone || "all"}:${dealId || "all"}:${ascending ? "asc" : "desc"}`;
    const cached = getCachedValue(cacheKey);

    if (cached) return cached;

    let query = supabase.from("message_logs").select("*");

    if (phone) {
      query = query.eq("phone", phone);
    }

    if (dealId) {
      query = query.eq("deal_id", dealId);
    }

    const { data, error } = await query.order("created_at", { ascending });

    if (error) throw error;

    const result = {
      success: true,
      data: (data || []).map(normalizeMessageRecord),
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

export async function loadAllMessageLogs({ ascending = false } = {}) {
  return loadMessageLogs({ ascending });
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
    clearCacheByPrefix(MESSAGE_LOG_CACHE_PREFIX);

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

export function subscribeToMessageInserts(onMessage) {
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
        clearCacheByPrefix(MESSAGE_LOG_CACHE_PREFIX);
        onMessage?.(normalizeMessageRecord(payload.new));
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
}
