import { normalizePhone } from "../../utils/phone";
import { safeTrim } from "../../utils/text";

export const CALL_OUTCOMES = [
  "Connected",
  "No answer",
  "Left voicemail",
  "Call back requested",
  "Not interested",
  "Wrong number",
  "Needs follow-up",
];

export function normalizeCallRecord({
  phone = "",
  direction = "outbound",
  status = "logged",
  outcome = "Connected",
  notes = "",
  nextCallDate = "",
  durationSeconds = null,
  deal = null,
  provider = "manual",
} = {}) {
  const noteBody = safeTrim(notes);
  const createdAt = new Date().toISOString();

  return {
    id: `call-${Date.now()}`,
    phone: normalizePhone(phone || deal?.phone),
    direction,
    status,
    outcome: safeTrim(outcome) || "Connected",
    notes: noteBody
      ? [
          {
            id: `call-note-${Date.now()}`,
            body: noteBody,
            createdAt,
            author: "Team",
          },
        ]
      : [],
    nextCallDate: safeTrim(nextCallDate),
    durationSeconds,
    relatedDealId: deal?.id || deal?.deal_id || null,
    createdAt,
    provider,
  };
}

export function buildCallTimelineEvent(callRecord = {}, deal = null) {
  const noteText = callRecord.notes?.map((note) => note.body).join(" ") || "";
  const nextCallText = callRecord.nextCallDate
    ? ` Next call: ${callRecord.nextCallDate}.`
    : "";

  return {
    id: callRecord.id || `call-event-${Date.now()}`,
    channel: "call",
    direction: callRecord.direction || "outbound",
    timestamp: callRecord.createdAt || new Date().toISOString(),
    formattedTimestamp: new Date(
      callRecord.createdAt || Date.now()
    ).toLocaleDateString(),
    sender: callRecord.direction === "inbound" ? "Seller" : "Team",
    status: callRecord.status || "logged",
    body: `Outcome: ${callRecord.outcome || "Logged"}. ${noteText}${nextCallText}`.trim(),
    summary:
      callRecord.summary?.summary ||
      "Call note logged. AI call summary can be reviewed before next action.",
    relatedDealId: callRecord.relatedDealId || deal?.id || null,
    relatedWorkflowId: null,
    sellerName: deal?.owner_name || deal?.seller_name || "",
    phone: callRecord.phone || deal?.phone || "",
    normalizedPhone: normalizePhone(callRecord.phone || deal?.phone),
    metadata: { callRecord },
    source: "call_foundation",
  };
}
