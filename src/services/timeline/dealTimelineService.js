import { getDealRoute } from "../../navigation/workspaces";
import { formatUsd } from "../../utils/currency";
import { formatSafeDate, toSafeDate } from "../../utils/dates";
import { getDealAliasText } from "../../utils/dealFields";
import { normalizePhone } from "../../utils/phone";
import { compactText } from "../../utils/text";
import {
  loadThreadMessages,
  normalizeInboxThreadMessage,
} from "../conversations";
import {
  listCompsByDeal,
  listDocumentsByDeal,
  listSellerTasksByPhone,
  listSequencesByDeal,
} from "../repositories";

export const TIMELINE_SOURCE_LIMIT = 100;
export const TIMELINE_RESULT_LIMIT = 250;
export const TIMELINE_VISIBLE_BATCH_SIZE = 40;

export const TIMELINE_SORT_DIRECTIONS = {
  NEWEST: "newest",
  OLDEST: "oldest",
};

export const TIMELINE_CATEGORIES = {
  COMMUNICATION: "communication",
  ACTIVITY: "activity-notes",
  TASKS: "tasks",
  OFFERS: "offers-negotiation",
  DOCUMENTS: "documents",
  UNDERWRITING: "underwriting-comps",
  WORKFLOWS: "workflow-automation",
  PIPELINE: "pipeline-status",
  TRANSACTIONS: "transaction-closing",
  APPROVALS: "approvals",
  SYSTEM: "system",
};

export const TIMELINE_RELIABILITY_LABELS = {
  VERIFIED: "Verified Record",
  PERSISTED: "Persisted Record",
  PROVIDER: "Provider Record",
  USER_ENTERED: "User-Entered Record",
  DERIVED: "Derived Display",
  COMPATIBILITY: "Compatibility Record",
  UNVERIFIED: "Unverified",
};

const CATEGORY_DEFINITIONS = [
  { id: TIMELINE_CATEGORIES.COMMUNICATION, label: "Communication", icon: "inbox" },
  { id: TIMELINE_CATEGORIES.ACTIVITY, label: "Activity & Notes", icon: "user" },
  { id: TIMELINE_CATEGORIES.TASKS, label: "Tasks", icon: "check" },
  { id: TIMELINE_CATEGORIES.OFFERS, label: "Offers", icon: "deals" },
  { id: TIMELINE_CATEGORIES.DOCUMENTS, label: "Documents", icon: "deals" },
  { id: TIMELINE_CATEGORIES.UNDERWRITING, label: "Underwriting & Comps", icon: "reports" },
  { id: TIMELINE_CATEGORIES.WORKFLOWS, label: "Workflows", icon: "pipeline" },
  { id: TIMELINE_CATEGORIES.PIPELINE, label: "Pipeline & Status", icon: "pipeline" },
  { id: TIMELINE_CATEGORIES.TRANSACTIONS, label: "Transactions", icon: "reports" },
  { id: TIMELINE_CATEGORIES.APPROVALS, label: "Approvals", icon: "check" },
  { id: TIMELINE_CATEGORIES.SYSTEM, label: "System", icon: "settings" },
];

const CATEGORY_IDS = new Set(CATEGORY_DEFINITIONS.map((category) => category.id));
const RELIABILITY_LABELS = new Set(Object.values(TIMELINE_RELIABILITY_LABELS));

const SOURCE_DEFINITIONS = [
  {
    id: "messages",
    label: "Messages",
    failureMessage: "Message history could not be loaded.",
    isEnabled: (context) => Boolean(context.dealId || context.phone),
    adapter: adaptMessageRecords,
  },
  {
    id: "tasks",
    label: "Tasks",
    failureMessage: "Task history could not be loaded.",
    isEnabled: (context) => Boolean(context.phone),
    adapter: adaptTaskRecords,
  },
  {
    id: "documents",
    label: "Documents",
    failureMessage: "Document history could not be loaded.",
    isEnabled: (context) => Boolean(context.dealId),
    adapter: adaptDocumentRecords,
  },
  {
    id: "comps",
    label: "Comps",
    failureMessage: "Comp history could not be loaded.",
    isEnabled: (context) => Boolean(context.dealId),
    adapter: adaptCompRecords,
  },
  {
    id: "sequences",
    label: "Follow-up sequences",
    failureMessage: "Follow-up sequence history could not be loaded.",
    isEnabled: (context) => Boolean(context.dealId),
    adapter: adaptSequenceRecords,
  },
];

function safeValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function conciseText(value, maximum = 240) {
  const text = compactText(safeValue(value));
  if (text.length <= maximum) return text;
  return `${text.slice(0, maximum - 3).trimEnd()}...`;
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

function normalizeIsoTimestamp(value) {
  return toSafeDate(value)?.toISOString() || null;
}

function normalizeLimit(value, fallback, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(1, Math.floor(parsed)));
}

function firstTimestamp(record, keys) {
  for (const key of keys) {
    const timestamp = normalizeIsoTimestamp(record?.[key]);
    if (timestamp) return timestamp;
  }
  return null;
}

