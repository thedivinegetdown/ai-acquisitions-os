import { useEffect, useMemo, useState } from "react";
import { appendOfferRevision, listOfferRevisionsByDeal } from "../services/repositories";
import { projectLatestOfferRevision } from "../services/offers";
import { formatNonNegativeUsd } from "../utils/currency";

const fieldStyle = { border: "1px solid #d1d5db", borderRadius: 8, padding: 10, width: "100%" };

function Field({ children, label }) {
  return <label><div style={{ color: "#64748b", fontSize: 12, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>{label}</div>{children}</label>;
}

function statusLabel(status = "") {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function OfferLifecyclePanel({ deal, onCommitmentsChanged, refresh }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    offerAmount: deal.latest_offer || deal.asking_price || deal.price || "",
    offerType: "cash",
    closingTimeline: "30 days",
    followUpDate: "",
    notes: "",
  });
  const latest = useMemo(() => projectLatestOfferRevision(history), [history]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const result = await listOfferRevisionsByDeal(deal.id);
      if (cancelled) return;
      if (result.success) {
        const records = result.data || [];
        setHistory(records);
        const record = projectLatestOfferRevision(records);
        if (record) setForm({
          offerAmount: record.offer_amount ?? "",
          offerType: record.terms?.offerType || "cash",
          closingTimeline: record.terms?.closingTimeline || "",
          followUpDate: record.follow_up_date || "",
          notes: record.notes || "",
        });
        setError("");
      } else {
        setError(result.error?.message || "Could not load offer history.");
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [deal.id]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function record(status) {
    setSaving(true);
    setError("");
    const result = await appendOfferRevision({ deal, revision: form, status });
    if (!result.success) {
      setError(result.error?.message || "Could not record offer revision.");
    } else {
      setHistory((current) => [...current, result.data]);
      refresh?.();
      onCommitmentsChanged?.();
    }
    setSaving(false);
  }

  const actions = !latest
    ? [["Save first draft", "draft"]]
    : latest.status === "draft"
      ? [["Save draft revision", "draft"], ["Record sent", "sent"], ["Withdraw", "withdrawn"]]
      : latest.status === "sent"
        ? [["Record seller counter", "countered"], ["Accept", "accepted"], ["Reject", "rejected"], ["Withdraw", "withdrawn"]]
        : latest.status === "countered"
          ? [["Record revised offer sent", "sent"], ["Accept counter", "accepted"], ["Reject", "rejected"], ["Withdraw", "withdrawn"]]
          : ["rejected", "withdrawn"].includes(latest.status)
            ? [["Start new draft", "draft"]]
            : [];

  return (
    <div style={{ background: "#f8fafc", border: "1px solid #dbe3ef", borderRadius: 14, padding: 18, marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div><div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>VERSIONED OFFER LIFECYCLE</div><h3 style={{ margin: "4px 0" }}>Manual Offer Record</h3></div>
        <span style={{ color: "#9a3412", fontWeight: 700 }}>Records outcomes only — nothing is sent.</span>
      </div>
      {error ? <p role="alert" style={{ color: "#b91c1c" }}>{error}</p> : null}
      {loading ? <p>Loading offer history...</p> : <>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginTop: 12 }}>
          <Field label={latest?.status === "sent" ? "Seller counter amount" : "Offer amount"}><input aria-label="Offer amount" min="0" type="number" value={form.offerAmount} onChange={(event) => update("offerAmount", event.target.value)} style={fieldStyle} /></Field>
          <Field label="Offer type"><select aria-label="Offer type" value={form.offerType} onChange={(event) => update("offerType", event.target.value)} style={fieldStyle}><option value="cash">Cash</option><option value="sellerFinance">Seller finance</option><option value="subjectTo">Subject-to</option></select></Field>
          <Field label="Closing timeline"><input aria-label="Closing timeline" value={form.closingTimeline} onChange={(event) => update("closingTimeline", event.target.value)} style={fieldStyle} /></Field>
          <Field label="Offer follow-up due"><input aria-label="Offer follow-up due" type="date" value={form.followUpDate} onChange={(event) => update("followUpDate", event.target.value)} style={fieldStyle} /></Field>
        </div>
        <Field label="Internal notes"><textarea aria-label="Internal offer notes" rows="2" value={form.notes} onChange={(event) => update("notes", event.target.value)} style={{ ...fieldStyle, marginTop: 4 }} /></Field>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {actions.map(([actionLabel, status]) => <button disabled={saving} key={status + actionLabel} onClick={() => record(status)} type="button">{saving ? "Saving..." : actionLabel}</button>)}
        </div>
        <div style={{ marginTop: 18 }}><strong>Immutable revision history</strong>{history.length === 0 ? <p>No offer revisions yet.</p> : <ol aria-label="Offer revision history" style={{ paddingLeft: 22 }}>{history.map((revision) => <li key={revision.id}>Revision {revision.revision_number}: {statusLabel(revision.status)} — {formatNonNegativeUsd(revision.offer_amount)}{revision.follow_up_date ? ` — follow up ${revision.follow_up_date}` : ""}</li>)}</ol>}</div>
      </>}
    </div>
  );
}
