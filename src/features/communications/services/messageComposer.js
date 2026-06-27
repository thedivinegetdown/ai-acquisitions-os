import { insertOutboundMessageLog } from "../../../services/conversations";
import {
  buildEmailTimelineEvent,
  getEmailProviderStatus,
  prepareEmailDraft,
} from "../../../services/email";
import {
  getCallProviderStatus,
  logManualCall,
} from "../../../services/calling";
import { sendOutboundSms } from "../../../services/sms";
import { createServiceError } from "../../../utils/errors";
import { safeTrim } from "../../../utils/text";
import { buildInternalNoteEvent } from "./conversationTimeline";

export const COMPOSER_CHANNELS = {
  SMS: "sms",
  EMAIL: "email",
  CALL: "call",
  NOTE: "note",
  TEMPLATE: "template",
};

export function buildDraftMessage({
  channel = COMPOSER_CHANNELS.SMS,
  body = "",
  to = "",
  subject = "",
  outcome = "Connected",
  nextCallDate = "",
} = {}) {
  return {
    channel,
    to,
    subject,
    outcome,
    nextCallDate,
    body: safeTrim(body),
    updatedAt: new Date().toISOString(),
  };
}

export async function prepareEmailDraftFromComposer({
  to,
  subject,
  body,
  deal = null,
  providerId = "manual",
} = {}) {
  const draftResult = await prepareEmailDraft({
    to,
    subject,
    body,
    deal,
    providerId,
  });

  if (!draftResult.success) return draftResult;

  const draft = draftResult.data?.draft || draftResult.data;

  return {
    success: true,
    data: {
      ...draftResult.data,
      event: buildEmailTimelineEvent(draft, deal),
      providerStatus: getEmailProviderStatus(providerId),
      message:
        draftResult.data?.fallbackMessage ||
        "Email foundation only - live email sending is not active yet. Draft prepared for review.",
    },
  };
}

export async function logCallFromComposer({
  to,
  outcome,
  notes,
  nextCallDate,
  deal = null,
  providerId = "manual",
  useAiSummary = true,
} = {}) {
  const callResult = await logManualCall({
    phone: to,
    outcome,
    notes,
    nextCallDate,
    deal,
    providerId,
    useAiSummary,
  });

  if (!callResult.success) return callResult;

  return {
    success: true,
    data: {
      ...callResult.data,
      providerStatus: getCallProviderStatus(providerId),
      message:
        callResult.data?.message ||
        "Call logged locally. Live calling is not active.",
    },
  };
}

export async function sendSmsFromComposer({
  to,
  body,
  dealId = null,
  logLocally = true,
} = {}) {
  const trimmedBody = safeTrim(body);

  if (!to) {
    return { success: false, error: { message: "Missing recipient phone number." } };
  }

  if (!trimmedBody) {
    return { success: false, error: { message: "Message cannot be empty." } };
  }

  try {
    const sendResult = await sendOutboundSms({
      to,
      message: trimmedBody,
      dealId,
    });

    if (!sendResult.success) return sendResult;

    if (logLocally) {
      const logResult = await insertOutboundMessageLog({
        phone: to,
        message: trimmedBody,
        dealId,
      });

      if (!logResult.success) return logResult;
    }

    return sendResult;
  } catch (error) {
    return {
      success: false,
      error: createServiceError(error, "Could not send SMS."),
    };
  }
}

export function createInternalNote({ body, deal = null, phone = "" } = {}) {
  const trimmedBody = safeTrim(body);

  if (!trimmedBody) {
    return {
      success: false,
      error: { message: "Note cannot be empty." },
    };
  }

  return {
    success: true,
    data: buildInternalNoteEvent(
      {
        id: `note-${Date.now()}`,
        body: trimmedBody,
        timestamp: new Date().toISOString(),
        phone,
      },
      deal
    ),
  };
}

export function prepareFutureCommunication({ channel, body, deal = null, phone = "" } = {}) {
  const trimmedBody = safeTrim(body);

  return {
    success: true,
    data: {
      id: `planned-${channel || "communication"}-${Date.now()}`,
      channel: channel || COMPOSER_CHANNELS.EMAIL,
      body: trimmedBody,
      dealId: deal?.id || null,
      phone,
      status: "draft",
      generatedAt: new Date().toISOString(),
      message:
        channel === COMPOSER_CHANNELS.EMAIL
          ? "Email provider is not connected yet. Draft saved locally for review."
          : "Template prepared locally for review.",
    },
  };
}
