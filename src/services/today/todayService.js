import { buildActionInbox } from "../notifications";
import { getPriorityWeight } from "../notifications/notificationPriorityService";
import { buildApprovalReadModel, isApprovalNotification } from "../approvals";
import { formatSafeDate } from "../../utils/dates";
import { getDealAliasText } from "../../utils/dealFields";

export const TODAY_CATEGORIES = ["act-now", "approvals", "waiting", "at-risk", "completed"];

export const TODAY_CATEGORY_LABELS = {
  "act-now": "Act Now",
  approvals: "Approvals",
  waiting: "Waiting",
  "at-risk": "At Risk",
  completed: "Completed",
};

export const TODAY_RESULT_LIMIT = 50;

const CATEGORY_WEIGHT = {
  "at-risk": 8,
  "act-now": 7,
  approvals: 5,
  waiting: 2,
  completed: 1,
};

const ACTION_BY_NOTIFICATION = {
  "open-conversation": { id: "open-inbox", label: "Open inbox", targetWorkspace: "inbox" },
  "open-seller-workspace": { id: "open-deal", label: "Open deal", targetWorkspace: "deals" },
  "view-ai-recommendation": { id: "open-deal", label: "Open deal", targetWorkspace: "deals" },
  "view-workflow-approval": { id: "open-deal", label: "Review context", targetWorkspace: "deals" },
  "view-transaction-checklist": { id: "open-deal", label: "Open deal", targetWorkspace: "deals" },
  "view-buyer-matches": { id: "open-buyers", label: "Open buyers", targetWorkspace: "buyers" },
  "view-documents": { id: "open-deal", label: "Open deal", targetWorkspace: "deals" },
  "view-system-health": { id: "open-settings", label: "Open settings", targetWorkspace: "settings" },
};

function nowIso(now) {
  return new Date(now).toISOString();
}

function todayIso(now) {
  return nowIso(now).slice(0, 10);
}

function normalizeDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function getDealId(deal = {}, fallback = "") {
  return getDealAliasText(deal, "id") || fallback;
}

function getAddress(deal = {}) {
  return getDealAliasText(deal, "address") || "Unknown property";
}

function getSeller(deal = {}) {
  return getDealAliasText(deal, "ownerName") || "Unknown seller";
}

function getDealStatus(deal = {}) {
  return getDealAliasText(deal, "stage") || "Unknown";
}

function getDealSource(deal = {}) {
  return getDealAliasText(deal, "source") || "Deals";
}

function isClosedDeal(deal = {}) {
  return getDealStatus(deal).toLowerCase() === "closed";
}

function isActiveDeal(deal = {}) {
  return Boolean(getDealId(deal)) && !isClosedDeal(deal);
}

function notificationCategory(notification = {}, today = todayIso(Date.now())) {
  if (notification.status === "Completed") return "completed";
  if (notification.requiresApproval) return "approvals";

  const category = String(notification.category || "").toLowerCase();
  const dueDate = normalizeDate(notification.deal?.due_date || notification.deal?.follow_up_date);

  if (
    notification.priority === "Critical" ||
    category.includes("overdue") ||
    category.includes("missing") ||
    category.includes("transaction") ||
    category.includes("system health")
  ) {
    return "at-risk";
  }

  if (
    category.includes("follow-up") ||
    category.includes("offer") ||
    category.includes("critical lead") ||
    dueDate === today
  ) {
    return "act-now";
  }

  if (notification.status === "Snoozed") return "waiting";
  return "act-now";
}

function normalizeAvailableAction(notification = {}) {
  const configured = ACTION_BY_NOTIFICATION[notification.action] || ACTION_BY_NOTIFICATION["open-seller-workspace"];
  return {
    ...configured,
    dealId: notification.dealId || null,
    phone: notification.deal?.phone || "",
  };
}

