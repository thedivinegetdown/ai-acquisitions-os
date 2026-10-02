import { useState } from "react";
import { Button, Card, SectionHeader, StatusBadge } from "../../design-system";
import { formatSafeDate } from "../../utils/dates";

function label(value) {
  return String(value || "unknown").split("-").map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
}

function groupRecords(records, mode) {
  return records.reduce((groups, record) => {
    const key = mode === "source"
      ? record.sourceKind
      : record.supportingEvidence?.category
        ? `Supporting: ${label(record.supportingEvidence.category.replaceAll("_", "-"))}`
        : record.relatedCanonicalField;
    const group = key || "Unknown";
    if (!groups[group]) groups[group] = [];
    groups[group].push(record);
    return groups;
  }, {});
}

function EvidenceItem({ item, onCopy, onNavigateSection }) {
  const lineageIds = [...(item.parentEvidenceIds || []), ...(item.derivedFromEvidenceIds || [])];
  const supporting = item.supportingEvidence;
  return (
    <li className="evidence-panel__item">
      <header>
        <div>
          <strong>{item.valueSummary || "Context only"}</strong>
          <span>{label(item.relationship)} Evidence</span>
        </div>
        <StatusBadge status={item.evidenceStatus === "usable" ? "success" : "warning"}>{label(item.evidenceStatus)}</StatusBadge>
      </header>
      <dl>
        <div><dt>{supporting ? "Evidence category" : "Canonical field"}</dt><dd>{supporting ? label(supporting.category.replaceAll("_", "-")) : item.relatedCanonicalField || "Not supplied"}</dd></div>
        <div><dt>Source kind</dt><dd>{label(item.sourceKind)}</dd></div>
        <div><dt>Source</dt><dd>{[item.sourceSystem, item.sourceType].filter(Boolean).join(" / ")}</dd></div>
        {item.sourceRecordId ? <div><dt>Source record</dt><dd>{item.sourceRecordId}</dd></div> : null}
        {item.sourceField ? <div><dt>Source field</dt><dd>{item.sourceField}</dd></div> : null}
        <div><dt>Verification</dt><dd>{label(item.verificationState)}</dd></div>
        <div><dt>Freshness</dt><dd>{label(item.freshnessState)}</dd></div>
        {item.sourceTimestamp ? <div><dt>Source timestamp</dt><dd>{formatSafeDate(item.sourceTimestamp, "Not available")}</dd></div> : null}
        {item.observedTimestamp ? <div><dt>Observed</dt><dd>{formatSafeDate(item.observedTimestamp, "Not available")}</dd></div> : null}
        <div><dt>Extraction</dt><dd>{label(item.extractionMethod)}</dd></div>
        {supporting ? <>
          <div><dt>Evidence status</dt><dd>{supporting.status}</dd></div>
          <div><dt>Resolution state</dt><dd>{supporting.resolutionState}</dd></div>
          {supporting.source.url ? <div><dt>Source URL</dt><dd><a href={supporting.source.url} target="_blank" rel="noreferrer">{supporting.source.url}</a></dd></div> : null}
          {supporting.source.reference ? <div><dt>Source reference</dt><dd>{supporting.source.reference}</dd></div> : null}
          {supporting.source.sourceDate ? <div><dt>Source date</dt><dd>{formatSafeDate(supporting.source.sourceDate, "Not available")}</dd></div> : null}
          <div><dt>Retrieved at</dt><dd>{formatSafeDate(supporting.source.retrievedAt, "Not available")}</dd></div>
          {supporting.linkage.parcelIdentifier ? <div><dt>Parcel identifier</dt><dd>{supporting.linkage.parcelIdentifier}</dd></div> : null}
          {supporting.linkage.ownerPartyName ? <div><dt>Owner / party</dt><dd>{supporting.linkage.ownerPartyName}</dd></div> : null}
          {supporting.notes ? <div><dt>Notes / limitations</dt><dd>{supporting.notes}</dd></div> : null}
        </> : null}
      </dl>
      {item.limitationCodes?.length ? <p className="evidence-panel__limitations">Limitations: {item.limitationCodes.map(label).join(", ")}</p> : null}
      {item.compatibility ? <p className="evidence-panel__warning">Compatibility Evidence; persisted does not mean independently verified.</p> : null}
      {lineageIds.length ? (
        <details>
          <summary>Derived From</summary>
          <ul>{lineageIds.map((id) => <li key={id}>{id}</li>)}</ul>
        </details>
      ) : null}
      <div className="evidence-panel__actions">
        <Button onClick={() => onCopy(item.evidenceId)} size="sm" variant="secondary">Copy Evidence ID</Button>
        {item.sourceRecordId ? <Button onClick={() => onCopy(item.sourceRecordId)} size="sm" variant="secondary">Copy source reference</Button> : null}
        {item.relationship === "challenges" ? <Button onClick={() => onNavigateSection?.("decision")} size="sm" variant="secondary">Open Conflict Review</Button> : null}
      </div>
    </li>
  );
}

