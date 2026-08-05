import { getDealRoute } from "../../navigation/workspaces";
import { hoursSince, toSafeDate } from "../../utils/dates";
import { getDealAliasText } from "../../utils/dealFields";
import { hasPhone, normalizePhone } from "../../utils/phone";
import { compactText, safeTrim } from "../../utils/text";
import { loadConversationInbox, loadThreadMessages } from "./conversationService";
import {
  conversationNeedsReply,
  conversationsMatch,
  getCanonicalConversationId,
  getConversationCompatibilityKey,
  getConversationMessageDirection,
  getConversationPhone,
  getExplicitUnreadState,
} from "./conversationSignals";
import { normalizeMessageRecord } from "./messageRepository";

export const INBOX_RESULT_LIMIT = 100;
export const INBOX_SOURCE_LIMIT = 500;
export const INBOX_LIST_BATCH_SIZE = 40;
export const INBOX_THREAD_BATCH_SIZE = 50;
export const INBOX_THREAD_MAX_LIMIT = 100;
export const INBOX_RECENT_HOURS = 7 * 24;

export const INBOX_FILTERS = [
  { id: "all", label: "All" },
  { id: "needs-reply", label: "Needs Reply" },
  { id: "failed", label: "Failed" },
  { id: "recent", label: "Recent" },
  { id: "linked", label: "Linked to Deal" },
  { id: "unlinked", label: "Unlinked" },
];

export const COMPOSER_SEND_STATES = {
  IDLE: "idle",
  SENDING: "sending",
  LIVE_SENT: "live-sent",
  TEST_SAVED: "test-saved",
  TEST_UNPERSISTED: "test-unpersisted",
  ACCEPTED: "accepted",
  FAILED: "failed",
  PROVIDER_UNAVAILABLE: "provider-unavailable",
};

const FAILED_DELIVERY_STATUSES = new Set(["failed", "undelivered"]);

function safeValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeBoundedLimit(value, fallback, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(1, Math.floor(parsed)));
}

