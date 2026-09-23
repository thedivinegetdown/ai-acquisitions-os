import { useEffect, useMemo, useState } from "react";
import { appendClosingRevision, listBuyers, listClosingRevisionsByDeal, listOfferRevisionsByDeal } from "../services/repositories";
import { projectLatestOfferRevision } from "../services/offers";
import { projectLatestClosingRevision } from "../services/transactions";
import { formatNonNegativeUsd } from "../utils/currency";

const fieldStyle = { border: "1px solid #d1d5db", borderRadius: 8, padding: 10, width: "100%" };
function Field({ children, label }) { return <label><div style={{ color: "#64748b", fontSize: 12, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>{label}</div>{children}</label>; }
function statusLabel(status = "") { return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export default function ClosingLifecyclePanel({ deal, onCommitmentsChanged, refresh }) {
  const [offers, setOffers] = useState([]);
  const [history, setHistory] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ contractDate: "", closingDate: "", deadlineLabel: "", deadlineDate: "", titleCompanyReference: "", selectedBuyerId: "", assignmentFee: "", expectedProceeds: "", actualRealizedProceeds: "", actualCosts: "", notes: "" });
  const acceptedOffer = useMemo(() => projectLatestOfferRevision(offers), [offers]);
  const latest = useMemo(() => projectLatestClosingRevision(history), [history]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [offerResult, closingResult, buyerResult] = await Promise.all([listOfferRevisionsByDeal(deal.id), listClosingRevisionsByDeal(deal.id), listBuyers()]);
      if (cancelled) return;
      setOffers(offerResult.success ? offerResult.data || [] : []);
      setHistory(closingResult.success ? closingResult.data || [] : []);
      setBuyers(buyerResult.success ? buyerResult.data || [] : []);
      const record = projectLatestClosingRevision(closingResult.success ? closingResult.data : []);
      if (record) {
        const deadline = record.material_deadlines?.[0] || {};
        setForm({ contractDate: record.contract_date || "", closingDate: record.closing_date || "", deadlineLabel: deadline.label || "", deadlineDate: deadline.dueDate || "", titleCompanyReference: record.title_company_reference || "", selectedBuyerId: record.selected_buyer_id || "", assignmentFee: record.assignment_fee ?? "", expectedProceeds: record.expected_proceeds ?? "", actualRealizedProceeds: record.actual_realized_proceeds ?? "", actualCosts: record.actual_costs ?? "", notes: record.notes || "" });
      }
      const failed = [offerResult, closingResult, buyerResult].find((result) => !result.success);
      setError(failed?.error?.message || "");
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [deal.id]);

  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  async function record(status) {
    setSaving(true);
    setError("");
    const materialDeadlines = form.deadlineDate ? [{ id: "material-1", label: form.deadlineLabel || "Contract deadline", dueDate: form.deadlineDate }] : [];
    const result = await appendClosingRevision({ closing: { ...form, materialDeadlines }, deal, status });
    if (!result.success) setError(result.error?.message || "Could not record closing revision.");
    else {
      setHistory((current) => [...current, result.data]);
      refresh?.();
      onCommitmentsChanged?.();
    }
    setSaving(false);
  }

  if (loading) return <p>Loading closing history...</p>;
  if (acceptedOffer?.status !== "accepted" && !latest) return <p>An accepted offer revision is required before entering closing.</p>;

  return (
    <div style={{ background: "#f8fafc", border: "1px solid #dbe3ef", borderRadius: 14, padding: 18, marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>CONTRACT / CLOSING LIFECYCLE</div><h3 style={{ margin: "4px 0" }}>Manual Closing Record</h3></div><span style={{ color: "#9a3412", fontWeight: 700 }}>No signing, money movement, or external automation.</span></div>
      {error ? <p role="alert" style={{ color: "#b91c1c" }}>{error}</p> : null}
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginTop: 12 }}>
        <Field label="Contract date"><input aria-label="Contract date" type="date" value={form.contractDate} onChange={(event) => update("contractDate", event.target.value)} style={fieldStyle} /></Field>
        <Field label="Closing date"><input aria-label="Closing date" type="date" value={form.closingDate} onChange={(event) => update("closingDate", event.target.value)} style={fieldStyle} /></Field>
        <Field label="Material deadline"><input aria-label="Material deadline label" placeholder="Inspection deadline" value={form.deadlineLabel} onChange={(event) => update("deadlineLabel", event.target.value)} style={fieldStyle} /></Field>
        <Field label="Deadline date"><input aria-label="Material deadline date" type="date" value={form.deadlineDate} onChange={(event) => update("deadlineDate", event.target.value)} style={fieldStyle} /></Field>
        <Field label="Title / closing company"><input aria-label="Title or closing company" value={form.titleCompanyReference} onChange={(event) => update("titleCompanyReference", event.target.value)} style={fieldStyle} /></Field>
        <Field label="Selected buyer"><select aria-label="Selected buyer" value={form.selectedBuyerId} onChange={(event) => update("selectedBuyerId", event.target.value)} style={fieldStyle}><option value="">Not selected</option>{buyers.map((buyer) => <option key={buyer.id} value={buyer.id}>{buyer.name}</option>)}</select></Field>
        <Field label="Assignment fee"><input aria-label="Assignment fee" min="0" type="number" value={form.assignmentFee} onChange={(event) => update("assignmentFee", event.target.value)} style={fieldStyle} /></Field>
        <Field label="Expected proceeds"><input aria-label="Expected proceeds" min="0" type="number" value={form.expectedProceeds} onChange={(event) => update("expectedProceeds", event.target.value)} style={fieldStyle} /></Field>
        <Field label="Realized proceeds"><input aria-label="Realized proceeds" min="0" type="number" value={form.actualRealizedProceeds} onChange={(event) => update("actualRealizedProceeds", event.target.value)} style={fieldStyle} /></Field>
        <Field label="Actual costs"><input aria-label="Actual costs" min="0" type="number" value={form.actualCosts} onChange={(event) => update("actualCosts", event.target.value)} style={fieldStyle} /></Field>
      </div>
      <Field label="Internal notes"><textarea aria-label="Closing notes" rows="2" value={form.notes} onChange={(event) => update("notes", event.target.value)} style={fieldStyle} /></Field>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        {!latest ? <button disabled={saving} onClick={() => record("under_contract")} type="button">Enter under contract</button> : latest.status === "under_contract" ? <><button disabled={saving} onClick={() => record("under_contract")} type="button">Save milestone revision</button><button disabled={saving} onClick={() => record("closed")} type="button">Record closed</button><button disabled={saving} onClick={() => record("cancelled")} type="button">Record cancelled</button></> : null}
      </div>
      <div style={{ marginTop: 18 }}><strong>Immutable closing history</strong>{history.length === 0 ? <p>No closing revisions yet.</p> : <ol aria-label="Closing revision history" style={{ paddingLeft: 22 }}>{history.map((revision) => <li key={revision.id}>Revision {revision.revision_number}: {statusLabel(revision.status)}{revision.closing_date ? ` — ${revision.closing_date}` : ""}{revision.actual_realized_proceeds != null ? ` — ${formatNonNegativeUsd(revision.actual_realized_proceeds)} realized` : ""}</li>)}</ol>}</div>
    </div>
  );
}
