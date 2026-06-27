import { useEffect, useMemo, useState } from "react";
import { useDealIntelligence } from "../hooks/useDealIntelligence";
import { analyzeConversation } from "../services/conversationAnalysis";
import { analyzeDeal } from "../services/dealAnalysis";
import { planFollowUp } from "../services/followUpPlanner";
import { prioritizeLead } from "../services/leadPriority";
import { loadThreadMessages } from "../services/conversations";
import {
  analyzeOfferRange,
  analyzeOfferReadiness,
  analyzeOfferStrategy,
} from "../services/offers";

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 12,
};

const sectionStyle = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 14,
};

function MetricCard({ label, value }) {
  return (
    <div style={cardStyle}>
      <div
        style={{
          color: "#64748b",
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <strong>{value ?? "Unknown"}</strong>
    </div>
  );
}

function InlineMetric({ label, value }) {
  return (
    <div>
      <div
        style={{
          color: "#64748b",
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <strong>{value ?? "Unknown"}</strong>
    </div>
  );
}

function DetailList({ title, items, emptyText }) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

  return (
    <div style={sectionStyle}>
      <strong>{title}</strong>
      {safeItems.length === 0 ? (
        <p style={{ marginBottom: 0 }}>{emptyText}</p>
      ) : (
        <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
          {safeItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlainList({ items, emptyText }) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

  if (safeItems.length === 0) {
    return <p style={{ marginBottom: 0 }}>{emptyText}</p>;
  }

  return (
    <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
      {safeItems.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function AIIntelligenceDashboard({
  deal,
  selectedPhone,
  refreshKey,
  tasks = [],
}) {
  const [messages, setMessages] = useState([]);
  const [messageError, setMessageError] = useState("");
  const [draftFollowUp, setDraftFollowUp] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => {
    if (!selectedPhone) {
      setMessages([]);
      setMessageError("");
      return;
    }

    loadMessages();
  }, [selectedPhone, refreshKey]);

  async function loadMessages() {
    const result = await loadThreadMessages(selectedPhone);

    if (!result.success) {
      console.error("[AIIntelligenceDashboard] Message load failed:", result.error);
      setMessages([]);
      setMessageError("Conversation data is unavailable right now.");
      return;
    }

    setMessages(result.data);
    setMessageError("");
  }

  const dealAnalysis = useMemo(() => analyzeDeal(deal), [deal]);
  const conversationAnalysis = useMemo(
    () => analyzeConversation(messages),
    [messages]
  );
  const leadPriority = useMemo(
    () => prioritizeLead({ deal, messages }),
    [deal, messages]
  );
  const followUpPlan = useMemo(
    () => planFollowUp({ deal, messages }),
    [deal, messages]
  );
  const offerReadiness = useMemo(
    () => analyzeOfferReadiness(deal),
    [deal]
  );
  const offerRange = useMemo(() => analyzeOfferRange(deal), [deal]);
  const offerStrategy = useMemo(
    () => analyzeOfferStrategy({ deal, messages }),
    [deal, messages]
  );
  const intelligence = useDealIntelligence({
    deal,
    messages,
    tasks,
    offerReadiness,
    offerRange,
    offerStrategy,
    conversationAnalysis,
    leadPriority,
    followUpPlan,
  });

  useEffect(() => {
    setDraftFollowUp(followUpPlan.suggestedMessage || "");
    setCopyStatus("");
  }, [followUpPlan.suggestedMessage]);

  async function copyFollowUpMessage() {
    setCopyStatus("");

    try {
      await navigator.clipboard.writeText(draftFollowUp);
      setCopyStatus("Copied");
    } catch (error) {
      console.error("[AIIntelligenceDashboard] Copy failed:", error);
      setCopyStatus("Copy failed");
    }
  }

  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #dbe3ef",
        borderRadius: 14,
        padding: 18,
        marginBottom: 18,
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
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
            AI Intelligence Dashboard
          </div>
          <strong
            style={{
              color: "#0f172a",
              fontSize: 22,
            }}
          >
            Acquisition Intelligence
          </strong>
        </div>

        <span
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 999,
            color: "#334155",
            fontSize: 13,
            fontWeight: 800,
            padding: "7px 12px",
          }}
        >
          {intelligence.source} analysis
        </span>
      </div>

      {messageError && (
        <div
          style={{
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: 10,
            color: "#9a3412",
            marginBottom: 12,
            padding: 12,
          }}
        >
          {messageError}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          marginBottom: 12,
        }}
      >
        <MetricCard
          label="Acquisition Score"
          value={`${intelligence.score}/100`}
        />
        <MetricCard label="Confidence" value={intelligence.confidence} />
        <MetricCard
          label="Deal Health Score"
          value={`${dealAnalysis.score}/100`}
        />
        <MetricCard label="Deal Grade" value={dealAnalysis.grade} />
        <MetricCard label="Lead Priority" value={leadPriority.priorityLabel} />
        <MetricCard label="Follow-Up Urgency" value={followUpPlan.urgency} />
        <MetricCard
          label="Recommended Next Action"
          value={leadPriority.suggestedAction}
        />
      </div>

      {!intelligence.summary && !followUpPlan.suggestedMessage ? (
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #dbe3ef",
            borderRadius: 10,
            color: "#334155",
            marginBottom: 12,
            padding: 12,
          }}
        >
          No AI recommendation is available yet. Update seller details or start a conversation to surface guidance.
        </div>
      ) : null}

      <div style={{ ...sectionStyle, marginBottom: 12 }}>
        <strong>Executive Summary</strong>
        <p style={{ color: "#334155", lineHeight: 1.5, marginBottom: 0 }}>
          {intelligence.summary ||
            "Not enough information is available for an executive summary yet."}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginBottom: 12,
        }}
      >
        <DetailList
          title="Strengths"
          items={dealAnalysis.strengths}
          emptyText="No strengths detected yet."
        />
        <DetailList
          title="Weaknesses"
          items={dealAnalysis.weaknesses}
          emptyText="No weaknesses detected yet."
        />
        <DetailList
          title="Risks"
          items={intelligence.risks}
          emptyText="No major risks detected yet."
        />
        <DetailList
          title="Opportunities"
          items={dealAnalysis.opportunities}
          emptyText="No opportunities detected yet."
        />
        <DetailList
          title="Missing Information"
          items={intelligence.missingData}
          emptyText="No major missing information."
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginBottom: 12,
        }}
      >
        <div style={sectionStyle}>
          <strong>Conversation Intelligence</strong>
          <div
            style={{
              display: "grid",
              gap: 8,
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              marginTop: 10,
            }}
          >
            <InlineMetric
              label="Seller Sentiment"
              value={conversationAnalysis.sentiment}
            />
            <InlineMetric
              label="Urgency Level"
              value={conversationAnalysis.urgency}
            />
            <InlineMetric
              label="Engagement Level"
              value={conversationAnalysis.engagement}
            />
          </div>
        </div>

        <DetailList
          title="Detected Intent"
          items={conversationAnalysis.detectedIntent}
          emptyText="No seller intent detected yet."
        />
        <DetailList
          title="Key Phrases"
          items={conversationAnalysis.keyPhrases}
          emptyText="No key phrases detected yet."
        />
        <DetailList
          title="Red Flags"
          items={conversationAnalysis.redFlags}
          emptyText="No red flags detected."
        />
      </div>

      <div style={{ ...sectionStyle, marginBottom: 12 }}>
        <strong>Suggested Communication Tone</strong>
        <p style={{ color: "#334155", lineHeight: 1.5, marginBottom: 0 }}>
          {conversationAnalysis.suggestedTone}
        </p>
      </div>

      <div style={sectionStyle}>
        <strong>Follow-Up Plan</strong>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            marginTop: 12,
            marginBottom: 12,
          }}
        >
          <InlineMetric
            label="Follow-Up Time"
            value={followUpPlan.followUpTime}
          />
          <InlineMetric label="Channel" value={followUpPlan.channel} />
          <InlineMetric
            label="Readiness"
            value={followUpPlan.readinessStatus}
          />
        </div>

        <div
          style={{
            color: "#64748b",
            fontSize: 12,
            fontWeight: 700,
            marginBottom: 6,
            textTransform: "uppercase",
          }}
        >
          Suggested follow-up message
        </div>
        <textarea
          value={draftFollowUp}
          onChange={(event) => setDraftFollowUp(event.target.value)}
          rows="4"
          style={{
            width: "100%",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            padding: 10,
            resize: "vertical",
          }}
        />

        <button
          type="button"
          onClick={copyFollowUpMessage}
          disabled={!draftFollowUp.trim()}
          style={{
            marginTop: 10,
            padding: "8px 12px",
            border: "1px solid #0f172a",
            borderRadius: 8,
            background: draftFollowUp.trim() ? "#0f172a" : "#e5e7eb",
            color: draftFollowUp.trim() ? "#ffffff" : "#64748b",
            cursor: draftFollowUp.trim() ? "pointer" : "not-allowed",
            fontWeight: 700,
          }}
        >
          Copy Message
        </button>

        {copyStatus && (
          <span
            style={{
              color: copyStatus === "Copied" ? "#166534" : "#b91c1c",
              marginLeft: 10,
            }}
          >
            {copyStatus}
          </span>
        )}

        <div
          style={{
            borderTop: "1px solid #e5e7eb",
            marginTop: 14,
            paddingTop: 12,
          }}
        >
          <strong>Reasoning</strong>
          <PlainList
            items={followUpPlan.reasoning}
            emptyText="No follow-up reasoning available yet."
          />
        </div>
      </div>
    </div>
  );
}