function normalizeOffset(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function normalizeStatus(value) {
  return safeValue(value).toLowerCase();
}

function stableHash(value) {
  let hash = 2166136261;
  const text = String(value || "");

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function getMessageSourceId(record = {}) {
  return safeValue(record.id || record.message_id || record.messageId);
}

function getProviderIdentifier(record = {}) {
  return safeValue(
    record.provider_sid || record.providerSid || record.provider_message_id
  );
}

function getProviderMode(record = {}, deliveryStatus = "") {
  const explicitMode = normalizeStatus(
    record.provider_mode || record.providerMode || record.mode
  );

  if (["live", "test"].includes(explicitMode)) return explicitMode;
  return deliveryStatus === "test" ? "test" : null;
}

function getExplicitDeliveryStatus(record = {}) {
  const status = normalizeStatus(record.lastDeliveryStatus || record.status);
  const statusWasExplicit =
    record.lastDeliveryStatus !== null && record.lastDeliveryStatus !== undefined
      ? Boolean(safeValue(record.lastDeliveryStatus))
      : record.statusWasExplicit === true;
  return statusWasExplicit && status ? status : null;
}

function getDealId(deal = {}) {
  return getDealAliasText(deal, "id") || safeValue(deal.uuid);
}

function getDealPhone(deal = {}) {
  return getDealAliasText(deal, "phone");
}

function buildDealIndexes(deals = []) {
  const byId = new Map();
  const byPhone = new Map();

  (Array.isArray(deals) ? deals : [])
    .filter((deal) => deal && typeof deal === "object" && !Array.isArray(deal))
    .slice(0, 500)
    .forEach((deal) => {
      const dealId = getDealId(deal);
      const normalizedPhone = normalizePhone(getDealPhone(deal));
      if (dealId && !byId.has(dealId)) byId.set(dealId, deal);
      if (normalizedPhone && !byPhone.has(normalizedPhone)) {
        byPhone.set(normalizedPhone, deal);
      }
    });

  return { byId, byPhone };
}

function resolveDealContext(summary, dealIndexes) {
  const requestedDealId = safeValue(
    summary.dealId || summary.deal_id || summary.relatedDealId
  );
  const normalizedPhone = normalizePhone(getConversationPhone(summary));
  const deal =
    (requestedDealId ? dealIndexes.byId.get(requestedDealId) : null) ||
    (normalizedPhone ? dealIndexes.byPhone.get(normalizedPhone) : null) ||
    null;
  const linkedDealId = deal ? getDealId(deal) : requestedDealId;

  return {
    deal,
    linked: Boolean(linkedDealId),
    linkedDealId: linkedDealId || null,
    contextAvailable: Boolean(deal),
    targetRoute: linkedDealId ? getDealRoute(linkedDealId) : null,
  };
}

function messageTimestamp(record = {}) {
  const value =
    record.created_at ||
    record.createdAt ||
    record.timestamp ||
    record.lastMessageTimestamp ||
    record.lastMessageAt;
  return toSafeDate(value)?.toISOString() || null;
}

function actorLabel(direction, record = {}) {
  return (
    safeValue(record.actorLabel || record.actor || record.sender) ||
    (direction === "outbound" ? "Acquisitions team" : "Seller")
  );
}

export function normalizeInboxThreadMessage(
  record = {},
  { compatibilityKey = "", dealId = null } = {}
) {
  const normalized = normalizeMessageRecord(record);
  const direction = getConversationMessageDirection(normalized);
  const body = compactText(normalized.message || normalized.body);
  const timestamp = messageTimestamp(normalized);
  const resolvedCompatibilityKey =
    compatibilityKey || getConversationCompatibilityKey(normalized);
  const deliveryStatus = getExplicitDeliveryStatus(normalized);
  const providerIdentifier = getProviderIdentifier(normalized);
  const sourceId = getMessageSourceId(normalized);
  const fallbackIdentity = stableHash(
    [
      resolvedCompatibilityKey,
      direction,
      timestamp || "no-time",
      body,
    ].join(":")
  );
  const id = `message:${sourceId || providerIdentifier || fallbackIdentity}`;
  const providerMode = getProviderMode(normalized, deliveryStatus || "");
  const actor = actorLabel(direction, normalized);
  const timestampLabel = timestamp
    ? new Date(timestamp).toLocaleString()
    : "Timestamp unavailable";
  const statusLabel = deliveryStatus ? `, status ${deliveryStatus}` : "";

  return {
    id,
    sourceId: sourceId || null,
    canonicalConversationId: getCanonicalConversationId(normalized) || null,
    compatibilityKey: resolvedCompatibilityKey,
    dealId:
      safeValue(normalized.deal_id || normalized.dealId || dealId) || null,
    phone: getConversationPhone(normalized),
    normalizedPhone: normalizePhone(getConversationPhone(normalized)),
    direction,
    directionSource: normalized.directionSource,
    body,
    timestamp,
    deliveryStatus,
    providerMode,
    providerIdentifier: providerIdentifier || null,
    actorLabel: actor,
    failed: Boolean(
      direction === "outbound" &&
        deliveryStatus &&
        FAILED_DELIVERY_STATUSES.has(deliveryStatus)
    ),
    testMode: providerMode === "test" || deliveryStatus === "test",
    validForResponse: Boolean(body && timestamp && resolvedCompatibilityKey),
    accessibilityLabel: `${direction === "outbound" ? "Outbound" : "Inbound"} message from ${actor}, ${timestampLabel}${statusLabel}`,
    source: safeValue(normalized.source) || "message_logs",
  };
}

function summaryTimestamp(summary = {}) {
  return (
    messageTimestamp(summary) ||
    messageTimestamp({ created_at: summary.created_at }) ||
    null
  );
}

export function normalizeInboxConversationSummary(
  summary = {},
  { compatibilityKey = "", dealIndexes = buildDealIndexes([]), now = Date.now() } = {}
) {
  const normalized = normalizeMessageRecord({
    ...summary,
    message: summary.lastMessagePreview || summary.message || summary.body,
    created_at:
      summary.lastMessageTimestamp ||
      summary.lastMessageAt ||
      summary.created_at ||
      summary.createdAt,
    direction: summary.lastMessageDirection || summary.direction,
    status: summary.lastDeliveryStatus || summary.status,
    statusWasExplicit:
      summary.lastDeliveryStatus !== null &&
      summary.lastDeliveryStatus !== undefined
        ? Boolean(safeValue(summary.lastDeliveryStatus))
        : summary.statusWasExplicit,
  });
  const resolvedCompatibilityKey =
    compatibilityKey || getConversationCompatibilityKey(normalized);
  const context = resolveDealContext(normalized, dealIndexes);
  const lastMessageTimestamp = summaryTimestamp(normalized);
  const lastMessagePreview = compactText(normalized.message || normalized.body);
  const lastMessageDirection = getConversationMessageDirection(normalized);
  const lastDeliveryStatus = getExplicitDeliveryStatus(normalized);
  const providerMode = getProviderMode(normalized, lastDeliveryStatus || "");
  const hoursOld = lastMessageTimestamp
    ? hoursSince(lastMessageTimestamp, now)
    : null;
  const unreadState = getExplicitUnreadState(summary);
  const requestedDealId = safeValue(
    normalized.dealId || normalized.deal_id || normalized.relatedDealId
  );
  const linkedContextMissing = Boolean(
    context.linked && !context.contextAvailable
  );
  const messageCountValue = Number(summary.messageCount || summary.message_count);
  const messageCount =
    Number.isFinite(messageCountValue) && messageCountValue >= 0
      ? messageCountValue
      : null;
  const responseCandidate = {
    ...normalized,
    compatibilityKey: resolvedCompatibilityKey,
    lastMessageDirection,
    lastMessagePreview,
    lastMessageTimestamp,
  };
  const needsReply = conversationNeedsReply(responseCandidate);
  const failedDelivery = Boolean(
    lastMessageDirection === "outbound" &&
      lastDeliveryStatus &&
      FAILED_DELIVERY_STATUSES.has(lastDeliveryStatus)
  );
  const sellerName = context.deal
    ? getDealAliasText(context.deal, "ownerName")
    : safeValue(summary.sellerName || summary.seller_name || summary.owner_name);
  const propertyAddress = context.deal
    ? getDealAliasText(context.deal, "address")
    : safeValue(summary.propertyAddress || summary.property_address || summary.address);
  const stage = context.deal
    ? getDealAliasText(context.deal, "stage")
    : safeValue(summary.stage || summary.pipeline_stage);
  const phone = getConversationPhone(normalized);
  const tenantId =
    safeValue(
      summary.tenantId || summary.tenant_id || context.deal?.tenant_id
    ) || null;
  const organizationId =
    safeValue(
      summary.organizationId ||
        summary.organization_id ||
        context.deal?.organization_id
    ) || null;

  return {
    id: resolvedCompatibilityKey,
    compatibilityKey: resolvedCompatibilityKey,
    canonicalConversationId: getCanonicalConversationId(normalized) || null,
    tenantId,
    organizationId,
    phone,
    normalizedPhone: normalizePhone(phone),
    participantIdentifier: phone,
    sellerName,
    propertyAddress,
    linkedDealId: context.linkedDealId,
    linkedDealRoute: context.targetRoute,
    linked: context.linked,
    linkedStatus: context.linked
      ? context.contextAvailable
        ? "linked"
        : "context-unavailable"
      : "unlinked",
    linkedContextAvailable: context.contextAvailable,
    channel: safeValue(summary.channel) || "sms",
    lastMessagePreview,
    lastMessageDirection,
    lastMessageTimestamp,
    lastDeliveryStatus,
    providerMode,
    needsReply,
    unreadState,
    failedDelivery,
    testMode: providerMode === "test" || lastDeliveryStatus === "test",
    messageCount,
    messageCountIsComplete: summary.messageCountIsComplete === true,
    source: safeValue(summary.source) || "message_logs",
    lastMeaningfulActivity: lastMessageTimestamp,
    recent: hoursOld !== null && hoursOld >= 0 && hoursOld <= INBOX_RECENT_HOURS,
    stage: stage || null,
    availableActions: [
      { id: "open-conversation", enabled: Boolean(resolvedCompatibilityKey) },
      { id: "send-message", enabled: hasPhone(phone) },
      context.linkedDealId
        ? {
            id: "open-deal",
            enabled: context.contextAvailable,
            route: context.targetRoute,
          }
        : null,
    ].filter(Boolean),
    partialDataWarnings: [
      linkedContextMissing
        ? requestedDealId
          ? "Linked deal details are unavailable."
          : "A related deal was detected, but its details are unavailable."
        : null,
      !lastMessageTimestamp ? "The latest message timestamp is unavailable." : null,
      !lastMessagePreview ? "The latest message preview is unavailable." : null,
    ].filter(Boolean),
  };
}

function inboxAttentionRank(item) {
  if (item.needsReply) return 5;
  if (item.failedDelivery) return 4;
  if (item.lastMessageDirection === "inbound" && item.recent) return 3;
  if (item.recent) return 2;
  return 1;
}

export function compareInboxConversations(left, right) {
  const attentionDifference = inboxAttentionRank(right) - inboxAttentionRank(left);
  if (attentionDifference !== 0) return attentionDifference;

  const leftTime = toSafeDate(left.lastMessageTimestamp)?.getTime() || 0;
  const rightTime = toSafeDate(right.lastMessageTimestamp)?.getTime() || 0;
  if (leftTime !== rightTime) return rightTime - leftTime;
  return left.compatibilityKey.localeCompare(right.compatibilityKey);
}

function canonicalKeysByPhone(summaries) {
  const map = new Map();
  summaries.forEach((summary) => {
    const canonicalId = getCanonicalConversationId(summary);
    const phone = normalizePhone(getConversationPhone(summary));
    if (canonicalId && phone && !map.has(phone)) {
      map.set(phone, `conversation:${canonicalId}`);
    }
  });
  return map;
}

function filterTenantContext(items, tenantId, organizationId) {
  return items.filter((item) => {
    if (tenantId && item.tenantId && item.tenantId !== tenantId) return false;
    if (
      organizationId &&
      item.organizationId &&
      item.organizationId !== organizationId
    ) {
      return false;
    }
    return true;
  });
}

export function buildInboxReadModel({
  conversationSummaries = [],
  deals = [],
  errors = [],
  limit = INBOX_RESULT_LIMIT,
  now = Date.now(),
  organizationId = "",
  sourceMetadata = {},
  tenantId = "",
} = {}) {
  const sourceInput = Array.isArray(conversationSummaries)
    ? conversationSummaries
    : [];
  const validSourceRecords = sourceInput.filter(
    (summary) =>
      summary && typeof summary === "object" && !Array.isArray(summary)
  );
  const source = validSourceRecords.slice(0, INBOX_SOURCE_LIMIT);
  const malformedCount = sourceInput.length - validSourceRecords.length;
  const resultLimit = normalizeBoundedLimit(
    limit,
    INBOX_RESULT_LIMIT,
    INBOX_RESULT_LIMIT
  );
  const dealIndexes = buildDealIndexes(deals);
  const canonicalByPhone = canonicalKeysByPhone(source);
  const normalized = source.map((summary) => {
    const phoneKey = normalizePhone(getConversationPhone(summary));
    const compatibilityKey =
      getCanonicalConversationId(summary)
        ? getConversationCompatibilityKey(summary)
        : canonicalByPhone.get(phoneKey) || getConversationCompatibilityKey(summary);
    return normalizeInboxConversationSummary(summary, {
      compatibilityKey,
      dealIndexes,
      now,
    });
  });
  const validItems = normalized.filter((item) => item.compatibilityKey);
  const sorted = filterTenantContext(
    validItems,
    safeValue(tenantId),
    safeValue(organizationId)
  ).sort(compareInboxConversations);
  const seen = new Set();
  let duplicateCount = 0;
  const deduped = sorted.filter((item) => {
    if (seen.has(item.compatibilityKey)) {
      duplicateCount += 1;
      return false;
    }
    seen.add(item.compatibilityKey);
    return true;
  });
  const items = deduped.slice(0, resultLimit);
  const invalidCount = normalized.length - validItems.length;
  const sourceWarnings = [];

  if ((Array.isArray(errors) ? errors : [errors]).filter(Boolean).length) {
    sourceWarnings.push(
      "Linked deal context is incomplete. Conversation history remains available."
    );
  }
  if (malformedCount || invalidCount) {
    sourceWarnings.push(
      `${malformedCount + invalidCount} malformed conversation record(s) were omitted.`
    );
  }
  if (duplicateCount) {
    sourceWarnings.push(
      `${duplicateCount} duplicate conversation record(s) were consolidated.`
    );
  }
  if (items.some((item) => item.partialDataWarnings.length > 0)) {
    sourceWarnings.push(
      "Some conversation or linked-deal facts are incomplete."
    );
  }

  const truncated = Boolean(
    sourceMetadata.truncated ||
      sourceInput.length > INBOX_SOURCE_LIMIT ||
      deduped.length > resultLimit
  );
  const counts = {
    all: items.length,
    needsReply: items.filter((item) => item.needsReply).length,
    failed: items.filter((item) => item.failedDelivery).length,
    recent: items.filter((item) => item.recent).length,
    linked: items.filter((item) => item.linked).length,
    unlinked: items.filter((item) => !item.linked).length,
  };

  return {
    items,
    counts,
    generatedAt: new Date(now).toISOString(),
    totalLoaded: sourceInput.length,
    totalVisible: items.length,
    limit: resultLimit,
    truncated,
    notices: truncated
      ? [
          `Showing a bounded set of ${items.length} conversations from the available message history.`,
        ]
      : [],
    sourceStatus: sourceWarnings.length ? "partial" : "complete",
    sourceWarnings: sourceWarnings.slice(0, 10),
    supportedFilters: {
      needsReply: items.some((item) => item.needsReply),
      failed: items.some((item) => item.failedDelivery),
      recent: items.some((item) => item.lastMessageTimestamp),
      linked: items.some((item) => item.linked),
      unlinked: items.some((item) => !item.linked),
      unread: items.some((item) => item.unreadState !== null),
    },
    providerState: items.some((item) => item.testMode)
      ? { mode: "test", label: "Test mode appears in message history" }
      : { mode: "unknown", label: "Delivery provider state not reported" },
    freeFirst: {
      providerRequired: false,
      costCategory: "core-free-first",
      notice:
        "Conversation history, search, filters, and drafting do not require a paid communication provider.",
    },
  };
}

export async function loadInboxReadModel({
  deals = [],
  errors = [],
  force = false,
  limit = INBOX_RESULT_LIMIT,
  now = Date.now(),
  organizationId = "",
  sourceLimit = INBOX_SOURCE_LIMIT,
  tenantId = "",
} = {}) {
  const result = await loadConversationInbox({
    force,
    limit: normalizeBoundedLimit(
      sourceLimit,
      INBOX_SOURCE_LIMIT,
      INBOX_SOURCE_LIMIT
    ),
  });

  if (!result.success) {
    return {
      success: false,
      error: { message: "Inbox conversations could not be loaded." },
    };
  }

  return {
    success: true,
    data: buildInboxReadModel({
      conversationSummaries: result.data || [],
      deals,
      errors,
      limit,
      now,
      organizationId,
      sourceMetadata: result.metadata || {},
      tenantId,
    }),
  };
}

function chronologicalMessageSort(left, right) {
  const leftTime = toSafeDate(left.timestamp)?.getTime() || 0;
  const rightTime = toSafeDate(right.timestamp)?.getTime() || 0;
  if (leftTime !== rightTime) return leftTime - rightTime;
  return left.id.localeCompare(right.id);
}

export function mergeInboxThreadMessages(current = [], incoming = []) {
  const byId = new Map();
  [...current, ...incoming].forEach((message) => {
    if (message?.id && !byId.has(message.id)) byId.set(message.id, message);
  });
  return [...byId.values()].sort(chronologicalMessageSort);
}

export async function loadInboxThread({
  conversation,
  force = false,
  limit = INBOX_THREAD_BATCH_SIZE,
  offset = 0,
} = {}) {
  const safeLimit = normalizeBoundedLimit(
    limit,
    INBOX_THREAD_BATCH_SIZE,
    INBOX_THREAD_MAX_LIMIT
  );
  const safeOffset = normalizeOffset(offset);
  const phone = getConversationPhone(conversation || {});
  const dealId = safeValue(conversation?.linkedDealId);

  if (!phone && !dealId) {
    return {
      success: true,
      data: {
        messages: [],
        hasEarlier: false,
        nextOffset: safeOffset,
        sourceWarnings: ["No participant or linked deal identifier is available."],
      },
    };
  }

  const result = await loadThreadMessages(phone, {
    ascending: false,
    dealId,
    force,
    limit: safeLimit + 1,
    offset: safeOffset,
  });

  if (!result.success) {
    return {
      success: false,
      error: { message: "This conversation history could not be loaded." },
    };
  }

  const sourceRows = result.data || [];
  const pageRows = sourceRows.slice(0, safeLimit);
  const normalized = pageRows.map((message, index) =>
    normalizeInboxThreadMessage(message, {
      compatibilityKey: conversation?.compatibilityKey,
      dealId,
      index: safeOffset + index,
    })
  );
  const usable = normalized.filter(
    (message) => message.compatibilityKey && message.body
  );
  const omittedCount = normalized.length - usable.length;

  return {
    success: true,
    data: {
      messages: mergeInboxThreadMessages([], usable),
      hasEarlier: sourceRows.length > safeLimit,
      nextOffset: safeOffset + pageRows.length,
      sourceWarnings: omittedCount
        ? [`${omittedCount} malformed message record(s) were omitted.`]
        : [],
      metadata: {
        limit: safeLimit,
        offset: safeOffset,
        returned: usable.length,
      },
    },
  };
}

export function filterInboxConversations(
  conversations = [],
  { filter = "all", query = "" } = {}
) {
  const normalizedQuery = safeValue(query).toLowerCase();

  return (Array.isArray(conversations) ? conversations : []).filter((item) => {
    const searchable = [
      item.sellerName,
      item.propertyAddress,
      item.phone,
      item.lastMessagePreview,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const filterMatches =
      filter === "all" ||
      (filter === "needs-reply" && item.needsReply) ||
      (filter === "failed" && item.failedDelivery) ||
      (filter === "recent" && item.recent) ||
      (filter === "linked" && item.linked) ||
      (filter === "unlinked" && !item.linked);

    return filterMatches && (!normalizedQuery || searchable.includes(normalizedQuery));
  });
}

function unavailableSendFailure(result = {}) {
  const status = Number(result.metadata?.status);
  const message = safeValue(result.error?.message).toLowerCase();
  return (
    [404, 408, 503, 504].includes(status) ||
    /unavailable|failed to fetch|network|function.*not found/.test(message)
  );
}

export function normalizeInboxSendResult(result = {}, { linkedDealId = null } = {}) {
  if (result.success !== true) {
    const unavailable = unavailableSendFailure(result);
    return {
      success: false,
      state: unavailable
        ? COMPOSER_SEND_STATES.PROVIDER_UNAVAILABLE
        : COMPOSER_SEND_STATES.FAILED,
      message: unavailable
        ? "SMS delivery is unavailable. Your draft is preserved."
        : "The message was not sent. Your draft is preserved so you can try again.",
      mode: "unknown",
      deliveryStatus: null,
      clearDraft: false,
    };
  }

  const data = result.data || {};
  const mode = normalizeStatus(data.mode);
  const deliveryStatus = normalizeStatus(data.status) || null;

  if (mode === "test") {
    return {
      success: true,
      state: linkedDealId
        ? COMPOSER_SEND_STATES.TEST_SAVED
        : COMPOSER_SEND_STATES.TEST_UNPERSISTED,
      message: linkedDealId
        ? "Message saved in test mode. No live SMS was sent."
        : "Test-mode send accepted. No live SMS was sent, and no linked deal was available for persisted history.",
      mode: "test",
      deliveryStatus,
      clearDraft: Boolean(linkedDealId),
    };
  }

  if (mode === "live") {
    return {
      success: true,
      state: COMPOSER_SEND_STATES.LIVE_SENT,
      message:
        deliveryStatus === "delivered"
          ? "The SMS provider reported this message delivered."
          : "SMS accepted for sending. Delivery has not been confirmed.",
      mode: "live",
      deliveryStatus,
      clearDraft: true,
    };
  }

  return {
    success: true,
    state: COMPOSER_SEND_STATES.ACCEPTED,
    message:
      "The send request was accepted, but the provider mode was not reported. Delivery is not confirmed.",
    mode: "unknown",
    deliveryStatus,
    clearDraft: true,
  };
}

export function buildSmsTemplates({ propertyAddress = "" } = {}) {
  const property = safeTrim(propertyAddress) || "your property";
  return {
    initial: `Hi, I'm reaching out about ${property}. Would you consider an offer?`,
    followup: `Just following up on ${property}. Would you be open to discussing an offer?`,
    offer: `I can make a cash offer on ${property}. Would you like to hear the numbers?`,
    checkin: `Hey just checking in on ${property}. Let me know if you're still interested in selling.`,
  };
}

export function messageBelongsToConversation(message, conversation) {
  return conversationsMatch(message, conversation);
}