function normalizeNotificationItem(notification = {}, { now = Date.now() } = {}) {
  const category = notificationCategory(notification, todayIso(now));
  const action = normalizeAvailableAction(notification);

  return {
    id: `notification:${notification.id}`,
    tenantId: notification.deal?.organization_id || notification.deal?.tenant_id || null,
    type: notification.requiresApproval ? "approval" : "notification",
    category,
    title: notification.title || "Action needed",
    summary: notification.reason || "",
    relatedSeller: notification.relatedSeller || getSeller(notification.deal),
    relatedDeal: notification.relatedDeal || getAddress(notification.deal),
    priority: notification.priority || "Medium",
    urgency: category === "at-risk" ? "High risk" : notification.priority || "Medium",
    reason: notification.reason || "",
    recommendedNextAction: notification.recommendedAction || "Review this item.",
    dueDate: notification.deal?.due_date || notification.deal?.follow_up_date || "",
    actionWindow: notification.deal?.due_date ? formatSafeDate(notification.deal.due_date, "") : "",
    source: notification.category || "Action Inbox",
    createdAt: notification.createdAt || nowIso(now),
    updatedAt: notification.updatedAt || notification.createdAt || nowIso(now),
    status: notification.status || "New",
    availableActions: [action],
    evidence: [
      notification.reason ? { label: "Rule", value: notification.reason } : null,
      notification.category ? { label: "Source", value: notification.category } : null,
    ].filter(Boolean),
    targetWorkspace: action.targetWorkspace,
    target: {
      dealId: notification.dealId || null,
      phone: notification.deal?.phone || "",
    },
    dataConfidence: notification.deal ? "Derived from loaded CRM data" : "Partial source data",
    sortSignals: {
      priorityWeight: getPriorityWeight(notification.priority),
      dueDate: notification.deal?.due_date || notification.deal?.follow_up_date || "",
    },
  };
}

function approvalTodayCategory(status) {
  if (status === "deferred") return "waiting";
  if (status === "expired") return "at-risk";
  if (["approved", "rejected", "cancelled"].includes(status)) return "completed";
  return "approvals";
}

function normalizeApprovalTodayItem(approval = {}) {
  const category = approvalTodayCategory(approval.status);
  const dealId = approval.relatedDeal?.id || null;
  const phone = approval.relatedSeller?.phone || approval.relatedConversation?.phone || "";

  return {
    id: `today:${approval.id}`,
    tenantId: approval.tenantId,
    type: "approval",
    category,
    title: approval.title,
    summary: approval.summary,
    relatedSeller: approval.relatedSeller?.name || "Unknown seller",
    relatedDeal:
      approval.relatedProperty?.address || approval.relatedDeal?.label || "Unknown property",
    priority: approval.riskLevel || "Medium",
    urgency: approval.urgency || approval.riskLevel || "Normal",
    reason: approval.reason,
    recommendedNextAction: approval.requestedAction,
    dueDate: approval.expirationTimestamp || approval.actionDueAt || "",
    actionWindow: approval.expirationTimestamp
      ? formatSafeDate(approval.expirationTimestamp, "")
      : "",
    source: approval.sourceSystem || "Universal Approval Inbox",
    createdAt: approval.requestedTimestamp,
    updatedAt: approval.decisionMetadata?.decidedAt || approval.requestedTimestamp,
    status: approval.status,
    availableActions: [
      {
        id: "open-approval-inbox",
        label: "Review approval",
        targetWorkspace: "approvals",
        dealId,
        phone,
      },
    ],
    evidence: approval.evidence,
    targetWorkspace: "approvals",
    target: { dealId, phone, approvalId: approval.id },
    dataConfidence: "Derived from the normalized approval read model",
    sortSignals: {
      priorityWeight: getPriorityWeight(approval.riskLevel),
      dueDate: approval.expirationTimestamp || approval.actionDueAt || "",
    },
  };
}

