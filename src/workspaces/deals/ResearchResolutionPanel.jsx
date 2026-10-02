import { useState } from "react";
import { Button, Card, Input, SectionHeader, Select, TextArea } from "../../design-system";
import { RESEARCH_FIELDS } from "../../services/research-intelligence/researchResolutionService";
import {
  SUPPORTING_EVIDENCE_CATEGORIES,
  SUPPORTING_EVIDENCE_RESOLUTION_STATES,
  SUPPORTING_EVIDENCE_STATUSES,
} from "../../services/research-intelligence/supportingEvidenceService";
import {
  saveResearchCommand,
  saveSupportingEvidenceCommand,
} from "../../services/repositories/researchRepository";

const CATEGORY_LABELS = Object.freeze({
  ownership_title: "Ownership / title",
  mortgage_liens: "Mortgage / liens",
  hoa: "HOA",
  municipal_code: "Municipal / code",
  occupancy: "Occupancy",
  bankruptcy_probate: "Bankruptcy / probate",
  other_due_diligence: "Other due diligence",
});

const EMPTY_SUPPORTING_FORM = Object.freeze({
  category: SUPPORTING_EVIDENCE_CATEGORIES[0],
  fact: "",
  sourceName: "",
  sourceUrl: "",
  sourceReference: "",
  sourceDate: "",
  retrievedAt: "",
  status: SUPPORTING_EVIDENCE_STATUSES[0],
  resolutionState: SUPPORTING_EVIDENCE_RESOLUTION_STATES[0],
  parcelIdentifier: "",
  ownerPartyName: "",
  notes: "",
});

function currentValue(deal, descriptor) {
  try {
    return descriptor.columns.map((column) => deal[column]).find((entry) => entry != null && entry !== "") ?? "Unknown";
  } catch { return "Unavailable"; }
}