function normalizeEvidence(evidence = []) {
  return (Array.isArray(evidence) ? evidence : [])
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === "string") {
        return { label: "Supporting fact", value: conciseText(entry), source: null };
      }

      const value = conciseText(entry.value ?? entry.detail ?? entry.summary);
      if (!value) return null;
      return {
        label: safeValue(entry.label || entry.type) || "Supporting fact",
        value,
        source: safeValue(entry.source) || null,
      };
    })
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeReference(reference = {}, type) {
  const id = safeValue(reference.id);
  const name = safeValue(reference.name);
  const address = safeValue(reference.address);
  const phone = safeValue(reference.phone);
  if (!id && !name && !address && !phone) return null;

  return {
    id: id || null,
    name: name || null,
    address: address || null,
    phone: phone || null,
    normalizedPhone: phone ? normalizePhone(phone) : "",
    type,
  };
}

function normalizeActions(actions = []) {
  return (Array.isArray(actions) ? actions : [])
    .map((action) => {
      if (!action || action.id !== "open-context") return null;
      const targetSection = safeValue(action.targetSection);
      const targetWorkspace = safeValue(action.targetWorkspace);
      const targetRoute = safeValue(action.targetRoute);
      if (!targetSection && !targetWorkspace && !targetRoute) return null;

      return {
        id: "open-context",
        label: safeValue(action.label) || "Open Context",
        targetSection: targetSection || null,
        targetWorkspace: targetWorkspace || null,
        targetRoute: targetRoute || null,
      };
    })
    .filter(Boolean)
    .slice(0, 1);
}

function combineWarnings(...warnings) {
  return warnings.map(safeValue).filter(Boolean).join(" ") || null;
}

/**
 * Stable compatibility contract consumed by the Deal Timeline UI. Source adapters may
 * evolve independently as canonical domain events become available.
 */
export function normalizeTimelineEvent(event = {}) {
  const category = safeValue(event.category);
  const title = conciseText(event.title, 160);
  const sourceSystem = safeValue(event.sourceSystem);
  if (!CATEGORY_IDS.has(category) || !title || !sourceSystem) return null;

  const timestamp = normalizeIsoTimestamp(event.timestamp);
  const sourceRecordId = safeValue(event.sourceRecordId) || null;
  const fallbackIdentity = stableHash(
    [category, event.type, sourceSystem, sourceRecordId, timestamp, title].join(":")
  );
  const id = safeValue(event.id) || `timeline:${category}:${fallbackIdentity}`;
  const reliability = RELIABILITY_LABELS.has(event.reliability)
    ? event.reliability
    : TIMELINE_RELIABILITY_LABELS.UNVERIFIED;
  const partialDataWarning = combineWarnings(
    event.partialDataWarning,
    timestamp ? "" : "This record has no trustworthy timestamp and is shown as undated."
  );

  return {
    id,
    tenantId: safeValue(event.tenantId) || null,
    organizationId: safeValue(event.organizationId) || null,
    dealId: safeValue(event.dealId) || null,
    sellerReference: normalizeReference(event.sellerReference, "seller"),
    propertyReference: normalizeReference(event.propertyReference, "property"),
    category,
    categoryLabel:
      CATEGORY_DEFINITIONS.find((definition) => definition.id === category)?.label || category,
    categoryIcon:
      CATEGORY_DEFINITIONS.find((definition) => definition.id === category)?.icon || "deals",
    type: safeValue(event.type) || "record",
    timestamp,
    actorType: safeValue(event.actorType) || null,
    actorLabel: safeValue(event.actorLabel) || null,
    title,
    summary: conciseText(event.summary),
    status: safeValue(event.status) || null,
    direction: safeValue(event.direction) || null,
    sourceSystem,
    sourceRecordId,
    evidence: normalizeEvidence(event.evidence),
    reliability,
    relatedEntityType: safeValue(event.relatedEntityType) || null,
    relatedEntityId: safeValue(event.relatedEntityId) || null,
    targetSection: safeValue(event.targetSection) || null,
    targetWorkspace: safeValue(event.targetWorkspace) || null,
    targetRoute: safeValue(event.targetRoute) || null,
    availableActions: normalizeActions(event.availableActions),
    partialDataWarning,
    deduplicationKey:
      safeValue(event.deduplicationKey) || `${category}:${sourceSystem}:${sourceRecordId || fallbackIdentity}`,
    deterministicSortKey: timestamp ? `${timestamp}:${id}` : `undated:${id}`,
  };
}

export function buildDealTimelineContext(deal = {}) {
  const dealId = getDealAliasText(deal, "id");
  const phone = getDealAliasText(deal, "phone");

  return {
    dealId,
    tenantId: safeValue(deal.tenant_id || deal.tenantId),
    organizationId: safeValue(deal.organization_id || deal.organizationId),
    phone,
    sellerReference: {
      id: safeValue(deal.seller_id || deal.sellerId),
      name: getDealAliasText(deal, "ownerName"),
      phone,
    },
    propertyReference: {
      id: safeValue(deal.property_id || deal.propertyId),
      address: getDealAliasText(deal, "address"),
    },
    dealRoute: dealId ? getDealRoute(dealId) : null,
  };
}

function recordMatchesContext(record, context) {
  const recordDealId = safeValue(
    record.deal_id || record.dealId || record.relatedDealId || record.relatedDeal?.id
  );
  const recordTenantId = safeValue(record.tenant_id || record.tenantId);
  const recordOrganizationId = safeValue(record.organization_id || record.organizationId);

  if (recordDealId && context.dealId && recordDealId !== context.dealId) return false;
  if (recordTenantId && context.tenantId && recordTenantId !== context.tenantId) return false;
  if (
    recordOrganizationId &&
    context.organizationId &&
    recordOrganizationId !== context.organizationId
  ) {
    return false;
  }
  return true;
}

