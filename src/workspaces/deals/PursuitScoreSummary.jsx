import { Badge, Card, SectionHeader, StatusBadge } from "../../design-system";
import { canPresentPursuitScore } from "../../services/decision-intelligence";

function priorityLabel(score) {
  if (score >= 70) return "High pursuit priority";
  if (score >= 40) return "Moderate pursuit priority";
  return "Low pursuit priority";
}

function displayNumber(value) {
  if (!Number.isFinite(value)) return "Not evaluated";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

// New component reason: existing local metric cards do not provide the
// production eligibility, category explanation, ruleset, and Evidence disclosure
// required for an explainable Pursuit Score.
export default function PursuitScoreSummary({
  assetStrategyContext,
  metric,
  result,
}) {
  if (
    !canPresentPursuitScore({ assetStrategyContext, metric, result })
  ) {
    return null;
  }

  const partial = result.evaluationState === "partial";
  const categories = result.categoryResults.filter((category) =>
    Number.isFinite(category.rawCategoryScore)
  );

  return (
    <Card className="pursuit-score-summary">
      <SectionHeader
        actions={
          <StatusBadge status={partial ? "warning" : "info"}>
            {partial ? "Partial evaluation" : "Evaluated"}
          </StatusBadge>
        }
        description="Strategy-specific prioritization for continued acquisition review."
        title="Pursuit Score"
      />
      <div className="pursuit-score-summary__headline">
        <div
          aria-label={`Pursuit Score ${displayNumber(metric.value)} out of 100`}
          className="pursuit-score-summary__value"
        >
          <strong>{displayNumber(metric.value)}</strong>
          <span>/100</span>
        </div>
        <div className="pursuit-score-summary__meaning">
          <Badge>{priorityLabel(metric.value)}</Badge>
          <p>{metric.explanation}</p>
        </div>
      </div>

      <dl
        aria-label="Pursuit Score category contributions"
        className="pursuit-score-summary__categories"
      >
        {categories.map((category) => (
          <div key={category.categoryId}>
            <dt>{category.label || category.categoryId}</dt>
            <dd>
              <strong>{displayNumber(category.rawCategoryScore)}/100</strong>
              <span>
                {displayNumber(category.weightedContribution)} weighted points
              </span>
              <small>{category.explanation}</small>
            </dd>
          </div>
        ))}
      </dl>

      <details className="pursuit-score-summary__details">
        <summary>Score explanation and Evidence</summary>
        <dl className="pursuit-score-summary__metadata">
          <div>
            <dt>Strategy</dt>
            <dd>{result.strategyId}</dd>
          </div>
          <div>
            <dt>Scoring profile</dt>
            <dd>
              {result.scoringProfileId} / {result.profileVersion}
            </dd>
          </div>
          <div>
            <dt>Ruleset</dt>
            <dd>
              {result.ruleset.rulesetId} / {result.ruleset.rulesetVersion}
            </dd>
          </div>
          <div>
            <dt>Evidence references</dt>
            <dd>{result.evidenceReferenceIds.length}</dd>
          </div>
        </dl>
        <ul
          aria-label="Pursuit Score Evidence and Provenance references"
          className="pursuit-score-summary__evidence"
        >
          {result.evidenceReferenceIds.map((evidenceId) => (
            <li key={evidenceId}>{evidenceId}</li>
          ))}
        </ul>
        {result.partialDataWarnings.length ? (
          <ul className="pursuit-score-summary__warnings">
            {result.partialDataWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </details>

      <p className="pursuit-score-summary__disclaimer">
        {result.operatorDisclaimer}
      </p>
    </Card>
  );
}
