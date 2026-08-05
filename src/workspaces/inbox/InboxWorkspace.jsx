import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Badge,
  Button,
  Card,
  Dropdown,
  EmptyState,
  ErrorState,
  Input,
  LoadingSkeleton,
  PageHeader,
  StatusBadge,
  TextArea,
} from "../../design-system";
import {
  COMPOSER_SEND_STATES,
  INBOX_FILTERS,
  INBOX_LIST_BATCH_SIZE,
  buildSmsTemplates,
  filterInboxConversations,
  loadInboxThread,
  mergeInboxThreadMessages,
  messageBelongsToConversation,
  normalizeInboxSendResult,
  normalizeInboxThreadMessage,
  subscribeToMessageInserts,
} from "../../services/conversations";
import { sendOutboundSms } from "../../services/sms";
import { hasPhone } from "../../utils/phone";
import "./inbox-workspace.css";

const SELECTED_CONVERSATION_KEY = "ai-inbox-selected-conversation";
const MAX_SMS_CHARACTERS = 1600;
const NEAR_BOTTOM_THRESHOLD_PX = 80;

const EMPTY_READ_MODEL = {
  items: [],
  counts: {
    all: 0,
    needsReply: 0,
    failed: 0,
    recent: 0,
    linked: 0,
    unlinked: 0,
  },
  generatedAt: "",
  notices: [],
  providerState: { mode: "unknown" },
  sourceWarnings: [],
  supportedFilters: {},
};

function formatDateTime(value, fallback = "Not available") {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString();
}

function capitalize(value, fallback = "Not reported") {
  const text = String(value || "").trim();
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : fallback;
}

