import { formatSafeDate } from "../../utils/dates";
import { safeTrim } from "../../utils/text";
import {
  findConversationByPhone,
  findDealByPhone,
  loadConversationSummaries,
} from "./conversationRepository";
import { loadMessageLogs } from "./messageRepository";

export async function loadConversationInbox(options = {}) {
  return loadConversationSummaries(options);
}

export async function loadConversationThread(phone) {
  if (!phone) {
    return {
      success: true,
      data: {
        deal: null,
        conversation: {
          phone: "",
          messages: [],
          lastMessageAt: null,
        },
      },
    };
  }

  const [dealResult, conversationResult] = await Promise.all([
    findDealByPhone(phone),
    findConversationByPhone(phone),
  ]);

  if (!conversationResult.success) return conversationResult;

  return {
    success: true,
    data: {
      deal: dealResult.success ? dealResult.data : null,
      conversation: conversationResult.data,
      sourceWarnings: dealResult.success
        ? []
        : ["Linked deal context could not be loaded."],
    },
  };
}

export async function loadThreadMessages(phone, options = {}) {
  const {
    ascending = true,
    dealId = null,
    force = false,
    limit,
    offset = 0,
  } = options;

  return loadMessageLogs({
    phone: phone || undefined,
    dealId: phone ? undefined : dealId || undefined,
    ascending,
    force,
    limit,
    offset,
  });
}

export function buildSmsTimelineEvent(message = {}) {
  const direction = message.direction === "outbound" ? "outbound" : "inbound";

  return {
    id: `sms-${message.id || `${direction}-${message.created_at || ""}`}`,
    type: "sms",
    icon: direction === "outbound" ? "->" : "<-",
    created_at: message.created_at,
    direction,
    actor: direction === "outbound" ? "You" : "Seller",
    directionLabel: direction === "outbound" ? "Outbound" : "Inbound",
    preview: safeTrim(message.message || message.body),
    formattedDate: formatSafeDate(message.created_at, ""),
  };
}
