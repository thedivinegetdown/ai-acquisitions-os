import { useMemo, useState } from "react";
import { analyzeDisposition, BUYER_TYPES } from "../services/buyers";
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

const emptyBuyer = {
  name: "",
  buyerType: "Cash buyer",
  targetMarkets: "",
  maxPurchasePrice: "",
  preferredPropertyType: "",
  preferredCondition: "",
  minBeds: "",
  minBaths: "",
  buyBoxNotes: "",
  fundingProofStatus: "Unknown",
  lastContactDate: "",
  notes: "",
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

function PlainList({ title, items, emptyText }) {
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

export default function BuyerDispositionsPanel({ deal }) {
  const [buyers, setBuyers] = useState([]);
  const [form, setForm] = useState(emptyBuyer);
  const [exitStrategy, setExitStrategy] = useState("Wholesale");
  const analysis = useMemo(
    () => analyzeDisposition({ deal, buyers, exitStrategy }),
    [deal, buyers, exitStrategy]
  );

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function addBuyer(event) {
    event.preventDefault();

    if (!form.name.trim()) return;

    setBuyers((current) => [
      ...current,
      {
        ...form,
        id: `${Date.now()}-${form.name}`,
      },
    ]);
    setForm(emptyBuyer);
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
            Buyer CRM + Dispositions
          </div>
          <strong style={{ color: "#0f172a", fontSize: 22 }}>
            Internal Buyer Matching
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
          Internal/manual buyer matching only.
        </span>
      </div>

      <form onSubmit={addBuyer}>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            marginBottom: 12,
          }}
        >
          <Field label="Buyer Name">
            <input
              value={form.name}
              onChange={(event) => updateForm("name", event.target.value)}
              style={fieldStyle}
              required
            />
          </Field>

          <Field label="Buyer Type">
            <select
              value={form.buyerType}
              onChange={(event) => updateForm("buyerType", event.target.value)}
              style={fieldStyle}
            >
              {BUYER_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </Field>

          <Field label="Target Markets">
            <input
              value={form.targetMarkets}
              onChange={(event) =>
                updateForm("targetMarkets", event.target.value)
              }
              placeholder="City, zip, county"
              style={fieldStyle}
            />
          </Field>

          <Field label="Max Purchase Price">
            <input
              type="number"
              value={form.maxPurchasePrice}
              onChange={(event) =>
                updateForm("maxPurchasePrice", event.target.value)
              }
              style={fieldStyle}
            />
          </Field>

          <Field label="Property Type">
            <input
              value={form.preferredPropertyType}
              onChange={(event) =>
                updateForm("preferredPropertyType", event.target.value)
              }
              style={fieldStyle}
            />
          </Field>

          <Field label="Condition">
            <select
              value={form.preferredCondition}
              onChange={(event) =>
                updateForm("preferredCondition", event.target.value)
              }
              style={fieldStyle}
            >
              <option value="">Any</option>
              <option>Excellent</option>
              <option>Good</option>
              <option>Fair</option>
              <option>Poor</option>
            </select>
          </Field>

          <Field label="Minimum Beds">
            <input
              type="number"
              value={form.minBeds}
              onChange={(event) => updateForm("minBeds", event.target.value)}
              style={fieldStyle}
            />
          </Field>

          <Field label="Minimum Baths">
            <input
              type="number"
              value={form.minBaths}
              onChange={(event) => updateForm("minBaths", event.target.value)}
              style={fieldStyle}
            />
          </Field>

          <Field label="Funding Proof">
            <select
              value={form.fundingProofStatus}
              onChange={(event) =>
                updateForm("fundingProofStatus", event.target.value)
              }
              style={fieldStyle}
            >
              <option>Unknown</option>
              <option>Requested</option>
              <option>Verified</option>
              <option>Expired</option>
            </select>
          </Field>

          <Field label="Last Contact Date">
            <input
              type="date"
              value={form.lastContactDate}
              onChange={(event) =>
                updateForm("lastContactDate", event.target.value)
              }
              style={fieldStyle}
            />
          </Field>

          <Field label="Deal Exit Strategy">
            <select
              value={exitStrategy}
              onChange={(event) => setExitStrategy(event.target.value)}
              style={fieldStyle}
            >
              <option>Wholesale</option>
              <option>Fix and flip</option>
              <option>Buy and hold</option>
              <option>Seller finance</option>
              <option>Subject-to</option>
              <option>Pass / review manually</option>
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
          <Field label="Buy Box Notes">
            <textarea
              value={form.buyBoxNotes}
              onChange={(event) =>
                updateForm("buyBoxNotes", event.target.value)
              }
              rows="3"
              style={{
                ...fieldStyle,
                resize: "vertical",
              }}
            />
          </Field>

          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              rows="3"
              style={{
                ...fieldStyle,
                resize: "vertical",
              }}
            />
          </Field>
        </div>

        <button
          type="submit"
          disabled={!form.name.trim()}
          style={{
            padding: "10px 14px",
            border: "1px solid #0f172a",
            borderRadius: 8,
            background: form.name.trim() ? "#0f172a" : "#e5e7eb",
            color: form.name.trim() ? "#ffffff" : "#64748b",
            cursor: form.name.trim() ? "pointer" : "not-allowed",
            fontWeight: 700,
            marginBottom: 14,
          }}
        >
          Add Manual Buyer
        </button>
      </form>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          marginBottom: 12,
        }}
      >
        <MetricCard label="Buyer Demand" value={analysis.buyerDemandLevel} />
        <MetricCard label="Match Score" value={`${analysis.matchScore}/100`} />
        <MetricCard
          label="Wholesale Potential"
          value={analysis.wholesalePotential}
        />
        <MetricCard label="Assignment Risk" value={analysis.assignmentRisk} />
        <MetricCard
          label="Disposition Strategy"
          value={analysis.recommendedDispositionStrategy}
        />
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
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginBottom: 12,
        }}
      >
        <DetailList
          title="Suggested Marketing Angle"
          items={[analysis.suggestedMarketingAngle]}
          emptyText="No marketing angle available yet."
        />
        <DetailList
          title="Next Disposition Action"
          items={[analysis.recommendedNextDispositionAction]}
          emptyText="No disposition action available yet."
        />
        <DetailList
          title="Risks"
          items={analysis.risks}
          emptyText="No major disposition risks detected yet."
        />
        <DetailList
          title="Missing Data"
          items={analysis.missingData}
          emptyText="No major buyer/disposition data gaps."
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
        Matched Buyers
      </div>

      {buyers.length === 0 ? (
        <div
          style={{
            ...cardStyle,
            color: "#475569",
          }}
        >
          No manual buyers added yet. Add a buyer above to evaluate match fit.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 10,
          }}
        >
          {analysis.matchedBuyers.map((match) => (
            <div key={match.buyer.id} style={cardStyle}>
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
                <div>
                  <strong>{match.buyer.name}</strong>
                  <div style={{ color: "#64748b", fontSize: 12 }}>
                    {match.buyer.buyerType} - Max{" "}
                    {match.buyer.maxPurchasePrice
                      ? formatNonNegativeUsd(match.buyer.maxPurchasePrice)
                      : "Any"}
                  </div>
                </div>
                <strong>{match.matchScore}/100</strong>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                }}
              >
                <PlainList
                  title="Match Reasons"
                  items={match.matchReasons}
                  emptyText="No match reasons available."
                />
                <PlainList
                  title="Mismatch Reasons"
                  items={match.mismatchReasons}
                  emptyText="No major mismatches detected."
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
