import {
  Badge,
  Card,
  SectionHeader,
  StatusBadge,
} from "../../design-system";
import { formatUsd } from "../../utils/currency";

const EXIT_STATE_LABELS = Object.freeze({
  blocked: "Blocked",
  candidate: "Candidate",
  "manual-review-required": "Manual Review Required",
  "not-evaluated": "Not Evaluated",
  reviewable: "Reviewable",
});

function formatRatio(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "Not evaluated";
}

function statusForState(value) {
  if (value === "candidate" || value === "reviewable") return "success";
  if (value === "blocked") return "warning";
  if (value === "manual-review-required") return "info";
  return "neutral";
}

function UnderwritingFacts({ underwriting }) {
  const evaluated = underwriting?.evaluationState === "evaluated";
  const values = [
    ["Acquisition ceiling", underwriting?.acquisitionCeiling, "currency"],
    ["Ceiling spread", underwriting?.ceilingSpread, "currency"],
    ["Wholesale target", underwriting?.wholesaleTarget, "currency"],
    ["Projected flip gross margin", underwriting?.projectedFlipGrossMargin, "currency"],
    ["Projected flip gross-margin ratio", underwriting?.projectedFlipGrossMarginRatio, "ratio"],
    ["Repair-to-ARV ratio", underwriting?.repairToArvRatio, "ratio"],
    ["Rent-to-price ratio", underwriting?.rentToPriceRatio, "ratio"],
  ];

  if (!evaluated) {
    return (
      <p className="residential-strategy__unavailable">
        Missing required facts. Residential underwriting is not evaluated and unavailable values are not shown as zero.
      </p>
    );
  }

  return (
    <dl aria-label="Residential underwriting results" className="residential-strategy__metrics">
      {values.map(([label, value, type]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{type === "ratio" ? formatRatio(value) : formatUsd(value, "Not evaluated")}</dd>
        </div>
      ))}
    </dl>
  );
}

// New component reason: no existing component combines the versioned residential
// underwriting, individual risk signals, exit candidates, and assumption disclosure.
export default function ResidentialStrategySummary({ result }) {
  if (!result?.eligible) return null;

  const underwriting = result.underwriting;
  const risks = Array.isArray(result.riskSignals) ? result.riskSignals : [];
  const exits = Array.isArray(result.exitCandidates) ? result.exitCandidates : [];

  return (
    <Card className="residential-strategy">
      <SectionHeader
        actions={<StatusBadge status="success">Implemented</StatusBadge>}
        description="Versioned deterministic underwriting and review guidance for this explicitly classified residential home."
        eyebrow="Residential Acquisition Strategy v1"
        title="Residential Strategy"
      />
      <div className="residential-strategy__status" aria-label="Residential Strategy status">
        <Badge>{result.strategyVersion}</Badge>
        <Badge>{result.scoringProfileId}</Badge>
        <StatusBadge status={underwriting?.evaluationState === "evaluated" ? "info" : "warning"}>
          Underwriting: {underwriting?.evaluationState === "evaluated" ? "Evaluated" : "Missing required facts"}
        </StatusBadge>
      </div>

      <UnderwritingFacts underwriting={underwriting} />

      <section aria-labelledby="residential-risk-signals">
        <h3 id="residential-risk-signals">Risk signals</h3>
        {risks.length ? (
          <ul className="residential-strategy__list">
            {risks.map((signal) => (
              <li key={signal.signalId}>
                <StatusBadge status={signal.severity === "blocking" ? "warning" : "neutral"}>
                  {signal.severity}
                </StatusBadge>
                <div>
                  <strong>{signal.label}</strong>
                  <p>{signal.explanation}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No individual risk signals are represented by the current inputs. This is not a Risk Level assessment.</p>
        )}
      </section>

      <section aria-labelledby="residential-exit-candidates">
        <h3 id="residential-exit-candidates">Review-only exit candidates</h3>
        <ul className="residential-strategy__list">
          {exits.map((candidate) => (
            <li key={candidate.candidateId}>
              <StatusBadge status={statusForState(candidate.state)}>
                {EXIT_STATE_LABELS[candidate.state] || "Not Evaluated"}
              </StatusBadge>
              <div>
                <strong>{candidate.label}</strong>
                <p>{candidate.explanation}</p>
                {candidate.manualReviewRequirements.length ? (
                  <small>{candidate.manualReviewRequirements.join(" ")}</small>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <details className="residential-strategy__details">
        <summary>Assumptions and excluded costs</summary>
        <p>{underwriting?.assumptionDisclosure}</p>
        <p>{underwriting?.excludedCostDisclosure}</p>
        <p>{underwriting?.operatorDisclaimer}</p>
      </details>
    </Card>
  );
}