function buildWaitingItems(deals = [], { now = Date.now() } = {}) {
  const today = todayIso(now);

  return deals
    .filter(isActiveDeal)
    .filter((deal) => {
      const dueDate = normalizeDate(deal.due_date || deal.follow_up_date);
      return dueDate && dueDate > today;
    })
    .map((deal) => ({
      id: `waiting:${getDealId(deal)}`,
      tenantId: deal.organization_id || deal.tenant_id || null,
      type: "follow-up",
      category: "waiting",
      title: `Waiting until ${formatSafeDate(deal.due_date || deal.follow_up_date, "scheduled follow-up")}`,
      summary: deal.next_action || "Follow-up is scheduled for a future date.",
      relatedSeller: getSeller(deal),
      relatedDeal: getAddress(deal),
      priority: "Low",
      urgency: "Can wait",
      reason: "The next follow-up date is in the future.",
      recommendedNextAction: "No action needed until the scheduled follow-up.",
      dueDate: deal.due_date || deal.follow_up_date || "",
      actionWindow: formatSafeDate(deal.due_date || deal.follow_up_date, ""),
      source: getDealSource(deal),
      createdAt: deal.created_at || nowIso(now),
      updatedAt: deal.updated_at || deal.created_at || nowIso(now),
      status: getDealStatus(deal),
      availableActions: [{ id: "open-deal", label: "Open deal", targetWorkspace: "deals", dealId: getDealId(deal) }],
      evidence: [{ label: "Scheduled follow-up", value: formatSafeDate(deal.due_date || deal.follow_up_date, "") }],
      targetWorkspace: "deals",
      target: { dealId: getDealId(deal), phone: deal.phone || "" },
      dataConfidence: "Derived from loaded CRM data",
      sortSignals: { priorityWeight: 1, dueDate: deal.due_date || deal.follow_up_date || "" },
    }));
}

function buildCompletedItems(deals = [], { now = Date.now() } = {}) {
  const today = todayIso(now);

  return deals
    .filter((deal) => isClosedDeal(deal) && normalizeDate(deal.updated_at || deal.closed_at) === today)
    .map((deal) => ({
      id: `completed:${getDealId(deal)}`,
      tenantId: deal.organization_id || deal.tenant_id || null,
      type: "completed-work",
      category: "completed",
      title: `Completed: ${getAddress(deal)}`,
      summary: "Deal is marked closed in the currently loaded CRM data.",
      relatedSeller: getSeller(deal),
      relatedDeal: getAddress(deal),
      priority: "Low",
      urgency: "Completed",
      reason: "The deal was updated as closed today.",
      recommendedNextAction: "Review the deal record if follow-up is needed.",
      dueDate: "",
      actionWindow: "",
      source: getDealSource(deal),
      createdAt: deal.created_at || nowIso(now),
      updatedAt: deal.updated_at || deal.closed_at || nowIso(now),
      status: "Completed",
      availableActions: [{ id: "open-deal", label: "Open deal", targetWorkspace: "deals", dealId: getDealId(deal) }],
      evidence: [{ label: "Stage", value: getDealStatus(deal) }],
      targetWorkspace: "deals",
      target: { dealId: getDealId(deal), phone: deal.phone || "" },
      dataConfidence: "Derived from loaded CRM data",
      sortSignals: { priorityWeight: 1, dueDate: "" },
    }));
}

function buildSellerReplyItems(conversations = [], { now = Date.now() } = {}) {
  return conversations
    .filter((conversation) => conversation?.direction === "inbound")
    .slice(0, 10)
    .map((conversation) => ({
      id: `seller-reply:${conversation.phone}`,
      tenantId: conversation.organization_id || conversation.tenant_id || null,
      type: "seller-reply",
      category: "act-now",
      title: "Seller reply needs attention",
      summary: conversation.lastMessagePreview || "Recent inbound seller message.",
      relatedSeller: conversation.sellerName || "Unknown seller",
      relatedDeal: conversation.relatedDeal || conversation.phone || "Unknown property",
      priority: "High",
      urgency: "Seller response",
      reason: "The latest available conversation summary is inbound.",
      recommendedNextAction: "Open the inbox and respond from the existing communication workflow.",
      dueDate: "",
      actionWindow: "",
      source: "Conversation Inbox",
      createdAt: conversation.created_at || nowIso(now),
      updatedAt: conversation.lastMessageAt || conversation.created_at || nowIso(now),
      status: "New",
      availableActions: [{ id: "open-inbox", label: "Open inbox", targetWorkspace: "inbox", phone: conversation.phone }],
      evidence: [{ label: "Last message direction", value: "Inbound" }],
      targetWorkspace: "inbox",
      target: { dealId: null, phone: conversation.phone || "" },
      dataConfidence: "Derived from loaded conversation summary",
      sortSignals: { priorityWeight: 3, dueDate: "" },
    }));
}