export default function EvidenceAndProvenancePanel({ coverage, lineage, onNavigateSection, registry }) {
  const [groupMode, setGroupMode] = useState("fact");
  const [copyStatus, setCopyStatus] = useState("");
  const records = registry?.evidenceRecords || [];
  const hasLimitations = Boolean(coverage?.limitationCodes?.length);
  const grouped = groupRecords(records, groupMode);
  if (!records.length && !hasLimitations) return null;

  async function copy(value) {
    try {
      if (!globalThis.navigator?.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await globalThis.navigator.clipboard.writeText(value);
      setCopyStatus("Evidence reference copied.");
    } catch {
      setCopyStatus("Unable to copy. The reference remains visible for manual selection.");
    }
  }

  return (
    <Card className="evidence-panel">
      <SectionHeader description="Trace decision facts to bounded source identity, explicit states, and derived lineage." title="Evidence and Provenance" />
      <dl className="evidence-panel__summary" aria-label="Evidence summary">
        <div><dt>Total</dt><dd>{registry?.counts?.total || 0}</dd></div>
        <div><dt>Supporting</dt><dd>{registry?.counts?.supporting || 0}</dd></div>
        <div><dt>Challenging</dt><dd>{registry?.counts?.challenging || 0}</dd></div>
        <div><dt>Contextual</dt><dd>{registry?.counts?.contextual || 0}</dd></div>
        <div><dt>Limited</dt><dd>{registry?.counts?.limited || 0}</dd></div>
        <div><dt>Fields</dt><dd>{coverage?.counts?.representedFields || 0}</dd></div>
        <div><dt>Fields with conflicts</dt><dd>{coverage?.counts?.fieldsWithConflicts || 0}</dd></div>
        <div><dt>Last evaluated</dt><dd>{formatSafeDate(registry?.evaluatedTimestamp, "Not available")}</dd></div>
      </dl>
      <div className="evidence-panel__grouping" aria-label="Group Evidence by">
        <span>Group by</span>
        <Button aria-pressed={groupMode === "fact"} onClick={() => setGroupMode("fact")} size="sm" variant="secondary">Canonical Fact</Button>
        <Button aria-pressed={groupMode === "source"} onClick={() => setGroupMode("source")} size="sm" variant="secondary">Source Kind</Button>
      </div>
      {Object.entries(grouped).map(([group, items]) => (
        <section className="evidence-panel__group" key={group}>
          <h3>{group}</h3>
          <ul>{items.map((item) => <EvidenceItem item={item} key={item.evidenceId} onCopy={copy} onNavigateSection={onNavigateSection} />)}</ul>
        </section>
      ))}
      {lineage?.outputs?.length ? (
        <details className="evidence-panel__output-lineage">
          <summary>Derived decision outputs</summary>
          <ul>{lineage.outputs.map((output) => <li key={output.outputId}><strong>{output.label}</strong><span>{output.derivedFromEvidenceIds.join(", ") || "No direct Evidence supplied"}</span></li>)}</ul>
        </details>
      ) : null}
      {copyStatus ? <p aria-live="polite" className="evidence-panel__copy-status" role="status">{copyStatus}</p> : null}
    </Card>
  );
}
