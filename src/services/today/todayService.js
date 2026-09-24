import { buildActionInbox } from "../notifications";
import { getPriorityWeight } from "../notifications/notificationPriorityService";
import { buildApprovalReadModel, isApprovalNotification } from "../approvals";
import { formatSafeDate } from "../../utils/dates";
import { getDealAliasText } from "../../utils/dealFields";
import {
  conversationNeedsReply,
  getConversationCompatibilityKey,
} from "../conversations";
import { applyTodayPrioritization } from "../decision-intelligence/prioritization";

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

function getDealCommitmentDueDate(deal = {}) {
  return deal.next_action_due_date || deal.due_date || deal.follow_up_date || "";
}

function obligationActionKey(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

function buildObligationKey(dealId, action, dueDate) {
  const actionKey = obligationActionKey(action);
  const dateKey = normalizeDate(dueDate);
  return dealId && actionKey && dateKey ? `${dealId}:${actionKey}:${dateKey}` : "";
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
  const dueDate = normalizeDate(getDealCommitmentDueDate(notification.deal));

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
  const dueDate = getDealCommitmentDueDate(notification.deal);
  const isDealCommitment =
    Boolean(notification.deal?.next_action) &&
    ["Follow-ups due", "Overdue tasks"].includes(notification.category);

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
    dueDate,
    sourceDueTimestamp: dueDate || null,
    actionWindow: dueDate ? formatSafeDate(dueDate, "") : "",
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
    commitment: isDealCommitment
      ? { sourceType: "deal", sourceId: notification.dealId, dealId: notification.dealId }
      : null,
    obligationKey: isDealCommitment
      ? buildObligationKey(notification.dealId, notification.deal.next_action, dueDate)
      : "",
    ownershipPriority: isDealCommitment ? 1 : 0,
    dataConfidence: notification.deal ? "Derived from loaded CRM data" : "Partial source data",
    sortSignals: {
      priorityWeight: getPriorityWeight(notification.priority),
      dueDate,
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
    sourceDueTimestamp: approval.actionDueAt || null,
    sourceExpirationTimestamp: approval.expirationTimestamp || null,
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
      const dueDate = normalizeDate(getDealCommitmentDueDate(deal));
      return dueDate && dueDate > today;
    })
    .map((deal) => ({
      id: `waiting:${getDealId(deal)}`,
      tenantId: deal.organization_id || deal.tenant_id || null,
      type: "follow-up",
      category: "waiting",
      title: `Waiting until ${formatSafeDate(getDealCommitmentDueDate(deal), "scheduled follow-up")}`,
      summary: deal.next_action || "Follow-up is scheduled for a future date.",
      relatedSeller: getSeller(deal),
      relatedDeal: getAddress(deal),
      priority: "Low",
      urgency: "Can wait",
      reason: "The next follow-up date is in the future.",
      recommendedNextAction: "No action needed until the scheduled follow-up.",
      dueDate: getDealCommitmentDueDate(deal),
      sourceDueTimestamp: getDealCommitmentDueDate(deal) || null,
      actionWindow: formatSafeDate(getDealCommitmentDueDate(deal), ""),
      source: getDealSource(deal),
      createdAt: deal.created_at || nowIso(now),
      updatedAt: deal.updated_at || deal.created_at || nowIso(now),
      status: getDealStatus(deal),
      availableActions: [{ id: "open-deal", label: "Open deal", targetWorkspace: "deals", dealId: getDealId(deal) }],
      evidence: [{ label: "Scheduled follow-up", value: formatSafeDate(getDealCommitmentDueDate(deal), "") }],
      targetWorkspace: "deals",
      target: { dealId: getDealId(deal), phone: deal.phone || "" },
      commitment: { sourceType: "deal", sourceId: getDealId(deal), dealId: getDealId(deal) },
      obligationKey: buildObligationKey(
        getDealId(deal),
        deal.next_action,
        getDealCommitmentDueDate(deal)
      ),
      ownershipPriority: 1,
      dataConfidence: "Derived from loaded CRM data",
      sortSignals: { priorityWeight: 1, dueDate: getDealCommitmentDueDate(deal) },
    }));
}

