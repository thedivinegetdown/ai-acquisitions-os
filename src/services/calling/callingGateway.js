import { createFailure, createSuccess } from "../api/serviceResult";
import { manualCallProvider } from "./manualCallProvider";
import { mockCallProvider } from "./mockCallProvider";
import {
  CALL_OUTCOMES,
  buildCallTimelineEvent,
  normalizeCallRecord,
} from "./callLogService";
import {
  generateCallTalkingPoints,
  summarizeCallNotes,
  summarizeCallNotesWithAi,
} from "./callSummaryService";

const PROVIDERS = {
  manual: manualCallProvider,
  mock: mockCallProvider,
};

export function getCallProvider(providerId = "manual") {
  return PROVIDERS[providerId] || manualCallProvider;
}

export function getCallProviderStatus(providerId = "manual") {
  const provider = getCallProvider(providerId);

  return {
    providerId: provider.id,
    label: provider.label,
    configured: provider.configured,
    liveCallingActive: false,
    message: "Calling foundation only - live calling is not active yet.",
  };
}

export async function requestLiveCall({
  phone = "",
  dealId = null,
  providerId = "manual",
} = {}) {
  const provider = getCallProvider(providerId);
  return provider.placeCall({ phone, dealId });
}

export async function logManualCall({
  phone = "",
  direction = "outbound",
  outcome = "Connected",
  notes = "",
  nextCallDate = "",
  deal = null,
  providerId = "manual",
  useAiSummary = false,
} = {}) {
  if (!phone && !deal?.phone) {
    return createFailure(
      new Error("Missing phone number for call log."),
      "Missing phone number for call log."
    );
  }

  const summary = useAiSummary
    ? await summarizeCallNotesWithAi({ notes, outcome, deal })
    : summarizeCallNotes({ notes, outcome });
  const record = normalizeCallRecord({
    phone,
    direction,
    status: outcome === "Left voicemail" ? "voicemail" : "logged",
    outcome,
    notes,
    nextCallDate,
    deal,
    provider: providerId,
  });
  const enrichedRecord = {
    ...record,
    summary,
  };

  return createSuccess({
    record: enrichedRecord,
    event: buildCallTimelineEvent(enrichedRecord, deal),
    providerStatus: getCallProviderStatus(providerId),
    message: "Call logged locally. Live calling is not active.",
  });
}

export {
  CALL_OUTCOMES,
  buildCallTimelineEvent,
  generateCallTalkingPoints,
  summarizeCallNotes,
  summarizeCallNotesWithAi,
};
