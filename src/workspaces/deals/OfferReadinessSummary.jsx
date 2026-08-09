import { Button, Card, SectionHeader, StatusBadge } from "../../design-system";

const STATUS = Object.freeze({
  blocked: "warning",
  "manual-review-required": "warning",
  "needs-information": "warning",
  "needs-verification": "warning",
  "ready-for-offer-preparation": "success",
  unavailable: "neutral",
});

const GATE_LABELS = Object.freeze({
  failed: "Failed",
  "manual-review": "Manual Review",
  "not-applicable": "Not Applicable",
  passed: "Passed",
  pending: "Pending",
  unavailable: "Unavailable",
});

function groupGates(gates) {
  return gates.reduce((groups, gate) => {
    const category = gate.category || "Strategy Analysis";
    if (!groups[category]) groups[category] = [];
    groups[category].push(gate);
    return groups;
  }, {});
}

// New component reason: existing metric summaries are numeric and cannot
// present strategy-specific, non-numeric gates and approval triggers safely.
export default function OfferReadinessSummary({ onNavigateSection, onNavigateWorkspace, result }) {
  if (!result) return null;
  const groups = groupGates(result.gateResults || []);
  const unresolvedBlocking = result.blockingGateResults?.length || 0;
  const manualReview = result.manualReviewGates?.length || 0;
  const advisory = result.advisoryGateResults?.length || 0;
  const action = result.recommendedNextAction;

  return (
    <Card className="offer-readiness-summary">
      <SectionHeader
        actions={
          <StatusBadge status={STATUS[result.readinessState] || "neutral"}>
            {result.displayLabel || "Unavailable"}
          </StatusBadge>
        }
        description="A preparation gate based on required facts, Evidence, strategy analysis, and review conditions. Pursuit Score remains a separate continued-review priority."
        eyebrow={`${result.strategyLabel || "Asset Strategy"} / ${result.rulesetVersion || "No ruleset"}`}
        title="Offer Readiness"
      />
      <p>{result.explanation}</p>
      <dl aria-label="Offer Readiness gate counts" className="offer-readiness-summary__counts">
        <div><dt>Blocking</dt><dd>{unresolvedBlocking}</dd></div>
        <div><dt>Manual review</dt><dd>{manualReview}</dd></div>
        <div><dt>Advisory</dt><dd>{advisory}</dd></div>
      </dl>
      <div className="offer-readiness-summary__next">
        <div>
          <span>Next safe action</span>
          <strong>{action?.label || "Review Decision"}</strong>
          {action?.explanation ? <p>{action.explanation}</p> : null}
        </div>
        {action?.enabled && action.targetSection ? (
          <Button
            onClick={() => action.targetSection === "approvals"
              ? onNavigateWorkspace?.("approvals")
              : onNavigateSection?.(action.targetSection)}
            variant="secondary"
          >
            Open {action.targetSection === "property" && result.assetType === "vacant-residential-land" ? "Parcel" : action.targetSection === "numbers" && result.assetType === "vacant-residential-land" ? "Land Analysis" : action.targetSection}
          </Button>
        ) : null}
      </div>
      {result.approvalRequirement?.required ? (
        <div className="offer-readiness-summary__approval" role="status">
          <strong>Approval Required</strong>
          <p>{result.approvalRequirement.reason}</p>
        </div>
      ) : null}
      {Object.keys(groups).length ? (
        <details className="offer-readiness-summary__details">
          <summary>Readiness gates and Evidence</summary>
          {Object.entries(groups).map(([category, gates]) => (
            <section aria-labelledby={`readiness-${category.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`} key={category}>
              <h3 id={`readiness-${category.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}>{category}</h3>
              <ul>
                {gates.map((gate) => (
                  <li key={gate.gateId}>
                    <StatusBadge status={gate.evaluationState === "passed" ? "success" : gate.evaluationState === "not-applicable" ? "neutral" : "warning"}>
                      {GATE_LABELS[gate.evaluationState] || "Unavailable"}
                    </StatusBadge>
                    <div>
                      <strong>{gate.label}</strong>
                      <span>{gate.criticality}</span>
                      <p>{gate.reason}</p>
                      {gate.evidenceIds.length ? <small>{gate.evidenceIds.length} Evidence reference{gate.evidenceIds.length === 1 ? "" : "s"}</small> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </details>
      ) : null}
      <p className="offer-readiness-summary__disclaimer">{result.operatorDisclaimer}</p>
    </Card>
  );
}
