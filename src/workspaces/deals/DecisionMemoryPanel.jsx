import { useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, Input, SectionHeader, Select, TextArea } from "../../design-system/components";
import useDecisionMemory from "../../hooks/useDecisionMemory";
import { OWNER_DECISION_TYPES } from "../../services/decision-intelligence/decisionMemoryService";
import { formatSafeDate } from "../../utils/dates";

function sentence(value) {
  const normalized = String(value || "").replaceAll("_", " ");
  return normalized ? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}` : "Unknown";
}

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount)
    : null;
}

function DecisionSummary({ decision, recommendation }) {
  const override = decision.override_flag === true;
  return (
    <div className="decision-memory__decision">
      <strong>{override ? "Owner override" : "Owner followed recommendation"}</strong>
      <p>
        {override
          ? decision.alternative_result?.label || "Explicit alternative recorded"
          : recommendation?.label || "Canonical recommendation followed"}
      </p>
      {decision.reason ? <p>Reason: {decision.reason}</p> : null}
      <small>{decision.actor_reference || "Recorded actor"} · {formatSafeDate(decision.decided_at || decision.created_at)}</small>
    </div>
  );
}

function OutcomeSummary({ outcome }) {
  const record = outcome.sourceRecord;
  if (outcome.type === "offer-revision") {
    return (
      <li>
        <strong>Offer revision {record.revision_number}: {sentence(record.status)}</strong>
        {money(record.offer_amount) ? ` · ${money(record.offer_amount)}` : ""}
        <small> · source {record.id}</small>
      </li>
    );
  }
  const realized = money(record.actual_realized_proceeds);
  const costs = money(record.actual_costs);
  return (
    <li>
      <strong>Closing revision {record.revision_number}: {sentence(record.status)}</strong>
      {record.accepted_offer_revision_id ? ` · accepted offer ${record.accepted_offer_revision_id}` : ""}
      {realized ? ` · ${realized} realized${costs ? `, ${costs} costs` : ""}` : ""}
      <small> · source {record.id}</small>
    </li>
  );
}

export default function DecisionMemoryPanel({ deal, readModel }) {
  const { currentEntry, error, history, loading, recordDecision } = useDecisionMemory({ deal, readModel });
  const [decisionType, setDecisionType] = useState(OWNER_DECISION_TYPES.FOLLOWED);
  const [alternative, setAlternative] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const currentDecision = currentEntry?.decisions?.[0] || null;

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    const result = await recordDecision({
      alternative: { label: alternative },
      decisionType,
      reason,
    });
    if (!result.success) setFormError(result.error?.message || "Could not record the owner decision.");
    else {
      setAlternative("");
      setReason("");
    }
    setSubmitting(false);
  }

  return (
    <Card className="decision-memory" data-testid="decision-memory">
      <SectionHeader
        description="Immutable recommendations, explicit owner choices, and references to later offer and closing truth."
        title="Decision Memory"
      />
      <p className="decision-memory__limitation">{history.limitation}</p>

      {error ? <ErrorState description={error} title="Decision Memory is partial" /> : null}
      {loading ? <p>Loading Decision Memory...</p> : null}

      {!loading && currentEntry && !currentDecision ? (
        <form className="decision-memory__form" onSubmit={submit}>
          <Select
            label="Owner decision"
            onChange={(event) => setDecisionType(event.target.value)}
            value={decisionType}
          >
            <option value={OWNER_DECISION_TYPES.FOLLOWED}>Follow recommendation</option>
            <option value={OWNER_DECISION_TYPES.ALTERNATIVE}>Choose an alternative</option>
          </Select>
          {decisionType === OWNER_DECISION_TYPES.ALTERNATIVE ? (
            <Input
              label="Explicit alternative"
              onChange={(event) => setAlternative(event.target.value)}
              required
              value={alternative}
            />
          ) : null}
          <TextArea
            hint={decisionType === OWNER_DECISION_TYPES.ALTERNATIVE ? "Required for an override." : "Optional context for following the recommendation."}
            label="Decision reason"
            onChange={(event) => setReason(event.target.value)}
            required={decisionType === OWNER_DECISION_TYPES.ALTERNATIVE}
            rows={2}
            value={reason}
          />
          {formError ? <p role="alert">{formError}</p> : null}
          <Button disabled={submitting} type="submit">
            {submitting ? "Recording..." : "Record owner decision"}
          </Button>
        </form>
      ) : null}

      {!loading && history.entries.length === 0 ? (
        <EmptyState
          description="A usable canonical recalculation will create the first immutable snapshot."
          title="No decision history yet"
        />
      ) : (
        <ol aria-label="Decision Memory history" className="decision-memory__history">
          {history.entries.map((entry) => {
            const recommendation = entry.snapshot.recommendation_result;
            const basis = entry.snapshot.recommendation_basis;
            return (
              <li key={entry.snapshot.id}>
                <article>
                  <div className="decision-memory__heading">
                    <strong>Recommendation {entry.snapshot.snapshot_number}</strong>
                    <Badge>{entry.snapshot.decision_contract_version}</Badge>
                  </div>
                  <p>{recommendation?.label || recommendation?.actionCode || "Recommendation recorded"}</p>
                  <p>{recommendation?.explanation}</p>
                  <small>
                    Evaluated {formatSafeDate(entry.snapshot.evaluated_at)} · basis {basis?.basisType || "reference unavailable"}
                  </small>
                  {entry.decisions.map((decision) => (
                    <DecisionSummary decision={decision} key={decision.id} recommendation={recommendation} />
                  ))}
                  {entry.outcomes.length ? (
                    <div className="decision-memory__outcomes">
                      <strong>Later lifecycle references</strong>
                      <ul>
                        {entry.outcomes.map((outcome) => <OutcomeSummary key={outcome.id} outcome={outcome} />)}
                      </ul>
                    </div>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
