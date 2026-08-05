import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  SectionHeader,
  StatusBadge,
} from "../../design-system";
import { formatSafeDate } from "../../utils/dates";

const STATE_STATUS = Object.freeze({
  present: "success",
  missing: "warning",
  unknown: "neutral",
  unverified: "warning",
  conflicting: "danger",
  stale: "warning",
  unavailable: "neutral",
  "not-applicable": "neutral",
});

const CRITICALITY_STATUS = Object.freeze({
  blocking: "danger",
  advisory: "warning",
  informational: "neutral",
});

function displayLabel(value) {
  return String(value || "unknown")
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function groupItems(items) {
  const groups = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const category = item.category || "Decision";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item);
  });
  groups.forEach((entries) =>
    entries.sort(
      (left, right) =>
        ["blocking", "advisory", "informational"].indexOf(left.criticality) -
        ["blocking", "advisory", "informational"].indexOf(right.criticality)
    )
  );
  return [...groups.entries()];
}

function copyActionLabel(kind) {
  return kind === "question" ? "Copy Seller Question" : "Copy Research Guidance";
}

function InformationItem({ item, onCopy, onNavigateSection }) {
  const evidenceCount = item.evidenceReferenceIds.length;
  const conflictCount = item.conflictIds.length;
  return (
    <article className="missing-autopilot__item">
      <div className="missing-autopilot__item-heading">
        <div>
          <h4>{item.label}</h4>
          <p>{item.reason || item.description}</p>
        </div>
        <div className="missing-autopilot__badges" aria-label={`${item.label} status`}>
          <StatusBadge status={STATE_STATUS[item.state] || "neutral"}>
            State: {displayLabel(item.state)}
          </StatusBadge>
          <StatusBadge
            status={CRITICALITY_STATUS[item.criticality] || "neutral"}
          >
            Criticality: {displayLabel(item.criticality)}
          </StatusBadge>
        </div>
      </div>

      <dl className="missing-autopilot__facts">
        {item.currentValueSummary ? (
          <div>
            <dt>Current value</dt>
            <dd>{item.currentValueSummary}</dd>
          </div>
        ) : null}
        {item.matchedSourceField ? (
          <div>
            <dt>Source field</dt>
            <dd>{item.matchedSourceField}</dd>
          </div>
        ) : null}
        {item.verificationState ? (
          <div>
            <dt>Verification</dt>
            <dd>{displayLabel(item.verificationState)}</dd>
          </div>
        ) : null}
        {item.freshnessState ? (
          <div>
            <dt>Freshness</dt>
            <dd>{displayLabel(item.freshnessState)}</dd>
          </div>
        ) : null}
      </dl>

      {item.description ? (
        <div className="missing-autopilot__guidance">
          <strong>Why it matters</strong>
          <p>{item.description}</p>
        </div>
      ) : null}

      {item.sellerQuestion ? (
        <div className="missing-autopilot__guidance">
          <strong>Seller question</strong>
          <p>{item.sellerQuestion}</p>
        </div>
      ) : null}
      {item.researchGuidance ? (
        <div className="missing-autopilot__guidance">
          <strong>Manual research guidance</strong>
          <p>{item.researchGuidance}</p>
        </div>
      ) : null}

      <div className="missing-autopilot__actions">
        <Button
          onClick={() => onNavigateSection?.(item.relatedSection)}
          size="sm"
          variant="secondary"
        >
          Open {displayLabel(item.relatedSection)}
        </Button>
        {item.sellerQuestion ? (
          <Button
            onClick={() => onCopy(item.sellerQuestion, "question", item.itemId)}
            size="sm"
            variant="secondary"
          >
            {copyActionLabel("question")}
          </Button>
        ) : null}
        {item.researchGuidance ? (
          <Button
            onClick={() =>
              onCopy(item.researchGuidance, "guidance", item.itemId)
            }
            size="sm"
            variant="secondary"
          >
            {copyActionLabel("guidance")}
          </Button>
        ) : null}
      </div>

      <details className="missing-autopilot__evidence">
        <summary>Evidence and Provenance</summary>
        <dl>
          <div>
            <dt>Canonical field</dt>
            <dd>{item.canonicalField || "Not available"}</dd>
          </div>
          <div>
            <dt>Evidence references</dt>
            <dd>
              {evidenceCount
                ? item.evidenceReferenceIds.join(", ")
                : "No evidence reference is attached to this missing fact."}
            </dd>
          </div>
          <div>
            <dt>Conflict references</dt>
            <dd>
              {conflictCount ? item.conflictIds.join(", ") : "No explicit conflict supplied."}
            </dd>
          </div>
          <div>
            <dt>Source timestamp</dt>
            <dd>{formatSafeDate(item.sourceTimestamp, "Not available")}</dd>
          </div>
        </dl>
        {item.compatibilityWarning ? <p>{item.compatibilityWarning}</p> : null}
        {item.partialDataWarnings.length ? (
          <ul>
            {item.partialDataWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </details>
    </article>
  );
}

function NextInformationAction({ action, onCopy, onNavigateSection }) {
  if (!action) return null;
  const copyValue = action.sellerQuestion || action.researchGuidance;
  const copyKind = action.sellerQuestion ? "question" : "guidance";
  return (
    <div className="missing-autopilot__next-action">
      <span>Highest-priority next information action</span>
      <strong>{action.label}</strong>
      {action.explanation ? <p>{action.explanation}</p> : null}
      {copyValue ? (
        <Button
          onClick={() => onCopy(copyValue, copyKind, action.actionId)}
          size="sm"
          variant="secondary"
        >
          {copyActionLabel(copyKind)}
        </Button>
      ) : (
        <Button
          disabled={!action.enabled}
          onClick={() => onNavigateSection?.(action.targetSection)}
          size="sm"
          variant="secondary"
        >
          Open {displayLabel(action.targetSection)}
        </Button>
      )}
    </div>
  );
}

// New component reason: the former flat missing-facts list could not present
// asset-aware requirements, provenance, safe copy actions, and limitations as
// one reusable read-only Decision Room experience.
export default function MissingInformationAutopilot({
  onNavigateSection,
  readModel,
}) {
  const [copyStatus, setCopyStatus] = useState(null);

  async function handleCopy(value, kind, itemId) {
    try {
      if (!globalThis.navigator?.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await globalThis.navigator.clipboard.writeText(value);
      setCopyStatus({
        id: itemId,
        kind: "success",
        message:
          kind === "question"
            ? "Seller question copied. Review and edit it before use."
            : "Research guidance copied. Research remains pending until evidence is supplied.",
      });
    } catch {
      setCopyStatus({
        id: itemId,
        kind: "error",
        message: "Unable to copy to the clipboard. The text remains visible for manual selection.",
      });
    }
  }

  if (!readModel || readModel.status === "failed") {
    return (
      <Card className="decision-room__missing missing-autopilot" muted>
        <ErrorState
          description="The stored deal remains available, but missing-information requirements could not be evaluated."
          title="Missing Information unavailable"
        />
      </Card>
    );
  }

  const groups = groupItems(readModel.openItems);
  const reviewCount =
    readModel.counts.unknown +
    readModel.counts.unverified +
    readModel.counts.conflicting +
    readModel.counts.stale;

  return (
    <Card className="decision-room__missing missing-autopilot" muted>
      <SectionHeader
        description="Deterministic detection of decision-critical facts from the current stored record. No research, messaging, or CRM update runs from this panel."
        eyebrow={readModel.selectedProfile?.label || "Common Acquisition Core"}
        title="Missing Information"
      />

      <div className="missing-autopilot__summary" aria-label="Missing information summary">
        <StatusBadge status={readModel.counts.blocking ? "danger" : "success"}>
          Blocking: {readModel.counts.blocking}
        </StatusBadge>
        <StatusBadge status={readModel.counts.advisory ? "warning" : "neutral"}>
          Advisory: {readModel.counts.advisory}
        </StatusBadge>
        <StatusBadge status={reviewCount ? "warning" : "neutral"}>
          Unknown or review required: {reviewCount}
        </StatusBadge>
        <Badge>
          Last evaluated: {formatSafeDate(readModel.evaluatedTimestamp, "Not available")}
        </Badge>
      </div>

      <NextInformationAction
        action={readModel.highestPriorityAction}
        onCopy={handleCopy}
        onNavigateSection={onNavigateSection}
      />

      {copyStatus ? (
        <p
          className={`missing-autopilot__copy-status missing-autopilot__copy-status--${copyStatus.kind}`}
          role={copyStatus.kind === "error" ? "alert" : "status"}
        >
          {copyStatus.message}
        </p>
      ) : null}

      {readModel.status === "partial" || readModel.partialDataWarnings.length ? (
        <div className="decision-room__partial-warning" role="status">
          <strong>Partial evaluation</strong>
          <p>Available requirements are shown. Review the source warnings before relying on omitted or unavailable facts.</p>
        </div>
      ) : null}

      {groups.length ? (
        <div className="missing-autopilot__groups">
          {groups.map(([category, items], index) => (
            <section aria-labelledby={`missing-group-${index}`} key={category}>
              <h3 id={`missing-group-${index}`}>{category}</h3>
              <div className="missing-autopilot__items">
                {items.map((item) => (
                  <InformationItem
                    item={item}
                    key={item.itemId}
                    onCopy={handleCopy}
                    onNavigateSection={onNavigateSection}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          description="No currently evaluated requirements are missing. This does not establish purchase readiness, verification, scoring, or final strategy readiness."
          title="No currently evaluated gaps"
        />
      )}

      {readModel.limitations.length ? (
        <section
          aria-labelledby="strategy-capability-limitations"
          className="missing-autopilot__limitations"
        >
          <h3 id="strategy-capability-limitations">
            Strategy and Capability Limitations
          </h3>
          <ul>
            {readModel.limitations.map((limitation) => (
              <li key={limitation.limitationId}>
                <strong>{limitation.label}</strong>
                {limitation.explanation ? <span>{limitation.explanation}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Card>
  );
}
