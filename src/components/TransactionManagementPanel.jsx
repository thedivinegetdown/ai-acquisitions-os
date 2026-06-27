import { useEffect, useMemo, useState } from "react";
import {
  analyzeTransaction,
  buildInitialTransactionState,
  CONTRACT_STATUSES,
  EXIT_STRATEGIES,
  TITLE_STATUSES,
  TRANSACTION_STATUSES,
} from "../services/transactions";
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

export default function TransactionManagementPanel({ deal }) {
  const initialTransaction = useMemo(
    () => buildInitialTransactionState(deal),
    [deal]
  );
  const [transaction, setTransaction] = useState(initialTransaction);

  useEffect(() => {
    setTransaction(initialTransaction);
  }, [initialTransaction]);

  const analysis = useMemo(
    () => analyzeTransaction(transaction),
    [transaction]
  );

  function updateTransaction(field, value) {
    setTransaction((current) => ({
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
            Transaction / Closing Management
          </div>
          <strong style={{ color: "#0f172a", fontSize: 22 }}>
            Internal Transaction Tracking
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
          Internal tracking only - no legal documents generated.
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
        <Field label="Transaction Status">
          <select
            value={transaction.transactionStatus}
            onChange={(event) =>
              updateTransaction("transactionStatus", event.target.value)
            }
            style={fieldStyle}
          >
            {TRANSACTION_STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </Field>

        <Field label="Contract Status">
          <select
            value={transaction.contractStatus}
            onChange={(event) =>
              updateTransaction("contractStatus", event.target.value)
            }
            style={fieldStyle}
          >
            {CONTRACT_STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </Field>

        <Field label="Title Status">
          <select
            value={transaction.titleStatus}
            onChange={(event) =>
              updateTransaction("titleStatus", event.target.value)
            }
            style={fieldStyle}
          >
            {TITLE_STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </Field>

        <Field label="Closing Date">
          <input
            type="date"
            value={transaction.closingDate}
            onChange={(event) =>
              updateTransaction("closingDate", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>

        <Field label="Escrow Deposit">
          <input
            type="number"
            value={transaction.escrowDeposit}
            onChange={(event) =>
              updateTransaction("escrowDeposit", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>

        <Field label="Title Company">
          <input
            value={transaction.titleCompany}
            onChange={(event) =>
              updateTransaction("titleCompany", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>

        <Field label="Closing Attorney">
          <input
            value={transaction.closingAttorney}
            onChange={(event) =>
              updateTransaction("closingAttorney", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>

        <Field label="Buyer Assigned">
          <input
            value={transaction.buyerAssigned}
            onChange={(event) =>
              updateTransaction("buyerAssigned", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>

        <Field label="Assignment Fee">
          <input
            type="number"
            value={transaction.assignmentFee}
            onChange={(event) =>
              updateTransaction("assignmentFee", event.target.value)
            }
            style={fieldStyle}
          />
        </Field>

        <Field label="Exit Strategy">
          <select
            value={transaction.exitStrategy}
            onChange={(event) =>
              updateTransaction("exitStrategy", event.target.value)
            }
            style={fieldStyle}
          >
            {EXIT_STRATEGIES.map((strategy) => (
              <option key={strategy}>{strategy}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          value={transaction.notes}
          onChange={(event) => updateTransaction("notes", event.target.value)}
          rows="4"
          style={{
            ...fieldStyle,
            resize: "vertical",
            marginBottom: 12,
          }}
        />
      </Field>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          marginBottom: 12,
        }}
      >
        <MetricCard
          label="Closing Progress"
          value={`${analysis.closingProgress}/100`}
        />
        <MetricCard label="Confidence" value={analysis.confidence} />
        <MetricCard label="Status" value={analysis.transactionStatus} />
        <MetricCard
          label="Escrow"
          value={
            transaction.escrowDeposit
              ? formatNonNegativeUsd(transaction.escrowDeposit)
              : "Missing"
          }
        />
        <MetricCard
          label="Assignment Fee"
          value={
            transaction.assignmentFee
              ? formatNonNegativeUsd(transaction.assignmentFee)
              : "Missing"
          }
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
          ...cardStyle,
          color: "#334155",
          lineHeight: 1.5,
          marginBottom: 12,
        }}
      >
        <strong>Recommended next action:</strong>{" "}
        {analysis.recommendedNextAction}
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
          title="Transaction Risks"
          items={analysis.risks}
          emptyText="No major transaction risks detected yet."
        />
        <DetailList
          title="Missing Items"
          items={analysis.missingItems}
          emptyText="No major missing transaction items."
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
        Closing Checklist
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        {analysis.checklistItems.map((item) => (
          <ChecklistItem key={item.key} item={item} />
        ))}
      </div>
    </div>
  );
}
