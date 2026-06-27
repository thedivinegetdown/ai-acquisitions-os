import { useEffect, useMemo, useState } from "react";
import {
  analyzeOfferDraft,
  buildInitialOfferDraft,
  compareOfferScenarios,
  OFFER_TYPES,
} from "../services/offers";
import { formatNonNegativeUsd } from "../utils/currency";

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

function DetailList({ title, items, emptyText }) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

  return (
    <div>
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

function ScenarioCard({ scenario, recommended }) {
  return (
    <div
      style={{
        ...cardStyle,
        border: recommended ? "2px solid #0f172a" : cardStyle.border,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <strong>{scenario.label}</strong>
        <span
          style={{
            background: recommended ? "#0f172a" : "#f1f5f9",
            borderRadius: 999,
            color: recommended ? "#ffffff" : "#475569",
            fontSize: 12,
            fontWeight: 800,
            padding: "4px 8px",
          }}
        >
          {recommended ? "Recommended" : scenario.riskLevel}
        </span>
      </div>

      <div
        style={{
          color: "#334155",
          fontSize: 14,
          lineHeight: 1.5,
          marginBottom: 10,
        }}
      >
        {scenario.recommendedUseCase}
      </div>

      <div
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
          marginBottom: 10,
        }}
      >
        <div>
          <div style={{ color: "#64748b", fontSize: 12 }}>Amount</div>
          <strong>
            {scenario.amount
              ? formatNonNegativeUsd(scenario.amount)
              : "Needs input"}
          </strong>
        </div>
        <div>
          <div style={{ color: "#64748b", fontSize: 12 }}>Confidence</div>
          <strong>{scenario.confidence}</strong>
        </div>
        <div>
          <div style={{ color: "#64748b", fontSize: 12 }}>Risk</div>
          <strong>{scenario.riskLevel}</strong>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        }}
      >
        <DetailList
          title="Pros"
          items={scenario.pros}
          emptyText="No pros available."
        />
        <DetailList
          title="Cons"
          items={scenario.cons}
          emptyText="No cons available."
        />
      </div>
    </div>
  );
}

export default function OfferBuilder({ deal }) {
  const initialDraft = useMemo(() => buildInitialOfferDraft(deal), [deal]);
  const [draft, setDraft] = useState(initialDraft);

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

  const analysis = useMemo(
    () => analyzeOfferDraft({ deal, draft }),
    [deal, draft]
  );
  const comparison = useMemo(
    () => compareOfferScenarios({ deal, draft }),
    [deal, draft]
  );

  function updateDraft(field, value) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
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
            Offer Builder
          </div>
          <strong
            style={{
              color: "#0f172a",
              fontSize: 22,
            }}
          >
            Internal Offer Planning
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
          Internal planning only — not sent to seller.
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
        <Field label="Offer Type">
          <select
            value={draft.offerType}
            onChange={(event) => updateDraft("offerType", event.target.value)}
            style={fieldStyle}
          >
            {Object.entries(OFFER_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Offer Amount">
          <input
            type="number"
            value={draft.amount}
            onChange={(event) => updateDraft("amount", event.target.value)}
            style={fieldStyle}
          />
        </Field>

        <Field label="Down Payment">
          <input
            type="number"
            value={draft.downPayment}
            onChange={(event) => updateDraft("downPayment", event.target.value)}
            style={fieldStyle}
          />
        </Field>

        <Field label="Monthly Payment">
          <input
            type="number"
            value={draft.monthlyPayment}
            onChange={(event) =>
              updateDraft("monthlyPayment", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>

        <Field label="Interest Rate">
          <input
            type="number"
            value={draft.interestRate}
            onChange={(event) =>
              updateDraft("interestRate", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>

        <Field label="Term Length">
          <input
            type="number"
            value={draft.termMonths}
            onChange={(event) => updateDraft("termMonths", event.target.value)}
            placeholder="Months"
            style={fieldStyle}
          />
        </Field>

        <Field label="Closing Timeline">
          <input
            type="text"
            value={draft.closingTimeline}
            onChange={(event) =>
              updateDraft("closingTimeline", event.target.value)
            }
            style={fieldStyle}
          />
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
        <Field label="Notes">
          <textarea
            value={draft.notes}
            onChange={(event) => updateDraft("notes", event.target.value)}
            rows="4"
            style={{
              ...fieldStyle,
              resize: "vertical",
            }}
          />
        </Field>

        <Field label="Internal Rationale">
          <textarea
            value={draft.internalRationale}
            onChange={(event) =>
              updateDraft("internalRationale", event.target.value)
            }
            rows="4"
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
        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: 12 }}>Current Structure</div>
          <strong>{analysis.label}</strong>
        </div>
        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: 12 }}>Confidence</div>
          <strong>{analysis.confidence}</strong>
        </div>
        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: 12 }}>Risk Level</div>
          <strong>{analysis.riskLevel}</strong>
        </div>
        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: 12 }}>Generated</div>
          <strong>{new Date(analysis.generatedAt).toLocaleString()}</strong>
        </div>
      </div>

      <div
        style={{
          ...cardStyle,
          color: "#334155",
          lineHeight: 1.5,
          marginBottom: 12,
        }}
      >
        <strong>Recommended use case:</strong> {analysis.recommendedUseCase}
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
        Offer Scenario Comparison
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
        }}
      >
        {comparison.scenarios.map((scenario) => (
          <ScenarioCard
            key={scenario.offerType}
            scenario={scenario}
            recommended={scenario.offerType === comparison.recommendedType}
          />
        ))}
      </div>
    </div>
  );
}
