import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  SectionHeader,
  StatusBadge,
  Tabs,
} from "../../design-system";
import { buildTodayBriefing, buildTodayReadModel, TODAY_CATEGORY_LABELS } from "../../services/today";

const CATEGORY_STATUS = {
  "act-now": "info",
  approvals: "warning",
  waiting: "neutral",
  "at-risk": "danger",
  completed: "success",
};

const PRIORITY_STATUS = {
  Critical: "danger",
  High: "warning",
  Medium: "info",
  Low: "neutral",
};

function formatTimestamp(value) {
  if (!value) return "Not refreshed yet";
  return new Date(value).toLocaleString();
}

function findDealById(deals = [], dealId) {
  if (!dealId) return null;
  return deals.find((deal) => [deal.id, deal.deal_id, deal.lead_id, deal.property_id].includes(dealId)) || null;
}

function readSelectedCategory() {
  if (typeof window === "undefined") return "act-now";
  return localStorage.getItem("ai-today-category") || "act-now";
}

function persistSelectedCategory(categoryId) {
  if (typeof window === "undefined") return;
  localStorage.setItem("ai-today-category", categoryId);
}

function BriefingCard({ briefing }) {
  return (
    <Card className="today-briefing">
      <SectionHeader
        description={`Last refreshed ${formatTimestamp(briefing.generatedAt)}`}
        title="Daily Acquisition Briefing"
      />
      <p className="today-briefing__summary">{briefing.summary}</p>
      <div className="today-briefing__focus">
        <strong>Recommended focus:</strong> {briefing.focusText}
      </div>
      <dl className="today-briefing__metrics" aria-label="Today briefing counts">
        <div>
          <dt>Urgent</dt>
          <dd>{briefing.counts.urgentActions}</dd>
        </div>
        <div>
          <dt>Seller replies</dt>
          <dd>{briefing.counts.sellerReplies}</dd>
        </div>
        <div>
          <dt>Approvals</dt>
          <dd>{briefing.counts.approvals}</dd>
        </div>
        <div>
          <dt>At risk</dt>
          <dd>{briefing.counts.atRisk}</dd>
        </div>
        <div>
          <dt>Follow-ups</dt>
          <dd>{briefing.counts.dueOrOverdueFollowUps}</dd>
        </div>
        <div>
          <dt>Waiting</dt>
          <dd>{briefing.counts.waiting}</dd>
        </div>
      </dl>
    </Card>
  );
}

function SourceWarnings({ warnings = [] }) {
  if (!warnings.length) return null;

  return (
    <ErrorState
      description={warnings.join(" ")}
      title="Some Today sources are incomplete"
    />
  );
}

