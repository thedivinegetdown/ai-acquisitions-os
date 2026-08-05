import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Icon,
  LoadingSkeleton,
  SectionHeader,
  Select,
  StatusBadge,
} from "../../design-system";
import {
  TIMELINE_SORT_DIRECTIONS,
  TIMELINE_VISIBLE_BATCH_SIZE,
  filterTimelineEvents,
  groupTimelineEvents,
  loadDealTimeline,
  sortTimelineEvents,
} from "../../services/timeline";
import { formatSafeDate } from "../../utils/dates";
import "./deal-timeline.css";

function statusTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (/fail|error|undeliver|reject|cancel/.test(normalized)) return "danger";
  if (/complete|approved|delivered|received|sent/.test(normalized)) return "success";
  if (/pending|queued|test|defer|wait/.test(normalized)) return "warning";
  return "neutral";
}
function referenceLabel(event) {
  return [
    event.sellerReference?.name,
    event.propertyReference?.address,
  ]
    .filter(Boolean)
    .join(" - ");
}

// Separate row reason: one semantic event owns its disclosure and navigation-only action,
// while loading, filtering, and source aggregation remain in the parent and service layers.
function TimelineEventRow({ event, onOpenContext }) {
  const action = event.availableActions?.[0] || null;
  const contextLabel = referenceLabel(event);
  const titleId = `timeline-event-${event.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  return (
    <li className="deal-timeline__event-item">
      <article aria-labelledby={titleId} className="deal-timeline__event">
        <div aria-hidden="true" className="deal-timeline__event-icon">
          <Icon name={event.categoryIcon} size="sm" />
        </div>
        <div className="deal-timeline__event-content">
          <div className="deal-timeline__event-heading">
            <div className="deal-timeline__badges">
              <Badge>{event.categoryLabel}</Badge>
              {event.direction ? (
                <StatusBadge status="info">Direction: {event.direction}</StatusBadge>
              ) : null}
              {event.status ? (
                <StatusBadge status={statusTone(event.status)}>
                  Status: {event.status}
                </StatusBadge>
              ) : null}
            </div>
            {event.timestamp ? (
              <time dateTime={event.timestamp}>
                {formatSafeDate(event.timestamp, "Timestamp unavailable")}
              </time>
            ) : (
              <span className="deal-timeline__undated">Timestamp unavailable</span>
            )}
          </div>

          <h4 id={titleId}>{event.title}</h4>
          {event.summary ? <p>{event.summary}</p> : null}

          <div className="deal-timeline__event-meta">
            {event.actorLabel ? <span>Actor: {event.actorLabel}</span> : null}
            {contextLabel ? <span>Related: {contextLabel}</span> : null}
            <span>Source: {event.sourceSystem}</span>
            <span>Reliability: {event.reliability}</span>
          </div>

          <div className="deal-timeline__event-footer">
            <details className="deal-timeline__details">
              <summary>Source details</summary>
              <dl>
                <div>
                  <dt>Source system</dt>
                  <dd>{event.sourceSystem}</dd>
                </div>
                <div>
                  <dt>Reliability</dt>
                  <dd>{event.reliability}</dd>
                </div>
                {event.sourceRecordId ? (
                  <div>
                    <dt>Source record</dt>
                    <dd>{event.sourceRecordId}</dd>
                  </div>
                ) : null}
                {event.partialDataWarning ? (
                  <div>
                    <dt>Data note</dt>
                    <dd>{event.partialDataWarning}</dd>
                  </div>
                ) : null}
                {event.evidence.map((entry, index) => (
                  <div key={`${entry.label}-${index}`}>
                    <dt>{entry.label}</dt>
                    <dd>
                      {entry.value}
                      {entry.source ? ` (Source: ${entry.source})` : ""}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
            {action && onOpenContext ? (
              <Button onClick={() => onOpenContext(event)} size="sm" variant="secondary">
                {action.label}
              </Button>
            ) : null}
          </div>
        </div>
      </article>
    </li>
  );
}

// New component reason: the existing ActivityTimeline owns a single SMS thread and
// cannot present a bounded, normalized, cross-source deal history without duplicating loaders.
export default function DealTimeline({
  deal,
  loadTimeline = loadDealTimeline,
  onOpenContext,
}) {
  const requestIdRef = useRef(0);
  const [readModel, setReadModel] = useState(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortDirection, setSortDirection] = useState(
    TIMELINE_SORT_DIRECTIONS.NEWEST
  );
  const [visibleCount, setVisibleCount] = useState(TIMELINE_VISIBLE_BATCH_SIZE);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [announcement, setAnnouncement] = useState("Loading timeline history.");

  const refreshTimeline = useCallback(
    async (force = false) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setLoading(true);
      setErrorMessage("");
      setAnnouncement(force ? "Refreshing timeline history." : "Loading timeline history.");

      try {
        const result = await loadTimeline({ deal, force });
        if (requestIdRef.current !== requestId) return;

        if (result?.success !== true) {
          setReadModel(null);
          setErrorMessage(
            result?.error?.message || "Timeline history could not be loaded."
          );
          setAnnouncement("Timeline history failed to load.");
          return;
        }

        const model = result.data;
        setReadModel(model);
        setVisibleCount(TIMELINE_VISIBLE_BATCH_SIZE);
        setActiveCategory((current) =>
          model.filters?.some((filter) => filter.id === current) ? current : "all"
        );
        setAnnouncement(
          `Timeline refreshed with ${model.totalVisible || 0} event${model.totalVisible === 1 ? "" : "s"}.`
        );
      } catch {
        if (requestIdRef.current !== requestId) return;
        setReadModel(null);
        setErrorMessage("Timeline history could not be loaded.");
        setAnnouncement("Timeline history failed to load.");
      } finally {
        if (requestIdRef.current === requestId) setLoading(false);
      }
    },
    [deal, loadTimeline]
  );

  useEffect(() => {
    refreshTimeline(false);
    return () => {
      requestIdRef.current += 1;
    };
  }, [refreshTimeline]);

  const filteredEvents = useMemo(
    () =>
      sortTimelineEvents(
        filterTimelineEvents(readModel?.items || [], activeCategory),
        sortDirection
      ),
    [activeCategory, readModel?.items, sortDirection]
  );
  const visibleEvents = useMemo(
    () => filteredEvents.slice(0, visibleCount),
    [filteredEvents, visibleCount]
  );
  const groups = useMemo(
    () => groupTimelineEvents(visibleEvents, { sortDirection }),
    [sortDirection, visibleEvents]
  );

  if (loading && !readModel) {
    return (
      <div aria-busy="true" className="deal-timeline deal-timeline--loading" role="status">
        <span>Loading timeline history...</span>
        {[0, 1, 2].map((item) => (
          <div className="deal-timeline__skeleton" key={item}>
            <LoadingSkeleton height="1.25rem" width="35%" />
            <LoadingSkeleton height="1rem" width="85%" />
            <LoadingSkeleton height="1rem" width="55%" />
          </div>
        ))}
      </div>
    );
  }

  if (errorMessage && !readModel) {
    return (
      <ErrorState
        action={<Button onClick={() => refreshTimeline(true)}>Retry</Button>}
        description={errorMessage}
        title="Timeline unavailable"
      />
    );
  }

  const filters = readModel?.filters || [{ id: "all", label: "All Events", count: 0 }];
  const hasMore = visibleCount < filteredEvents.length;

  return (
    <div className="deal-timeline">
      <SectionHeader
        actions={
          <Button
            aria-label="Refresh deal timeline"
            disabled={loading}
            onClick={() => refreshTimeline(true)}
            size="sm"
            variant="secondary"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        }
        description="Persisted deal history from supported communication and operating records."
        title="Timeline"
      />

      <div className="deal-timeline__summary">
        <Badge>{readModel?.totalVisible || 0} events</Badge>
        {readModel?.sourceStatus === "partial" ? (
          <StatusBadge status="warning">Partial source results</StatusBadge>
        ) : null}
        <span>
          Last refreshed {formatSafeDate(readModel?.generatedAt, "not yet")}
        </span>
      </div>

      <p aria-live="polite" className="deal-timeline__announcement" role="status">
        {announcement}
      </p>

      {readModel?.sourceWarnings?.length ? (
        <details className="deal-timeline__source-warning">
          <summary>Review source warnings</summary>
          <ul>
            {readModel.sourceWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="deal-timeline__controls">
        <div aria-label="Timeline category filters" className="deal-timeline__filters" role="group">
          {filters.map((filter) => (
            <Button
              aria-pressed={activeCategory === filter.id}
              key={filter.id}
              onClick={() => {
                setActiveCategory(filter.id);
                setVisibleCount(TIMELINE_VISIBLE_BATCH_SIZE);
              }}
              size="sm"
              variant={activeCategory === filter.id ? "primary" : "secondary"}
            >
              {filter.label} ({filter.count})
            </Button>
          ))}
        </div>
        <Select
          aria-label="Timeline sort order"
          label="Order"
          onChange={(event) => {
            setSortDirection(event.target.value);
            setVisibleCount(TIMELINE_VISIBLE_BATCH_SIZE);
          }}
          value={sortDirection}
        >
          <option value={TIMELINE_SORT_DIRECTIONS.NEWEST}>Newest first</option>
          <option value={TIMELINE_SORT_DIRECTIONS.OLDEST}>Oldest first</option>
        </Select>
      </div>

      {readModel?.notices?.map((notice) => (
        <p className="deal-timeline__notice" key={notice}>
          {notice}
        </p>
      ))}

      {filteredEvents.length === 0 ? (
        <EmptyState
          description={
            activeCategory === "all"
              ? "No supported historical records are available for this deal."
              : "No timeline events match this category."
          }
          title={activeCategory === "all" ? "No history yet" : "No matching events"}
        />
      ) : (
        <div className="deal-timeline__groups">
          {groups.map((group) => (
            <section aria-labelledby={`timeline-group-${group.id}`} key={group.id}>
              <h3 id={`timeline-group-${group.id}`}>{group.label}</h3>
              <ol aria-label={`${group.label} timeline events`} className="deal-timeline__events">
                {group.events.map((event) => (
                  <TimelineEventRow
                    event={event}
                    key={event.id}
                    onOpenContext={onOpenContext}
                  />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      {hasMore ? (
        <div className="deal-timeline__show-more">
          <Button
            onClick={() =>
              setVisibleCount((current) =>
                Math.min(current + TIMELINE_VISIBLE_BATCH_SIZE, filteredEvents.length)
              )
            }
            variant="secondary"
          >
            Show More
          </Button>
          <span>
            Showing {visibleEvents.length} of {filteredEvents.length}
          </span>
        </div>
      ) : null}
    </div>
  );
}
