import { useState } from "react";
import { Button, Card, SectionHeader, StatusBadge } from "../../design-system";
import { formatSafeDate } from "../../utils/dates";

const STATUS = Object.freeze({
  blocking: "danger",
  advisory: "warning",
  resolved: "success",
});

function displayLabel(value) {
  return String(value || "unknown")
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function sectionLabel(section, assetType) {
  if (section === "property" && assetType === "vacant-residential-land") return "Parcel";
  if (section === "numbers" && assetType === "vacant-residential-land") return "Land Analysis";
  return displayLabel(section || "decision");
}

function Candidate({ candidate, onCopy }) {
  return (
    <li className="conflict-review__candidate">
      <div className="conflict-review__candidate-heading">
        <strong>{candidate.rawValueSummary || String(candidate.normalizedComparableValue)}</strong>
        <Button onClick={() => onCopy(candidate.rawValueSummary || String(candidate.normalizedComparableValue), candidate.candidateId)} size="sm" variant="secondary">
          Copy Candidate Value
        </Button>
      </div>
      <dl>
        {candidate.sourceField ? <div><dt>Source field</dt><dd>{candidate.sourceField}</dd></div> : null}
        {candidate.sourceSystem || candidate.sourceType ? <div><dt>Source</dt><dd>{[candidate.sourceSystem, candidate.sourceType].filter(Boolean).join(" / ")}</dd></div> : null}
        {candidate.verificationState ? <div><dt>Verification</dt><dd>{displayLabel(candidate.verificationState)}</dd></div> : null}
        {candidate.freshnessState ? <div><dt>Freshness</dt><dd>{displayLabel(candidate.freshnessState)}</dd></div> : null}
        {candidate.sourceTimestamp ? <div><dt>Source timestamp</dt><dd>{formatSafeDate(candidate.sourceTimestamp, "Not available")}</dd></div> : null}
        {candidate.evidenceId ? <div><dt>Evidence</dt><dd>{candidate.evidenceId}</dd></div> : null}
      </dl>
      {candidate.compatibilityEvidence ? <p className="conflict-review__warning">Current CRM compatibility Evidence; persisted does not mean independently verified.</p> : null}
    </li>
  );
}

function Resolution({ resolution, candidates }) {
  if (!resolution) return null;
  const selected = candidates.find((candidate) => candidate.candidateId === resolution.selectedCandidateId);
  return (
    <div className="conflict-review__resolution">
      <StatusBadge status="success">Resolved</StatusBadge>
      <dl>
        {selected || resolution.canonicalValueSummary ? <div><dt>Selected candidate</dt><dd>{selected?.rawValueSummary || resolution.canonicalValueSummary}</dd></div> : null}
        {resolution.reason ? <div><dt>Reason</dt><dd>{resolution.reason}</dd></div> : null}
        {resolution.actorReference ? <div><dt>Actor</dt><dd>{resolution.actorReference}</dd></div> : null}
        {resolution.decidedTimestamp ? <div><dt>Decided</dt><dd>{formatSafeDate(resolution.decidedTimestamp, "Not available")}</dd></div> : null}
        {resolution.approvalReference ? <div><dt>Approval</dt><dd>{resolution.approvalReference}</dd></div> : null}
      </dl>
    </div>
  );
}

function ConflictCard({ assetType, conflict, onCopy, onNavigateSection }) {
  const resolved = conflict.state === "resolved";
  return (
    <article className="conflict-review__conflict">
      <header className="conflict-review__heading">
        <div>
          <h3>{conflict.label}</h3>
          <p>{conflict.description || conflict.summary}</p>
        </div>
        <StatusBadge status={resolved ? STATUS.resolved : STATUS[conflict.criticality] || "warning"}>
          {resolved ? "Resolved" : displayLabel(conflict.criticality)}
        </StatusBadge>
      </header>
      <dl className="conflict-review__meta">
        <div><dt>Canonical field</dt><dd>{conflict.canonicalField}</dd></div>
        <div><dt>Candidate values</dt><dd>{conflict.candidateValues.length}</dd></div>
        <div><dt>Distinct values</dt><dd>{conflict.distinctNormalizedValues.length}</dd></div>
        <div><dt>Related context</dt><dd>{sectionLabel(conflict.relatedSection, assetType)}</dd></div>
      </dl>
      {conflict.candidateValues.length ? (
        <details className="conflict-review__details">
          <summary>Compare candidate values and Evidence</summary>
          <p>Review order helps organize evidence; it does not select the correct value.</p>
          <ol className="conflict-review__candidates">
            {conflict.candidateValues.map((candidate) => <Candidate candidate={candidate} key={candidate.candidateId} onCopy={onCopy} />)}
          </ol>
        </details>
      ) : <p>No safely comparable candidate values were supplied with this explicit conflict.</p>}
      <Resolution candidates={conflict.candidateValues} resolution={conflict.explicitResolutionReference} />
      {!resolved ? (
        <div className="conflict-review__actions">
          <Button onClick={() => onNavigateSection?.(conflict.relatedSection || "decision")} variant="secondary">
            Open {sectionLabel(conflict.relatedSection, assetType)}
          </Button>
          {conflict.evidenceIds[0] ? <Button onClick={() => onCopy(conflict.evidenceIds.join(", "), `${conflict.conflictId}:evidence`)} variant="secondary">Copy Evidence Reference</Button> : null}
        </div>
      ) : null}
    </article>
  );
}

export default function ConflictReviewPanel({ onNavigateSection, readModel }) {
  const [copyStatus, setCopyStatus] = useState(null);
  const conflicts = [
    ...(readModel?.activeConflicts || []),
    ...(readModel?.resolvedConflicts || []),
  ];
  if (!conflicts.length) return null;

  async function handleCopy(value, id) {
    try {
      if (!globalThis.navigator?.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await globalThis.navigator.clipboard.writeText(value);
      setCopyStatus({ id, message: "Conflict detail copied." });
    } catch {
      setCopyStatus({ id, message: "Unable to copy. The value remains visible for manual selection." });
    }
  }

  return (
    <Card className="conflict-review" id="conflict-review">
      <SectionHeader
        description="Explicit stored values disagree for one or more decision facts. Review the candidate values and their Evidence before relying on the affected field."
        eyebrow={`${readModel.counts.open} open / ${readModel.counts.blocking} blocking / ${readModel.counts.advisory} advisory`}
        title="Conflicting Data"
      />
      {readModel.highestPriorityConflict ? <p><strong>Highest-priority conflict:</strong> {readModel.highestPriorityConflict.label}</p> : null}
      <p className="conflict-review__evaluated">Last evaluated: {formatSafeDate(readModel.evaluatedTimestamp, "Not available")}</p>
      <div className="conflict-review__list">
        {conflicts.map((conflict) => <ConflictCard assetType={readModel.assetType} conflict={conflict} key={conflict.conflictId} onCopy={handleCopy} onNavigateSection={onNavigateSection} />)}
      </div>
      {copyStatus ? <p aria-live="polite" className="conflict-review__copy-status" role="status">{copyStatus.message}</p> : null}
    </Card>
  );
}
