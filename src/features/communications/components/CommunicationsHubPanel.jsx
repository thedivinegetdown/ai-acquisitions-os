import { useMemo, useState } from "react";
import {
  COMPOSER_CHANNELS,
  COMMUNICATION_CHANNELS,
} from "../services";
import { useCommunications, useMessageComposer } from "../hooks";
import { createAiEmailDraft, getEmailProviderStatus } from "../../../services/email";
import {
  CALL_OUTCOMES,
  generateCallTalkingPoints,
  getCallProviderStatus,
  summarizeCallNotesWithAi,
} from "../../../services/calling";

const channelLabels = {
  sms: "SMS",
  email: "Email",
  call: "Calls",
  voicemail: "Voicemail",
  note: "Notes",
  ai: "AI Events",
  workflow: "Workflow Events",
  transaction: "Transaction Events",
};

const filterChannels = [
  COMMUNICATION_CHANNELS.SMS,
  COMMUNICATION_CHANNELS.EMAIL,
  COMMUNICATION_CHANNELS.CALL,
  COMMUNICATION_CHANNELS.VOICEMAIL,
  COMMUNICATION_CHANNELS.NOTE,
  COMMUNICATION_CHANNELS.WORKFLOW,
  COMMUNICATION_CHANNELS.AI,
  COMMUNICATION_CHANNELS.TRANSACTION,
];

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 14,
};

const labelStyle = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
};

function Metric({ label, value }) {
  return (
    <div style={cardStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={{ color: "#0f172a", fontSize: 20, fontWeight: 800, marginTop: 4 }}>
        {value}
      </div>
    </div>
  );
}

function CommunicationCard({ event }) {
  const directionColor =
    event.direction === "inbound"
      ? "#0369a1"
      : event.direction === "outbound"
        ? "#15803d"
        : "#7c3aed";

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <span
              style={{
                background: "#f1f5f9",
                border: "1px solid #e2e8f0",
                borderRadius: 999,
                color: "#334155",
                fontSize: 12,
                fontWeight: 700,
                padding: "4px 8px",
              }}
            >
              {channelLabels[event.channel] || event.channel}
            </span>
            <span
              style={{
                background: "#ffffff",
                border: `1px solid ${directionColor}`,
                borderRadius: 999,
                color: directionColor,
                fontSize: 12,
                fontWeight: 700,
                padding: "4px 8px",
                textTransform: "capitalize",
              }}
            >
              {event.direction}
            </span>
            <span
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 999,
                color: "#475569",
                fontSize: 12,
                fontWeight: 700,
                padding: "4px 8px",
              }}
            >
              {event.status}
            </span>
          </div>
          <div style={{ color: "#0f172a", fontWeight: 800 }}>
            {event.sender || "Unknown Sender"}
          </div>
        </div>
        <div style={{ color: "#64748b", fontSize: 12, textAlign: "right" }}>
          {event.formattedTimestamp}
        </div>
      </div>

      <p style={{ color: "#334155", margin: "10px 0 8px", lineHeight: 1.5 }}>
        {event.body || "No message body available."}
      </p>

      <div
        style={{
          color: "#64748b",
          fontSize: 12,
          display: "grid",
          gap: 4,
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        }}
      >
        <span>Related deal: {event.relatedDealId || "Unlinked"}</span>
        <span>Related workflow: {event.relatedWorkflowId || "None"}</span>
        <span>AI summary: {event.summary || "Pending"}</span>
      </div>
    </div>
  );
}

