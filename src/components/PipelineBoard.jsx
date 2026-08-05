import { memo, useState } from "react";
import { Badge, Button, StatusBadge } from "../design-system";
import { formatUsd } from "../utils/currency";

const COLUMN_BATCH_SIZE = 12;

function formatDate(value, fallback = "Not available") {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString();
}

function urgencyStyle(urgency) {
  if (["Critical", "High"].includes(urgency)) return "danger";
  if (urgency === "Medium") return "warning";
  return "neutral";
}

function riskStyle(riskLevel) {
  if (["Critical", "High"].includes(riskLevel)) return "danger";
  if (riskLevel === "Medium") return "warning";
  return "neutral";
}

// Distinct responsibility: render one normalized opportunity without deriving pipeline rules.
export function PipelineCard({ item, onOpenDeal, onToggleSelect }) {
  const financialFact =
    item.financialSummary.askingPrice !== null
      ? `Asking ${formatUsd(item.financialSummary.askingPrice)}`
      : item.financialSummary.arv !== null
        ? `ARV ${formatUsd(item.financialSummary.arv)}`
        : "No financial facts loaded";

  return (
    <article className={`pipeline-card ${item.selected ? "pipeline-card--selected" : ""}`.trim()}>
      <div className="pipeline-card__toolbar">
        {onToggleSelect && item.hasPersistentId ? (
          <label className="pipeline-card__selection">
            <input
              checked={item.selected}
              onChange={() => onToggleSelect(item.dealId)}
              type="checkbox"
            />
            <span className="sr-only">Select {item.propertyAddress}</span>
          </label>
        ) : null}
        <div className="pipeline-card__badges">
          <StatusBadge status={urgencyStyle(item.urgency)}>
            Urgency: {item.urgency || "Not signaled"}
          </StatusBadge>
          {item.atRisk ? (
            <StatusBadge status={riskStyle(item.riskLevel)}>Risk: {item.riskLevel}</StatusBadge>
          ) : null}
        </div>
      </div>

      <button
        aria-label={
          item.hasPersistentId
            ? `Open deal ${item.propertyAddress}`
            : `${item.propertyAddress} cannot be opened because its deal ID is missing`
        }
        className="pipeline-card__open"
        disabled={!item.hasPersistentId}
        onClick={() => onOpenDeal(item)}
        type="button"
      >
        <div>
          <h3>{item.propertyAddress}</h3>
          <p className="pipeline-card__seller">{item.seller}</p>
        </div>

        <div className="pipeline-card__status">
          <Badge>{item.currentStatus}</Badge>
          {item.approvalRequired ? <StatusBadge status="warning">Approval required</StatusBadge> : null}
          {item.needsReply ? <StatusBadge status="info">Needs Reply</StatusBadge> : null}
          {item.unreadConversation ? <StatusBadge status="info">Unread conversation</StatusBadge> : null}
          {item.stale ? <StatusBadge status="danger">Stale</StatusBadge> : null}
        </div>

        <div className="pipeline-card__next-action">
          <span>Next action</span>
          <strong>{item.nextAction || "No next action recorded"}</strong>
          {item.nextActionDueDate ? <small>Due {formatDate(item.nextActionDueDate)}</small> : null}
        </div>

        <dl className="pipeline-card__facts">
          <div>
            <dt>Assigned</dt>
            <dd>{item.assignedUser || "Unassigned"}</dd>
          </div>
          <div>
            <dt>Last activity</dt>
            <dd>{formatDate(item.lastMeaningfulActivity.timestamp)}</dd>
          </div>
          <div>
            <dt>Supporting fact</dt>
            <dd>{financialFact}</dd>
          </div>
          <div>
            <dt>Missing information</dt>
            <dd>{item.missingInformationCount}</dd>
          </div>
        </dl>
      </button>
    </article>
  );
}

// Existing board responsibility retained: group and bound normalized cards by pipeline stage.
function PipelineBoard({ stageColumns = [], onOpenDeal, onToggleSelect }) {
  const [visibleByStage, setVisibleByStage] = useState({});

  function visibleLimit(stageId) {
    return visibleByStage[stageId] || COLUMN_BATCH_SIZE;
  }

  function showMore(stageId) {
    setVisibleByStage((current) => ({
      ...current,
      [stageId]: visibleLimit(stageId) + COLUMN_BATCH_SIZE,
    }));
  }

  return (
    <div
      aria-label="Pipeline board by stage"
      className="pipeline-board-scroll"
      data-testid="pipeline-board"
      role="region"
      tabIndex={0}
    >
      <div className="pipeline-board">
        {stageColumns.map((stage) => {
          const limit = visibleLimit(stage.id);
          const visibleItems = stage.items.slice(0, limit);
          const remaining = Math.max(0, stage.items.length - visibleItems.length);

          return (
            <section aria-labelledby={`pipeline-stage-${stage.id}`} className="pipeline-column" key={stage.id}>
              <header className="pipeline-column__header">
                <h2 id={`pipeline-stage-${stage.id}`}>{stage.label}</h2>
                <Badge>{stage.count}</Badge>
              </header>

              <div className="pipeline-column__items">
                {visibleItems.length ? (
                  visibleItems.map((item) => (
                    <PipelineCard
                      item={item}
                      key={item.id}
                      onOpenDeal={onOpenDeal}
                      onToggleSelect={onToggleSelect}
                    />
                  ))
                ) : (
                  <p className="pipeline-column__empty">No opportunities in this stage.</p>
                )}
              </div>

              {remaining ? (
                <Button onClick={() => showMore(stage.id)} size="sm" variant="secondary">
                  Show {Math.min(COLUMN_BATCH_SIZE, remaining)} more
                </Button>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default memo(PipelineBoard);