function referenceContext(context, record = {}) {
  return {
    tenantId: safeValue(record.tenant_id || record.tenantId || context.tenantId),
    organizationId: safeValue(
      record.organization_id || record.organizationId || context.organizationId
    ),
    dealId: safeValue(record.deal_id || record.dealId || context.dealId),
    sellerReference: {
      id: safeValue(record.seller_id || record.sellerId || context.sellerReference?.id),
      name: safeValue(
        record.seller_name || record.sellerName || context.sellerReference?.name
      ),
      phone: safeValue(record.phone || context.sellerReference?.phone),
    },
    propertyReference: {
      id: safeValue(record.property_id || record.propertyId || context.propertyReference?.id),
      address: safeValue(
        record.property_address || record.propertyAddress || context.propertyReference?.address
      ),
    },
  };
}

function openContextAction({ targetRoute, targetSection, targetWorkspace }) {
  if (!targetRoute && !targetSection && !targetWorkspace) return [];
  return [
    {
      id: "open-context",
      label: "Open Context",
      targetRoute,
      targetSection,
      targetWorkspace,
    },
  ];
}

function adaptRecords({ records, context, sourceId, sourceLabel, normalizeRecord }) {
  const input = Array.isArray(records) ? records : [];
  const sourceLimit = TIMELINE_SOURCE_LIMIT;
  const bounded = input.slice(0, sourceLimit);
  const events = [];
  let malformedCount = Array.isArray(records) ? 0 : records == null ? 0 : 1;
  let contextMismatchCount = 0;

  bounded.forEach((record) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      malformedCount += 1;
      return;
    }
    if (!recordMatchesContext(record, context)) {
      contextMismatchCount += 1;
      return;
    }

    try {
      const normalized = normalizeRecord(record);
      const candidates = Array.isArray(normalized) ? normalized : [normalized];
      const validEvents = candidates.map(normalizeTimelineEvent).filter(Boolean);
      if (validEvents.length === 0) {
        malformedCount += 1;
        return;
      }
      events.push(...validEvents);
    } catch {
      malformedCount += 1;
    }
  });

  const undatedCount = events.filter((event) => !event.timestamp).length;
  const warnings = [
    input.length > sourceLimit
      ? `${sourceLabel} were bounded to ${sourceLimit} source records.`
      : null,
    malformedCount
      ? `${malformedCount} malformed ${sourceLabel.toLowerCase()} record(s) were omitted.`
      : null,
    contextMismatchCount
      ? `${contextMismatchCount} ${sourceLabel.toLowerCase()} record(s) outside this deal context were omitted.`
      : null,
    undatedCount
      ? `${undatedCount} ${sourceLabel.toLowerCase()} record(s) have no trustworthy timestamp.`
      : null,
  ].filter(Boolean);

  return {
    sourceId,
    label: sourceLabel,
    status: warnings.length ? "partial" : "complete",
    events,
    warnings,
    sourceRecordCount: input.length,
    loadedRecordCount: bounded.length,
    truncated: input.length > sourceLimit,
  };
}

export function adaptMessageRecords(records = [], context = {}) {
  return adaptRecords({
    records,
    context,
    sourceId: "messages",
    sourceLabel: "Messages",
    normalizeRecord(record) {
      const message = normalizeInboxThreadMessage(record, {
        dealId: context.dealId,
      });
      if (!message.id || !message.body) return null;

      const linkedContext = referenceContext(context, record);
      const directionLabel = message.direction === "outbound" ? "Outbound" : "Inbound";
      const reliability = message.providerIdentifier
        ? TIMELINE_RELIABILITY_LABELS.PROVIDER
        : message.directionSource === "direction-column"
          ? TIMELINE_RELIABILITY_LABELS.PERSISTED
          : TIMELINE_RELIABILITY_LABELS.COMPATIBILITY;
      const directionWarning =
        message.directionSource && message.directionSource !== "direction-column"
          ? `Direction was normalized from ${message.directionSource}.`
          : "";

      return {
        id: message.id,
        ...linkedContext,
        category: TIMELINE_CATEGORIES.COMMUNICATION,
        type: "sms-message",
        timestamp: message.timestamp,
        actorType: message.direction === "outbound" ? "user-or-system" : "seller",
        actorLabel: message.actorLabel,
        title: `${directionLabel} SMS message`,
        summary: message.body,
        status: message.deliveryStatus,
        direction: message.direction,
        sourceSystem: "SMS message record",
        sourceRecordId: message.sourceId || message.providerIdentifier,
        evidence: [
          { label: "Record source", value: message.source },
          { label: "Direction source", value: message.directionSource },
          message.providerMode
            ? { label: "Provider mode", value: message.providerMode }
            : null,
          message.deliveryStatus
            ? { label: "Delivery status", value: message.deliveryStatus }
            : null,
        ],
        reliability,
        relatedEntityType: "conversation",
        relatedEntityId: message.compatibilityKey,
        targetWorkspace: message.phone ? "inbox" : null,
        targetRoute: message.phone ? "/inbox" : null,
        availableActions: openContextAction({
          targetWorkspace: message.phone ? "inbox" : null,
          targetRoute: message.phone ? "/inbox" : null,
        }),
        partialDataWarning: directionWarning,
        deduplicationKey: message.id,
      };
    },
  });
}