function commitmentCategory(status, dueDate, updatedAt, now) {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  if (["completed", "complete", "done"].includes(normalizedStatus)) {
    return normalizeDate(updatedAt) === todayIso(now) ? "completed" : "";
  }
  if (["cancelled", "canceled", "skipped"].includes(normalizedStatus)) return "";

  const date = normalizeDate(dueDate);
  if (!date) return "";
  if (date < todayIso(now)) return "at-risk";
  if (date > todayIso(now)) return "waiting";
  return "act-now";
}

function buildSourceCommitmentItems({ records, sourceType, dealsById, now }) {
  return (Array.isArray(records) ? records : []).flatMap((record) => {
    const dueDate = sourceType === "seller-task" ? record.due_at : record.due_date;
    const category = commitmentCategory(record.status, dueDate, record.updated_at, now);
    if (!category) return [];

    const deal = dealsById.get(String(record.deal_id || "")) || {};
    const dealId = record.deal_id || null;
    const action =
      sourceType === "seller-task"
        ? record.title
        : record.action_type || `Sequence step ${record.step_day || ""}`.trim();
    const completed = category === "completed";
    const sourceLabel = sourceType === "seller-task" ? "Seller Tasks" : "Sequence Steps";

    return [{
      id: `commitment:${sourceType}:${record.id}`,
      tenantId: record.organization_id || deal.organization_id || null,
      type: "commitment",
      category,
      title: completed ? `Completed: ${action}` : action || "Owner commitment",
      summary: completed ? "This commitment was completed today." : action || "Owner commitment",
      relatedSeller: getSeller(deal),
      relatedDeal: getAddress(deal),
      priority: category === "at-risk" ? "Critical" : category === "act-now" ? "High" : "Low",
      urgency: category === "at-risk" ? "Overdue" : category === "act-now" ? "Due" : completed ? "Completed" : "Can wait",
      reason:
        category === "at-risk"
          ? `This commitment was due ${formatSafeDate(dueDate, "earlier")}.`
          : category === "act-now"
            ? "This commitment is due today."
            : completed
              ? "The source record is durably marked completed."
              : "This commitment is scheduled for a future date.",
      recommendedNextAction: completed ? "No further action is required." : action || "Review the commitment.",
      dueDate,
      sourceDueTimestamp: dueDate || null,
      actionWindow: formatSafeDate(dueDate, ""),
      source: sourceLabel,
      createdAt: record.created_at || nowIso(now),
      updatedAt: record.updated_at || record.created_at || nowIso(now),
      status: record.status || "open",
      availableActions: dealId
        ? [{ id: "open-deal", label: "Open deal", targetWorkspace: "deals", dealId }]
        : [],
      evidence: [{ label: "Commitment source", value: sourceLabel }],
      targetWorkspace: dealId ? "deals" : "today",
      target: { dealId, phone: record.phone || deal.phone || "" },
      commitment: { sourceType, sourceId: record.id, dealId },
      obligationKey: buildObligationKey(dealId, action, dueDate),
      ownershipPriority: sourceType === "seller-task" ? 3 : 2,
      dataConfidence: "Persisted source record",
      sortSignals: {
        priorityWeight: category === "at-risk" ? 4 : category === "act-now" ? 3 : 1,
        dueDate: normalizeDate(dueDate),
      },
    }];
  });
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
      sourceDueTimestamp: null,
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
    .filter(conversationNeedsReply)
    .slice(0, 10)
    .map((conversation) => {
      const phone = conversation.phone || conversation.participantIdentifier || "";
      const dealId = conversation.linkedDealId || conversation.dealId || null;
      return {
        id: `seller-reply:${getConversationCompatibilityKey(conversation)}`,
        tenantId:
          conversation.organizationId ||
          conversation.organization_id ||
          conversation.tenantId ||
          conversation.tenant_id ||
          null,
        type: "seller-reply",
        category: "act-now",
        title: "Seller reply needs attention",
        summary: conversation.lastMessagePreview || "Recent inbound seller message.",
        relatedSeller: conversation.sellerName || "Unknown seller",
        relatedDeal:
          conversation.propertyAddress ||
          conversation.relatedDeal ||
          phone ||
          "Unknown property",
        priority: "High",
        urgency: "Seller response",
        reason: "The latest valid message in the shared conversation summary is inbound.",
        recommendedNextAction:
          "Open the inbox and respond from the existing communication workflow.",
        dueDate: "",
        sourceEventTimestamp:
          conversation.lastMessageTimestamp ||
          conversation.lastMessageAt ||
          conversation.created_at ||
          null,
        actionWindow: "",
        source: "Unified Inbox",
        createdAt: conversation.created_at || nowIso(now),
        updatedAt:
          conversation.lastMessageTimestamp ||
          conversation.lastMessageAt ||
          conversation.created_at ||
          nowIso(now),
        status: "New",
        availableActions: [
          {
            id: "open-inbox",
            label: "Open inbox",
            targetWorkspace: "inbox",
            phone,
          },
        ],
        evidence: [{ label: "Last message direction", value: "Inbound" }],
        targetWorkspace: "inbox",
        target: { dealId, phone },
        dataConfidence: "Derived from the normalized Inbox communication signal",
        sortSignals: { priorityWeight: 3, dueDate: "" },
      };
    });
}