function dedupeTodayItems(items = []) {
  const seen = new Set();
  const deduped = [];

  for (const item of items) {
    const conditionKey = [
      item.type,
      item.category,
      item.target?.dealId || item.target?.phone || item.relatedDeal,
      item.reason,
    ].join(":");

    if (seen.has(conditionKey)) continue;
    seen.add(conditionKey);
    deduped.push(item);
  }

  return deduped;
}

export function compareTodayItems(left, right) {
  const leftCategory = CATEGORY_WEIGHT[left.category] || 0;
  const rightCategory = CATEGORY_WEIGHT[right.category] || 0;
  if (leftCategory !== rightCategory) return rightCategory - leftCategory;

  const priorityDiff = (right.sortSignals?.priorityWeight || 0) - (left.sortSignals?.priorityWeight || 0);
  if (priorityDiff !== 0) return priorityDiff;

  const leftDue = left.sortSignals?.dueDate || left.dueDate || "9999-12-31";
  const rightDue = right.sortSignals?.dueDate || right.dueDate || "9999-12-31";
  if (leftDue !== rightDue) return leftDue.localeCompare(rightDue);

  return new Date(right.updatedAt || right.createdAt) - new Date(left.updatedAt || left.createdAt);
}

function buildCounts(items = []) {
  return TODAY_CATEGORIES.reduce((counts, category) => {
    counts[category] = items.filter((item) => item.category === category).length;
    return counts;
  }, {});
}

export function buildTodayReadModel({
  conversations = [],
  deals = [],
  errors = [],
  limit = TODAY_RESULT_LIMIT,
  now = Date.now(),
  notificationStateById = {},
  role = "",
} = {}) {
  const safeDeals = Array.isArray(deals)
    ? deals.filter((deal) => deal && typeof deal === "object").slice(0, 250)
    : [];
  const safeConversations = Array.isArray(conversations) ? conversations.slice(0, 25) : [];
  const inbox = buildActionInbox({ deals: safeDeals, stateById: notificationStateById });
  const sourceWarnings = [...(inbox.missingData || []), ...errors.filter(Boolean)];
  const operatorNotifications = (inbox.notifications || []).filter(
    (notification) => notification.category !== "System health warnings"
  );
  const approvalReadModel = buildApprovalReadModel({
    dealNotifications: operatorNotifications,
    deals: safeDeals,
    limit,
    now,
    role,
  });
  const notificationItems = operatorNotifications
    .filter((notification) => !isApprovalNotification(notification))
    .map((notification) => normalizeNotificationItem(notification, { now }));
  const approvalItems = approvalReadModel.items.map(normalizeApprovalTodayItem);

  const items = dedupeTodayItems([
    ...notificationItems,
    ...approvalItems,
    ...buildSellerReplyItems(safeConversations, { now }),
    ...buildWaitingItems(safeDeals, { now }),
    ...buildCompletedItems(safeDeals, { now }),
  ])
    .sort(compareTodayItems)
    .slice(0, Math.max(1, limit));

  return {
    categories: TODAY_CATEGORIES.map((id) => ({ id, label: TODAY_CATEGORY_LABELS[id], count: buildCounts(items)[id] })),
    counts: buildCounts(items),
    generatedAt: nowIso(now),
    items,
    limit,
    role,
    sourceWarnings,
    sourceStatus: sourceWarnings.length ? "partial" : "complete",
    sources: [
      "Action Inbox",
      "Notification Rules",
      "Universal Approval Inbox",
      "Deal Data",
      "Conversation summaries when supplied",
    ],
    approvals: approvalReadModel,
  };
}
