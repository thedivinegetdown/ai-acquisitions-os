import { getDealRoute } from "../../navigation/workspaces";
import { daysSince, toSafeDate } from "../../utils/dates";
import {
  getDealAliasNumber,
  getDealAliasText,
} from "../../utils/dealFields";
import { getPriorityWeight } from "../notifications/notificationPriorityService";
import { buildTodayReadModel } from "../today";

export const PIPELINE_RESULT_LIMIT = 250;

const PIPELINE_SOURCE_LIMIT = 500;
const PIPELINE_SIGNAL_LIMIT = 2500;
const PIPELINE_SIGNAL_BATCH_SIZE = 250;
const STALE_AFTER_DAYS = 14;

export const PIPELINE_STAGE_DEFINITIONS = [
  { id: "new-lead", label: "New Lead", order: 0, terminal: false },
  { id: "contacted", label: "Contacted", order: 1, terminal: false },
  { id: "offer-sent", label: "Offer Sent", order: 2, terminal: false },
  { id: "under-contract", label: "Under Contract", order: 3, terminal: false },
  { id: "closed", label: "Closed", order: 4, terminal: true },
  { id: "dead-lead", label: "Dead Lead", order: 5, terminal: true },
  { id: "unstaged", label: "Unstaged", order: 6, terminal: false },
  { id: "other", label: "Other", order: 7, terminal: false },
];

export const PIPELINE_FOCUS_VIEWS = [
  { id: "needs-attention", label: "Needs Attention" },
  { id: "new-leads", label: "New Leads" },
  { id: "follow-up-due", label: "Follow-Up Due" },
  { id: "waiting", label: "Waiting" },
  { id: "at-risk", label: "At Risk" },
  { id: "all", label: "All Deals" },
];

export const DEFAULT_PIPELINE_FILTERS = Object.freeze({
  search: "",
  stage: "all",
  assignedUser: "all",
  source: "all",
  urgency: "all",
  risk: "all",
  missingNextAction: false,
  stale: false,
  unreadResponse: false,
  approvalRequired: false,
});

const ACTIVITY_FIELDS = [
  ["last_meaningful_activity_at", "Last meaningful activity"],
  ["last_activity_at", "Last activity"],
  ["last_contacted_at", "Seller contact"],
  ["last_message_at", "Message activity"],
  ["updated_at", "Record updated"],
  ["created_at", "Record created"],
];

const UNREAD_FIELDS = [
  "unread_conversation_count",
  "unread_message_count",
  "unread_count",
  "has_unread_response",
];

function safeText(value, fallback = "") {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  return String(value).trim() || fallback;
}

