import { useMemo, useState } from "react";
import {
  analyzeManualLead,
  confirmPreviewOnlyImport,
  parseCsvLeadText,
} from "../services/leadIntake";
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

const leadSources = [
  "Direct mail",
  "PPC",
  "SEO",
  "Cold calling",
  "SMS campaign",
  "Referral",
  "Agent",
  "CSV Import",
  "Other",
];

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

function Metric({ label, value }) {
  return (
    <div style={cardStyle}>
      <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>
        {label}
      </div>
      <strong style={{ color: "#0f172a", fontSize: 22 }}>{value}</strong>
    </div>
  );
}

function WarningList({ title, items, emptyText }) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

  return (
    <div style={cardStyle}>
      <strong>{title}</strong>
      {safeItems.length === 0 ? (
        <p style={{ color: "#64748b", marginBottom: 0 }}>{emptyText}</p>
      ) : (
        <ul style={{ color: "#334155", marginBottom: 0, paddingLeft: 18 }}>
          {safeItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function LeadImporter({ deals = [] }) {
  const [manualLead, setManualLead] = useState({
    sellerName: "",
    phone: "",
    email: "",
    propertyAddress: "",
    city: "",
    state: "",
    zip: "",
    leadSource: "Direct mail",
    market: "",
    askingPrice: "",
    notes: "",
  });
  const [analysis, setAnalysis] = useState(null);
  const [confirmation, setConfirmation] = useState("");

  const preview = useMemo(
    () =>
      analysis || {
        parsedLeads: [],
        validLeads: [],
        invalidLeads: [],
        duplicateLeads: [],
        warnings: [],
        summary: "No leads parsed yet.",
        recommendedNextAction: "Add a manual lead or upload a CSV to preview intake.",
      },
    [analysis]
  );

  function updateManualLead(field, value) {
    setManualLead((current) => ({
      ...current,
      [field]: value,
    }));
    setConfirmation("");
  }

  function previewManualLead() {
    setAnalysis(
      analyzeManualLead({
        lead: manualLead,
        existingDeals: deals,
        defaults: {
          leadSource: manualLead.leadSource,
          market: manualLead.market,
        },
      })
    );
    setConfirmation("");
  }

  async function handleCsvFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const csvText = await file.text();
    setAnalysis(
      parseCsvLeadText({
        csvText,
        existingDeals: deals,
        defaults: {
          leadSource: "CSV Import",
          market: manualLead.market,
        },
      })
    );
    setConfirmation("");
  }

  function confirmPreview() {
    const result = confirmPreviewOnlyImport(preview);
    setConfirmation(result.data.message);
  }

  return (
    <section
      style={{
        background: "#f8fafc",
        border: "1px solid #dbe3ef",
        borderRadius: 14,
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
        marginBottom: 24,
        padding: 18,
      }}
    >
      <div
        style={{
          alignItems: "flex-start",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              color: "#64748b",
              fontSize: 13,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            Data Import / Lead Intake
          </div>
          <h2 style={{ color: "#0f172a", margin: "4px 0 0" }}>
            Lead Import / Intake
          </h2>
          <p style={{ color: "#64748b", margin: "6px 0 0" }}>
            Lead intake foundation - review before importing.
          </p>
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
          Preview-only. No database writes.
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          marginBottom: 12,
        }}
      >
        <Field label="Seller Name">
          <input
            value={manualLead.sellerName}
            onChange={(event) => updateManualLead("sellerName", event.target.value)}
            style={fieldStyle}
          />
        </Field>
        <Field label="Phone">
          <input
            value={manualLead.phone}
            onChange={(event) => updateManualLead("phone", event.target.value)}
            style={fieldStyle}
          />
        </Field>
        <Field label="Email">
          <input
            value={manualLead.email}
            onChange={(event) => updateManualLead("email", event.target.value)}
            style={fieldStyle}
          />
        </Field>
        <Field label="Property Address">
          <input
            value={manualLead.propertyAddress}
            onChange={(event) =>
              updateManualLead("propertyAddress", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>
        <Field label="City">
          <input
            value={manualLead.city}
            onChange={(event) => updateManualLead("city", event.target.value)}
            style={fieldStyle}
          />
        </Field>
        <Field label="State">
          <input
            value={manualLead.state}
            onChange={(event) => updateManualLead("state", event.target.value)}
            style={fieldStyle}
          />
        </Field>
        <Field label="Zip">
          <input
            value={manualLead.zip}
            onChange={(event) => updateManualLead("zip", event.target.value)}
            style={fieldStyle}
          />
        </Field>
        <Field label="Lead Source">
          <select
            value={manualLead.leadSource}
            onChange={(event) => updateManualLead("leadSource", event.target.value)}
            style={fieldStyle}
          >
            {leadSources.map((source) => (
              <option key={source}>{source}</option>
            ))}
          </select>
        </Field>
        <Field label="Market">
          <input
            value={manualLead.market}
            onChange={(event) => updateManualLead("market", event.target.value)}
            style={fieldStyle}
          />
        </Field>
        <Field label="Asking Price">
          <input
            type="number"
            value={manualLead.askingPrice}
            onChange={(event) => updateManualLead("askingPrice", event.target.value)}
            style={fieldStyle}
          />
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          value={manualLead.notes}
          onChange={(event) => updateManualLead("notes", event.target.value)}
          rows={3}
          style={{ ...fieldStyle, marginBottom: 12, resize: "vertical" }}
        />
      </Field>

      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          onClick={previewManualLead}
          style={{
            background: "#0f172a",
            border: "1px solid #0f172a",
            borderRadius: 8,
            color: "#ffffff",
            cursor: "pointer",
            fontWeight: 800,
            padding: "10px 14px",
          }}
        >
          Preview Manual Lead
        </button>
        <label
          style={{
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            color: "#334155",
            cursor: "pointer",
            fontWeight: 800,
            padding: "10px 14px",
          }}
        >
          Upload CSV Preview
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleCsvFile}
            style={{ display: "none" }}
          />
        </label>
        <button
          type="button"
          onClick={confirmPreview}
          disabled={preview.parsedLeads.length === 0}
          style={{
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            color: "#334155",
            cursor: preview.parsedLeads.length ? "pointer" : "not-allowed",
            fontWeight: 800,
            padding: "10px 14px",
          }}
        >
          Confirm Reviewed
        </button>
        {confirmation && (
          <span style={{ color: "#15803d", fontSize: 13, fontWeight: 700 }}>
            {confirmation}
          </span>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          marginBottom: 12,
        }}
      >
        <Metric label="Parsed" value={preview.parsedLeads.length} />
        <Metric label="Clean" value={preview.validLeads.length} />
        <Metric label="Invalid" value={preview.invalidLeads.length} />
        <Metric label="Duplicates" value={preview.duplicateLeads.length} />
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginBottom: 12,
        }}
      >
        <WarningList
          title="Validation Warnings"
          items={preview.warnings}
          emptyText="No warnings yet."
        />
        <WarningList
          title="Recommended Next Action"
          items={[preview.recommendedNextAction]}
          emptyText="No action needed."
        />
      </div>

      <div style={cardStyle}>
        <strong>Preview</strong>
        <p style={{ color: "#64748b", margin: "6px 0 10px" }}>
          {preview.summary}
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          {preview.parsedLeads.slice(0, 8).map((lead) => (
            <div
              key={`${lead.rowNumber}-${lead.sellerName}-${lead.propertyAddress}`}
              style={{
                background: lead.valid && !lead.duplicate ? "#f8fafc" : "#fff7ed",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 10,
              }}
            >
              <strong>{lead.sellerName || "Missing seller"}</strong>
              <div style={{ color: "#334155", fontSize: 13, marginTop: 4 }}>
                {lead.propertyAddress || "Missing property address"} |{" "}
                {lead.phone || lead.email || "Missing contact"} |{" "}
                {lead.leadSource || "Missing source"} |{" "}
                {lead.market || "Missing market"}
              </div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                Asking price:{" "}
                {lead.askingPrice ? formatNonNegativeUsd(lead.askingPrice) : "Missing"}
                {lead.warnings?.length ? ` | Warnings: ${lead.warnings.join(", ")}` : ""}
                {lead.duplicateReasons?.length
                  ? ` | Duplicates: ${lead.duplicateReasons.join(", ")}`
                  : ""}
              </div>
            </div>
          ))}
          {preview.parsedLeads.length === 0 && (
            <div style={{ color: "#64748b" }}>
              Add a manual lead or upload a CSV to generate an import preview.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
