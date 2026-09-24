import { supabase } from "../../supabaseClient";
import { toUserSafeError } from "../../utils/errors";
import { getOrSetCachedValue } from "../cache";
import {
  loadMessageLogs,
  normalizeMessageRecord,
} from "./messageRepository";
import {
  conversationNeedsReply,
  getCanonicalConversationId,
  getConversationCompatibilityKey,
} from "./conversationSignals";

export const CONVERSATION_SUMMARY_DEFAULT_LIMIT = 100;
export const CONVERSATION_SUMMARY_MAX_LIMIT = 500;
export const CONVERSATION_SUMMARY_PAGE_SIZE = 250;

function normalizeSummaryLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return CONVERSATION_SUMMARY_DEFAULT_LIMIT;
  return Math.min(CONVERSATION_SUMMARY_MAX_LIMIT, Math.max(1, Math.floor(parsed)));
}

async function loadConversationSummaryRows(limit) {
  const uniqueConversations = [];
  const seenKeys = new Set();
  let uniqueCount = 0;
  let offset = 0;
  let sourceRows = 0;
  let pages = 0;
  let exhausted = false;

  const compareSummaries = (left, right) => {
    const leftNeedsReply = conversationNeedsReply(left) ? 1 : 0;
    const rightNeedsReply = conversationNeedsReply(right) ? 1 : 0;
    if (leftNeedsReply !== rightNeedsReply) return rightNeedsReply - leftNeedsReply;

    const failedStatuses = new Set(["failed", "undelivered"]);
    const leftFailed = failedStatuses.has(String(left.lastDeliveryStatus || "").toLowerCase()) ? 1 : 0;
    const rightFailed = failedStatuses.has(String(right.lastDeliveryStatus || "").toLowerCase()) ? 1 : 0;
    if (leftFailed !== rightFailed) return rightFailed - leftFailed;

    const timeDifference = new Date(right.lastMessageTimestamp || 0) - new Date(left.lastMessageTimestamp || 0);
    if (timeDifference !== 0) return timeDifference;
    return left.compatibilityKey.localeCompare(right.compatibilityKey);
  };

  while (!exhausted) {
    const { data, error } = await supabase
      .from("message_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + CONVERSATION_SUMMARY_PAGE_SIZE - 1);

    if (error) return { data: null, error };

    const page = data || [];
    pages += 1;
    sourceRows += page.length;
    exhausted = page.length < CONVERSATION_SUMMARY_PAGE_SIZE;

    page.forEach((message) => {
      const normalized = normalizeMessageRecord(message);
      const compatibilityKey = getConversationCompatibilityKey(normalized);
      if (!compatibilityKey || seenKeys.has(compatibilityKey)) return;

      seenKeys.add(compatibilityKey);
      uniqueCount += 1;
      const summary = {
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
      };
      uniqueConversations.push(summary);
      uniqueConversations.sort(compareSummaries);
      if (uniqueConversations.length > limit + 1) uniqueConversations.pop();
    });

    offset += page.length;
  }

  return {
    data: uniqueConversations,
    error: null,
    metadata: { exhausted, pages, sourceRows, uniqueCount },
  };
}

export async function loadConversationSummaries({
  force = false,
  limit = CONVERSATION_SUMMARY_DEFAULT_LIMIT,
} = {}) {
  try {
    const safeLimit = normalizeSummaryLimit(limit);
    const cacheKey = `conversation-summaries:${safeLimit}`;
    const result = force
      ? await loadConversationSummaryRows(safeLimit)
      : await getOrSetCachedValue(
          cacheKey,
          () => loadConversationSummaryRows(safeLimit),
          10000
        );
    const { data, error, metadata: pageMetadata = {} } = result;

    if (error) throw error;
    const summaries = (data || []).slice(0, safeLimit);
    const hasMore = (pageMetadata.uniqueCount || 0) > safeLimit;

    return {
      success: true,
      data: summaries,
      metadata: {
        limit: safeLimit,
        returned: summaries.length,
        sourceRows: pageMetadata.sourceRows || 0,
        pages: pageMetadata.pages || 0,
        hasMore,
        truncated: hasMore,
        continuation: hasMore
          ? { available: false, reason: "The Inbox is intentionally bounded to the highest-attention conversations." }
          : null,
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
