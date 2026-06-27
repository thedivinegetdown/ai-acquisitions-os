import { useEffect, useState } from "react";
import { loadThreadMessages } from "../../../services/conversations";
import { logger } from "../../../services/logging";
import { useCopilotChat } from "../hooks/useCopilotChat";
import { useCopilot } from "../hooks/useCopilot";

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: 12,
};

const EMPTY_TASKS = [];

function Badge({ children }) {
  return (
    <span
      style={{
        background: "#f1f5f9",
        borderRadius: 999,
        color: "#475569",
        fontSize: 12,
        fontWeight: 800,
        padding: "4px 8px",
      }}
    >
      {children}
    </span>
  );
}

function List({ items, emptyText }) {
  if (!items.length) {
    return <p style={{ color: "#64748b", marginBottom: 0 }}>{emptyText}</p>;
  }

  return (
    <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
      {items.slice(0, 5).map((item, index) => (
        <li key={`${item.summary || item}-${index}`}>
          {typeof item === "string" ? item : item.recommendation || item.summary}
        </li>
      ))}
    </ul>
  );
}

function CopyButton({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  const hasText = Boolean(text?.trim?.());

  async function copyText() {
    if (!hasText) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      logger.error("[CopilotPanel] Copy failed", error);
    }
  }

  return (
    <button
      type="button"
      onClick={copyText}
      disabled={!hasText}
      style={{
        border: "1px solid #cbd5e1",
        background: "#ffffff",
        borderRadius: 8,
        color: hasText ? "#334155" : "#94a3b8",
        cursor: hasText ? "pointer" : "not-allowed",
        fontSize: 12,
        fontWeight: 800,
        padding: "7px 9px",
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function SafetyLabels() {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
      <Badge>AI-generated guidance - review before using</Badge>
      <Badge>Internal guidance only</Badge>
      <Badge>Not legal advice</Badge>
      <Badge>Messages are not sent automatically</Badge>
    </div>
  );
}

function MissingDataNotice({ deal, messages, copilot }) {
  const missing = [];

  if (!deal) missing.push("Missing deal context");
  if (!deal?.owner_name && !deal?.seller_name) missing.push("Missing seller data");
  if (!messages.length) missing.push("Missing conversation");
  if (copilot?.fallbackUsed || copilot?.error) {
    missing.push("AI provider unavailable - rule fallback active");
  }

  if (!missing.length) return null;

  return (
    <div
      style={{
        background: "#fffbeb",
        border: "1px solid #fde68a",
        borderRadius: 8,
        color: "#92400e",
        marginBottom: 12,
        padding: 12,
      }}
    >
      <strong>Context gaps</strong>
      <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
        {missing.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default function CopilotPanel({
  deal,
  selectedPhone,
  refreshKey,
  tasks,
}) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!selectedPhone) {
      setMessages([]);
      return;
    }

    loadMessages();
  }, [selectedPhone, refreshKey]);

  async function loadMessages() {
    const result = await loadThreadMessages(selectedPhone);

    if (!result.success) {
      logger.error("[CopilotPanel] Message load failed", result.error);
      setMessages([]);
      return;
    }

    setMessages(result.data);
  }

  const copilot = useCopilot({
    deal,
    messages,
    tasks: tasks || EMPTY_TASKS,
  });
  const chat = useCopilotChat({ copilot, deal, selectedPhone });

  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #dbe3ef",
        borderRadius: 14,
        padding: 18,
        marginBottom: 18,
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              color: "#64748b",
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 4,
              textTransform: "uppercase",
            }}
          >
            AI Acquisition Copilot
          </div>
          <strong style={{ color: "#0f172a", fontSize: 22 }}>
            AI-Assisted Deal Assistant
          </strong>
          <SafetyLabels />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge>{copilot.priority} Priority</Badge>
          <Badge>{copilot.fallbackUsed ? "Rule Fallback" : copilot.source}</Badge>
        </div>
      </div>

      <div style={{ ...cardStyle, marginBottom: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 8,
          }}
        >
          <strong>{copilot.recommendation}</strong>
          <Badge>{copilot.confidence} Confidence</Badge>
        </div>
        <p style={{ color: "#334155", lineHeight: 1.5, marginBottom: 8 }}>
          {copilot.summary}
        </p>
        <CopyButton
          text={`${copilot.recommendation}\n\n${copilot.summary}`}
          label="Copy Guidance"
        />
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Source: {copilot.source} - Category: {copilot.category}
        </div>
        {copilot.loading && (
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 6 }}>
            Checking AI provider...
          </div>
        )}
        {copilot.error && (
          <div style={{ color: "#b45309", fontSize: 13, marginTop: 6 }}>
            AI unavailable: using rule-based fallback.
          </div>
        )}
      </div>

      <MissingDataNotice deal={deal} messages={messages} copilot={copilot} />

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginBottom: 12,
        }}
      >
        <div style={cardStyle}>
          <strong>Prioritized Recommendations</strong>
          <List
            items={copilot.recommendations}
            emptyText="No recommendations yet."
          />
        </div>

        <div style={cardStyle}>
          <strong>Copilot Feed</strong>
          <List items={copilot.feed} emptyText="No insights yet." />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginBottom: 12,
        }}
      >
        <div style={cardStyle}>
          <strong>Daily Agenda</strong>
          <List
            items={[
              ...copilot.agenda.highestPriorityLeads,
              ...copilot.agenda.followUpsDue,
              ...copilot.agenda.contractsNeedingAttention,
              ...copilot.agenda.buyersNeedingContact,
            ]}
            emptyText="Agenda is clear."
          />
        </div>

        <div style={cardStyle}>
          <strong>Deal Timeline</strong>
          {copilot.timeline.length === 0 ? (
            <p style={{ color: "#64748b", marginBottom: 0 }}>
              No timeline events yet.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {copilot.timeline.slice(-5).map((event, index) => (
                <div key={`${event.label}-${index}`}>
                  <strong>{event.label}</strong>
                  <div style={{ color: "#64748b", fontSize: 12 }}>
                    {event.date
                      ? new Date(event.date).toLocaleString()
                      : "No date"}
                  </div>
                  <div style={{ color: "#334155" }}>{event.detail}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ ...cardStyle, marginBottom: 12 }}>
        <strong>Copilot Chat</strong>
        <p style={{ color: "#64748b", margin: "6px 0 10px" }}>
          Ask about next steps, risks, offer strength, objections, or follow-up.
          Drafts are never sent automatically.
        </p>
        <textarea
          value={chat.question}
          onChange={(event) => chat.setQuestion(event.target.value)}
          placeholder="What should I do next?"
          rows={3}
          style={{
            width: "100%",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            padding: 10,
            resize: "vertical",
          }}
        />
        <button
          type="button"
          onClick={() => chat.ask()}
          disabled={chat.loading || !chat.question.trim()}
          style={{
            marginTop: 10,
            padding: "10px 14px",
            border: "1px solid #0f172a",
            borderRadius: 8,
            background: chat.loading || !chat.question.trim() ? "#e5e7eb" : "#0f172a",
            color: chat.loading || !chat.question.trim() ? "#64748b" : "#ffffff",
            cursor: chat.loading || !chat.question.trim() ? "not-allowed" : "pointer",
            fontWeight: 800,
          }}
        >
          {chat.loading ? "Thinking..." : "Ask Copilot"}
        </button>
        {chat.error && (
          <div style={{ color: "#b91c1c", marginTop: 8 }}>
            {chat.error}
            {chat.canRetry && (
              <button
                type="button"
                onClick={chat.retry}
                disabled={chat.loading}
                style={{
                  border: "1px solid #b91c1c",
                  background: "#ffffff",
                  borderRadius: 8,
                  color: "#b91c1c",
                  cursor: chat.loading ? "not-allowed" : "pointer",
                  fontWeight: 800,
                  marginLeft: 10,
                  padding: "6px 9px",
                }}
              >
                Retry
              </button>
            )}
          </div>
        )}
        {chat.answer && (
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              marginTop: 12,
              padding: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <strong>{chat.answer.recommendation}</strong>
              <CopyButton
                text={`${chat.answer.recommendation}\n\n${chat.answer.summary}`}
                label="Copy Response"
              />
            </div>
            <p style={{ color: "#334155", lineHeight: 1.5 }}>
              {chat.answer.summary}
            </p>
            {chat.answer.drafts?.sms && (
              <div style={{ marginTop: 10 }}>
                <strong>Follow-up Draft</strong>
                <textarea
                  defaultValue={Array.isArray(chat.answer.drafts.sms)
                    ? chat.answer.drafts.sms.join("\n\n")
                    : chat.answer.drafts.sms}
                  rows={3}
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    marginTop: 6,
                    padding: 10,
                    resize: "vertical",
                    width: "100%",
                  }}
                />
                <CopyButton
                  text={Array.isArray(chat.answer.drafts.sms)
                    ? chat.answer.drafts.sms.join("\n\n")
                    : chat.answer.drafts.sms}
                  label="Copy Draft"
                />
              </div>
            )}
            {chat.answer.raw?.negotiationScript && (
              <div style={{ marginTop: 10 }}>
                <strong>Negotiation Script</strong>
                <textarea
                  defaultValue={chat.answer.raw.negotiationScript}
                  rows={4}
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    marginTop: 6,
                    padding: 10,
                    resize: "vertical",
                    width: "100%",
                  }}
                />
                <CopyButton
                  text={chat.answer.raw.negotiationScript}
                  label="Copy Script"
                />
              </div>
            )}
            <div style={{ color: "#64748b", fontSize: 12 }}>
              Confidence: {chat.answer.confidence} - Source: {chat.answer.source}
              {chat.answer.fallbackUsed ? " - Rule fallback used" : ""}
            </div>
          </div>
        )}
      </div>

      <div style={{ color: "#64748b", fontSize: 12 }}>
        AI assistance is review-only. No automatic seller communication.
      </div>
    </div>
  );
}
