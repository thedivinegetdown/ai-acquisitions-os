import { formatSafeDate } from "../../utils/dates";
import { safeTrim } from "../../utils/text";
import {
  findConversationByPhone,
  findDealByPhone,
  loadConversationSummaries,
} from "./conversationRepository";
import { loadMessageLogs } from "./messageRepository";

export async function loadConversationInbox() {
  return loadConversationSummaries();
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

  if (!dealResult.success) return dealResult;
  if (!conversationResult.success) return conversationResult;

  return {
    success: true,
    data: {
      deal: dealResult.data,
      conversation: conversationResult.data,
    },
  };
}

export async function loadThreadMessages(phone) {
  return loadMessageLogs({ phone, ascending: true });
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