function ChannelToggle({ channel, active, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(channel)}
      style={{
        border: active ? "1px solid #0f172a" : "1px solid #cbd5e1",
        background: active ? "#0f172a" : "#ffffff",
        color: active ? "#ffffff" : "#334155",
        borderRadius: 999,
        padding: "7px 10px",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {channelLabels[channel] || channel}
    </button>
  );
}

export default function CommunicationsHubPanel({
  deal,
  selectedPhone,
  refreshKey = 0,
  onSent,
}) {
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [copyStatus, setCopyStatus] = useState("");
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const [callAiLoading, setCallAiLoading] = useState(false);
  const communications = useCommunications({
    phone: selectedPhone || deal?.phone,
    deal,
    refreshKey: `${refreshKey}-${localRefreshKey}`,
  });
  const composer = useMessageComposer({
    phone: selectedPhone || deal?.phone,
    deal,
    onLocalEvent: communications.addLocalEvent,
    onSent: () => {
      setLocalRefreshKey((current) => current + 1);
      onSent?.();
    },
  });

  const submitLabel = useMemo(() => {
    if (composer.draft.channel === COMPOSER_CHANNELS.SMS) return "Send SMS";
    if (composer.draft.channel === COMPOSER_CHANNELS.NOTE) return "Add Note";
    if (composer.draft.channel === COMPOSER_CHANNELS.EMAIL) return "Prepare Email Draft";
    if (composer.draft.channel === COMPOSER_CHANNELS.CALL) return "Log Call";
    return "Prepare Template";
  }, [composer.draft.channel]);
  const emailProviderStatus = useMemo(() => getEmailProviderStatus(), []);
  const callProviderStatus = useMemo(() => getCallProviderStatus(), []);

  async function copyDraftToClipboard() {
    const text = [
      composer.draft.subject ? `Subject: ${composer.draft.subject}` : "",
      composer.draft.body,
    ]
      .filter(Boolean)
      .join("\n\n");

    if (!text.trim()) return;

    await navigator.clipboard?.writeText(text);
    setCopyStatus("Draft copied.");
    window.setTimeout(() => setCopyStatus(""), 1800);
  }

  async function handleAiEmailDraft() {
    setAiDraftLoading(true);
    try {
      const result = await createAiEmailDraft({
        deal,
        messages: communications.messages,
        to: composer.draft.to,
      });

      if (result.success) {
        composer.updateDraft({
          channel: COMPOSER_CHANNELS.EMAIL,
          subject: result.data.subject,
          body: result.data.body,
          to: result.data.to,
        });
      }
    } finally {
      setAiDraftLoading(false);
    }
  }

  async function handleAiCallTalkingPoints() {
    setCallAiLoading(true);
    try {
      const result = await generateCallTalkingPoints({
        deal,
        messages: communications.messages,
      });

      composer.updateDraft({
        channel: COMPOSER_CHANNELS.CALL,
        body: result.talkingPoints?.join("\n") || result.summary,
      });
    } finally {
      setCallAiLoading(false);
    }
  }

  async function handleAiCallSummary() {
    setCallAiLoading(true);
    try {
      const result = await summarizeCallNotesWithAi({
        notes: composer.draft.body,
        outcome: composer.draft.outcome,
        deal,
      });

      composer.updateDraft({
        channel: COMPOSER_CHANNELS.CALL,
        body: [
          composer.draft.body,
          "",
          `AI summary: ${result.summary}`,
          result.objections?.length
            ? `Objections: ${result.objections.join(", ")}`
            : "",
          `Recommended next action: ${result.recommendedNextAction}`,
        ]
          .filter(Boolean)
          .join("\n"),
      });
    } finally {
      setCallAiLoading(false);
    }
  }

  return (
    <section
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 18,
        marginTop: 18,
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div>
          <div style={labelStyle}>Unified Communications Hub</div>
          <h3 style={{ color: "#0f172a", margin: "4px 0 0", fontSize: 20 }}>
            Seller Interaction Timeline
          </h3>
          <p style={{ color: "#64748b", margin: "6px 0 0" }}>
            Centralized communication history. SMS is active; other channels are
            provider-ready and not sent automatically.
          </p>
          <p style={{ color: "#9a3412", fontWeight: 800, margin: "6px 0 0" }}>
            Email foundation only - live email sending is not active yet.
          </p>
          <p style={{ color: "#9a3412", fontWeight: 800, margin: "6px 0 0" }}>
            Calling foundation only - live calling is not active yet.
          </p>
        </div>
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 999,
            color: "#334155",
            fontSize: 12,
            fontWeight: 800,
            padding: "8px 12px",
            alignSelf: "flex-start",
          }}
        >
          {communications.visibleCount} of {communications.totalCount} shown
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <Metric label="Messages Sent" value={communications.analytics.messagesSent} />
        <Metric
          label="Messages Received"
          value={communications.analytics.messagesReceived}
        />
        <Metric
          label="Avg Response"
          value={communications.analytics.averageResponseLabel}
        />
        <Metric label="Response Rate" value={communications.analytics.responseRateLabel} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div style={{ ...cardStyle, display: "grid", gap: 10 }}>
          <div style={labelStyle}>Search</div>
          <input
            value={communications.query}
            onChange={(event) => communications.setQuery(event.target.value)}
            placeholder="Seller, phone, deal, date, keyword, type"
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "10px 12px",
              width: "100%",
            }}
          />
          <select
            value={communications.filters.direction}
            onChange={(event) =>
              communications.setFilters((current) => ({
                ...current,
                direction: event.target.value,
              }))
            }
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "10px 12px",
              width: "100%",
            }}
          >
            <option value="all">All directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
            <option value="internal">Internal</option>
            <option value="system">System</option>
          </select>
          <button
            type="button"
            onClick={communications.clearFilters}
            style={{
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 8,
              color: "#334155",
              cursor: "pointer",
              fontWeight: 700,
              padding: "9px 12px",
            }}
          >
            Clear Filters
          </button>
        </div>

        <div style={{ ...cardStyle, display: "grid", gap: 10 }}>
          <div style={labelStyle}>Filters</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {filterChannels.map((channel) => (
              <ChannelToggle
                key={channel}
                channel={channel}
                active={communications.filters.channels.includes(channel)}
                onToggle={communications.toggleChannel}
              />
            ))}
          </div>
          <input
            type="date"
            value={communications.filters.date}
            onChange={(event) =>
              communications.setFilters((current) => ({
                ...current,
                date: event.target.value,
              }))
            }
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "10px 12px",
              width: "100%",
            }}
          />
        </div>
      </div>

      <div
        style={{
          ...cardStyle,
          display: "grid",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div style={labelStyle}>Communication Composer</div>
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            color: "#334155",
            fontSize: 13,
            padding: 10,
          }}
        >
          Future email provider status: {emailProviderStatus.label}.{" "}
          {emailProviderStatus.message}
          <br />
          Future calling provider status: {callProviderStatus.label}.{" "}
          {callProviderStatus.message}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
          }}
        >
          <select
            value={composer.draft.channel}
            onChange={(event) =>
              composer.updateDraft({ channel: event.target.value })
            }
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "10px 12px",
              width: "100%",
            }}
          >
            <option value={COMPOSER_CHANNELS.SMS}>SMS</option>
            <option value={COMPOSER_CHANNELS.EMAIL}>Email later</option>
            <option value={COMPOSER_CHANNELS.CALL}>Log call</option>
            <option value={COMPOSER_CHANNELS.NOTE}>Internal note</option>
            <option value={COMPOSER_CHANNELS.TEMPLATE}>Template draft</option>
          </select>
          <input
            value={composer.draft.to}
            onChange={(event) => composer.updateDraft({ to: event.target.value })}
            placeholder={
              composer.draft.channel === COMPOSER_CHANNELS.EMAIL
                ? "Recipient email"
                : composer.draft.channel === COMPOSER_CHANNELS.CALL
                  ? "Seller phone"
                : "Recipient phone"
            }
            disabled={
              ![
                COMPOSER_CHANNELS.SMS,
                COMPOSER_CHANNELS.EMAIL,
                COMPOSER_CHANNELS.CALL,
              ].includes(composer.draft.channel)
            }
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "10px 12px",
              width: "100%",
              background:
                [
                  COMPOSER_CHANNELS.SMS,
                  COMPOSER_CHANNELS.EMAIL,
                  COMPOSER_CHANNELS.CALL,
                ].includes(composer.draft.channel)
                  ? "#ffffff"
                  : "#f8fafc",
            }}
          />
        </div>
        {composer.draft.channel === COMPOSER_CHANNELS.EMAIL && (
          <input
            value={composer.draft.subject}
            onChange={(event) =>
              composer.updateDraft({ subject: event.target.value })
            }
            placeholder="Email subject"
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "10px 12px",
              width: "100%",
            }}
          />
        )}
        {composer.draft.channel === COMPOSER_CHANNELS.CALL && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
            }}
          >
            <select
              value={composer.draft.outcome}
              onChange={(event) =>
                composer.updateDraft({ outcome: event.target.value })
              }
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "10px 12px",
                width: "100%",
              }}
            >
              {CALL_OUTCOMES.map((outcome) => (
                <option key={outcome}>{outcome}</option>
              ))}
            </select>
            <input
              type="date"
              value={composer.draft.nextCallDate}
              onChange={(event) =>
                composer.updateDraft({ nextCallDate: event.target.value })
              }
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "10px 12px",
                width: "100%",
              }}
            />
          </div>
        )}
        <textarea
          value={composer.draft.body}
          onChange={(event) => composer.updateDraft({ body: event.target.value })}
          placeholder={
            composer.draft.channel === COMPOSER_CHANNELS.CALL
              ? "Add call notes, objections, seller motivation, and follow-up details"
              : "Write an SMS, internal note, or future channel draft"
          }
          rows={4}
          style={{
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            padding: "10px 12px",
            resize: "vertical",
            width: "100%",
          }}
        />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            onClick={composer.submitDraft}
            disabled={composer.sending || !composer.draft.body.trim()}
            style={{
              border: "1px solid #0f172a",
              background:
                composer.sending || !composer.draft.body.trim()
                  ? "#e5e7eb"
                  : "#0f172a",
              borderRadius: 8,
              color:
                composer.sending || !composer.draft.body.trim()
                  ? "#64748b"
                  : "#ffffff",
              cursor:
                composer.sending || !composer.draft.body.trim()
                  ? "not-allowed"
                  : "pointer",
              fontWeight: 800,
              padding: "10px 14px",
            }}
          >
            {composer.sending ? "Working..." : submitLabel}
          </button>
          {composer.draft.channel === COMPOSER_CHANNELS.EMAIL && (
            <button
              type="button"
              onClick={handleAiEmailDraft}
              disabled={aiDraftLoading}
              style={{
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                borderRadius: 8,
                color: "#334155",
                cursor: aiDraftLoading ? "not-allowed" : "pointer",
                fontWeight: 800,
                padding: "10px 14px",
              }}
            >
              {aiDraftLoading ? "Drafting..." : "AI email draft"}
            </button>
          )}
          {composer.draft.channel === COMPOSER_CHANNELS.CALL && (
            <>
              <button
                type="button"
                onClick={handleAiCallTalkingPoints}
                disabled={callAiLoading}
                style={{
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  borderRadius: 8,
                  color: "#334155",
                  cursor: callAiLoading ? "not-allowed" : "pointer",
                  fontWeight: 800,
                  padding: "10px 14px",
                }}
              >
                {callAiLoading ? "Preparing..." : "AI talking points"}
              </button>
              <button
                type="button"
                onClick={handleAiCallSummary}
                disabled={callAiLoading || !composer.draft.body.trim()}
                style={{
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  borderRadius: 8,
                  color: "#334155",
                  cursor:
                    callAiLoading || !composer.draft.body.trim()
                      ? "not-allowed"
                      : "pointer",
                  fontWeight: 800,
                  padding: "10px 14px",
                }}
              >
                {callAiLoading ? "Summarizing..." : "AI summarize notes"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={copyDraftToClipboard}
            disabled={!composer.draft.body.trim()}
            style={{
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 8,
              color: "#334155",
              cursor: composer.draft.body.trim() ? "pointer" : "not-allowed",
              fontWeight: 800,
              padding: "10px 14px",
            }}
          >
            Copy draft
          </button>
          {copyStatus && (
            <span style={{ color: "#15803d", fontSize: 13, fontWeight: 700 }}>
              {copyStatus}
            </span>
          )}
          {composer.statusMessage && (
            <span style={{ color: "#15803d", fontSize: 13, fontWeight: 700 }}>
              {composer.statusMessage}
            </span>
          )}
          {composer.error && (
            <span style={{ color: "#b91c1c", fontSize: 13, fontWeight: 700 }}>
              {composer.error}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {communications.loading ? (
          <div style={cardStyle}>Loading communications...</div>
        ) : communications.error ? (
          <div style={{ ...cardStyle, color: "#b91c1c" }}>
            {communications.error}
          </div>
        ) : communications.filteredTimeline.length === 0 ? (
          <div style={cardStyle}>
            No communications match the current search and filters.
          </div>
        ) : (
          communications.filteredTimeline.map((event) => (
            <CommunicationCard key={event.id} event={event} />
          ))
        )}
      </div>
    </section>
  );
}
