import { useEffect, useMemo, useRef, useState } from "react";
import PipelineBoard from "../../components/PipelineBoard";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingSkeleton,
  PageHeader,
  Select,
  StatusBadge,
} from "../../design-system";
import {
  DEFAULT_PIPELINE_FILTERS,
  PIPELINE_FOCUS_VIEWS,
  buildPipelineReadModel,
  filterPipelineItems,
  getPipelineActiveFilterCount,
  getPipelineStageColumns,
  normalizePipelineFilters,
} from "../../services/pipeline";
import { formatUsd } from "../../utils/currency";
import { getDealAliasText } from "../../utils/dealFields";
import "./pipeline-workspace.css";

const FILTER_STORAGE_KEY = "ai-pipeline-filters";
const FOCUS_STORAGE_KEY = "ai-pipeline-focus";
const VIEW_STORAGE_KEY = "ai-pipeline-view";
const LIST_BATCH_SIZE = 50;

function formatDate(value, fallback = "Not available") {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString();
}

function formatDateTime(value, fallback = "Not available") {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString();
}

function readSessionValue(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.sessionStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function readSessionFilters() {
  try {
    return normalizePipelineFilters(JSON.parse(readSessionValue(FILTER_STORAGE_KEY, "{}")));
  } catch {
    return { ...DEFAULT_PIPELINE_FILTERS };
  }
}

function writeSessionValue(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Session persistence is a convenience; the workspace remains usable without it.
  }
}

function urgencyStyle(urgency) {
  if (["Critical", "High"].includes(urgency)) return "danger";
  if (urgency === "Medium") return "warning";
  return "neutral";
}