export function adaptActivityRecords(records = [], context = {}) {
  return adaptRecords({
    records,
    context,
    sourceId: "activities",
    sourceLabel: "Activities",
    normalizeRecord(record) {
      const body = conciseText(record.summary || record.note || record.notes || record.body);
      const timestamp = firstTimestamp(record, ["occurred_at", "created_at", "createdAt", "timestamp"]);
      const sourceId = safeValue(record.id || record.activity_id);
      if (!body && !safeValue(record.title)) return null;
      const linkedContext = referenceContext(context, record);
      const actorLabel = safeValue(
        record.actor_label || record.actorLabel || record.author_name || record.author
      );

      return {
        id: sourceId ? `activity:${sourceId}` : null,
        ...linkedContext,
        category: TIMELINE_CATEGORIES.ACTIVITY,
        type: safeValue(record.event_type || record.type) || "activity-record",
        timestamp,
        actorType: actorLabel ? "user" : null,
        actorLabel,
        title: safeValue(record.title) || (timestamp ? "Activity recorded" : "Activity record"),
        summary: body,
        status: safeValue(record.status),
        direction: safeValue(record.direction),
        sourceSystem: safeValue(record.source_system || record.source) || "Seller activity record",
        sourceRecordId: sourceId,
        evidence: record.evidence,
        reliability: actorLabel
          ? TIMELINE_RELIABILITY_LABELS.USER_ENTERED
          : sourceId
            ? TIMELINE_RELIABILITY_LABELS.PERSISTED
            : TIMELINE_RELIABILITY_LABELS.COMPATIBILITY,
        relatedEntityType: "activity",
        relatedEntityId: sourceId,
        targetSection: "activity",
        availableActions: openContextAction({ targetSection: "activity" }),
        partialDataWarning: sourceId ? "" : "The activity source identifier is unavailable.",
        deduplicationKey: sourceId ? `activity:${sourceId}` : null,
      };
    },
  });
}

export function adaptTaskRecords(records = [], context = {}) {
  return adaptRecords({
    records,
    context,
    sourceId: "tasks",
    sourceLabel: "Tasks",
    normalizeRecord(record) {
      const taskTitle = conciseText(record.title, 140);
      if (!taskTitle) return null;
      const timestamp = firstTimestamp(record, ["created_at", "createdAt"]);
      const sourceId = safeValue(record.id || record.task_id);
      const linkedContext = referenceContext(context, record);
      const dueAt = normalizeIsoTimestamp(record.due_at || record.dueAt);

      return {
        id: sourceId ? `task:${sourceId}` : null,
        ...linkedContext,
        category: TIMELINE_CATEGORIES.TASKS,
        type: timestamp ? "task-created" : "task-record",
        timestamp,
        actorType: safeValue(record.created_by || record.createdBy) ? "user" : null,
        actorLabel: safeValue(record.created_by_name || record.createdByName),
        title: `${timestamp ? "Task created" : "Task record"}: ${taskTitle}`,
        summary: dueAt ? `Current due date: ${formatSafeDate(dueAt, "Unavailable")}.` : "Seller task record.",
        sourceSystem: "Task record",
        sourceRecordId: sourceId,
        evidence: [
          dueAt ? { label: "Current due date", value: formatSafeDate(dueAt, "Unavailable") } : null,
          record.status ? { label: "Current task status", value: record.status } : null,
        ],
        reliability: sourceId
          ? TIMELINE_RELIABILITY_LABELS.PERSISTED
          : TIMELINE_RELIABILITY_LABELS.COMPATIBILITY,
        relatedEntityType: "task",
        relatedEntityId: sourceId,
        targetSection: "seller",
        availableActions: openContextAction({ targetSection: "seller" }),
        partialDataWarning: sourceId ? "" : "The task source identifier is unavailable.",
        deduplicationKey: sourceId ? `task:${sourceId}` : null,
      };
    },
  });
}

export function adaptDocumentRecords(records = [], context = {}) {
  return adaptRecords({
    records,
    context,
    sourceId: "documents",
    sourceLabel: "Documents",
    normalizeRecord(record) {
      const documentTitle = conciseText(record.title || record.name, 140);
      if (!documentTitle) return null;
      const timestamp = firstTimestamp(record, ["created_at", "createdAt", "added_at", "uploaded_at"]);
      const sourceId = safeValue(record.id || record.document_id);
      const linkedContext = referenceContext(context, record);

      return {
        id: sourceId ? `document:${sourceId}` : null,
        ...linkedContext,
        category: TIMELINE_CATEGORIES.DOCUMENTS,
        type: timestamp ? "document-added" : "document-record",
        timestamp,
        actorType: safeValue(record.created_by || record.createdBy) ? "user" : null,
        actorLabel: safeValue(record.created_by_name || record.createdByName),
        title: `${timestamp ? "Document added" : "Document record"}: ${documentTitle}`,
        summary: conciseText(record.notes || record.doc_type || record.type),
        status: safeValue(record.status),
        sourceSystem: "Document record",
        sourceRecordId: sourceId,
        evidence: [
          record.doc_type ? { label: "Document type", value: record.doc_type } : null,
          record.notes ? { label: "Record notes", value: record.notes } : null,
        ],
        reliability: sourceId
          ? TIMELINE_RELIABILITY_LABELS.PERSISTED
          : TIMELINE_RELIABILITY_LABELS.COMPATIBILITY,
        relatedEntityType: "document",
        relatedEntityId: sourceId,
        targetSection: "documents",
        availableActions: openContextAction({ targetSection: "documents" }),
        partialDataWarning: sourceId ? "" : "The document source identifier is unavailable.",
        deduplicationKey: sourceId ? `document:${sourceId}` : null,
      };
    },
  });
}

