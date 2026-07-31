import { useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Drawer,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  Modal,
  PageHeader,
  SectionHeader,
  Select,
  StatusBadge,
  Tabs,
} from "../../design-system";
import {
  buildApprovalReadModel,
  getApprovalItemsForFilter,
} from "../../services/approvals";
import "./approval-inbox.css";

const STATUS_STYLE = {
  approved: "success",
  cancelled: "neutral",
  deferred: "info",
  expired: "danger",
  pending: "warning",
  rejected: "danger",
};

const RISK_STYLE = {
  Critical: "danger",
  High: "danger",
  Low: "neutral",
  Medium: "warning",
};

function formatDateTime(value, fallback = "Not available") {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toLocaleString();
}

function formatStatus(value) {
  const status = String(value || "pending");
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}

function relatedLabel(item) {
  return (
    item.relatedProperty?.address ||
    item.relatedDeal?.label ||
    item.relatedSeller?.name ||
    "No related record"
  );
}

function appendCommandActions(item, commands = {}) {
  if (item.status !== "pending") return item;
  const hasApproveCommand = typeof commands.approve === "function";
  const hasRejectCommand = typeof commands.reject === "function";
  if (!hasApproveCommand && !hasRejectCommand) return item;
  const actions = [...item.availableActions];

  if (hasApproveCommand) {
    actions.unshift({ id: "approve", label: "Approve", mode: "command" });
  }

  if (hasRejectCommand) {
    actions.push({ id: "reject", label: "Reject", mode: "command" });
  }

  return {
    ...item,
    availableActions: actions,
    executionMode: "source-command",
    manualCompletionRequired: false,
  };
}

// Distinct responsibility: summarize one normalized approval and expose only its supported actions.
export function ApprovalItemCard({ busy = false, item, onAction, onOpenDetails, selected = false }) {
  const primaryAction =
    item.availableActions.find((action) => action.id === "approve") ||
    item.availableActions.find((action) => action.id === "open-context");
  const secondaryActions = item.availableActions.filter(
    (action) => action.id !== primaryAction?.id
  );

  return (
    <article
      aria-label={`${item.title}, ${formatStatus(item.status)}`}
      className={`approval-item ${selected ? "approval-item--selected" : ""}`.trim()}
    >
      <button
        aria-expanded={selected}
        className="approval-item__summary"
        onClick={() => onOpenDetails(item)}
        type="button"
      >
        <div className="approval-item__heading">
          <div>
            <h3>{item.title}</h3>
            <p>{item.summary}</p>
          </div>
          <div className="approval-item__badges">
            <StatusBadge status={STATUS_STYLE[item.status] || "neutral"}>
              Status: {formatStatus(item.status)}
            </StatusBadge>
            <StatusBadge status={RISK_STYLE[item.riskLevel] || "neutral"}>
              Risk: {item.riskLevel}
            </StatusBadge>
          </div>
        </div>

        <dl className="approval-item__meta">
          <div>
            <dt>Related</dt>
            <dd>{relatedLabel(item)}</dd>
          </div>
          <div>
            <dt>Seller</dt>
            <dd>{item.relatedSeller?.name || "Unknown seller"}</dd>
          </div>
          <div>
            <dt>Requested by</dt>
            <dd>{item.requestedBy?.name || "System"}</dd>
          </div>
          <div>
            <dt>Requested</dt>
            <dd>{formatDateTime(item.requestedTimestamp)}</dd>
          </div>
        </dl>

        <div className="approval-item__reason">
          <strong>Why approval is needed:</strong> {item.reason}
        </div>
      </button>

      <div className="approval-item__footer">
        <div className="approval-item__source">
          <Badge>{item.sourceSystem}</Badge>
          {item.freeFirst?.provider ? (
            <StatusBadge status={item.freeFirst.providerConfigured ? "info" : "neutral"}>
              {item.freeFirst.providerConfigured
                ? `${item.freeFirst.provider} configured`
                : `${item.freeFirst.provider} optional`}
            </StatusBadge>
          ) : null}
        </div>
        <div className="approval-item__actions">
          {secondaryActions.map((action) => (
            <Button
              disabled={busy}
              key={action.id}
              onClick={() => onAction(item, action)}
              size="sm"
              variant={action.id === "reject" ? "danger" : "secondary"}
            >
              {action.label}
            </Button>
          ))}
          {primaryAction ? (
            <Button
              disabled={busy}
              onClick={() => onAction(item, primaryAction)}
              size="sm"
            >
              {primaryAction.label}
            </Button>
          ) : null}
        </div>
      </div>

      {item.manualCompletionRequired ? (
        <div className="approval-item__manual-note">
          Manual completion required. This inbox does not execute the underlying action.
        </div>
      ) : null}
    </article>
  );
}

