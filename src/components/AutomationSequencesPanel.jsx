import { useEffect, useMemo, useState } from "react";
import {
  analyzeAutomationPlan,
  SEQUENCE_CHANNELS,
  SEQUENCE_STATUSES,
  SEQUENCE_TYPES,
} from "../services/automation";
import { loadThreadMessages } from "../services/conversations";

const fieldStyle = {
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: 10,
  width: "100%",
};

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 12,
};

function Field({ label, children }) {
  return (
    <label>
      <div
        style={{
          color: "#64748b",
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      {children}
    </label>
  );
}

function MetricCard({ label, value }) {
  return (
    <div style={cardStyle}>
      <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>
        {label}
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function DetailList({ title, items, emptyText }) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

  return (
    <div style={cardStyle}>
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

const initialDraft = {
  sequenceName: "",
  sequenceType: "Cold lead follow-up",
  sequenceStatus: "Draft",
  nextStep: "",
  nextFollowUpDate: "",
  preferredChannel: "SMS",
  notes: "",
};

export default function AutomationSequencesPanel({
  deal,
  selectedPhone,
  refreshKey,
}) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState(initialDraft);
  const [editableStepText, setEditableStepText] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

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
      console.error("[AutomationSequencesPanel] Message load failed:", result.error);
      setMessages([]);
      return;
    }

    setMessages(result.data);
  }

  const analysis = useMemo(
    () =>
      analyzeAutomationPlan({
        deal,
        messages,
        sequenceDraft: draft,
      }),
    [deal, messages, draft]
  );

  useEffect(() => {
    setEditableStepText(analysis.steps[0]?.description || "");
    setCopyStatus("");
  }, [analysis.steps]);

  function updateDraft(field, value) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function copyStepText() {
    setCopyStatus("");

    try {
      await navigator.clipboard.writeText(editableStepText);
      setCopyStatus("Copied");
    } catch (error) {
      console.error("[AutomationSequencesPanel] Copy failed:", error);
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
            Automation / Follow-Up Sequences
          </div>
          <strong style={{ color: "#0f172a", fontSize: 22 }}>
            Internal Sequence Planning
          </strong>
        </div>

        <span
          style={{
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: 999,
            color: "#9a3412",
            fontSize: 13,
            fontWeight: 800,
            padding: "7px 12px",
          }}
        >
          Automation planning only - messages are not sent automatically.
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          marginBottom: 12,
        }}
      >
        <Field label="Sequence Name">
          <input
            value={draft.sequenceName}
            onChange={(event) => updateDraft("sequenceName", event.target.value)}
            placeholder={analysis.recommendedSequence}
            style={fieldStyle}
          />
        </Field>

        <Field label="Sequence Type">
          <select
            value={draft.sequenceType}
            onChange={(event) => updateDraft("sequenceType", event.target.value)}
            style={fieldStyle}
          >
            {SEQUENCE_TYPES.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </Field>

        <Field label="Sequence Status">
          <select
            value={draft.sequenceStatus}
            onChange={(event) =>
              updateDraft("sequenceStatus", event.target.value)
            }
            style={fieldStyle}
          >
            {SEQUENCE_STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </Field>

        <Field label="Next Follow-Up Date">
          <input
            type="date"
            value={draft.nextFollowUpDate}
            onChange={(event) =>
              updateDraft("nextFollowUpDate", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>

        <Field label="Preferred Channel">
          <select
            value={draft.preferredChannel}
            onChange={(event) =>
              updateDraft("preferredChannel", event.target.value)
            }
            style={fieldStyle}
          >
            {SEQUENCE_CHANNELS.map((channel) => (
              <option key={channel}>{channel}</option>
            ))}
          </select>
        </Field>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
          marginBottom: 12,
        }}
      >
        <Field label="Next Step">
          <textarea
            value={draft.nextStep}
            onChange={(event) => updateDraft("nextStep", event.target.value)}
            rows="3"
            style={{
              ...fieldStyle,
              resize: "vertical",
            }}
          />
        </Field>

        <Field label="Notes">
          <textarea
            value={draft.notes}
            onChange={(event) => updateDraft("notes", event.target.value)}
            rows="3"
            style={{
              ...fieldStyle,
              resize: "vertical",
            }}
          />
        </Field>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          marginBottom: 12,
        }}
      >
        <MetricCard label="Recommended Sequence" value={analysis.sequenceType} />
        <MetricCard label="Urgency" value={analysis.urgency} />
        <MetricCard label="Channel" value={analysis.recommendedChannel} />
        <MetricCard label="Next Date" value={analysis.nextFollowUpDate} />
      </div>

      <div
        style={{
          ...cardStyle,
          color: "#334155",
          lineHeight: 1.5,
          marginBottom: 12,
        }}
      >
        <strong>Summary:</strong> {analysis.summary}
      </div>

      <div
        style={{
          ...cardStyle,
          marginBottom: 12,
        }}
      >
        <strong>Editable suggested message/task</strong>
        <textarea
          value={editableStepText}
          onChange={(event) => setEditableStepText(event.target.value)}
          rows="4"
          style={{
            ...fieldStyle,
            resize: "vertical",
            marginTop: 8,
          }}
        />
        <button
          type="button"
          onClick={copyStepText}
          disabled={!editableStepText.trim()}
          style={{
            marginTop: 10,
            padding: "8px 12px",
            border: "1px solid #0f172a",
            borderRadius: 8,
            background: editableStepText.trim() ? "#0f172a" : "#e5e7eb",
            color: editableStepText.trim() ? "#ffffff" : "#64748b",
            cursor: editableStepText.trim() ? "pointer" : "not-allowed",
            fontWeight: 700,
          }}
        >
          Copy
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
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginBottom: 12,
        }}
      >
        <DetailList
          title="Risks"
          items={analysis.risks}
          emptyText="No sequence risks detected yet."
        />
        <DetailList
          title="Missing Data"
          items={analysis.missingData}
          emptyText="No missing automation planning fields."
        />
        <DetailList
          title="Recommended Next Action"
          items={[analysis.recommendedNextAction]}
          emptyText="No next action available."
        />
      </div>

      <div
        style={{
          color: "#64748b",
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 10,
          textTransform: "uppercase",
        }}
      >
        Sequence Step Preview
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
        }}
      >
        {analysis.steps.map((step) => (
          <div key={step.stepNumber} style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                alignItems: "flex-start",
                flexWrap: "wrap",
                marginBottom: 8,
              }}
            >
              <strong>Step {step.stepNumber}</strong>
              <span
                style={{
                  background: step.status === "Ready" ? "#dbeafe" : "#f1f5f9",
                  borderRadius: 999,
                  color: step.status === "Ready" ? "#1d4ed8" : "#475569",
                  fontSize: 12,
                  fontWeight: 800,
                  padding: "4px 8px",
                }}
              >
                {step.status}
              </span>
            </div>
            <div style={{ color: "#334155", lineHeight: 1.5 }}>
              {step.timing} - {step.channel}
            </div>
            <div style={{ color: "#475569", marginTop: 4 }}>
              {step.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