export function adaptCompRecords(records = [], context = {}) {
  return adaptRecords({
    records,
    context,
    sourceId: "comps",
    sourceLabel: "Comps",
    normalizeRecord(record) {
      const address = conciseText(record.address || record.property_address, 140);
      if (!address) return null;
      const timestamp = firstTimestamp(record, ["created_at", "createdAt", "saved_at"]);
      const sourceId = safeValue(record.id || record.comp_id);
      const linkedContext = referenceContext(context, record);
      const salePrice = formatUsd(record.sale_price, "");

      return {
        id: sourceId ? `comp:${sourceId}` : null,
        ...linkedContext,
        category: TIMELINE_CATEGORIES.UNDERWRITING,
        type: timestamp ? "comp-added" : "comp-record",
        timestamp,
        actorType: safeValue(record.created_by || record.createdBy) ? "user" : null,
        actorLabel: safeValue(record.created_by_name || record.createdByName),
        title: timestamp ? "Comparable sale added" : "Comparable sale record",
        summary: [address, salePrice].filter(Boolean).join(" - "),
        sourceSystem: "Comparable sale record",
        sourceRecordId: sourceId,
        evidence: [
          { label: "Comp address", value: address },
          salePrice ? { label: "Recorded sale price", value: salePrice } : null,
          record.sqft ? { label: "Recorded square feet", value: record.sqft } : null,
        ],
        reliability: sourceId
          ? TIMELINE_RELIABILITY_LABELS.PERSISTED
          : TIMELINE_RELIABILITY_LABELS.COMPATIBILITY,
        relatedEntityType: "comp",
        relatedEntityId: sourceId,
        targetSection: "property",
        availableActions: openContextAction({ targetSection: "property" }),
        partialDataWarning: sourceId ? "" : "The comp source identifier is unavailable.",
        deduplicationKey: sourceId ? `comp:${sourceId}` : null,
      };
    },
  });
}

export function adaptSequenceRecords(records = [], context = {}) {
  return adaptRecords({
    records,
    context,
    sourceId: "sequences",
    sourceLabel: "Sequence steps",
    normalizeRecord(record) {
      const actionType = conciseText(record.action_type || record.action, 100);
      if (!actionType) return null;
      const timestamp = firstTimestamp(record, ["created_at", "createdAt", "started_at"]);
      const sourceId = safeValue(record.id || record.sequence_step_id);
      const linkedContext = referenceContext(context, record);
      const rawStepDay = record.step_day;
      const stepDay =
        rawStepDay === null || rawStepDay === undefined || rawStepDay === ""
          ? null
          : Number.isFinite(Number(rawStepDay))
            ? Number(rawStepDay)
            : null;

      return {
        id: sourceId ? `sequence:${sourceId}` : null,
        ...linkedContext,
        category: TIMELINE_CATEGORIES.WORKFLOWS,
        type: timestamp ? "sequence-step-added" : "sequence-step-record",
        timestamp,
        actorType: safeValue(record.created_by || record.createdBy) ? "user" : null,
        actorLabel: safeValue(record.created_by_name || record.createdByName),
        title: timestamp ? "Follow-up sequence step added" : "Follow-up sequence record",
        summary: `${actionType}${stepDay === null ? "" : `, day ${stepDay}`}.`,
        sourceSystem: "Follow-up sequence record",
        sourceRecordId: sourceId,
        evidence: [
          { label: "Action type", value: actionType },
          stepDay === null ? null : { label: "Sequence day", value: stepDay },
          record.due_date ? { label: "Current due date", value: record.due_date } : null,
        ],
        reliability: sourceId
          ? TIMELINE_RELIABILITY_LABELS.PERSISTED
          : TIMELINE_RELIABILITY_LABELS.COMPATIBILITY,
        relatedEntityType: "sequence-step",
        relatedEntityId: sourceId,
        targetSection: "communication",
        availableActions: openContextAction({ targetSection: "communication" }),
        partialDataWarning: sourceId ? "" : "The sequence source identifier is unavailable.",
        deduplicationKey: sourceId ? `sequence:${sourceId}` : null,
      };
    },
  });
}

export function adaptOfferRecords(records = [], context = {}) {
  return adaptRecords({
    records,
    context,
    sourceId: "offers",
    sourceLabel: "Offers",
    normalizeRecord(record) {
      const sourceId = safeValue(record.id || record.offer_id || record.negotiation_event_id);
      const timestamp = firstTimestamp(record, ["occurred_at", "submitted_at", "created_at", "createdAt"]);
      const label = conciseText(record.title || record.event_type || record.offer_type || record.status, 100);
      if (!sourceId || (!timestamp && !label)) return null;
      const linkedContext = referenceContext(context, record);
      const amount = formatUsd(record.amount ?? record.offer_amount, "");

      return {
        id: `offer:${sourceId}`,
        ...linkedContext,
        category: TIMELINE_CATEGORIES.OFFERS,
        type: safeValue(record.event_type || record.type) || "offer-record",
        timestamp,
        actorType: safeValue(record.actor_type),
        actorLabel: safeValue(record.actor_label || record.created_by_name),
        title: `Offer record${label ? `: ${label}` : ""}`,
        summary: conciseText(record.summary || record.notes || amount),
        status: safeValue(record.status),
        sourceSystem: safeValue(record.source_system) || "Offer record",
        sourceRecordId: sourceId,
        evidence: [
          amount ? { label: "Recorded amount", value: amount } : null,
          ...(Array.isArray(record.evidence) ? record.evidence : []),
        ],
        reliability: TIMELINE_RELIABILITY_LABELS.PERSISTED,
        relatedEntityType: "offer",
        relatedEntityId: sourceId,
        targetSection: "numbers",
        availableActions: openContextAction({ targetSection: "numbers" }),
        deduplicationKey: `offer:${sourceId}`,
      };
    },
  });
}

