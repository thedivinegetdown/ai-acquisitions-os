import { useEffect, useMemo, useState } from "react";
import {
  analyzeDocumentReadiness,
  buildInitialDocumentState,
  DOCUMENT_STATUSES,
} from "../services/documents";

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

function StatusField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <select value={value} onChange={onChange} style={fieldStyle}>
        {DOCUMENT_STATUSES.map((status) => (
          <option key={status}>{status}</option>
        ))}
      </select>
    </Field>
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

function ChecklistItem({ item }) {
  return (
    <div
      style={{
        ...cardStyle,
        color: item.complete ? "#166534" : "#475569",
      }}
    >
      <strong>{item.complete ? "Complete" : "Open"}</strong>
      <div style={{ color: "#0f172a", marginTop: 4 }}>{item.label}</div>
    </div>
  );
}

export default function DocumentContractPrepPanel({ deal }) {
  const initialDocuments = useMemo(
    () => buildInitialDocumentState(deal),
    [deal]
  );
  const [documents, setDocuments] = useState(initialDocuments);

  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  const analysis = useMemo(
    () => analyzeDocumentReadiness(documents),
    [documents]
  );

  function updateDocument(field, value) {
    setDocuments((current) => ({
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
            Documents / Contract Prep
          </div>
          <strong style={{ color: "#0f172a", fontSize: 22 }}>
            Internal Document Preparation
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
          Internal preparation only - not legal advice.
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
        <StatusField
          label="Purchase Agreement"
          value={documents.purchaseAgreementStatus}
          onChange={(event) =>
            updateDocument("purchaseAgreementStatus", event.target.value)
          }
        />
        <StatusField
          label="Assignment Agreement"
          value={documents.assignmentAgreementStatus}
          onChange={(event) =>
            updateDocument("assignmentAgreementStatus", event.target.value)
          }
        />
        <StatusField
          label="Seller Disclosures"
          value={documents.sellerDisclosuresStatus}
          onChange={(event) =>
            updateDocument("sellerDisclosuresStatus", event.target.value)
          }
        />
        <StatusField
          label="Title Documents"
          value={documents.titleDocumentsStatus}
          onChange={(event) =>
            updateDocument("titleDocumentsStatus", event.target.value)
          }
        />
        <StatusField
          label="Proof of Funds"
          value={documents.proofOfFundsStatus}
          onChange={(event) =>
            updateDocument("proofOfFundsStatus", event.target.value)
          }
        />
        <StatusField
          label="Inspection Documents"
          value={documents.inspectionDocumentsStatus}
          onChange={(event) =>
            updateDocument("inspectionDocumentsStatus", event.target.value)
          }
        />
        <StatusField
          label="Closing Package"
          value={documents.closingPackageStatus}
          onChange={(event) =>
            updateDocument("closingPackageStatus", event.target.value)
          }
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          marginBottom: 12,
        }}
      >
        <Field label="Seller Legal Name">
          <input
            value={documents.sellerLegalName}
            onChange={(event) =>
              updateDocument("sellerLegalName", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>
        <Field label="Property Address">
          <input
            value={documents.propertyAddress}
            onChange={(event) =>
              updateDocument("propertyAddress", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>
        <Field label="Purchase Price">
          <input
            type="number"
            value={documents.purchasePrice}
            onChange={(event) =>
              updateDocument("purchasePrice", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>
        <Field label="Closing Date">
          <input
            type="date"
            value={documents.closingDate}
            onChange={(event) =>
              updateDocument("closingDate", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>
        <Field label="Title Company">
          <input
            value={documents.titleCompany}
            onChange={(event) =>
              updateDocument("titleCompany", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>
        <Field label="Earnest Money Deposit">
          <input
            type="number"
            value={documents.earnestMoneyDeposit}
            onChange={(event) =>
              updateDocument("earnestMoneyDeposit", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>
        <Field label="Buyer / Assignee">
          <input
            value={documents.buyerAssignee}
            onChange={(event) =>
              updateDocument("buyerAssignee", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>
        <Field label="Exit Strategy">
          <input
            value={documents.exitStrategy}
            onChange={(event) =>
              updateDocument("exitStrategy", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>
      </div>

      <Field label="Contingencies">
        <textarea
          value={documents.contingencies}
          onChange={(event) =>
            updateDocument("contingencies", event.target.value)
          }
          rows={2}
          style={{ ...fieldStyle, resize: "vertical", marginBottom: 12 }}
        />
      </Field>

      <Field label="Notes">
        <textarea
          value={documents.notes}
          onChange={(event) => updateDocument("notes", event.target.value)}
          rows={3}
          style={{ ...fieldStyle, resize: "vertical", marginBottom: 12 }}
        />
      </Field>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          marginBottom: 12,
        }}
      >
        <MetricCard
          label="Document Readiness"
          value={`${analysis.documentReadinessScore}/100`}
        />
        <MetricCard
          label="Contract Prep Status"
          value={analysis.contractPrepStatus}
        />
        <MetricCard label="Confidence" value={analysis.confidence} />
      </div>

      <div style={{ ...cardStyle, marginBottom: 12 }}>
        <strong>Recommended Next Action</strong>
        <p style={{ color: "#334155", marginBottom: 0 }}>
          {analysis.recommendedNextAction}
        </p>
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
          title="Missing Items"
          items={analysis.missingItems}
          emptyText="No missing items identified."
        />
        <DetailList
          title="Risks"
          items={analysis.risks}
          emptyText="No document risks identified."
        />
      </div>

      <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        <strong>Contract Prep Checklist</strong>
        <div
          style={{
            display: "grid",
            gap: 8,
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          }}
        >
          {analysis.checklistItems.map((item) => (
            <ChecklistItem key={item.key} item={item} />
          ))}
        </div>
      </div>

      <div style={{ color: "#64748b", fontSize: 12 }}>
        {analysis.summary} No documents are generated or sent externally.
      </div>
    </div>
  );
}
