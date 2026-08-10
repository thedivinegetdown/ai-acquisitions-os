import { Button, Card, SectionHeader, StatusBadge } from "../../design-system";
import { formatSafeDate } from "../../utils/dates";

const STATUS = Object.freeze({
  current: "success",
  "revalidation-due": "info",
  stale: "warning",
  expired: "danger",
  unknown: "neutral",
});

function label(value) {
  return String(value || "unknown").split("-").map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
}

function ageLabel(value) {
  if (!Number.isFinite(value)) return "Unknown";
  return `${Math.floor(value)} day${Math.floor(value) === 1 ? "" : "s"}`;
}

function FactItem({ fact }) {
  return (
    <li>
      <header>
        <strong>{fact.label || fact.canonicalField}</strong>
        <StatusBadge status={STATUS[fact.state] || "neutral"}>{label(fact.state)}</StatusBadge>
      </header>
      <dl>
        <div><dt>Canonical field</dt><dd>{fact.canonicalField}</dd></div>
        <div><dt>Revalidation</dt><dd>{label(fact.revalidationState)}</dd></div>
        <div><dt>Policy</dt><dd>{fact.policyId || "No applicable policy"}</dd></div>
        <div><dt>Criticality</dt><dd>{label(fact.criticality)}</dd></div>
        <div><dt>Source timestamp</dt><dd>{formatSafeDate(fact.newestRelevantSourceTimestamp, "Not available")}</dd></div>
        <div><dt>Age</dt><dd>{ageLabel(fact.ageDays)}</dd></div>
        <div><dt>Revalidation due</dt><dd>{formatSafeDate(fact.policyTimestamps?.revalidationDueTimestamp, "Not available")}{fact.policyTimestamps?.policyDerived ? " (Policy-derived)" : ""}</dd></div>
        <div><dt>Stale after</dt><dd>{formatSafeDate(fact.policyTimestamps?.staleTimestamp, "Not available")}{fact.policyTimestamps?.policyDerived ? " (Policy-derived)" : ""}</dd></div>
        <div><dt>Expires after</dt><dd>{formatSafeDate(fact.policyTimestamps?.expirationTimestamp, "Not available")}{fact.policyTimestamps?.policyDerived ? " (Policy-derived)" : ""}</dd></div>
        <div><dt>Conflict</dt><dd>{fact.activeConflictIds?.length ? "Active" : "None represented"}</dd></div>
        <div><dt>Evidence IDs</dt><dd>{fact.evidenceIds?.join(", ") || "None"}</dd></div>
      </dl>
      <p>{fact.explanation}</p>
      {fact.limitationCodes?.length ? <p>Limitations: {fact.limitationCodes.map(label).join(", ")}</p> : null}
    </li>
  );
}

function hasMaterialFreshnessReview(readModel, recommendationSupport) {
  return Boolean(
    readModel?.revalidationDueFacts?.length ||
    readModel?.staleFacts?.length ||
    readModel?.expiredFacts?.length ||
    readModel?.unknownFacts?.some((fact) => fact.criticality === "blocking") ||
    readModel?.warnings?.length ||
    recommendationSupport?.state === "revalidation-required"
  );
}

export default function FreshnessAndRevalidationPanel({ onNavigateSection, readModel, recommendationSupport }) {
  if (!hasMaterialFreshnessReview(readModel, recommendationSupport)) return null;
  const relevantFacts = (readModel.factAssessments || []).filter((fact) =>
    ["revalidation-due", "stale", "expired"].includes(fact.state) ||
    (fact.state === "unknown" && fact.criticality === "blocking")
  );
  return (
    <Card className="decision-quality">
      <SectionHeader
        description="Freshness is based on real source or eligible observation timestamps and fact-specific policy. It is separate from verification and Data Reliability."
        title="Freshness & Revalidation"
      />
      <dl className="decision-room__decision-meta" aria-label="Freshness summary">
        <div><dt>Current</dt><dd>{readModel.counts?.current || 0}</dd></div>
        <div><dt>Revalidation Due</dt><dd>{readModel.counts?.revalidationDue || 0}</dd></div>
        <div><dt>Stale</dt><dd>{readModel.counts?.stale || 0}</dd></div>
        <div><dt>Expired</dt><dd>{readModel.counts?.expired || 0}</dd></div>
        <div><dt>Unknown</dt><dd>{readModel.counts?.unknown || 0}</dd></div>
        <div><dt>Critical Revalidation Required</dt><dd>{readModel.counts?.criticalRevalidationRequired || 0}</dd></div>
      </dl>
      {recommendationSupport?.state === "revalidation-required" ? (
        <p className="decision-quality__warning" role="status">Part of the current recommendation basis depends on Evidence that requires revalidation.</p>
      ) : null}
      {relevantFacts.length ? (
        <details className="decision-quality__details">
          <summary>Review fact freshness</summary>
          <ul className="decision-quality__facts">
            {relevantFacts.map((fact) => <FactItem fact={fact} key={fact.canonicalField} />)}
          </ul>
        </details>
      ) : null}
      <div className="decision-quality__actions">
        <Button onClick={() => onNavigateSection?.("decision")} size="sm" variant="secondary">Open Evidence</Button>
        {relevantFacts.some((fact) => fact.activeConflictIds?.length) ? <Button onClick={() => onNavigateSection?.("decision")} size="sm" variant="secondary">Open Conflict Review</Button> : null}
      </div>
      <p className="decision-quality__disclaimer">Policy-derived revalidation dates are review guidance, not seller or contractual deadlines. This panel does not refresh data, create tasks, or change the recommendation.</p>
    </Card>
  );
}