// Distinct responsibility: present bounded approval counts without deriving or mutating them.
function ApprovalSummary({ counts }) {
  return (
    <Card className="approval-summary">
      <SectionHeader
        description="Counts reflect the currently loaded, role-visible approval read model."
        title="Approval summary"
      />
      <dl className="approval-summary__metrics" aria-label="Approval summary counts">
        <div>
          <dt>Pending</dt>
          <dd>{counts.pending}</dd>
        </div>
        <div>
          <dt>High risk</dt>
          <dd>{counts.highRisk}</dd>
        </div>
        <div>
          <dt>Expiring soon</dt>
          <dd>{counts.expiringSoon}</dd>
        </div>
        <div>
          <dt>Deferred</dt>
          <dd>{counts.deferred}</dd>
        </div>
        <div>
          <dt>Completed decisions</dt>
          <dd>{counts.completed}</dd>
        </div>
      </dl>
    </Card>
  );
}

// Distinct responsibility: show evidence, provenance, cost context, and decision history for one item.
function ApprovalDetails({ item, onAction }) {
  if (!item) return null;

  return (
    <div className="approval-details">
      <div className="approval-details__badges">
        <StatusBadge status={STATUS_STYLE[item.status] || "neutral"}>
          Status: {formatStatus(item.status)}
        </StatusBadge>
        <StatusBadge status={RISK_STYLE[item.riskLevel] || "neutral"}>
          Risk: {item.riskLevel}
        </StatusBadge>
        <Badge>Urgency: {item.urgency}</Badge>
      </div>

      <section aria-labelledby="approval-request-heading">
        <h3 id="approval-request-heading">Requested action</h3>
        <p>{item.requestedAction}</p>
      </section>

      <section aria-labelledby="approval-context-heading">
        <h3 id="approval-context-heading">Related context</h3>
        <dl className="approval-details__facts">
          <div>
            <dt>Seller</dt>
            <dd>{item.relatedSeller?.name || "Unknown seller"}</dd>
          </div>
          <div>
            <dt>Property</dt>
            <dd>{item.relatedProperty?.address || "Unknown property"}</dd>
          </div>
          <div>
            <dt>Deal</dt>
            <dd>{item.relatedDeal?.label || "Unknown deal"}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{item.sourceSystem}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="approval-evidence-heading">
        <h3 id="approval-evidence-heading">Evidence and provenance</h3>
        {item.evidence.length ? (
          <ul className="approval-details__evidence">
            {item.evidence.map((entry, index) => (
              <li key={`${entry.label}-${index}`}>
                <strong>{entry.label}:</strong> {entry.value}
                {entry.source ? <span> Source: {entry.source}.</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>No supporting facts were supplied by the source.</p>
        )}
      </section>

      <section aria-labelledby="approval-provider-heading">
        <h3 id="approval-provider-heading">Provider and cost</h3>
        <p>{item.freeFirst?.costNotice}</p>
      </section>

      <section aria-labelledby="approval-decision-heading">
        <h3 id="approval-decision-heading">Decision history</h3>
        {item.decisionMetadata ? (
          <p>
            {formatStatus(item.status)} by {item.decisionMetadata.actor || "Current user"} at{" "}
            {formatDateTime(item.decisionMetadata.decidedAt)}.
            {item.decisionMetadata.sessionOnly
              ? " This display state applies only to the current session."
              : ""}
          </p>
        ) : (
          <p>No approval decision is recorded in the current read model.</p>
        )}
      </section>

      {item.availableActions.some((action) => action.id === "open-context") ? (
        <Button
          onClick={() =>
            onAction(
              item,
              item.availableActions.find((action) => action.id === "open-context")
            )
          }
        >
          Review in context
        </Button>
      ) : null}
    </div>
  );
}

// Distinct responsibility: collect a future defer interval and clearly scope it to this session.
function DeferDialog({ isOpen, item, onCancel, onConfirm }) {
  const [days, setDays] = useState("1");

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Defer approval review">
      <div className="approval-defer-dialog">
        <p>
          Defer {item?.title || "this approval"} in this session. This does not update the
          underlying workflow or source record.
        </p>
        <Select
          label="Review again"
          onChange={(event) => setDays(event.target.value)}
          value={days}
        >
          <option value="1">Tomorrow</option>
          <option value="3">In 3 days</option>
          <option value="7">In 1 week</option>
        </Select>
        <div className="approval-dialog__actions">
          <Button onClick={onCancel} variant="secondary">
            Cancel
          </Button>
          <Button onClick={() => onConfirm(Number(days))}>Defer item</Button>
        </div>
      </div>
    </Modal>
  );
}

// Distinct responsibility: provide a bounded, route-level review surface over the shared approval read model.
export default function ApprovalInboxWorkspace({
  approvalCommands = {},
  campaigns = [],
  dealLoadError = null,
  dealNotifications,
  deals = [],
  loading = false,
  messageDrafts = [],
  navigateToDeal,
  onNavigateWorkspace,
  openDeal,
  organizationId = "",
  refresh,
  role = "Owner",
  setSelectedPhone,
  sourceErrors = [],
  tenantId = "",
  workflowApprovals = [],
}) {
  const [decisionStateById, setDecisionStateById] = useState({});
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [deferItem, setDeferItem] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [pendingActionId, setPendingActionId] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [lastRefreshAt, setLastRefreshAt] = useState("");
  const [actionError, setActionError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const submissionLockRef = useRef("");

  const readModel = useMemo(
    () =>
      buildApprovalReadModel({
        campaigns,
        dealNotifications,
        deals,
        decisionStateById,
        errors: [dealLoadError, refreshError, ...sourceErrors].filter(Boolean),
        messageDrafts,
        organizationId,
        role,
        tenantId,
        workflowApprovals,
      }),
    [
      campaigns,
      dealLoadError,
      dealNotifications,
      deals,
      decisionStateById,
      messageDrafts,
      organizationId,
      refreshError,
      role,
      sourceErrors,
      tenantId,
      workflowApprovals,
    ]
  );
  const displayItems = useMemo(
    () =>
      readModel.items.map((item) =>
        appendCommandActions(item, approvalCommands[item.id])
      ),
    [approvalCommands, readModel.items]
  );
  const displayModel = useMemo(
    () => ({ ...readModel, items: displayItems }),
    [displayItems, readModel]
  );
  const activeFilter = readModel.filters.some((filter) => filter.id === selectedFilter)
    ? selectedFilter
    : "all";
  const selectedItem = displayItems.find((item) => item.id === selectedItemId) || null;
  const tabs = readModel.filters.map((filter) => ({
    id: filter.id,
    label: `${filter.label} (${filter.count})`,
    content: filter.id === activeFilter ? (
      <ApprovalList
        busyId={pendingActionId}
        items={getApprovalItemsForFilter(displayModel, filter.id)}
        onAction={handleAction}
        onOpenDetails={(item) => setSelectedItemId(item.id)}
        selectedItemId={selectedItemId}
      />
    ) : null,
  }));

  async function handleRefresh() {
    setRefreshError("");
    try {
      await refresh?.();
      setLastRefreshAt(new Date().toISOString());
      setAnnouncement("Approval sources refreshed.");
    } catch {
      setRefreshError("Approval sources could not be refreshed. Existing results remain visible.");
    }
  }

  function handleOpenContext(item) {
    const phone = item.relatedConversation?.phone || item.relatedSeller?.phone;
    if (phone) setSelectedPhone?.(phone);

    if (item.relatedDeal?.id) {
      if (navigateToDeal) {
        navigateToDeal(item.relatedDeal.id);
        return;
      }

      const deal = deals.find((candidate) =>
        [candidate.id, candidate.deal_id, candidate.lead_id].includes(item.relatedDeal.id)
      );
      if (deal && openDeal) {
        openDeal(deal);
        return;
      }
    }

    if (item.targetWorkspace) onNavigateWorkspace?.(item.targetWorkspace);
  }

  function handleAction(item, action) {
    setActionError("");

    if (action.id === "open-context") {
      handleOpenContext(item);
      return;
    }

    if (action.id === "defer") {
      setDeferItem(item);
      return;
    }

    const command = approvalCommands[item.id]?.[action.id];
    if (typeof command !== "function") {
      setActionError(
        "No safe execution command is connected. Review the item in its source context."
      );
      return;
    }

    setConfirmState({ action, item });
  }

  function confirmDefer(days) {
    if (!deferItem) return;
    const deferredDate = new Date();
    deferredDate.setDate(deferredDate.getDate() + days);
    const deferredUntil = deferredDate.toISOString().slice(0, 10);

    setDecisionStateById((current) => ({
      ...current,
      [deferItem.id]: {
        status: "deferred",
        deferredUntil,
        decidedAt: new Date().toISOString(),
        reason: `Review deferred for ${days} day(s).`,
        sessionOnly: true,
      },
    }));
    setAnnouncement(
      `${deferItem.title} deferred in this session until ${deferredUntil}.`
    );
    setDeferItem(null);
  }

  async function executeConfirmedAction() {
    if (!confirmState || pendingActionId || submissionLockRef.current) return;
    const { action, item } = confirmState;
    const command = approvalCommands[item.id]?.[action.id];
    if (typeof command !== "function") {
      setConfirmState(null);
      setActionError("The approval command is no longer available. Nothing was changed.");
      return;
    }

    submissionLockRef.current = item.id;
    setPendingActionId(item.id);
    setActionError("");

    try {
      const result = await command(item);
      if (result?.success !== true) {
        throw new Error("Command did not confirm success.");
      }

      const nextStatus = action.id === "reject" ? "rejected" : "approved";
      setDecisionStateById((current) => ({
        ...current,
        [item.id]: {
          status: nextStatus,
          decidedAt: new Date().toISOString(),
          reason: result.reason || "Executed through an existing safe command.",
          sessionOnly: result.approvalPersisted !== true,
        },
      }));
      setAnnouncement(`${item.title} ${nextStatus}.`);
      setConfirmState(null);
    } catch {
      setActionError(
        "The approval command could not be completed. Nothing was marked approved or rejected."
      );
    } finally {
      submissionLockRef.current = "";
      setPendingActionId("");
    }
  }

  const confirmMessage = confirmState
    ? `${confirmState.action.label} "${confirmState.item.requestedAction}" for ${relatedLabel(
        confirmState.item
      )}. ${confirmState.item.freeFirst?.costNotice || ""}`
    : "";

  return (
    <section className="workspace approval-workspace">
      <PageHeader
        actions={
          <Button disabled={loading} onClick={handleRefresh} variant="secondary">
            Refresh
          </Button>
        }
        description="Review consequential actions in one place. Nothing executes without an existing safe command."
        title="Approvals"
      />

      <div className="approval-workspace__refresh-note">
        Pending: {readModel.counts.pending} | Last refreshed:{" "}
        {formatDateTime(lastRefreshAt || readModel.generatedAt)}
      </div>

      <div aria-live="polite" className="approval-workspace__announcement" role="status">
        {announcement}
      </div>

      {loading ? (
        <ApprovalLoadingState />
      ) : (
        <div className="workspace__content">
          <Card className="approval-workspace__compatibility" muted>
            <strong>Compatibility approval foundation</strong>
            <p>{readModel.executionNotice}</p>
          </Card>

          {readModel.sourceWarnings.length ? (
            <ErrorState
              description={readModel.sourceWarnings.join(" ")}
              title="Some approval sources are unavailable"
            />
          ) : null}

          {actionError ? (
            <ErrorState description={actionError} title="Approval action not completed" />
          ) : null}

          <ApprovalSummary counts={readModel.counts} />

          {readModel.items.length ? (
            <Card className="approval-filters">
              <Tabs
                activeId={activeFilter}
                ariaLabel="Approval filters"
                onChange={setSelectedFilter}
                tabs={tabs}
              />
            </Card>
          ) : (
            <EmptyState
              description="No approval signals are represented by the currently loaded and role-visible data."
              title="No approvals waiting"
            />
          )}
        </div>
      )}

      <Drawer
        isOpen={Boolean(selectedItem)}
        onClose={() => setSelectedItemId("")}
        title={selectedItem?.title || "Approval details"}
      >
        <ApprovalDetails item={selectedItem} onAction={handleAction} />
      </Drawer>

      <DeferDialog
        isOpen={Boolean(deferItem)}
        item={deferItem}
        onCancel={() => setDeferItem(null)}
        onConfirm={confirmDefer}
      />

      <ConfirmDialog
        confirmLabel={confirmState?.action.id === "reject" ? "Reject action" : "Approve action"}
        isOpen={Boolean(confirmState)}
        message={confirmMessage}
        onCancel={() => setConfirmState(null)}
        onConfirm={executeConfirmedAction}
        title={`${confirmState?.action.label || "Confirm"} approval`}
      />
    </section>
  );
}

// Distinct responsibility: render a bounded filtered collection and its filter-specific empty state.
function ApprovalList({ busyId, items, onAction, onOpenDetails, selectedItemId }) {
  if (!items.length) {
    return (
      <EmptyState
        description="No approval items match this filter in the currently loaded data."
        title="No matching approvals"
      />
    );
  }

  return (
    <div className="approval-list" aria-label="Approval review list">
      {items.map((item) => (
        <ApprovalItemCard
          busy={busyId === item.id}
          item={item}
          key={item.id}
          onAction={onAction}
          onOpenDetails={onOpenDetails}
          selected={selectedItemId === item.id}
        />
      ))}
    </div>
  );
}

// Distinct responsibility: preserve the workspace layout while approval sources are loading.
function ApprovalLoadingState() {
  return (
    <Card aria-label="Loading Approval Inbox" className="approval-loading">
      <LoadingSkeleton height="1.5rem" width="14rem" />
      <LoadingSkeleton height="5rem" />
      <LoadingSkeleton height="9rem" />
    </Card>
  );
}