function TodayItemCard({ item, onOpenItem }) {
  const primaryAction = item.availableActions[0];

  return (
    <article className="today-item">
      <button
        className="today-item__main"
        onClick={() => onOpenItem(item)}
        type="button"
      >
        <div className="today-item__header">
          <div>
            <h3>{item.title}</h3>
            <p>{item.summary}</p>
          </div>
          <div className="today-item__badges">
            <StatusBadge status={CATEGORY_STATUS[item.category] || "neutral"}>
              {TODAY_CATEGORY_LABELS[item.category] || item.category}
            </StatusBadge>
            <StatusBadge status={PRIORITY_STATUS[item.priority] || "neutral"}>
              {item.priority}
            </StatusBadge>
          </div>
        </div>

        <dl className="today-item__meta">
          <div>
            <dt>Related</dt>
            <dd>{item.relatedDeal}</dd>
          </div>
          <div>
            <dt>Seller</dt>
            <dd>{item.relatedSeller}</dd>
          </div>
          <div>
            <dt>Due</dt>
            <dd>{item.actionWindow || item.urgency || "No due date"}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{item.status}</dd>
          </div>
        </dl>

        <div className="today-item__reason">
          <strong>Why it matters:</strong> {item.reason || "Current data indicates this item needs review."}
        </div>
        <div className="today-item__action">
          <strong>Next action:</strong> {item.recommendedNextAction}
        </div>
      </button>

      {primaryAction ? (
        <div className="today-item__footer">
          <Badge>{item.source}</Badge>
          <Button onClick={() => onOpenItem(item)} size="sm" variant="secondary">
            {primaryAction.label}
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function TodayList({ categoryId, items, onOpenItem }) {
  if (!items.length) {
    return (
      <EmptyState
        description={`There are no ${TODAY_CATEGORY_LABELS[categoryId].toLowerCase()} items from the currently loaded data.`}
        title={`No ${TODAY_CATEGORY_LABELS[categoryId]} items`}
      />
    );
  }

  return (
    <div className="today-list" aria-label={`${TODAY_CATEGORY_LABELS[categoryId]} work list`}>
      {items.map((item) => (
        <TodayItemCard item={item} key={item.id} onOpenItem={onOpenItem} />
      ))}
    </div>
  );
}

function TodayLoadingState() {
  return (
    <Card className="today-loading" aria-label="Loading Today workspace">
      <LoadingSkeleton height="1.5rem" width="16rem" />
      <LoadingSkeleton height="5rem" />
      <LoadingSkeleton height="7rem" />
    </Card>
  );
}

export default function TodayWorkspace({
  conversationLoadError = null,
  conversations = [],
  dealLoadError = null,
  deals = [],
  loading = false,
  onNavigateWorkspace,
  openDeal,
  refresh,
  refreshConversations,
  setSelectedPhone,
}) {
  const [selectedCategory, setSelectedCategory] = useState(readSelectedCategory);
  const [manualRefreshAt, setManualRefreshAt] = useState(null);
  const [refreshError, setRefreshError] = useState("");

  const readModel = useMemo(
    () =>
      buildTodayReadModel({
        conversations,
        deals,
        errors: [conversationLoadError, dealLoadError, refreshError].filter(Boolean),
      }),
    [conversationLoadError, conversations, dealLoadError, deals, refreshError]
  );
  const briefing = useMemo(() => buildTodayBriefing(readModel), [readModel]);
  const tabs = readModel.categories.map((category) => ({
    id: category.id,
    label: `${category.label} (${category.count})`,
    content: (
      <TodayList
        categoryId={category.id}
        items={readModel.items.filter((item) => item.category === category.id)}
        onOpenItem={handleOpenItem}
      />
    ),
  }));

  async function handleRefresh() {
    setRefreshError("");

    try {
      await Promise.all(
        [refresh, refreshConversations]
          .filter((callback) => typeof callback === "function")
          .map((callback) => callback())
      );
      setManualRefreshAt(new Date().toISOString());
    } catch {
      setRefreshError("Could not refresh all Today data. Existing results remain visible.");
    }
  }

  function handleCategoryChange(categoryId) {
    persistSelectedCategory(categoryId);

    if (categoryId === "approvals" && onNavigateWorkspace) {
      onNavigateWorkspace("approvals");
      return;
    }

    setSelectedCategory(categoryId);
  }

  function handleOpenItem(item) {
    if (item.target?.phone) {
      setSelectedPhone?.(item.target.phone);
    }

    const deal = findDealById(deals, item.target?.dealId);
    if (deal && item.targetWorkspace === "deals") {
      openDeal?.(deal);
      return;
    }

    if (item.targetWorkspace) {
      onNavigateWorkspace?.(item.targetWorkspace);
    }
  }

  return (
    <section className="workspace today-workspace">
      <PageHeader
        actions={
          <Button disabled={loading} onClick={handleRefresh} variant="secondary">
            Refresh
          </Button>
        }
        description="Your decision-first acquisition queue for the currently loaded operational data."
        title="Today"
      />

      <div className="today-workspace__refresh-note">
        Last refreshed: {formatTimestamp(manualRefreshAt || readModel.generatedAt)}
      </div>

      {loading ? (
        <TodayLoadingState />
      ) : (
        <div className="workspace__content">
          <SourceWarnings warnings={briefing.warnings} />
          <BriefingCard briefing={briefing} />
          {readModel.items.length === 0 ? (
            <EmptyState
              description="No urgent actions, approvals, risks, waiting work, or completed work were found in the currently loaded data."
              title="No work queued for Today"
            />
          ) : (
            <Card className="today-categories">
              <Tabs
                activeId={selectedCategory}
                ariaLabel="Today categories"
                onChange={handleCategoryChange}
                tabs={tabs}
              />
            </Card>
          )}
        </div>
      )}
    </section>
  );
}