function readSessionValue(key, fallback = "") {
  if (typeof window === "undefined") return fallback;
  try {
    return window.sessionStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writeSessionValue(key, value) {
  if (typeof window === "undefined") return;
  try {
    if (value) window.sessionStorage.setItem(key, value);
    else window.sessionStorage.removeItem(key);
  } catch {
    // Session persistence is optional; Inbox behavior does not depend on it.
  }
}

function scheduleFrame(callback) {
  if (typeof window !== "undefined" && window.requestAnimationFrame) {
    window.requestAnimationFrame(callback);
    return;
  }
  setTimeout(callback, 0);
}

function availableFilters(readModel) {
  return INBOX_FILTERS.filter((filter) => {
    if (filter.id === "all") return true;
    if (filter.id === "needs-reply") return readModel.supportedFilters.needsReply;
    if (filter.id === "failed") return readModel.supportedFilters.failed;
    if (filter.id === "recent") return readModel.supportedFilters.recent;
    if (filter.id === "linked") return readModel.supportedFilters.linked;
    if (filter.id === "unlinked") return readModel.supportedFilters.unlinked;
    return false;
  });
}

function filterCount(readModel, filterId) {
  if (filterId === "needs-reply") return readModel.counts.needsReply;
  if (filterId === "failed") return readModel.counts.failed;
  return readModel.counts[filterId] ?? readModel.counts.all;
}

function messageStatusStyle(message) {
  if (message.failed) return "danger";
  if (message.testMode) return "warning";
  if (message.deliveryStatus === "delivered") return "success";
  if (message.deliveryStatus) return "info";
  return "neutral";
}

function composerStatusStyle(state) {
  if (
    state === COMPOSER_SEND_STATES.FAILED ||
    state === COMPOSER_SEND_STATES.PROVIDER_UNAVAILABLE
  ) {
    return "danger";
  }
  if (
    state === COMPOSER_SEND_STATES.TEST_SAVED ||
    state === COMPOSER_SEND_STATES.TEST_UNPERSISTED
  ) {
    return "warning";
  }
  if (state === COMPOSER_SEND_STATES.LIVE_SENT) return "success";
  return "neutral";
}

function summaryPrimaryLabel(conversation) {
  return (
    conversation.sellerName ||
    conversation.propertyAddress ||
    conversation.phone ||
    "Unknown participant"
  );
}

function summarySecondaryLabel(conversation) {
  if (conversation.sellerName && conversation.propertyAddress) {
    return conversation.propertyAddress;
  }
  if ((conversation.sellerName || conversation.propertyAddress) && conversation.phone) {
    return conversation.phone;
  }
  return conversation.linked ? "Linked deal" : "Unlinked conversation";
}

// Distinct responsibility: render one normalized conversation summary and no thread logic.
function ConversationRow({ active, conversation, onSelect }) {
  const directionLabel =
    conversation.lastMessageDirection === "outbound" ? "Outbound" : "Inbound";

  return (
    <li>
      <button
        aria-current={active ? "true" : undefined}
        aria-label={`Open conversation with ${summaryPrimaryLabel(conversation)}`}
        aria-pressed={active}
        className={`inbox-conversation-row ${active ? "inbox-conversation-row--active" : ""}`.trim()}
        onClick={() => onSelect(conversation)}
        type="button"
      >
        <div className="inbox-conversation-row__heading">
          <div>
            <strong>{summaryPrimaryLabel(conversation)}</strong>
            <span>{summarySecondaryLabel(conversation)}</span>
          </div>
          <time dateTime={conversation.lastMessageTimestamp || undefined}>
            {formatDateTime(conversation.lastMessageTimestamp, "No timestamp")}
          </time>
        </div>

        <p>{conversation.lastMessagePreview || "No message preview available."}</p>

        <div className="inbox-conversation-row__badges">
          <Badge>{directionLabel}</Badge>
          {conversation.needsReply ? (
            <StatusBadge status="info">Needs Reply</StatusBadge>
          ) : null}
          {conversation.failedDelivery ? (
            <StatusBadge status="danger">Failed</StatusBadge>
          ) : null}
          {conversation.testMode ? (
            <StatusBadge status="warning">Test Mode</StatusBadge>
          ) : null}
          {conversation.linked ? <Badge>Linked Deal</Badge> : <Badge>Unlinked</Badge>}
        </div>
      </button>
    </li>
  );
}

// Distinct responsibility: expose one shared search/filter contract for the summary list.
function ConversationListControls({
  activeFilter,
  filters,
  onFilterChange,
  onQueryChange,
  query,
  readModel,
}) {
  return (
    <div className="inbox-list-controls">
      <Input
        aria-label="Search conversations"
        label="Search"
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Seller, property, phone, or message"
        type="search"
        value={query}
      />
      <div aria-label="Conversation filters" className="inbox-filter-group" role="group">
        {filters.map((filter) => (
          <Button
            aria-pressed={activeFilter === filter.id}
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            size="sm"
            variant={activeFilter === filter.id ? "primary" : "ghost"}
          >
            {filter.label} ({filterCount(readModel, filter.id)})
          </Button>
        ))}
      </div>
    </div>
  );
}

// Distinct responsibility: present one bounded, searchable list and selection state.
function ConversationListPane({
  activeKey,
  conversations,
  onSelect,
  readModel,
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [visibleLimit, setVisibleLimit] = useState(INBOX_LIST_BATCH_SIZE);
  const filters = availableFilters(readModel);
  const effectiveFilter = filters.some((item) => item.id === filter) ? filter : "all";
  const filtered = useMemo(
    () => filterInboxConversations(conversations, { filter: effectiveFilter, query }),
    [conversations, effectiveFilter, query]
  );
  const visible = filtered.slice(0, visibleLimit);
  const remaining = filtered.length - visible.length;

  return (
    <Card className="inbox-list-pane">
      <div className="inbox-list-pane__header">
        <div>
          <h2>Conversations</h2>
          <p>{filtered.length} matching conversations</p>
        </div>
      </div>

      <ConversationListControls
        activeFilter={effectiveFilter}
        filters={filters}
        onFilterChange={setFilter}
        onQueryChange={setQuery}
        query={query}
        readModel={readModel}
      />

      {visible.length ? (
        <>
          <ol aria-label="Seller conversations" className="inbox-conversation-list">
            {visible.map((conversation) => (
              <ConversationRow
                active={conversation.compatibilityKey === activeKey}
                conversation={conversation}
                key={conversation.compatibilityKey}
                onSelect={onSelect}
              />
            ))}
          </ol>
          {remaining > 0 ? (
            <Button
              onClick={() =>
                setVisibleLimit((current) =>
                  Math.min(filtered.length, current + INBOX_LIST_BATCH_SIZE)
                )
              }
              variant="secondary"
            >
              Show {Math.min(INBOX_LIST_BATCH_SIZE, remaining)} more
            </Button>
          ) : null}
        </>
      ) : (
        <EmptyState
          action={
            query || effectiveFilter !== "all" ? (
              <Button
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
                variant="secondary"
              >
                Clear search and filters
              </Button>
            ) : null
          }
          description="Try another supported filter or clear the current search."
          title="No conversations match this view"
        />
      )}
    </Card>
  );
}

// Distinct responsibility: render normalized messages chronologically with explicit status text.
function MessageTimeline({
  hasEarlier,
  loadingEarlier,
  messages,
  onLoadEarlier,
  timelineRef,
}) {
  if (!messages.length) {
    return (
      <EmptyState
        description="This conversation has no bounded message history to display."
        title="No messages yet"
      />
    );
  }

  return (
    <div className="inbox-message-region">
      {hasEarlier ? (
        <Button
          disabled={loadingEarlier}
          onClick={onLoadEarlier}
          size="sm"
          variant="secondary"
        >
          {loadingEarlier ? "Loading earlier messages..." : "Load Earlier"}
        </Button>
      ) : null}
      <ol aria-label="Message history" className="inbox-message-timeline" ref={timelineRef}>
        {messages.map((message) => (
          <li
            className={`inbox-message inbox-message--${message.direction}`}
            key={message.id}
          >
            <article aria-label={message.accessibilityLabel}>
              <div className="inbox-message__meta">
                <strong>
                  {message.direction === "outbound" ? "Outbound" : "Inbound"} - {message.actorLabel}
                </strong>
                <time dateTime={message.timestamp || undefined}>
                  {formatDateTime(message.timestamp, "Timestamp unavailable")}
                </time>
              </div>
              <p>{message.body}</p>
              <div className="inbox-message__status">
                <StatusBadge status={messageStatusStyle(message)}>
                  {message.testMode
                    ? "Test Mode"
                    : message.deliveryStatus
                      ? `Status: ${capitalize(message.deliveryStatus)}`
                      : "Delivery status not reported"}
                </StatusBadge>
              </div>
            </article>
          </li>
        ))}
      </ol>
    </div>
  );
}

function draftStorageKey(conversation) {
  return `ai-inbox-draft:${conversation.compatibilityKey}`;
}

function readDraft(conversation) {
  return readSessionValue(draftStorageKey(conversation), "");
}

function writeDraft(conversation, value) {
  writeSessionValue(draftStorageKey(conversation), value);
}

// Distinct responsibility: validate and send one SMS through the existing application service.
function MessageComposer({ conversation, onSent }) {
  const [draft, setDraft] = useState(() => readDraft(conversation));
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState({
    state: COMPOSER_SEND_STATES.IDLE,
    message: "",
  });
  const sendingRef = useRef(false);
  const templates = useMemo(
    () => buildSmsTemplates({ propertyAddress: conversation.propertyAddress }),
    [conversation.propertyAddress]
  );
  const phoneValid = hasPhone(conversation.phone);

  function updateDraft(value) {
    setDraft(value);
    writeDraft(conversation, value);
    if (sendStatus.message) {
      setSendStatus({ state: COMPOSER_SEND_STATES.IDLE, message: "" });
    }
  }

  async function handleSend() {
    if (sendingRef.current) return;

    const trimmedDraft = draft.trim();
    if (!phoneValid) {
      setSendStatus({
        state: COMPOSER_SEND_STATES.FAILED,
        message: "A valid recipient phone number is required. Your draft is preserved.",
      });
      return;
    }
    if (!trimmedDraft) {
      setSendStatus({
        state: COMPOSER_SEND_STATES.FAILED,
        message: "Enter a message before sending.",
      });
      return;
    }

    sendingRef.current = true;
    setSending(true);
    setSendStatus({
      state: COMPOSER_SEND_STATES.SENDING,
      message: "Sending message...",
    });

    try {
      const result = await sendOutboundSms({
        to: conversation.phone,
        message: trimmedDraft,
        dealId: conversation.linkedDealId || null,
      });
      const normalizedResult = normalizeInboxSendResult(result, {
        linkedDealId: conversation.linkedDealId,
      });
      setSendStatus(normalizedResult);

      if (normalizedResult.success && normalizedResult.clearDraft) {
        setDraft("");
        writeDraft(conversation, "");
        try {
          await onSent?.();
        } catch {
          // The send result remains authoritative even if the follow-up refresh fails.
        }
      }
    } catch {
      setSendStatus(
        normalizeInboxSendResult({
          success: false,
          error: { message: "SMS provider unavailable." },
          metadata: { status: 503 },
        })
      );
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  function handleComposerKeyDown(event) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleSend();
    }
  }

  const templateItems = [
    { id: "initial", label: "Initial outreach", body: templates.initial },
    { id: "followup", label: "Follow-up", body: templates.followup },
    { id: "offer", label: "Offer conversation", body: templates.offer },
    { id: "checkin", label: "Check-in", body: templates.checkin },
  ].map((template) => ({
    id: template.id,
    label: template.label,
    onSelect: () => updateDraft(template.body),
  }));

  return (
    <div className="inbox-composer">
      <div className="inbox-composer__heading">
        <div>
          <h3>Reply</h3>
          <p>To {conversation.phone || "No recipient"}</p>
        </div>
        <Dropdown
          items={templateItems}
          label="Use message template"
          trigger="Use template"
        />
      </div>
      <TextArea
        aria-label="Message"
        aria-keyshortcuts="Control+Enter Meta+Enter"
        hint="Ctrl or Cmd + Enter sends. Enter adds a new line."
        label="Message"
        maxLength={MAX_SMS_CHARACTERS}
        onChange={(event) => updateDraft(event.target.value)}
        onKeyDown={handleComposerKeyDown}
        placeholder="Write a concise seller response"
        rows={4}
        value={draft}
      />
      <div className="inbox-composer__footer">
        <span>{draft.length} / {MAX_SMS_CHARACTERS} characters</span>
        <Button disabled={sending} onClick={handleSend}>
          {sending ? "Sending..." : "Send SMS"}
        </Button>
      </div>
      {sendStatus.message ? (
        <div
          aria-live="polite"
          className="inbox-composer__result"
          role={
            [
              COMPOSER_SEND_STATES.FAILED,
              COMPOSER_SEND_STATES.PROVIDER_UNAVAILABLE,
            ].includes(sendStatus.state)
              ? "alert"
              : "status"
          }
        >
          <StatusBadge status={composerStatusStyle(sendStatus.state)}>
            {sendStatus.message}
          </StatusBadge>
        </div>
      ) : null}
    </div>
  );
}

// Distinct responsibility: show communication context and supported record actions only.
function ThreadHeader({ conversation, navigateToDeal }) {
  const [copyStatus, setCopyStatus] = useState("");
  const phoneAvailable = hasPhone(conversation.phone);
  const callTarget = phoneAvailable
    ? `tel:${conversation.phone.replace(/[^+\d]/g, "")}`
    : "";

  async function copyPhone() {
    if (!conversation.phone || !navigator.clipboard) {
      setCopyStatus("Copy is unavailable in this browser.");
      return;
    }
    try {
      await navigator.clipboard.writeText(conversation.phone);
      setCopyStatus("Phone number copied.");
    } catch {
      setCopyStatus("Phone number could not be copied.");
    }
  }

  return (
    <header className="inbox-thread-header">
      <div>
        <h2>{summaryPrimaryLabel(conversation)}</h2>
        {conversation.propertyAddress ? <p>{conversation.propertyAddress}</p> : null}
        {conversation.phone ? <p>{conversation.phone}</p> : null}
      </div>
      <div className="inbox-thread-header__badges">
        {conversation.stage ? <Badge>Stage: {conversation.stage}</Badge> : null}
        {conversation.needsReply ? (
          <StatusBadge status="info">Needs Reply</StatusBadge>
        ) : (
          <StatusBadge status="neutral">No reply currently indicated</StatusBadge>
        )}
        {conversation.testMode ? (
          <StatusBadge status="warning">Test Mode History</StatusBadge>
        ) : null}
      </div>
      <div className="inbox-thread-header__actions">
        {conversation.linkedDealId && conversation.linkedContextAvailable && navigateToDeal ? (
          <Button
            onClick={() => navigateToDeal(conversation.linkedDealId)}
            size="sm"
            variant="secondary"
          >
            Open Deal
          </Button>
        ) : null}
        {phoneAvailable ? (
          <>
            <a className="inbox-action-link" href={callTarget}>Call</a>
            <Button onClick={copyPhone} size="sm" variant="ghost">Copy Phone</Button>
          </>
        ) : null}
      </div>
      {copyStatus ? (
        <div aria-live="polite" className="inbox-thread-header__copy-status" role="status">
          {copyStatus}
        </div>
      ) : null}
      {conversation.partialDataWarnings.length ? (
        <p className="inbox-thread-header__warning" role="status">
          {conversation.partialDataWarnings.join(" ")}
        </p>
      ) : null}
    </header>
  );
}

// Distinct responsibility: own bounded thread paging, Realtime merge, and scroll behavior.
function FocusedConversationThread({
  conversation,
  navigateToDeal,
  onConversationRefresh,
  onMobileBack,
  realtimeEvent,
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [hasEarlier, setHasEarlier] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const requestRef = useRef(0);
  const timelineRef = useRef(null);

  const loadLatest = useCallback(
    async ({ force = false, scroll = true } = {}) => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      setLoading(true);
      setError("");

      const result = await loadInboxThread({ conversation, force, offset: 0 });
      if (requestRef.current !== requestId) return result;

      if (!result.success) {
        setError(result.error?.message || "This conversation could not be loaded.");
        setLoading(false);
        return result;
      }

      setMessages(result.data.messages);
      setWarnings(result.data.sourceWarnings || []);
      setHasEarlier(result.data.hasEarlier);
      setNextOffset(result.data.nextOffset);
      setLoading(false);
      if (scroll) {
        scheduleFrame(() => {
          if (timelineRef.current) {
            timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
          }
        });
      }
      return result;
    },
    [conversation]
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadLatest().catch(() => {});
    }, 0);
    return () => {
      clearTimeout(timeoutId);
      requestRef.current += 1;
    };
  }, [loadLatest]);

  useEffect(() => {
    const realtimeMessage = realtimeEvent?.message;
    if (!realtimeMessage || !messageBelongsToConversation(realtimeMessage, conversation)) {
      return;
    }

    const timeline = timelineRef.current;
    const shouldScroll =
      !timeline ||
      timeline.scrollHeight - timeline.scrollTop - timeline.clientHeight <
        NEAR_BOTTOM_THRESHOLD_PX;
    const normalized = normalizeInboxThreadMessage(realtimeMessage, {
      compatibilityKey: conversation.compatibilityKey,
      dealId: conversation.linkedDealId,
    });
    if (!normalized.body) return;

    scheduleFrame(() => {
      setMessages((current) => mergeInboxThreadMessages(current, [normalized]));
      if (shouldScroll) {
        scheduleFrame(() => {
          if (timelineRef.current) {
            timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
          }
        });
      }
    });
  }, [conversation, realtimeEvent]);

  async function loadEarlier() {
    if (loadingEarlier || !hasEarlier) return;
    const timeline = timelineRef.current;
    const previousHeight = timeline?.scrollHeight || 0;
    setLoadingEarlier(true);
    const result = await loadInboxThread({ conversation, offset: nextOffset });

    if (result.success) {
      setMessages((current) =>
        mergeInboxThreadMessages(result.data.messages, current)
      );
      setWarnings((current) => [
        ...new Set([...current, ...(result.data.sourceWarnings || [])]),
      ]);
      setHasEarlier(result.data.hasEarlier);
      setNextOffset(result.data.nextOffset);
      scheduleFrame(() => {
        if (timelineRef.current) {
          timelineRef.current.scrollTop =
            timelineRef.current.scrollHeight - previousHeight;
        }
      });
    } else {
      setError(result.error?.message || "Earlier messages could not be loaded.");
    }
    setLoadingEarlier(false);
  }

  async function handleSent() {
    await loadLatest({ force: true, scroll: true });
    try {
      await onConversationRefresh?.();
    } catch {
      setWarnings((current) => [
        ...new Set([...current, "Conversation summaries could not be refreshed."]),
      ]);
    }
  }

  return (
    <Card className="inbox-thread-pane">
      <Button
        className="inbox-thread__mobile-back"
        onClick={onMobileBack}
        size="sm"
        variant="ghost"
      >
        Back to conversations
      </Button>
      <ThreadHeader conversation={conversation} navigateToDeal={navigateToDeal} />

      {warnings.length ? (
        <p className="inbox-thread__warning" role="status">{warnings.join(" ")}</p>
      ) : null}

      {loading ? (
        <div aria-label="Loading conversation thread" className="inbox-thread-loading">
          <LoadingSkeleton height="4rem" />
          <LoadingSkeleton height="4rem" width="80%" />
          <LoadingSkeleton height="4rem" />
        </div>
      ) : error ? (
        <ErrorState
          action={<Button onClick={() => loadLatest({ force: true })}>Retry thread</Button>}
          description={error}
          title="Conversation unavailable"
        />
      ) : (
        <MessageTimeline
          hasEarlier={hasEarlier}
          loadingEarlier={loadingEarlier}
          messages={messages}
          onLoadEarlier={loadEarlier}
          timelineRef={timelineRef}
        />
      )}

      <MessageComposer conversation={conversation} onSent={handleSent} />
    </Card>
  );
}