export function adaptTransactionRecords(records = [], context = {}) {
  return adaptRecords({
    records,
    context,
    sourceId: "transactions",
    sourceLabel: "Transactions",
    normalizeRecord(record) {
      const sourceId = safeValue(record.id || record.milestone_id || record.transaction_event_id);
      const timestamp = firstTimestamp(record, ["occurred_at", "completed_at", "created_at", "createdAt"]);
      const label = conciseText(record.title || record.milestone || record.event_type || record.type, 100);
      if (!sourceId || (!timestamp && !label)) return null;
      const linkedContext = referenceContext(context, record);

      return {
        id: `transaction:${sourceId}`,
        ...linkedContext,
        category: TIMELINE_CATEGORIES.TRANSACTIONS,
        type: safeValue(record.event_type || record.type) || "transaction-record",
        timestamp,
        actorType: safeValue(record.actor_type),
        actorLabel: safeValue(record.actor_label || record.created_by_name),
        title: `Transaction record${label ? `: ${label}` : ""}`,
        summary: conciseText(record.summary || record.notes),
        status: safeValue(record.status),
        sourceSystem: safeValue(record.source_system) || "Transaction record",
        sourceRecordId: sourceId,
        evidence: record.evidence,
        reliability: TIMELINE_RELIABILITY_LABELS.PERSISTED,
        relatedEntityType: "transaction",
        relatedEntityId: safeValue(record.transaction_id) || sourceId,
        targetSection: "closing",
        availableActions: openContextAction({ targetSection: "closing" }),
        deduplicationKey: `transaction:${sourceId}`,
      };
    },
  });
}

export function adaptApprovalItems(
  records = [],
  context = {},
  { timestampsArePersisted = false } = {}
) {
  if (!timestampsArePersisted) {
    return {
      sourceId: "approvals",
      label: "Approvals",
      status: "unavailable",
      events: [],
      warnings: [],
      sourceRecordCount: Array.isArray(records) ? records.length : 0,
      loadedRecordCount: 0,
      truncated: false,
    };
  }

  return adaptRecords({
    records,
    context,
    sourceId: "approvals",
    sourceLabel: "Approvals",
    normalizeRecord(record) {
      const sourceId = safeValue(record.id || record.sourceId);
      const requestedTimestamp = normalizeIsoTimestamp(record.requestedTimestamp);
      if (!sourceId || !requestedTimestamp) return null;
      const linkedContext = referenceContext(context, record);
      const targetSection = safeValue(record.targetSection);
      const targetWorkspace = safeValue(record.targetWorkspace);
      const targetRoute = safeValue(record.targetRoute);
      const requestedEvent = {
        id: `approval-request:${sourceId}`,
        ...linkedContext,
        category: TIMELINE_CATEGORIES.APPROVALS,
        type: "approval-requested",
        timestamp: requestedTimestamp,
        actorType: safeValue(record.requestedBy?.type),
        actorLabel: safeValue(record.requestedBy?.name),
        title: `Approval requested: ${safeValue(record.title) || "Review required"}`,
        summary: conciseText(record.requestedAction || record.reason || record.summary),
        status: "requested",
        sourceSystem: safeValue(record.sourceSystem) || "Approval request",
        sourceRecordId: safeValue(record.sourceId) || sourceId,
        evidence: record.evidence,
        reliability: record.sourceRecordPersisted === true
          ? TIMELINE_RELIABILITY_LABELS.PERSISTED
          : TIMELINE_RELIABILITY_LABELS.COMPATIBILITY,
        relatedEntityType: "approval",
        relatedEntityId: sourceId,
        targetSection,
        targetWorkspace,
        targetRoute,
        availableActions: openContextAction({ targetSection, targetWorkspace, targetRoute }),
        deduplicationKey: `approval-request:${sourceId}`,
      };
      const decision = record.decisionMetadata;
      const decidedAt =
        decision?.sessionOnly === false ? normalizeIsoTimestamp(decision.decidedAt) : null;
      if (!decidedAt) return requestedEvent;

      return [
        requestedEvent,
        {
          ...requestedEvent,
          id: `approval-decision:${sourceId}:${safeValue(record.status)}`,
          type: "approval-decided",
          timestamp: decidedAt,
          actorType: "user",
          actorLabel: safeValue(decision.actor),
          title: `Approval ${safeValue(record.status) || "decided"}: ${safeValue(record.title) || "Review"}`,
          summary: conciseText(decision.reason || record.summary),
          status: safeValue(record.status),
          deduplicationKey: `approval-decision:${sourceId}:${safeValue(record.status)}`,
        },
      ];
    },
  });
}