// Distinct responsibility: expose one shared filter contract without owning pipeline derivation.
function PipelineControls({
  activeFilterCount,
  filters,
  focusView,
  onFilterChange,
  onFocusChange,
  onReset,
  readModel,
  showFilters,
  setShowFilters,
  setViewMode,
  viewMode,
}) {
  return (
    <Card className="pipeline-controls">
      <div className="pipeline-controls__primary">
        <Input
          aria-label="Search pipeline"
          label="Search"
          onChange={(event) => onFilterChange("search", event.target.value)}
          placeholder="Property, seller, assignee, source, or next action"
          type="search"
          value={filters.search}
        />

        <div aria-label="Pipeline view mode" className="pipeline-view-toggle" role="group">
          <Button
            aria-pressed={viewMode === "board"}
            onClick={() => setViewMode("board")}
            size="sm"
            variant={viewMode === "board" ? "primary" : "secondary"}
          >
            Board
          </Button>
          <Button
            aria-pressed={viewMode === "list"}
            onClick={() => setViewMode("list")}
            size="sm"
            variant={viewMode === "list" ? "primary" : "secondary"}
          >
            Compact List
          </Button>
        </div>

        <Button
          aria-expanded={showFilters}
          onClick={() => setShowFilters((current) => !current)}
          size="sm"
          variant="secondary"
        >
          Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
        </Button>
      </div>

      <div aria-label="Pipeline focus views" className="pipeline-focus-views" role="group">
        {PIPELINE_FOCUS_VIEWS.map((view) => (
          <Button
            aria-pressed={focusView === view.id}
            key={view.id}
            onClick={() => onFocusChange(view.id)}
            size="sm"
            variant={focusView === view.id ? "primary" : "ghost"}
          >
            {view.label}
          </Button>
        ))}
      </div>

      {showFilters ? (
        <div className="pipeline-filter-panel">
          <div className="pipeline-filter-panel__selects">
            <Select
              label="Stage"
              onChange={(event) => onFilterChange("stage", event.target.value)}
              value={filters.stage}
            >
              <option value="all">All stages</option>
              {readModel.filterOptions.stages.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>

            {readModel.supportedFilters.assignedUser ? (
              <Select
                label="Assigned user"
                onChange={(event) => onFilterChange("assignedUser", event.target.value)}
                value={filters.assignedUser}
              >
                <option value="all">All assignees</option>
                {readModel.filterOptions.assignedUsers.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            ) : null}

            {readModel.supportedFilters.source ? (
              <Select
                label="Source"
                onChange={(event) => onFilterChange("source", event.target.value)}
                value={filters.source}
              >
                <option value="all">All sources</option>
                {readModel.filterOptions.sources.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            ) : null}

            {readModel.supportedFilters.urgency ? (
              <Select
                label="Urgency"
                onChange={(event) => onFilterChange("urgency", event.target.value)}
                value={filters.urgency}
              >
                <option value="all">All urgency levels</option>
                {readModel.filterOptions.urgencies.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            ) : null}

            <Select
              label="Risk"
              onChange={(event) => onFilterChange("risk", event.target.value)}
              value={filters.risk}
            >
              <option value="all">All risk states</option>
              <option value="at-risk">At risk</option>
              <option value="clear">No current risk flag</option>
            </Select>
          </div>

          <div className="pipeline-filter-panel__checks">
            <FilterCheckbox
              checked={filters.missingNextAction}
              label="Missing next action"
              onChange={(value) => onFilterChange("missingNextAction", value)}
            />
            {readModel.supportedFilters.stale ? (
              <FilterCheckbox
                checked={filters.stale}
                label="Stale deals"
                onChange={(value) => onFilterChange("stale", value)}
              />
            ) : null}
            {readModel.supportedFilters.unreadResponse ? (
              <FilterCheckbox
                checked={filters.unreadResponse}
                label="Unread seller response"
                onChange={(value) => onFilterChange("unreadResponse", value)}
              />
            ) : null}
            {readModel.supportedFilters.approvalRequired ? (
              <FilterCheckbox
                checked={filters.approvalRequired}
                label="Approval required"
                onChange={(value) => onFilterChange("approvalRequired", value)}
              />
            ) : null}
          </div>

          <Button disabled={!activeFilterCount && focusView === "all"} onClick={onReset} size="sm" variant="secondary">
            Reset filters
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

// Distinct responsibility: provide an accessible boolean control using the shared filter state.
function FilterCheckbox({ checked, label, onChange }) {
  return (
    <label className="pipeline-filter-check">
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <span>{label}</span>
    </label>
  );
}

// Distinct responsibility: render one normalized opportunity in the scanning-oriented list view.
function PipelineListRow({ item, onOpenDeal, onToggleSelect }) {
  const financialFact =
    item.financialSummary.askingPrice !== null
      ? formatUsd(item.financialSummary.askingPrice)
      : "Not available";

  return (
    <article className={`pipeline-list-row ${item.selected ? "pipeline-list-row--selected" : ""}`.trim()}>
      <div className="pipeline-list-row__select">
        {onToggleSelect && item.hasPersistentId ? (
          <label>
            <input
              aria-label={`Select ${item.propertyAddress}`}
              checked={item.selected}
              onChange={() => onToggleSelect(item.dealId)}
              type="checkbox"
            />
          </label>
        ) : null}
      </div>
      <button
        aria-label={
          item.hasPersistentId
            ? `Open deal ${item.propertyAddress}`
            : `${item.propertyAddress} cannot be opened because its deal ID is missing`
        }
        className="pipeline-list-row__open"
        disabled={!item.hasPersistentId}
        onClick={() => onOpenDeal(item)}
        type="button"
      >
        <div className="pipeline-list-row__identity" data-label="Property / Seller">
          <strong>{item.propertyAddress}</strong>
          <span>{item.seller}</span>
          <small>Asking: {financialFact}</small>
        </div>
        <div data-label="Stage">
          <strong>{item.currentStage}</strong>
          <span>{item.currentStatus}</span>
        </div>
        <div data-label="Assigned">
          <strong>{item.assignedUser || "Unassigned"}</strong>
          <span>{item.source || "Unknown source"}</span>
        </div>
        <div data-label="Next action">
          <strong>{item.nextAction || "No next action recorded"}</strong>
          <span>{item.nextActionDueDate ? `Due ${formatDate(item.nextActionDueDate)}` : "No due date"}</span>
        </div>
        <div data-label="Urgency / Risk" className="pipeline-list-row__badges">
          <StatusBadge status={urgencyStyle(item.urgency)}>
            Urgency: {item.urgency || "Not signaled"}
          </StatusBadge>
          {item.atRisk ? <StatusBadge status="danger">Risk: {item.riskLevel}</StatusBadge> : null}
          {item.approvalRequired ? <StatusBadge status="warning">Approval</StatusBadge> : null}
        </div>
        <div data-label="Last activity">
          <strong>{formatDate(item.lastMeaningfulActivity.timestamp)}</strong>
          <span>{item.lastMeaningfulActivity.label}</span>
        </div>
      </button>
    </article>
  );
}

// Distinct responsibility: bound the compact list while preserving one shared normalized item set.
function PipelineCompactList({ items, onOpenDeal, onToggleSelect }) {
  const [visibleCount, setVisibleCount] = useState(LIST_BATCH_SIZE);
  const visibleItems = items.slice(0, visibleCount);
  const remaining = Math.max(0, items.length - visibleItems.length);

  return (
    <div className="pipeline-list" data-testid="pipeline-compact-list">
      <div aria-hidden="true" className="pipeline-list__header">
        <span />
        <span>Property / Seller</span>
        <span>Stage</span>
        <span>Assigned</span>
        <span>Next action</span>
        <span>Urgency / Risk</span>
        <span>Last activity</span>
      </div>
      {visibleItems.map((item) => (
        <PipelineListRow
          item={item}
          key={item.id}
          onOpenDeal={onOpenDeal}
          onToggleSelect={onToggleSelect}
        />
      ))}
      {remaining ? (
        <Button onClick={() => setVisibleCount((count) => count + LIST_BATCH_SIZE)} variant="secondary">
          Show {Math.min(LIST_BATCH_SIZE, remaining)} more opportunities
        </Button>
      ) : null}
    </div>
  );
}

// Distinct responsibility: preserve the Pipeline layout while the existing deal repository loads.
function PipelineLoadingState() {
  return (
    <Card aria-label="Loading Pipeline" className="pipeline-loading">
      <LoadingSkeleton height="2rem" width="16rem" />
      <LoadingSkeleton height="5rem" />
      <LoadingSkeleton height="18rem" />
    </Card>
  );
}

// Distinct responsibility: own route-level Pipeline state and compose the shared read model into views.
export default function PipelineWorkspace({
  clearSelection,
  dealLoadError = null,
  deals = [],
  loading = false,
  navigateToDeal,
  now,
  openDeal,
  organizationId = "",
  refresh,
  role = "Owner",
  selectedIds = [],
  sourceErrors = [],
  tenantId = "",
  toggleSelect,
}) {
  const initialNowRef = useRef(now ?? Date.now());
  const evaluationNow = now ?? initialNowRef.current;
  const [filters, setFilters] = useState(readSessionFilters);
  const [focusView, setFocusView] = useState(() => {
    const stored = readSessionValue(FOCUS_STORAGE_KEY, "needs-attention");
    return PIPELINE_FOCUS_VIEWS.some((view) => view.id === stored) ? stored : "needs-attention";
  });
  const [viewMode, setViewMode] = useState(() =>
    readSessionValue(VIEW_STORAGE_KEY, "board") === "list" ? "list" : "board"
  );
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [lastRefreshAt, setLastRefreshAt] = useState("");
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    writeSessionValue(FILTER_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    writeSessionValue(FOCUS_STORAGE_KEY, focusView);
  }, [focusView]);

  useEffect(() => {
    writeSessionValue(VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const readModel = useMemo(
    () =>
      buildPipelineReadModel({
        deals,
        errors: [dealLoadError, refreshError, ...sourceErrors].filter(Boolean),
        now: evaluationNow,
        organizationId,
        role,
        selectedIds,
        tenantId,
      }),
    [
      dealLoadError,
      deals,
      evaluationNow,
      organizationId,
      refreshError,
      role,
      selectedIds,
      sourceErrors,
      tenantId,
    ]
  );
  const visibleItems = useMemo(
    () => filterPipelineItems(readModel.items, filters, focusView),
    [filters, focusView, readModel.items]
  );
  const stageColumns = useMemo(() => {
    const columns = getPipelineStageColumns(visibleItems);
    return filters.stage === "all"
      ? columns
      : columns.filter((column) => column.id === filters.stage);
  }, [filters.stage, visibleItems]);
  const activeFilterCount = getPipelineActiveFilterCount(filters);

  useEffect(() => {
    setFilters((current) => {
      const next = { ...current };
      const hasOption = (options, value) =>
        value === "all" || options.some((option) => option.value === value);

      if (!hasOption(readModel.filterOptions.stages, next.stage)) next.stage = "all";
      if (!hasOption(readModel.filterOptions.assignedUsers, next.assignedUser)) {
        next.assignedUser = "all";
      }
      if (!hasOption(readModel.filterOptions.sources, next.source)) next.source = "all";
      if (!hasOption(readModel.filterOptions.urgencies, next.urgency)) next.urgency = "all";
      if (!readModel.supportedFilters.stale) next.stale = false;
      if (!readModel.supportedFilters.unreadResponse) next.unreadResponse = false;
      if (!readModel.supportedFilters.approvalRequired) next.approvalRequired = false;

      const normalized = normalizePipelineFilters(next);
      return JSON.stringify(normalized) === JSON.stringify(current) ? current : normalized;
    });
  }, [readModel.filterOptions, readModel.supportedFilters]);

  function updateFilter(key, value) {
    setFilters((current) => normalizePipelineFilters({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters({ ...DEFAULT_PIPELINE_FILTERS });
    setFocusView("all");
    setAnnouncement("Pipeline filters reset.");
  }

  function openPipelineItem(item) {
    if (!item.dealId) return;
    if (navigateToDeal) {
      navigateToDeal(item.dealId);
      return;
    }
    const sourceDeal = deals.find(
      (deal) => String(getDealAliasText(deal, "id")) === String(item.dealId)
    );
    if (sourceDeal) openDeal?.(sourceDeal);
  }

  async function handleRefresh() {
    if (typeof refresh !== "function" || refreshing) return;
    setRefreshing(true);
    setRefreshError("");
    try {
      await refresh();
      const refreshedAt = new Date().toISOString();
      setLastRefreshAt(refreshedAt);
      setAnnouncement("Pipeline refresh request completed.");
    } catch {
      setRefreshError("Pipeline data could not be refreshed. Existing results remain visible.");
    } finally {
      setRefreshing(false);
    }
  }

  const hasSourceError = readModel.sourceWarnings.length > 0;
  const noLoadedItems = readModel.items.length === 0;
  const noVisibleItems = visibleItems.length === 0;

  return (
    <section className="workspace pipeline-workspace">
      <PageHeader
        actions={
          <div className="pipeline-header-actions">
            <Badge>{visibleItems.length} visible</Badge>
            {typeof refresh === "function" ? (
              <Button disabled={loading || refreshing} onClick={handleRefresh} variant="secondary">
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
            ) : null}
          </div>
        }
        description="Scan opportunities by stage, attention, and the next real action."
        title="Pipeline"
      />

      <div className="pipeline-workspace__refresh-note">
        Loaded opportunities: {readModel.totalVisible} | Last refreshed:{" "}
        {formatDateTime(lastRefreshAt || readModel.generatedAt)}
      </div>
      <div aria-live="polite" className="pipeline-workspace__announcement" role="status">
        {announcement}
      </div>

      {loading ? (
        <PipelineLoadingState />
      ) : (
        <div className="workspace__content">
          {hasSourceError ? (
            <ErrorState
              description={readModel.sourceWarnings.join(" ")}
              title={readModel.items.length ? "Some pipeline data is incomplete" : "Pipeline data unavailable"}
            />
          ) : null}

          {readModel.notices.map((notice) => (
            <Card className="pipeline-workspace__notice" key={notice} muted>{notice}</Card>
          ))}

          {!noLoadedItems ? (
            <>
              <PipelineControls
                activeFilterCount={activeFilterCount}
                filters={filters}
                focusView={focusView}
                onFilterChange={updateFilter}
                onFocusChange={setFocusView}
                onReset={resetFilters}
                readModel={readModel}
                setShowFilters={setShowFilters}
                setViewMode={setViewMode}
                showFilters={showFilters}
                viewMode={viewMode}
              />

              {selectedIds.length ? (
                <div className="pipeline-selection-summary">
                  <Badge>{selectedIds.length} selected</Badge>
                  {clearSelection ? <Button onClick={clearSelection} size="sm" variant="ghost">Clear selection</Button> : null}
                </div>
              ) : null}

              {noVisibleItems ? (
                <EmptyState
                  action={<Button onClick={resetFilters} variant="secondary">Reset pipeline view</Button>}
                  description="Change the focus view or clear filters to see other loaded opportunities."
                  title="No opportunities match this view"
                />
              ) : viewMode === "board" ? (
                <PipelineBoard
                  onOpenDeal={openPipelineItem}
                  onToggleSelect={toggleSelect}
                  stageColumns={stageColumns}
                />
              ) : (
                <PipelineCompactList
                  items={visibleItems}
                  onOpenDeal={openPipelineItem}
                  onToggleSelect={toggleSelect}
                />
              )}
            </>
          ) : !hasSourceError ? (
            <EmptyState
              description="New opportunities will appear here after they are added to the existing CRM."
              title="Pipeline is empty"
            />
          ) : null}
        </div>
      )}
    </section>
  );
}
