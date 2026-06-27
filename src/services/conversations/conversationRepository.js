import { supabase } from "../../supabaseClient";
import { toUserSafeError } from "../../utils/errors";
import { getOrSetCachedValue } from "../cache";
import { loadMessageLogs, normalizeMessageRecord } from "./messageRepository";

export async function loadConversationSummaries() {
  try {
    const { data, error } = await getOrSetCachedValue(
      "conversation-summaries",
      () =>
        supabase
          .from("message_logs")
          .select("phone, created_at, message, direction")
          .order("created_at", {
            ascending: false,
          }),
      10000
    );

    if (error) throw error;

    const uniqueConversations = [];
    const seenPhones = new Set();

    (data || []).forEach((message) => {
      const normalized = normalizeMessageRecord(message);

      if (!normalized.phone || seenPhones.has(normalized.phone)) return;

      seenPhones.add(normalized.phone);
      uniqueConversations.push({
        phone: normalized.phone,
        created_at: normalized.created_at,
        lastMessageAt: normalized.created_at,
        lastMessagePreview: normalized.message,
        direction: normalized.direction,
      });
    });

    return {
      success: true,
      data: uniqueConversations,
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

  const result = await loadMessageLogs({ phone, ascending: true });

  if (!result.success) return result;

  return {
    success: true,
    data: {
      phone,
      messages: result.data,
      lastMessageAt: result.data.at(-1)?.created_at || null,
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
    ascending: true,
  });

  if (!result.success) return result;

  return {
    success: true,
    data: {
      phone: result.data[0]?.phone || "",
      messages: result.data,
      lastMessageAt: result.data.at(-1)?.created_at || null,
    },
  };
}