export function adaptDealCreationRecord(deal = {}, context = buildDealTimelineContext(deal)) {
  const timestamp = firstTimestamp(deal, ["created_at", "createdAt", "imported_at"]);
  if (!timestamp || !context.dealId) {
    return {
      sourceId: "deal-record",
      label: "Deal record",
      status: "unavailable",
      events: [],
      warnings: [],
      sourceRecordCount: deal && typeof deal === "object" ? 1 : 0,
      loadedRecordCount: 0,
      truncated: false,
    };
  }

  const address = safeValue(context.propertyReference?.address);
  const seller = safeValue(context.sellerReference?.name);
  const event = normalizeTimelineEvent({
    id: `deal-created:${context.dealId}`,
    tenantId: context.tenantId,
    organizationId: context.organizationId,
    dealId: context.dealId,
    sellerReference: context.sellerReference,
    propertyReference: context.propertyReference,
    category: TIMELINE_CATEGORIES.SYSTEM,
    type: "deal-created",
    timestamp,
    actorType: safeValue(deal.created_by || deal.createdBy) ? "user" : null,
    actorLabel: safeValue(deal.created_by_name || deal.createdByName),
    title: "Deal record created",
    summary: [address, seller].filter(Boolean).join(" - "),
    sourceSystem: safeValue(deal.import_id || deal.imported_at)
      ? "Imported deal record"
      : "Deal record",
    sourceRecordId: context.dealId,
    evidence: deal.source
      ? [{ label: "Current lead source", value: deal.source, source: "Deal record" }]
      : [],
    reliability: TIMELINE_RELIABILITY_LABELS.COMPATIBILITY,
    relatedEntityType: "deal",
    relatedEntityId: context.dealId,
    targetSection: "decision",
    targetRoute: context.dealRoute,
    availableActions: openContextAction({ targetSection: "decision", targetRoute: context.dealRoute }),
    deduplicationKey: `deal-created:${context.dealId}`,
  });

  return {
    sourceId: "deal-record",
    label: "Deal record",
    status: "complete",
    events: event ? [event] : [],
    warnings: [],
    sourceRecordCount: 1,
    loadedRecordCount: 1,
    truncated: false,
  };
}

export function compareTimelineEvents(
  left,
  right,
  direction = TIMELINE_SORT_DIRECTIONS.NEWEST
) {
  const leftTime = toSafeDate(left?.timestamp)?.getTime();
  const rightTime = toSafeDate(right?.timestamp)?.getTime();
  const leftDated = Number.isFinite(leftTime);
  const rightDated = Number.isFinite(rightTime);

  if (leftDated !== rightDated) return leftDated ? -1 : 1;
  if (leftDated && leftTime !== rightTime) {
    return direction === TIMELINE_SORT_DIRECTIONS.OLDEST
      ? leftTime - rightTime
      : rightTime - leftTime;
  }
  return safeValue(left?.deterministicSortKey || left?.id).localeCompare(
    safeValue(right?.deterministicSortKey || right?.id)
  );
}

export function sortTimelineEvents(
  events = [],
  direction = TIMELINE_SORT_DIRECTIONS.NEWEST
) {
  const resolvedDirection =
    direction === TIMELINE_SORT_DIRECTIONS.OLDEST
      ? TIMELINE_SORT_DIRECTIONS.OLDEST
      : TIMELINE_SORT_DIRECTIONS.NEWEST;
  return [...(Array.isArray(events) ? events : [])].sort((left, right) =>
    compareTimelineEvents(left, right, resolvedDirection)
  );
}

function deduplicateTimelineEvents(events = []) {
  const seen = new Set();
  let duplicateCount = 0;
  const items = events.filter((event) => {
    const key = event.deduplicationKey || event.id;
    if (seen.has(key)) {
      duplicateCount += 1;
      return false;
    }
    seen.add(key);
    return true;
  });
  return { items, duplicateCount };
}

function uniqueWarnings(warnings) {
  return [...new Set(warnings.map(safeValue).filter(Boolean))].slice(0, 20);
}

function buildTimelineFilters(events) {
  return [
    { id: "all", label: "All Events", count: events.length, icon: "deals" },
    ...CATEGORY_DEFINITIONS.filter((definition) =>
      events.some((event) => event.category === definition.id)
    ).map((definition) => ({
      ...definition,
      count: events.filter((event) => event.category === definition.id).length,
    })),
  ];
}

export function buildTimelineReadModel({
  sourceResults = [],
  limit = TIMELINE_RESULT_LIMIT,
  now = Date.now(),
  sortDirection = TIMELINE_SORT_DIRECTIONS.NEWEST,
} = {}) {
  const resultLimit = normalizeLimit(limit, TIMELINE_RESULT_LIMIT, TIMELINE_RESULT_LIMIT);
  const sources = (Array.isArray(sourceResults) ? sourceResults : []).filter(Boolean);
  const normalizedEvents = sources
    .flatMap((source) => (Array.isArray(source.events) ? source.events : []))
    .map((event) => (event?.deterministicSortKey ? event : normalizeTimelineEvent(event)))
    .filter(Boolean);
  const { items: deduplicated, duplicateCount } = deduplicateTimelineEvents(normalizedEvents);
  const sorted = sortTimelineEvents(deduplicated, sortDirection);
  const items = sorted.slice(0, resultLimit);
  const activeSources = sources.filter((source) => source.status !== "unavailable");
  const successfulSources = activeSources.filter((source) => source.status !== "failed");
  const failedSources = activeSources.filter((source) => source.status === "failed");
  const partialSources = activeSources.filter((source) => source.status === "partial");
  const sourceStatus =
    activeSources.length > 0 && successfulSources.length === 0
      ? "failed"
      : failedSources.length || partialSources.length
        ? "partial"
        : "complete";
  const sourceWarnings = uniqueWarnings([
    ...sources.flatMap((source) => source.warnings || []),
    duplicateCount ? `${duplicateCount} duplicate timeline event(s) were consolidated.` : null,
  ]);
  const truncated = Boolean(
    sorted.length > resultLimit || sources.some((source) => source.truncated)
  );

  return {
    items,
    filters: buildTimelineFilters(items),
    generatedAt: new Date(now).toISOString(),
    sortDirection,
    totalAvailable: sorted.length,
    totalVisible: items.length,
    limit: resultLimit,
    truncated,
    notices: truncated
      ? [`Showing a bounded timeline of ${items.length} events from available history.`]
      : [],
    sourceStatus,
    sourceWarnings,
    sourceSummaries: sources.map((source) => ({
      id: source.sourceId,
      label: source.label,
      status: source.status,
      eventCount: source.events?.length || 0,
      warnings: source.warnings || [],
    })),
    freeFirst: {
      providerRequired: false,
      costCategory: "core-free-first",
      notice: "Timeline history uses existing persisted records and requires no paid provider.",
    },
  };
}

