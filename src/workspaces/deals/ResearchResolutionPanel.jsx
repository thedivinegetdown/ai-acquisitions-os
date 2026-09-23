import { useState } from "react";
import { Button, Card, Input, SectionHeader, Select } from "../../design-system";
import { RESEARCH_FIELDS } from "../../services/research-intelligence/researchResolutionService";
import { saveResearchCommand } from "../../services/repositories/researchRepository";

function currentValue(deal, descriptor) {
  try {
    return descriptor.columns.map((column) => deal[column]).find((entry) => entry != null && entry !== "") ?? "Unknown";
  } catch { return "Unavailable"; }
}

export default function ResearchResolutionPanel({ deal, readModel, onSaved }) {
  const fields = RESEARCH_FIELDS.filter((entry) => !entry.asset || entry.asset === readModel?.assetStrategyContext?.assetType);
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
  const conflict = readModel?.conflictReadModel?.activeConflicts.find((entry) => entry.canonicalField === field);
  const resolution = readModel?.conflictReadModel?.resolvedConflicts.find((entry) => entry.canonicalField === field);
  const evidence = (deal.research_evidence || []).filter((entry) => entry.relatedCanonicalField === field);
  const descriptor = fields.find((entry) => entry.field === field);

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

  return <Card className="workspace__stack">
    <SectionHeader title="Resolve research" description="Record a source-linked fact. Disagreeing values remain explicit until you select a candidate and explain the resolution." />
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
    {status && <p role="status">{status}</p>}
  </Card>;
}
