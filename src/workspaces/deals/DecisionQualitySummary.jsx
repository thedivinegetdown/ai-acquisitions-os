import { Button, Card, SectionHeader, StatusBadge } from "../../design-system";

const STATUS = Object.freeze({
  strong: "success",
  high: "success",
  moderate: "info",
  limited: "warning",
  low: "warning",
  unavailable: "neutral",
});

function label(value) {
  return String(value || "unavailable")
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function FactList({ facts, title }) {
  if (!facts?.length) return null;
  return (
    <section aria-labelledby={`decision-quality-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <h4 id={`decision-quality-${title.toLowerCase().replace(/\s+/g, "-")}`}>{title}</h4>
      <ul className="decision-quality__facts">
        {facts.map((fact) => (
          <li key={fact.canonicalField}>
            <header>
              <strong>{fact.label}</strong>
              <StatusBadge status={STATUS[fact.state] || "neutral"}>{label(fact.state)}</StatusBadge>
            </header>
            <dl>
              <div><dt>Evidence</dt><dd>{fact.evidenceIds.length}</dd></div>
              <div><dt>Verification</dt><dd>{label(fact.verificationState)}</dd></div>
              <div><dt>Freshness</dt><dd>{label(fact.freshnessState)}</dd></div>
              <div><dt>Conflict</dt><dd>{fact.activeConflictIds.length ? "Active" : "None represented"}</dd></div>
            </dl>
            {fact.limitationCodes.length ? <p>Limitations: {fact.limitationCodes.map(label).join(", ")}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

// Distinct responsibility: present the two categorical DI-03 outputs without
// combining them with Pursuit Score or Offer Readiness.
export default function DecisionQualitySummary({ confidence, onNavigateSection, recommendation, recommendationBasis, reliability }) {
  if (!reliability && !confidence) return null;
  const basisGaps = reliability?.basisGapRequirementIds || [];
  const activeConflicts = reliability?.conflictIds || [];

  return (
    <Card className="decision-quality">
      <SectionHeader
        description="Two separate, deterministic views of decision quality. Neither is a deal-success probability."
        title="Decision Quality"
      />
      <div className="decision-quality__summaries">
        <section aria-labelledby="data-reliability-heading">
          <header>
            <h3 id="data-reliability-heading">Data Reliability</h3>
            <StatusBadge status={STATUS[reliability?.grade] || "neutral"}>{reliability?.displayLabel || "Unavailable"}</StatusBadge>
          </header>
          <p>Quality and traceability of the Evidence supporting the current decision.</p>
          <dl>
            <div><dt>Assessment basis</dt><dd>{label(reliability?.assessmentBasis)}</dd></div>
            <div><dt>Critical facts</dt><dd>{reliability?.criticalFactResults?.length || 0}</dd></div>
            <div><dt>Key limitations</dt><dd>{reliability?.limitationCodes?.length || 0}</dd></div>
          </dl>
          <p>{reliability?.explanation}</p>
        </section>
        <section aria-labelledby="recommendation-confidence-heading">
          <header>
            <h3 id="recommendation-confidence-heading">Recommendation Confidence</h3>
            <StatusBadge status={STATUS[confidence?.level] || "neutral"}>{confidence?.displayLabel || "Unavailable"}</StatusBadge>
          </header>
          <p>How strongly the deterministic basis supports the recommended next action.</p>
          <dl>
            <div><dt>Recommended action</dt><dd>{recommendation?.label || "Not available"}</dd></div>
            <div><dt>Basis</dt><dd>{label(recommendationBasis?.basisType)}</dd></div>
            <div><dt>Limiting factors</dt><dd>{confidence?.limitingFactors?.length || 0}</dd></div>
          </dl>
          <p>{confidence?.explanation}</p>
          <p className="decision-quality__warning">Confidence is not the probability that the deal succeeds.</p>
        </section>
      </div>
      <div className="decision-quality__actions">
        <Button onClick={() => onNavigateSection?.("decision")} size="sm" variant="secondary">Open Evidence</Button>
        {activeConflicts.length ? <Button onClick={() => onNavigateSection?.("decision")} size="sm" variant="secondary">Open Conflict Review</Button> : null}
        {basisGaps.length ? <Button onClick={() => onNavigateSection?.("decision")} size="sm" variant="secondary">Review Missing Information</Button> : null}
      </div>
      <details className="decision-quality__details">
        <summary>Reliability and recommendation basis</summary>
        <FactList facts={reliability?.criticalFactResults} title="Critical facts" />
        <FactList facts={reliability?.advisoryFactResults} title="Advisory facts" />
        <section aria-labelledby="confidence-basis-heading">
          <h4 id="confidence-basis-heading">Recommendation basis</h4>
          <dl>
            <div><dt>Basis type</dt><dd>{label(recommendationBasis?.basisType)}</dd></div>
            <div><dt>Evidence IDs</dt><dd>{confidence?.evidenceIds?.join(", ") || "None supplied"}</dd></div>
            <div><dt>Missing Information IDs</dt><dd>{confidence?.missingInformationIds?.join(", ") || "None"}</dd></div>
            <div><dt>Conflict IDs</dt><dd>{confidence?.conflictIds?.join(", ") || "None"}</dd></div>
            <div><dt>Readiness gates</dt><dd>{confidence?.readinessGateIds?.join(", ") || "None"}</dd></div>
            <div><dt>Supporting factors</dt><dd>{confidence?.positiveSupportingFactors?.map(label).join(", ") || "None represented"}</dd></div>
            <div><dt>Limiting factors</dt><dd>{confidence?.limitingFactors?.map(label).join(", ") || "None represented"}</dd></div>
          </dl>
        </section>
      </details>
      <p className="decision-quality__disclaimer">{reliability?.operatorDisclaimer}</p>
      <p className="decision-quality__disclaimer">{confidence?.operatorDisclaimer}</p>
    </Card>
  );
}
