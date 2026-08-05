import { supabase } from "../../supabaseClient";
import { toUserSafeError } from "../../utils/errors";
import { getOrSetCachedValue } from "../cache";
import {
  loadMessageLogs,
  normalizeMessageRecord,
} from "./messageRepository";
import {
  getCanonicalConversationId,
  getConversationCompatibilityKey,
} from "./conversationSignals";

export const CONVERSATION_SUMMARY_DEFAULT_LIMIT = 100;
export const CONVERSATION_SUMMARY_MAX_LIMIT = 500;

function normalizeSummaryLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return CONVERSATION_SUMMARY_DEFAULT_LIMIT;
  return Math.min(CONVERSATION_SUMMARY_MAX_LIMIT, Math.max(1, Math.floor(parsed)));
}

async function loadConversationSummaryRows(limit) {
  return supabase
    .from("message_logs")
    .select("*")
    .limit(limit + 1)
    .order("created_at", {
      ascending: false,
    });
}

export async function loadConversationSummaries({
  force = false,
  limit = CONVERSATION_SUMMARY_DEFAULT_LIMIT,
} = {}) {
  try {
    const safeLimit = normalizeSummaryLimit(limit);
    const cacheKey = `conversation-summaries:${safeLimit}`;
    const { data, error } = force
      ? await loadConversationSummaryRows(safeLimit)
      : await getOrSetCachedValue(
          cacheKey,
          () => loadConversationSummaryRows(safeLimit),
          10000
        );

    if (error) throw error;

    const uniqueConversations = [];
    const seenKeys = new Set();

    (data || []).forEach((message) => {
      const normalized = normalizeMessageRecord(message);
      const compatibilityKey = getConversationCompatibilityKey(normalized);

      if (!compatibilityKey || seenKeys.has(compatibilityKey)) return;

      seenKeys.add(compatibilityKey);
      uniqueConversations.push({
        ...normalized,
        canonicalConversationId: getCanonicalConversationId(normalized) || null,
        compatibilityKey,
        phone: normalized.phone,
        normalizedPhone: normalized.normalizedPhone,
        dealId: normalized.deal_id || normalized.dealId || null,
        created_at: normalized.created_at,
        lastMessageAt: normalized.created_at,
        lastMessageTimestamp: normalized.created_at,
        lastMessagePreview: normalized.message,
        lastMessageDirection: normalized.direction,
        lastDeliveryStatus: message.status || null,
        direction: normalized.direction,
      });
    });

    const summaries = uniqueConversations.slice(0, safeLimit);

    return {
      success: true,
      data: summaries,
      metadata: {
        limit: safeLimit,
        returned: summaries.length,
        sourceRows: (data || []).length,
        truncated:
          (data || []).length > safeLimit || uniqueConversations.length > safeLimit,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: toUserSafeError(error, "Could not load conversations."),
        cause: error,
      },
    };
  }
}

export async function findDealByPhone(phone) {
  if (!phone) {
    return {
      success: true,
      data: null,
    };
  }

  try {
    const { data, error } = await supabase
      .from("deals")
      .select("*")
      .eq("phone", phone)
      .limit(1);

    if (error) throw error;

    return {
      success: true,
      data: data?.[0] || null,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: toUserSafeError(error, "Could not load linked deal."),
        cause: error,
      },
    };
  }
}

export async function findConversationByPhone(phone) {
  if (!phone) {
    return {
      success: true,
      data: {
        phone: "",
        messages: [],
      },
    };
  }

  const result = await loadMessageLogs({
    phone,
    ascending: false,
    limit: 200,
  });

  if (!result.success) return result;

  return {
    success: true,
    data: {
      phone,
      messages: [...result.data].reverse(),
      lastMessageAt: result.data[0]?.created_at || null,
    },
  };
}

export async function findConversationByDeal(deal) {
  const phone = deal?.phone || "";
  const dealId = deal?.id || deal?.deal_id || deal?.lead_id || null;

  if (phone) {
    return findConversationByPhone(phone);
  }

  if (!dealId) {
    return {
      success: true,
      data: {
        phone: "",
        messages: [],
        lastMessageAt: null,
      },
    };
  }

  const result = await loadMessageLogs({
    dealId,
    ascending: false,
    limit: 200,
  });

  if (!result.success) return result;

  return {
    success: true,
    data: {
      phone: result.data[0]?.phone || "",
      messages: [...result.data].reverse(),
      lastMessageAt: result.data[0]?.created_at || null,
    },
  };
}