// New component reason: the legacy Inbox route mounts three overlapping products and
// the seller-workspace thread; none provides the bounded split-view communication workspace.
export default function InboxWorkspace({
  conversationLoadError = "",
  conversationLoading = false,
  conversationReadModel = null,
  navigateToDeal,
  refreshConversations,
  selectedPhone = null,
  setSelectedPhone,
}) {
  const readModel = conversationReadModel || EMPTY_READ_MODEL;
  const [selectedKey, setSelectedKey] = useState(() =>
    selectedPhone ? "" : readSessionValue(SELECTED_CONVERSATION_KEY, "")
  );
  const [mobileThreadOpen, setMobileThreadOpen] = useState(Boolean(selectedPhone));
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [realtimeWarning, setRealtimeWarning] = useState("");
  const [realtimeEvent, setRealtimeEvent] = useState(null);
  const realtimeSequenceRef = useRef(0);
  const externalSelection = useMemo(
    () =>
      readModel.items.find(
        (conversation) =>
          selectedPhone && messageBelongsToConversation({ phone: selectedPhone }, conversation)
      ) || null,
    [readModel.items, selectedPhone]
  );
  const selectedConversation = useMemo(
    () =>
      readModel.items.find(
        (conversation) => conversation.compatibilityKey === selectedKey
      ) || null,
    [readModel.items, selectedKey]
  );
  const activeConversation = selectedConversation || externalSelection;
  const activeKey = activeConversation?.compatibilityKey || "";

  useEffect(() => {
    if (activeKey) writeSessionValue(SELECTED_CONVERSATION_KEY, activeKey);
    else if (selectedKey) writeSessionValue(SELECTED_CONVERSATION_KEY, "");
  }, [activeKey, selectedKey]);

  useEffect(() => {
    let unsubscribe = () => {};

    try {
      unsubscribe = subscribeToMessageInserts(
        (message) => {
          realtimeSequenceRef.current += 1;
          setRealtimeEvent({
            message,
            sequence: realtimeSequenceRef.current,
          });
          if (typeof refreshConversations === "function") {
            refreshConversations().catch(() => {
              setRealtimeWarning(
                "Live message arrived, but conversation summaries could not be refreshed."
              );
            });
          }
        },
        (status) => {
          if (status === "SUBSCRIBED") {
            setRealtimeWarning("");
            return;
          }
          if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
            setRealtimeWarning(
              "Live updates are unavailable. Use Refresh to check for new messages."
            );
          }
        }
      );
    } catch {
      setRealtimeWarning(
        "Live updates are unavailable. Use Refresh to check for new messages."
      );
    }

    return unsubscribe;
  }, [refreshConversations]);

  function selectConversation(conversation) {
    setSelectedKey(conversation.compatibilityKey);
    setSelectedPhone?.(conversation.phone || null);
    setMobileThreadOpen(true);
  }

  async function handleRefresh() {
    if (typeof refreshConversations !== "function" || refreshing) return;
    setRefreshing(true);
    setRefreshError("");
    try {
      await refreshConversations();
    } catch {
      setRefreshError(
        "Inbox data could not be refreshed. Existing conversations remain visible."
      );
    } finally {
      setRefreshing(false);
    }
  }

  const warnings = [
    ...readModel.sourceWarnings,
    conversationLoadError,
    refreshError,
    realtimeWarning,
  ].filter(Boolean);
  const fullError = Boolean(conversationLoadError && !readModel.items.length);
  const loading = conversationLoading && !readModel.items.length;

  return (
    <section
      className={`workspace inbox-workspace ${mobileThreadOpen ? "inbox-workspace--thread-open" : ""}`.trim()}
    >
      <PageHeader
        actions={
          <div className="inbox-header-actions">
            <Badge>{readModel.counts.all} conversations</Badge>
            <StatusBadge status={readModel.counts.needsReply ? "info" : "neutral"}>
              {readModel.counts.needsReply} Needs Reply
            </StatusBadge>
            {readModel.counts.failed ? (
              <StatusBadge status="danger">{readModel.counts.failed} Failed</StatusBadge>
            ) : null}
            {readModel.providerState.mode === "test" ? (
              <StatusBadge status="warning">Test Mode History</StatusBadge>
            ) : null}
            {typeof refreshConversations === "function" ? (
              <Button disabled={refreshing} onClick={handleRefresh} variant="secondary">
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
            ) : null}
          </div>
        }
        description="Review seller messages, respond safely, and open the related deal when more context is needed."
        title="Inbox"
      />
      <p className="inbox-workspace__refresh-note">
        Last refreshed: {formatDateTime(readModel.generatedAt)}
      </p>

      {warnings.length && !fullError ? (
        <Card className="inbox-workspace__warning" muted role="status">
          <strong>Some Inbox data is incomplete.</strong>
          <span>{[...new Set(warnings)].join(" ")}</span>
        </Card>
      ) : null}

      {readModel.notices.map((notice) => (
        <Card className="inbox-workspace__notice" key={notice} muted>{notice}</Card>
      ))}

      {loading ? (
        <Card aria-label="Loading Inbox" className="inbox-loading">
          <LoadingSkeleton height="3rem" />
          <LoadingSkeleton height="18rem" />
        </Card>
      ) : fullError ? (
        <ErrorState
          action={
            typeof refreshConversations === "function" ? (
              <Button onClick={handleRefresh}>Retry Inbox</Button>
            ) : null
          }
          description="Conversation history could not be loaded. No provider error details are exposed here."
          title="Inbox unavailable"
        />
      ) : !readModel.items.length ? (
        <EmptyState
          description="Incoming and outgoing communication history will appear here when message logs are available. Drafting remains available after selecting a real conversation."
          title="No conversations yet"
        />
      ) : (
        <div className="inbox-split-view" data-testid="inbox-split-view">
          <ConversationListPane
            activeKey={activeKey}
            conversations={readModel.items}
            onSelect={selectConversation}
            readModel={readModel}
          />
          {activeConversation ? (
            <FocusedConversationThread
              conversation={activeConversation}
              key={activeConversation.compatibilityKey}
              navigateToDeal={navigateToDeal}
              onConversationRefresh={refreshConversations}
              onMobileBack={() => setMobileThreadOpen(false)}
              realtimeEvent={realtimeEvent}
            />
          ) : (
            <Card className="inbox-thread-pane inbox-thread-pane--empty">
              <EmptyState
                description="Choose a seller conversation to review messages and prepare a response."
                title="Select a conversation"
              />
            </Card>
          )}
        </div>
      )}
    </section>
  );
}
