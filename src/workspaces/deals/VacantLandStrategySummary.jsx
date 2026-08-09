import { Badge, Card, SectionHeader, StatusBadge } from "../../design-system";
import { formatUsd } from "../../utils/currency";

const EXIT_LABELS = Object.freeze({
  blocked: "Blocked", candidate: "Candidate",
  "manual-review-required": "Manual Review Required",
  "not-evaluated": "Not Evaluated", reviewable: "Reviewable",
});

const ratio = (value) => Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "Not evaluated";
const number = (value, suffix = "") => Number.isFinite(value) ? `${value.toLocaleString()}${suffix}` : "Not evaluated";
const status = (value) => ["candidate", "reviewable"].includes(value) ? "success" : value === "blocked" ? "warning" : "info";

// New component reason: existing summaries encode residential underwriting;
// this component has the distinct responsibility of presenting land valuation,
// parcel feasibility, and review-only land exits without residential formulas.
export default function VacantLandStrategySummary({ compact = false, result }) {
  if (!result?.eligible) return null;
  const valuation = result.valuation || {};
  const signals = result.feasibilitySignals || [];
  const exits = result.exitCandidates || [];
  return (
    <Card className="residential-strategy vacant-land-strategy">
      <SectionHeader
        actions={<StatusBadge status="success">Implemented</StatusBadge>}
        description="Deterministic land-value context and parcel review signals from explicit stored facts and Evidence."
        eyebrow="Vacant Land Acquisition Strategy v1"
        title="Vacant Land Strategy"
      />
      <div className="residential-strategy__status" aria-label="Vacant Land Strategy status">
        <Badge>{result.strategyVersion}</Badge>
        <Badge>{result.scoringProfileId}</Badge>
        <StatusBadge status={valuation.evaluationState === "evaluated" ? "info" : "warning"}>
          Valuation: {valuation.evaluationState === "evaluated" ? "Evaluated" : "Missing required facts"}
        </StatusBadge>
      </div>
      <dl aria-label="Vacant land valuation context" className="residential-strategy__metrics">
        <div><dt>Asking price</dt><dd>{formatUsd(valuation.askingPrice, "Not evaluated")}</dd></div>
        <div><dt>Parcel size</dt><dd>{number(valuation.parcelSizeAcres, " acres")}</dd></div>
        <div><dt>Asking price per acre</dt><dd>{formatUsd(valuation.askingPricePerAcre, "Not evaluated")}</dd></div>
        <div><dt>Indicated land value</dt><dd>{formatUsd(valuation.indicatedLandValue, "Not evaluated")}</dd></div>
        <div><dt>Indicated value per acre</dt><dd>{formatUsd(valuation.indicatedValuePerAcre, "Not evaluated")}</dd></div>
        <div><dt>Gross land spread</dt><dd>{formatUsd(valuation.grossLandSpread, "Not evaluated")}</dd></div>
        <div><dt>Discount to indicated value</dt><dd>{ratio(valuation.discountToIndicatedValueRatio)}</dd></div>
        <div><dt>Land comparable count</dt><dd>{valuation.comparableCount || "None"}</dd></div>
      </dl>
      {!compact ? (
        <>
          <section aria-labelledby="land-feasibility-signals">
            <h3 id="land-feasibility-signals">Parcel feasibility signals</h3>
            {signals.length ? <ul className="residential-strategy__list">{signals.map((item) => (
              <li key={item.signalId}><StatusBadge status={item.severity === "blocking" ? "warning" : "neutral"}>{item.severity}</StatusBadge><div><strong>{item.label}</strong><p>{item.explanation}</p></div></li>
            ))}</ul> : <p>No represented feasibility signals were found. This is not a buildability conclusion.</p>}
          </section>
          <section aria-labelledby="land-exit-candidates">
            <h3 id="land-exit-candidates">Review-only land exit candidates</h3>
            <ul className="residential-strategy__list">{exits.map((item) => (
              <li key={item.candidateId}><StatusBadge status={status(item.state)}>{EXIT_LABELS[item.state] || "Not Evaluated"}</StatusBadge><div><strong>{item.label}</strong><p>{item.explanation}</p>{item.manualReviewRequirements?.length ? <small>{item.manualReviewRequirements.join(" ")}</small> : null}</div></li>
            ))}</ul>
          </section>
        </>
      ) : null}
      <details className="residential-strategy__details">
        <summary>Valuation Evidence, assumptions, and limitations</summary>
        <p>Source: {valuation.valuationSource || "Not available"}; valid stored land comps: {valuation.comparableCount || 0}.</p>
        {(valuation.assumptions || []).map((item) => <p key={item}>{item}</p>)}
        <p>{valuation.operatorDisclosure}</p>
        {(valuation.partialDataWarnings || []).map((item) => <p key={item}>{item}</p>)}
      </details>
    </Card>
  );
}
