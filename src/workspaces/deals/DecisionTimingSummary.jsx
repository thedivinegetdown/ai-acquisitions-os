import { Card, SectionHeader, StatusBadge } from "../../design-system";
import { formatSafeDate } from "../../utils/dates";

const STATUS = Object.freeze({
  critical: "danger",
  high: "warning",
  moderate: "info",
  low: "neutral",
  unavailable: "neutral",
  overdue: "danger",
  "act-now": "warning",
  today: "warning",
});

function label(value) {
  return String(value || "unavailable")
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function sourceTiming(windowResult) {
  const value =
    windowResult?.sourceDueTimestamp ||
    windowResult?.sourceExpirationTimestamp ||
    windowResult?.sourceEventTimestamp;
  return value ? formatSafeDate(value, "Not available") : "No source deadline represented";
}

export default function DecisionTimingSummary({ costOfDelay, recommendationBasis, windowResult }) {
  if (!costOfDelay && !windowResult) return null;

  return (
    <Card className="decision-timing">
      <SectionHeader
        description="Deterministic operational timing for the current recommended action."
        title="Decision Timing"
      />
      <div className="decision-timing__summaries">
        <section aria-labelledby="cost-of-delay-heading">
          <header>
            <h3 id="cost-of-delay-heading">Cost of Delay</h3>
            <StatusBadge status={STATUS[costOfDelay?.level] || "neutral"}>
              {costOfDelay?.displayLabel || "Unavailable"}
            </StatusBadge>
          </header>
          <dl>
            <div><dt>Recommendation basis</dt><dd>{label(recommendationBasis?.basisType)}</dd></div>
            <div><dt>Direct timing trigger</dt><dd>{costOfDelay?.directOperationalTrigger ? "Yes" : "No"}</dd></div>
            <div><dt>Seller timeline</dt><dd>{Number.isFinite(costOfDelay?.sellerTimelineDays) ? `${costOfDelay.sellerTimelineDays} days` : "Unknown"}</dd></div>
          </dl>
          <p>{costOfDelay?.explanation}</p>
          <p className="decision-timing__warning">Cost of Delay is an operational urgency category, not a dollar estimate.</p>
        </section>
        <section aria-labelledby="action-window-heading">
          <header>
            <h3 id="action-window-heading">Recommended Action Window</h3>
            <StatusBadge status={STATUS[windowResult?.windowType] || "neutral"}>
              {windowResult?.displayLabel || "Unavailable"}
            </StatusBadge>
          </header>
          <dl>
            <div><dt>Timing basis</dt><dd>{label(windowResult?.basisType)}</dd></div>
            <div><dt>Source timing</dt><dd>{sourceTiming(windowResult)}</dd></div>
            <div><dt>Timing type</dt><dd>{windowResult?.policyDerived ? "Policy-derived timing" : "Explicit source timing"}</dd></div>
          </dl>
          <p>{windowResult?.explanation}</p>
        </section>
      </div>
      <details className="decision-timing__details">
        <summary>Timing references</summary>
        <dl>
          <div><dt>Due timestamp</dt><dd>{windowResult?.sourceDueTimestamp || "None supplied"}</dd></div>
          <div><dt>Approval expiration</dt><dd>{windowResult?.sourceExpirationTimestamp || "None supplied"}</dd></div>
          <div><dt>Seller reply timestamp</dt><dd>{windowResult?.sourceEventTimestamp || "None supplied"}</dd></div>
          <div><dt>Evidence IDs</dt><dd>{windowResult?.evidenceIds?.join(", ") || "None supplied"}</dd></div>
          <div><dt>Cost ruleset</dt><dd>{costOfDelay?.rulesetVersion || "Not available"}</dd></div>
          <div><dt>Action-window ruleset</dt><dd>{windowResult?.rulesetVersion || "Not available"}</dd></div>
        </dl>
      </details>
      <p className="decision-timing__disclaimer">{costOfDelay?.operatorDisclaimer}</p>
      <p className="decision-timing__disclaimer">{windowResult?.operatorDisclaimer}</p>
    </Card>
  );
}
