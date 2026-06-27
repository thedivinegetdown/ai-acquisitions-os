import { callNetlifyFunction } from "../api";
import { toUserSafeError } from "../../utils/errors";
import { safeTrim } from "../../utils/text";

export async function sendOutboundSms({ to, message, dealId = null } = {}) {
  const trimmedMessage = safeTrim(message);

  if (!to) {
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
      to,
      message: trimmedMessage,
    };

    if (dealId) {
      payload.deal_id = dealId;
    }

    const result = await callNetlifyFunction("send-sms", {
      body: payload,
      retries: 1,
    });

    return result;
  } catch (error) {
    return {
      success: false,
      error: {
        message: toUserSafeError(error, "Could not send SMS."),
        cause: error,
      },
    };
  }
}