export default function ResearchResolutionPanel({ deal, readModel, onSaved }) {
  const fields = RESEARCH_FIELDS.filter((entry) => !entry.asset || entry.asset === readModel?.assetStrategyContext?.assetType);
  const [mode, setMode] = useState("canonical");
  const [field, setField] = useState(fields[0].field);
  const [value, setValue] = useState("");
  const [source, setSource] = useState("");
  const [sourceType, setSourceType] = useState("manual-research");
  const [verificationState, setVerification] = useState("unverified");
  const [sourceTimestamp, setTimestamp] = useState("");
  const [candidateId, setCandidate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [supportingForm, setSupportingForm] = useState({ ...EMPTY_SUPPORTING_FORM });
  const conflict = readModel?.conflictReadModel?.activeConflicts.find((entry) => entry.canonicalField === field);
  const resolution = readModel?.conflictReadModel?.resolvedConflicts.find((entry) => entry.canonicalField === field);
  const evidence = (deal.research_evidence || []).filter((entry) => entry.relatedCanonicalField === field);
  const descriptor = fields.find((entry) => entry.field === field);
  const supportingEvidence = (deal.research_evidence || []).filter((entry) => entry.supportingEvidence);

  function updateSupporting(fieldName, fieldValue) {
    setSupportingForm((current) => ({ ...current, [fieldName]: fieldValue }));
  }

  async function save(command) {
    setBusy(true);
    setStatus("");
    try {
      const result = await saveResearchCommand(deal, { ...command, field });
      if (!result.success) { setStatus(result.error?.message || "Research could not be saved."); return; }
      onSaved(result.data);
      setCandidate("");
      setStatus(command.type === "resolve" ? "Resolution saved. Canonical decision refreshed." : "Research saved. Canonical decision refreshed.");
    } catch {
      setStatus("Research could not be saved. Reload and try again.");
    } finally { setBusy(false); }
  }

  async function saveSupporting() {
    setBusy(true);
    setStatus("");
    try {
      const result = await saveSupportingEvidenceCommand(deal, supportingForm);
      if (!result.success) { setStatus(result.error?.message || "Supporting evidence could not be saved."); return; }
      onSaved(result.data);
      setSupportingForm({ ...EMPTY_SUPPORTING_FORM });
      setStatus("Supporting evidence added. Canonical deal facts were not changed.");
    } catch {
      setStatus("Supporting evidence could not be saved. Reload and try again.");
    } finally { setBusy(false); }
  }

  return <Card className="workspace__stack">
    <SectionHeader title="Resolve research" description="Record a source-linked fact. Disagreeing values remain explicit until you select a candidate and explain the resolution." />
    <Select label="Research workflow" disabled={busy} value={mode} onChange={(event) => { setMode(event.target.value); setStatus(""); }}>
      <option value="canonical">Resolve canonical research fact</option>
      <option value="supporting">Add supporting evidence</option>
    </Select>
    {mode === "canonical" && <>
      <Select label="Research fact" disabled={busy} value={field} onChange={(event) => { setField(event.target.value); setCandidate(""); setStatus(""); }}>
        {fields.map((entry) => <option key={entry.field} value={entry.field}>{entry.label}</option>)}
      </Select>
      <p>Current value: {currentValue(deal, descriptor)}</p>
      <Input label="Researched value" value={value} onChange={(event) => setValue(event.target.value)} />
      <Input label="Source reference" value={source} onChange={(event) => setSource(event.target.value)} placeholder="Document, record, URL, or named source" />
      <Select label="Source type" value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
        {["manual-research", "seller-statement", "document", "property-record", "comparable-sale", "land-comparable-sale"].map((type) => <option key={type}>{type}</option>)}
      </Select>
      <Select label="Verification" value={verificationState} onChange={(event) => setVerification(event.target.value)}>
        {["unverified", "verified", "unknown"].map((state) => <option key={state}>{state}</option>)}
      </Select>
      <Input label="Source timestamp (optional)" type="datetime-local" value={sourceTimestamp} onChange={(event) => setTimestamp(event.target.value)} />
      <p>Leave source time blank if unknown. Freshness is evaluated by the canonical revalidation policy.</p>
      <Button disabled={busy || !deal.organization_id || !value.trim() || !source.trim()} onClick={() => save({ type: "record", value, source, sourceType, verificationState, sourceTimestamp })}>Save researched fact</Button>
      {evidence.length > 0 && <ul aria-label="Saved research sources">{evidence.map((entry) => <li key={entry.evidenceId}>
        {entry.valueSummary} — {entry.sourceSystem} — {entry.verificationState} — {entry.sourceTimestamp || "Source time unknown"}
      </li>)}</ul>}
      {conflict && <div>
        <p role="status">Conflicting values require an explicit resolution.</p>
        <Select label="Resolution candidate" value={candidateId} onChange={(event) => setCandidate(event.target.value)}>
          <option value="">Select a source-linked value</option>
          {conflict.candidateValues.filter((entry) => evidence.some((record) => record.evidenceId === entry.evidenceId)).map((entry) =>
            <option key={entry.candidateId} value={entry.candidateId}>{entry.rawValueSummary} — {entry.sourceSystem}</option>)}
        </Select>
        <Input label="Resolution reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        <Button disabled={busy || !candidateId || !reason.trim()} onClick={() => save({ type: "resolve", candidateId, reason })}>Resolve selected conflict</Button>
      </div>}
      {resolution && <p>Resolved: {resolution.explicitResolutionReference?.canonicalValueSummary} — {resolution.explicitResolutionReference?.reason}</p>}
    </>}
    {mode === "supporting" && <>
      <p><strong>Supporting evidence does not change canonical deal facts.</strong></p>
      <Select label="Evidence category" disabled={busy} value={supportingForm.category} onChange={(event) => updateSupporting("category", event.target.value)}>
        {SUPPORTING_EVIDENCE_CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}
      </Select>
      <TextArea label="Finding / value" value={supportingForm.fact} onChange={(event) => updateSupporting("fact", event.target.value)} />
      <Input label="Source name" value={supportingForm.sourceName} onChange={(event) => updateSupporting("sourceName", event.target.value)} />
      <Input label="Source URL (optional)" type="url" value={supportingForm.sourceUrl} onChange={(event) => updateSupporting("sourceUrl", event.target.value)} />
      <Input label="Source reference (optional)" value={supportingForm.sourceReference} onChange={(event) => updateSupporting("sourceReference", event.target.value)} />
      <Input label="Source date/time (optional)" type="datetime-local" value={supportingForm.sourceDate} onChange={(event) => updateSupporting("sourceDate", event.target.value)} />
      <Input label="Retrieved at" type="datetime-local" value={supportingForm.retrievedAt} onChange={(event) => updateSupporting("retrievedAt", event.target.value)} />
      <Select label="Evidence status" value={supportingForm.status} onChange={(event) => updateSupporting("status", event.target.value)}>
        {SUPPORTING_EVIDENCE_STATUSES.map((evidenceStatus) => <option key={evidenceStatus} value={evidenceStatus}>{evidenceStatus}</option>)}
      </Select>
      <Select label="Resolution state" value={supportingForm.resolutionState} onChange={(event) => updateSupporting("resolutionState", event.target.value)}>
        {SUPPORTING_EVIDENCE_RESOLUTION_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
      </Select>
      <Input label="Parcel identifier (optional)" value={supportingForm.parcelIdentifier} onChange={(event) => updateSupporting("parcelIdentifier", event.target.value)} />
      <Input label="Owner / party name (optional)" value={supportingForm.ownerPartyName} onChange={(event) => updateSupporting("ownerPartyName", event.target.value)} />
      <TextArea label="Notes / limitations (optional)" value={supportingForm.notes} onChange={(event) => updateSupporting("notes", event.target.value)} />
      <Button disabled={busy || !deal.organization_id || !supportingForm.fact.trim() || !supportingForm.sourceName.trim() || !supportingForm.retrievedAt} onClick={saveSupporting}>Add supporting evidence</Button>
      {supportingEvidence.length > 0 && <ul aria-label="Saved supporting evidence">{supportingEvidence.map((entry) => {
        const detail = entry.supportingEvidence;
        return <li key={entry.evidenceId}>
          {detail.fact} — {CATEGORY_LABELS[detail.category] || detail.category} — {detail.status} — {detail.resolutionState} — {detail.source.name}
          {detail.source.reference ? ` — ${detail.source.reference}` : ""}
          {detail.source.url ? <> — <a href={detail.source.url} target="_blank" rel="noreferrer">Source URL</a></> : null}
          {` — Retrieved ${detail.source.retrievedAt}`}
          {detail.linkage.parcelIdentifier ? ` — Parcel ${detail.linkage.parcelIdentifier}` : ""}
          {detail.linkage.ownerPartyName ? ` — Party ${detail.linkage.ownerPartyName}` : ""}
          {detail.notes ? ` — ${detail.notes}` : ""}
        </li>;
      })}</ul>}
    </>}
    {status && <p role="status">{status}</p>}
  </Card>;
}