function normalizedKey(value) {
  return safeText(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function stageDefinitionById(id) {
  return PIPELINE_STAGE_DEFINITIONS.find((stage) => stage.id === id);
}

export function normalizePipelineStage(value) {
  const sourceLabel = safeText(value);
  if (!sourceLabel) {
    return { ...stageDefinitionById("unstaged"), sourceLabel: "", known: false };
  }

  const key = normalizedKey(sourceLabel);
  const known = PIPELINE_STAGE_DEFINITIONS.find(
    (stage) => !["unstaged", "other"].includes(stage.id) && normalizedKey(stage.label) === key
  );

  if (known) return { ...known, sourceLabel, known: true };
  return { ...stageDefinitionById("other"), sourceLabel, known: false };
}

function getTenantContext(deal = {}) {
  return {
    organizationId: safeText(deal.organization_id || deal.organizationId) || null,
    tenantId: safeText(deal.tenant_id || deal.tenantId) || null,
  };
}

function matchesTenantContext(deal, tenantId, organizationId) {
  const context = getTenantContext(deal);
  if (tenantId && context.tenantId && context.tenantId !== tenantId) return false;
  if (organizationId && context.organizationId && context.organizationId !== organizationId) {
    return false;
  }
  return true;
}

function getLastMeaningfulActivity(deal = {}) {
  const candidates = ACTIVITY_FIELDS.map(([field, label]) => {
    const date = toSafeDate(deal[field]);
    return date ? { timestamp: date.toISOString(), label, field } : null;
  }).filter(Boolean);

  return (
    candidates.sort(
      (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
    )[0] || { timestamp: "", label: "No activity timestamp", field: "" }
  );
}

function explicitUnreadIndicator(deal = {}) {
  for (const field of UNREAD_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(deal, field)) continue;
    const value = deal[field];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value > 0;
    const normalized = safeText(value).toLowerCase();
    if (["true", "yes", "unread"].includes(normalized)) return true;
    if (["false", "no", "read", "0", ""].includes(normalized)) return false;
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric > 0 : null;
  }

  return null;
}

function getAssignedUser(deal = {}) {
  return safeText(
    deal.acquisitions_rep ||
      deal.assigned_user ||
      deal.assignedUser ||
      deal.assigned_to ||
      deal.assignee_name
  );
}

function getAssetType(deal = {}) {
  return safeText(deal.asset_type || deal.assetType || deal.property_type || deal.propertyType);
}

function getMissingInformation(deal, stage, nextAction) {
  const missing = [];
  if (!getDealAliasText(deal, "address")) missing.push("Property address");
  if (!getDealAliasText(deal, "ownerName")) missing.push("Seller name");
  if (!stage.sourceLabel) missing.push("Pipeline stage");
  if (!getDealAliasText(deal, "source")) missing.push("Lead source");
  if (!getDealAliasText(deal, "phone") && !safeText(deal.email)) {
    missing.push("Seller contact information");
  }
  if (!stage.terminal && !nextAction) missing.push("Next action");
  return missing;
}

function getFinancialSummary(deal = {}) {
  const askingPrice = getDealAliasNumber(deal, "askingPrice");
  const arv = getDealAliasNumber(deal, "arv");
  const repairs = getDealAliasNumber(deal, "repairs");

  return {
    askingPrice: askingPrice !== null && askingPrice > 0 ? askingPrice : null,
    arv: arv !== null && arv > 0 ? arv : null,
    repairs: repairs !== null && repairs >= 0 ? repairs : null,
  };
}

function dateKey(value) {
  const date = toSafeDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
}

function dedupeSignals(signals = []) {
  const seen = new Set();
  return signals.filter((signal) => {
    const key = `${safeText(signal.id)}:${safeText(signal.label || signal.title || signal.reason)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getRiskFlags({ todayItems, stale, staleDays, missingNextAction }) {
  const flags = todayItems
    .filter((item) => item.category === "at-risk")
    .map((item) => ({
      id: `today:${item.id}`,
      label: safeText(item.title, "Attention required"),
      reason: safeText(item.reason || item.summary),
      level: safeText(item.priority, "High"),
      source: safeText(item.source, "Today Workspace"),
    }));

  if (stale) {
    flags.push({
      id: "stale",
      label: `Stale for ${staleDays} days`,
      reason: `No loaded activity timestamp has changed within the ${STALE_AFTER_DAYS}-day compatibility window.`,
      level: "Medium",
      source: "Existing pipeline stale convention",
    });
  }

  if (missingNextAction) {
    flags.push({
      id: "missing-next-action",
      label: "Missing next action",
      reason: "The active deal does not have a next action in the loaded CRM record.",
      level: "Medium",
      source: "Loaded deal data",
    });
  }

  return dedupeSignals(flags);
}

function highestUrgency(todayItems, approvals, unreadConversation) {
  const priorities = [
    ...todayItems.map((item) => item.priority),
    ...approvals.map((item) => item.riskLevel),
    unreadConversation ? "High" : null,
  ].filter(Boolean);

  return priorities.reduce(
    (highest, priority) =>
      !highest || getPriorityWeight(priority) > getPriorityWeight(highest) ? priority : highest,
    null
  );
}

function highestRiskLevel(riskFlags) {
  if (!riskFlags.length) return "None";
  return riskFlags.reduce(
    (highest, flag) =>
      getPriorityWeight(flag.level) > getPriorityWeight(highest) ? flag.level : highest,
    "Low"
  );
}

function selectedSet(selectedIds) {
  return selectedIds instanceof Set
    ? selectedIds
    : new Set((Array.isArray(selectedIds) ? selectedIds : []).map(String));
}

/**
 * Normalizes one loaded deal for Pipeline display. It retains only real CRM facts and
 * deterministic signals; it does not create a Pursuit Score, recommendation, or mutation command.
 */
export function normalizePipelineItem(
  deal = {},
  {
    approvalItems = [],
    index = 0,
    now = Date.now(),
    selectedIds = [],
    todayItems = [],
  } = {}
) {
  const dealId = getDealAliasText(deal, "id");
  const stage = normalizePipelineStage(getDealAliasText(deal, "stage"));
  const nextAction = safeText(deal.next_action || deal.nextAction);
  const dueDate = safeText(deal.next_action_due_date || deal.due_date || deal.follow_up_date);
  const dueDateKey = dateKey(dueDate);
  const today = new Date(now).toISOString().slice(0, 10);
  const lastActivity = getLastMeaningfulActivity(deal);
  const staleDays = lastActivity.timestamp ? daysSince(lastActivity.timestamp, now) : null;
  const stale = !stage.terminal && staleDays !== null && staleDays >= STALE_AFTER_DAYS;
  const missingNextAction = !stage.terminal && !nextAction;
  const unreadConversation = explicitUnreadIndicator(deal);
  const pendingApprovals = approvalItems.filter((item) => item.status === "pending");
  const riskFlags = getRiskFlags({ todayItems, stale, staleDays, missingNextAction });
  const atRisk = riskFlags.length > 0;
  const approvalRequired = pendingApprovals.length > 0;
  const urgency = highestUrgency(todayItems, pendingApprovals, unreadConversation);
  const activeAttentionSignal = todayItems.some((item) =>
    ["act-now", "at-risk", "approvals"].includes(item.category)
  );
  const followUpDue = !stage.terminal && Boolean(dueDateKey) && dueDateKey <= today;
  const futureFollowUp = !stage.terminal && Boolean(dueDateKey) && dueDateKey > today;
  const needsAttention = Boolean(
    activeAttentionSignal || atRisk || approvalRequired || unreadConversation || missingNextAction
  );
  const isWaiting = futureFollowUp && !needsAttention;
  const missingInformation = getMissingInformation(deal, stage, nextAction);
  const context = getTenantContext(deal);
  const selected = selectedSet(selectedIds).has(String(dealId));

  return {
    id: dealId || `pipeline-record:${index}`,
    dealId: dealId || null,
    hasPersistentId: Boolean(dealId),
    ...context,
    seller: getDealAliasText(deal, "ownerName") || "Unknown seller",
    propertyAddress: getDealAliasText(deal, "address") || "Unknown property",
    assetType: getAssetType(deal) || null,
    currentStage: stage.sourceLabel || stage.label,
    stageGroupId: stage.id,
    stageGroupLabel: stage.label,
    stageOrder: stage.order,
    stageKnown: stage.known,
    terminal: stage.terminal,
    currentStatus:
      safeText(deal.status || deal.negotiation_status || deal.negotiationStatus) ||
      stage.sourceLabel ||
      "Unknown",
    assignedUser: getAssignedUser(deal) || null,
    source: getDealAliasText(deal, "source") || null,
    financialSummary: getFinancialSummary(deal),
    lastMeaningfulActivity: lastActivity,
    nextAction: nextAction || null,
    nextActionDueDate: dueDate || null,
    urgency,
    riskLevel: highestRiskLevel(riskFlags),
    riskFlags,
    missingInformation,
    missingInformationCount: missingInformation.length,
    unreadConversation,
    approvalRequired,
    approvalCount: pendingApprovals.length,
    approvalIds: pendingApprovals.map((item) => item.id),
    stale,
    staleDays,
    staleEvaluated: !stage.terminal && Boolean(lastActivity.timestamp),
    missingNextAction,
    followUpDue,
    isWaiting,
    atRisk,
    needsAttention,
    attentionReasons: dedupeSignals(
      todayItems.map((item) => ({
        id: item.id,
        label: item.title,
        reason: item.reason,
        source: item.source,
      }))
    ),
    targetRoute: dealId ? getDealRoute(dealId) : null,
    selected,
    dataConfidence:
      safeText(
        deal.data_confidence || deal.confidence_label || deal.data_reliability_grade
      ) || null,
  };
}

function indexTodayItems(items = []) {
  const byDealId = new Map();
  items.forEach((item) => {
    const dealId = safeText(item.target?.dealId);
    if (!dealId) return;
    const existing = byDealId.get(dealId) || [];
    if (!existing.some((candidate) => candidate.id === item.id)) existing.push(item);
    byDealId.set(dealId, existing);
  });
  return byDealId;
}

function indexApprovalItems(items = []) {
  const byDealId = new Map();
  items.forEach((item) => {
    const dealId = safeText(item.relatedDeal?.id);
    if (!dealId) return;
    const existing = byDealId.get(dealId) || [];
    if (!existing.some((candidate) => candidate.id === item.id)) existing.push(item);
    byDealId.set(dealId, existing);
  });
  return byDealId;
}

function buildPipelineSignals(deals, now, role) {
  const todayItems = [];
  const approvalItems = [];

  for (let index = 0; index < deals.length; index += PIPELINE_SIGNAL_BATCH_SIZE) {
    const readModel = buildTodayReadModel({
      deals: deals.slice(index, index + PIPELINE_SIGNAL_BATCH_SIZE),
      limit: PIPELINE_SIGNAL_LIMIT,
      now,
      role,
    });
    todayItems.push(...readModel.items);
    approvalItems.push(...readModel.approvals.items);
  }

  return { todayItems, approvalItems };
}

function attentionRank(item) {
  if (item.atRisk) return 8;
  if (item.followUpDue) return 7;
  if (item.unreadConversation) return 6;
  if (item.approvalRequired) return 5;
  if (item.missingNextAction) return 4;
  if (item.isWaiting) return 2;
  if (item.terminal) return 0;
  return 3;
}

export function comparePipelineItems(left, right) {
  const attentionDifference = attentionRank(right) - attentionRank(left);
  if (attentionDifference !== 0) return attentionDifference;

  const urgencyDifference = getPriorityWeight(right.urgency) - getPriorityWeight(left.urgency);
  if (urgencyDifference !== 0) return urgencyDifference;

  const leftDue = left.nextActionDueDate || "9999-12-31";
  const rightDue = right.nextActionDueDate || "9999-12-31";
  if (leftDue !== rightDue) return leftDue.localeCompare(rightDue);

  const activityDifference =
    new Date(right.lastMeaningfulActivity.timestamp || 0).getTime() -
    new Date(left.lastMeaningfulActivity.timestamp || 0).getTime();
  if (activityDifference !== 0) return activityDifference;

  if (left.stageOrder !== right.stageOrder) return left.stageOrder - right.stageOrder;
  return left.propertyAddress.localeCompare(right.propertyAddress);
}

function dedupePipelineItems(items) {
  const seenDealIds = new Set();
  let duplicateCount = 0;
  const deduped = items.filter((item) => {
    if (!item.dealId) return true;
    if (seenDealIds.has(item.dealId)) {
      duplicateCount += 1;
      return false;
    }
    seenDealIds.add(item.dealId);
    return true;
  });
  return { items: deduped, duplicateCount };
}

function optionRows(items, getValue) {
  return [...new Set(items.map(getValue).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ label: value, value }));
}

export function getPipelineStageColumns(items = []) {
  return PIPELINE_STAGE_DEFINITIONS.filter(
    (stage) =>
      !["unstaged", "other"].includes(stage.id) ||
      items.some((item) => item.stageGroupId === stage.id)
  ).map((stage) => ({
    ...stage,
    items: items.filter((item) => item.stageGroupId === stage.id),
    count: items.filter((item) => item.stageGroupId === stage.id).length,
  }));
}

function buildFilterOptions(items) {
  return {
    stages: getPipelineStageColumns(items)
      .filter((stage) => stage.count > 0)
      .map((stage) => ({ label: stage.label, value: stage.id })),
    assignedUsers: optionRows(items, (item) => item.assignedUser),
    sources: optionRows(items, (item) => item.source),
    urgencies: optionRows(items, (item) => item.urgency),
  };
}

function normalizeWarnings(errors = []) {
  return (Array.isArray(errors) ? errors : [errors])
    .filter(Boolean)
    .map((error) => safeText(error?.message || error))
    .filter(Boolean)
    .slice(0, 10);
}

export function buildPipelineReadModel({
  deals = [],
  errors = [],
  limit = PIPELINE_RESULT_LIMIT,
  now = Date.now(),
  organizationId = "",
  role = "Owner",
  selectedIds = [],
  tenantId = "",
} = {}) {
  const sourceDeals = Array.isArray(deals) ? deals : [];
  const malformedCount = sourceDeals.filter(
    (deal) => !deal || typeof deal !== "object" || Array.isArray(deal)
  ).length;
  const boundedDeals = sourceDeals
    .filter((deal) => deal && typeof deal === "object" && !Array.isArray(deal))
    .slice(0, PIPELINE_SOURCE_LIMIT)
    .filter((deal) => matchesTenantContext(deal, tenantId, organizationId));
  const resultLimit = Math.min(
    PIPELINE_RESULT_LIMIT,
    Math.max(1, Number.isFinite(Number(limit)) ? Number(limit) : PIPELINE_RESULT_LIMIT)
  );
  const sharedSignals = buildPipelineSignals(boundedDeals, now, role);
  const todayByDealId = indexTodayItems(sharedSignals.todayItems);
  const approvalsByDealId = indexApprovalItems(sharedSignals.approvalItems);
  const normalized = boundedDeals.map((deal, index) => {
    const dealId = getDealAliasText(deal, "id");
    return normalizePipelineItem(deal, {
      approvalItems: approvalsByDealId.get(dealId) || [],
      index,
      now,
      selectedIds,
      todayItems: todayByDealId.get(dealId) || [],
    });
  });
  const deduped = dedupePipelineItems(normalized);
  const sortedItems = deduped.items.sort(comparePipelineItems);
  const items = sortedItems.slice(0, resultLimit);
  const sourceWarnings = normalizeWarnings(errors);

  if (malformedCount) {
    sourceWarnings.push(`${malformedCount} malformed pipeline record(s) were omitted.`);
  }
  if (deduped.duplicateCount) {
    sourceWarnings.push(`${deduped.duplicateCount} duplicate deal record(s) were consolidated.`);
  }

  const truncated =
    sourceDeals.length > PIPELINE_SOURCE_LIMIT || sortedItems.length > resultLimit;
  const notices = truncated
    ? [`Showing a bounded set of ${items.length} opportunities from ${sourceDeals.length} loaded records.`]
    : [];
  const filterOptions = buildFilterOptions(items);

  return {
    items,
    stageColumns: getPipelineStageColumns(items),
    filterOptions,
    supportedFilters: {
      assignedUser: filterOptions.assignedUsers.length > 0,
      source: filterOptions.sources.length > 0,
      urgency: filterOptions.urgencies.length > 0,
      stale: items.some((item) => item.staleEvaluated),
      unreadResponse: items.some((item) => item.unreadConversation !== null),
      approvalRequired: items.some((item) => item.approvalRequired),
    },
    generatedAt: new Date(now).toISOString(),
    limit: resultLimit,
    totalLoaded: sourceDeals.length,
    totalVisible: items.length,
    truncated,
    notices,
    organizationId: organizationId || null,
    tenantId: tenantId || null,
    role,
    sourceStatus: sourceWarnings.length ? "partial" : "complete",
    sourceWarnings: sourceWarnings.slice(0, 10),
    sources: [
      "Loaded deal records",
      "Today deterministic read model",
      "Action Inbox and Notification Rules",
      "Universal Approval Inbox read model",
      "Existing 14-day stale convention",
    ],
    freeFirst: {
      providerRequired: false,
      costCategory: "core-free-first",
      notice: "Pipeline review and filtering require no external provider.",
    },
  };
}

export function normalizePipelineFilters(filters = {}) {
  return {
    ...DEFAULT_PIPELINE_FILTERS,
    search: safeText(filters.search),
    stage: safeText(filters.stage, "all"),
    assignedUser: safeText(filters.assignedUser, "all"),
    source: safeText(filters.source, "all"),
    urgency: safeText(filters.urgency, "all"),
    risk: ["all", "at-risk", "clear"].includes(filters.risk) ? filters.risk : "all",
    missingNextAction: filters.missingNextAction === true,
    stale: filters.stale === true,
    unreadResponse: filters.unreadResponse === true,
    approvalRequired: filters.approvalRequired === true,
  };
}

function matchesFocusView(item, focusView) {
  if (focusView === "needs-attention") return item.needsAttention;
  if (focusView === "new-leads") return item.stageGroupId === "new-lead";
  if (focusView === "follow-up-due") return item.followUpDue;
  if (focusView === "waiting") return item.isWaiting;
  if (focusView === "at-risk") return item.atRisk;
  return true;
}

export function filterPipelineItems(items = [], filters = {}, focusView = "all") {
  const normalized = normalizePipelineFilters(filters);
  const query = normalized.search.toLowerCase();

  return (Array.isArray(items) ? items : []).filter((item) => {
    const searchable = [
      item.propertyAddress,
      item.seller,
      item.assetType,
      item.currentStage,
      item.currentStatus,
      item.assignedUser,
      item.source,
      item.nextAction,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      matchesFocusView(item, focusView) &&
      (!query || searchable.includes(query)) &&
      (normalized.stage === "all" || item.stageGroupId === normalized.stage) &&
      (normalized.assignedUser === "all" || item.assignedUser === normalized.assignedUser) &&
      (normalized.source === "all" || item.source === normalized.source) &&
      (normalized.urgency === "all" || item.urgency === normalized.urgency) &&
      (normalized.risk === "all" ||
        (normalized.risk === "at-risk" ? item.atRisk : !item.atRisk)) &&
      (!normalized.missingNextAction || item.missingNextAction) &&
      (!normalized.stale || item.stale) &&
      (!normalized.unreadResponse || item.unreadConversation === true) &&
      (!normalized.approvalRequired || item.approvalRequired)
    );
  });
}

export function getPipelineActiveFilterCount(filters = {}) {
  const normalized = normalizePipelineFilters(filters);
  return Object.entries(normalized).filter(([key, value]) => {
    const defaultValue = DEFAULT_PIPELINE_FILTERS[key];
    return value !== defaultValue;
  }).length;
}