export function filterTimelineEvents(events = [], category = "all") {
  const source = Array.isArray(events) ? events : [];
  return category === "all"
    ? source
    : source.filter((event) => event.category === category);
}

function sameCalendarDate(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function timelineDateGroup(timestamp, now) {
  const eventDate = toSafeDate(timestamp);
  if (!eventDate) return "undated";
  const currentDate = toSafeDate(now) || new Date();
  if (sameCalendarDate(eventDate, currentDate)) return "today";

  const yesterday = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate() - 1
  );
  if (sameCalendarDate(eventDate, yesterday)) return "yesterday";

  const startOfWeek = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate() - currentDate.getDay()
  );
  const startOfToday = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate()
  );
  if (eventDate >= startOfWeek && eventDate < startOfToday) return "this-week";
  return "earlier";
}

export function groupTimelineEvents(
  events = [],
  { now = Date.now(), sortDirection = TIMELINE_SORT_DIRECTIONS.NEWEST } = {}
) {
  const definitions = {
    today: "Today",
    yesterday: "Yesterday",
    "this-week": "This Week",
    earlier: "Earlier",
    undated: "Undated",
  };
  const groups = new Map();
  (Array.isArray(events) ? events : []).forEach((event) => {
    const id = timelineDateGroup(event.timestamp, now);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(event);
  });
  const order =
    sortDirection === TIMELINE_SORT_DIRECTIONS.OLDEST
      ? ["earlier", "this-week", "yesterday", "today", "undated"]
      : ["today", "yesterday", "this-week", "earlier", "undated"];

  return order
    .filter((id) => groups.has(id))
    .map((id) => ({ id, label: definitions[id], events: groups.get(id) }));
}

const DEFAULT_LOADERS = {
  messages: ({ context, force }) =>
    loadThreadMessages(context.phone, {
      ascending: false,
      dealId: context.dealId,
      force,
      limit: TIMELINE_SOURCE_LIMIT,
      offset: 0,
    }),
  tasks: ({ context }) =>
    listSellerTasksByPhone(context.phone, { limit: TIMELINE_SOURCE_LIMIT }),
  documents: ({ context }) =>
    listDocumentsByDeal(context.dealId, { limit: TIMELINE_SOURCE_LIMIT }),
  comps: ({ context }) =>
    listCompsByDeal(context.dealId, { limit: TIMELINE_SOURCE_LIMIT }),
  sequences: ({ context }) =>
    listSequencesByDeal(context.dealId, { limit: TIMELINE_SOURCE_LIMIT }),
};

async function loadTimelineSource(definition, loader, context, force) {
  if (!definition.isEnabled(context) || typeof loader !== "function") {
    return {
      sourceId: definition.id,
      label: definition.label,
      status: "unavailable",
      events: [],
      warnings: [],
      truncated: false,
    };
  }

  try {
    const result = await loader({ context, force, limit: TIMELINE_SOURCE_LIMIT });
    if (result?.success !== true) {
      return {
        sourceId: definition.id,
        label: definition.label,
        status: "failed",
        events: [],
        warnings: [definition.failureMessage],
        truncated: false,
      };
    }
    return definition.adapter(result.data || [], context);
  } catch {
    return {
      sourceId: definition.id,
      label: definition.label,
      status: "failed",
      events: [],
      warnings: [definition.failureMessage],
      truncated: false,
    };
  }
}

export async function loadDealTimeline({
  deal,
  extraSourceResults = [],
  force = false,
  limit = TIMELINE_RESULT_LIMIT,
  loaders = {},
  now = Date.now(),
} = {}) {
  const context = buildDealTimelineContext(deal);
  if (!context.dealId) {
    return {
      success: false,
      error: { message: "A deal identifier is required to load timeline history." },
    };
  }

  const configuredLoaders = { ...DEFAULT_LOADERS, ...loaders };
  const loadedSources = await Promise.all(
    SOURCE_DEFINITIONS.map((definition) =>
      loadTimelineSource(
        definition,
        configuredLoaders[definition.id],
        context,
        force
      )
    )
  );
  const dealSource = adaptDealCreationRecord(deal, context);
  const readModel = buildTimelineReadModel({
    sourceResults: [
      ...loadedSources,
      dealSource,
      ...(Array.isArray(extraSourceResults) ? extraSourceResults : []),
    ],
    limit,
    now,
  });

  if (readModel.sourceStatus === "failed") {
    return {
      success: false,
      error: { message: "Timeline history could not be loaded." },
      data: readModel,
    };
  }

  return { success: true, data: readModel };
}
