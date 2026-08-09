import { useMemo, useState } from "react";
import { Badge, StatusBadge } from "../design-system";
import { evaluateResidentialStrategyPreview } from "../services/asset-strategy";
import { formatUsd } from "../utils/currency";

export default function OfferEngine({ deal, strategyResult = null }) {
  const [evaluatedTimestamp] = useState(() => new Date().toISOString());
  const fallbackResult = useMemo(
    () =>
      strategyResult ||
      evaluateResidentialStrategyPreview({ deal, evaluatedTimestamp }),
    [deal, evaluatedTimestamp, strategyResult]
  );
  const underwriting = fallbackResult?.underwriting;
  const evaluated = underwriting?.evaluationState === "evaluated";
  const creativeCandidates = (fallbackResult?.exitCandidates || []).filter(
    (candidate) =>
      ["seller-finance-exploration", "subject-to-exploration"].includes(
        candidate.candidateId
      )
  );

  return (
    <section aria-labelledby="offer-engine-title" className="residential-offer-review">
      <div className="residential-analyzer__header">
        <h3 id="offer-engine-title">Offer review</h3>
        <Badge>Review only</Badge>
      </div>
      {evaluated ? (
        <dl aria-label="Residential offer review values" className="residential-analyzer__results">
          <div>
            <dt>Acquisition ceiling</dt>
            <dd>{formatUsd(underwriting.acquisitionCeiling)}</dd>
          </div>
          <div>
            <dt>Wholesale target</dt>
            <dd>{formatUsd(underwriting.wholesaleTarget)}</dd>
          </div>
        </dl>
      ) : (
        <p>Offer review is not evaluated until the required residential facts are present.</p>
      )}
      <p className="residential-analyzer__notice">
        These internal estimates prepare human review. They do not submit or approve an offer.
      </p>
      <div className="residential-offer-review__creative">
        {creativeCandidates.map((candidate) => (
          <div key={candidate.candidateId}>
            <StatusBadge status="info">Manual Review Required</StatusBadge>
            <strong>{candidate.label}</strong>
            <p>{candidate.explanation}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
