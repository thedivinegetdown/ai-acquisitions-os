import {
  loadAllMessageLogs,
  loadThreadMessages,
} from "../../../services/conversations";
import { createServiceError } from "../../../utils/errors";
import { normalizePhone } from "../../../utils/phone";
import { buildCommunicationTimeline } from "./conversationTimeline";

export async function loadCommunicationHistory({
  phone,
  deal = null,
  notes = [],
  systemEvents = [],
} = {}) {
  try {
    const normalizedPhone = normalizePhone(phone || deal?.phone);
    const result = normalizedPhone
      ? await loadThreadMessages(phone || deal?.phone)
      : await loadAllMessageLogs({ ascending: true });

    if (!result.success) {
      return result;
    }

    return {
      success: true,
      data: {
        messages: result.data || [],
        timeline: buildCommunicationTimeline({
          messages: result.data || [],
          notes,
          systemEvents,
          deal,
        }),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: createServiceError(error, "Could not load communications."),
    };
  }
}