function dedupeTodayItems(items = []) {
  const seen = new Map();
  const deduped = [];

  for (const item of items) {
    const targetKey =
      item.type === "seller-reply"
        ? item.id
        : item.target?.dealId || item.target?.phone || item.relatedDeal;
    const conditionKey =
      item.obligationKey ||
      (item.commitment
        ? `${item.commitment.sourceType}:${item.commitment.sourceId}`
        : [item.type, item.category, targetKey, item.reason].join(":"));

    if (!seen.has(conditionKey)) {
      seen.set(conditionKey, deduped.length);
      deduped.push(item);
      continue;
    }

    const existingIndex = seen.get(conditionKey);
    if ((item.ownershipPriority || 0) > (deduped[existingIndex].ownershipPriority || 0)) {
      deduped[existingIndex] = item;
    }
  }

  return deduped;
}

export function compareTodayItems(left, right) {
  const leftCategory = CATEGORY_WEIGHT[left.category] || 0;
  const rightCategory = CATEGORY_WEIGHT[right.category] || 0;
  if (leftCategory !== rightCategory) return rightCategory - leftCategory;

  const delayDiff = (right.sortSignals?.delayImpactRank || 0) - (left.sortSignals?.delayImpactRank || 0);
  if (delayDiff !== 0) return delayDiff;

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
  sellerTasks = [],
  sequenceSteps = [],
} = {}) {
  const safeDeals = Array.isArray(deals)
    ? deals.filter((deal) => deal && typeof deal === "object").slice(0, 250)
    : [];
  const safeConversations = Array.isArray(conversations) ? conversations.slice(0, 25) : [];
  const inbox = buildActionInbox({ deals: safeDeals, now, stateById: notificationStateById });
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
  const dealsById = new Map(safeDeals.map((deal) => [String(getDealId(deal)), deal]));
  const sellerTaskItems = buildSourceCommitmentItems({
    records: sellerTasks,
    sourceType: "seller-task",
    dealsById,
    now,
  });
  const sequenceItems = buildSourceCommitmentItems({
    records: sequenceSteps,
    sourceType: "sequence-step",
    dealsById,
    now,
  });

  const items = dedupeTodayItems([
    ...sellerTaskItems,
    ...sequenceItems,
    ...notificationItems,
    ...approvalItems,
    ...buildSellerReplyItems(safeConversations, { now }),
    ...buildWaitingItems(safeDeals, { now }),
    ...buildCompletedItems(safeDeals, { now }),
  ])
    .map((item) => applyTodayPrioritization(item, { evaluatedTimestamp: nowIso(now) }))
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
      "Seller Tasks",
      "Sequence Steps",
      "Conversation summaries when supplied",
    ],
    approvals: approvalReadModel,
  };
}
