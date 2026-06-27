import { analyzeSystemHealth } from "../observability";
import {
  buildDealNotifications,
  buildSystemHealthNotifications,
} from "./notificationRulesService";
import {
  normalizeNotificationStatus,
  sortNotificationsByPriority,
} from "./notificationPriorityService";

function applyLocalState(notifications = [], stateById = {}) {
  return notifications.map((notification) => ({
    ...notification,
    status: normalizeNotificationStatus(
      stateById[notification.id]?.status || notification.status
    ),
    snoozedUntil: stateById[notification.id]?.snoozedUntil || "",
    updatedAt: stateById[notification.id]?.updatedAt || notification.createdAt,
  }));
}

function groupNotifications(notifications = [], groupBy = "priority") {
  return notifications.reduce((groups, notification) => {
    const key = notification[groupBy] || "Other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(notification);
    return groups;
  }, {});
}

function isSnoozedActive(notification = {}) {
  if (notification.status !== "Snoozed") return true;
  if (!notification.snoozedUntil) return false;

  return notification.snoozedUntil <= new Date().toISOString().slice(0, 10);
}

function getMissingData(notifications = []) {
  const missing = [];

  if (notifications.length === 0) {
    missing.push("No notification rules matched the currently loaded data.");
  }

  if (!notifications.some((item) => item.category === "Unread seller messages")) {
    missing.push("Unread seller message state is not persisted yet.");
  }

  return missing;
}

export function generateNotifications({
  deals = [],
  stateById = {},
  groupBy = "priority",
} = {}) {
  const systemHealth = analyzeSystemHealth({ deals });
  const rawNotifications = [
    ...buildDealNotifications(deals),
    ...buildSystemHealthNotifications(systemHealth),
  ];
  const notifications = sortNotificationsByPriority(
    applyLocalState(rawNotifications, stateById)
  );
  const activeNotifications = notifications.filter(
    (notification) =>
      !["Dismissed", "Completed"].includes(notification.status) &&
      isSnoozedActive(notification)
  );
  const criticalCount = activeNotifications.filter(
    (notification) => notification.priority === "Critical"
  ).length;
  const overdueCount = activeNotifications.filter((notification) =>
    notification.category.toLowerCase().includes("overdue")
  ).length;
  const risks = [];

  if (criticalCount > 0) risks.push(`${criticalCount} critical items need attention.`);
  if (overdueCount > 0) risks.push(`${overdueCount} overdue items need attention.`);

  return {
    notifications: activeNotifications,
    groupedNotifications: groupNotifications(activeNotifications, groupBy),
    criticalCount,
    overdueCount,
    recommendedNextAction:
      criticalCount > 0
        ? "Start with critical notifications before lower-priority work."
        : "Review high-priority action inbox items and clear stale notifications.",
    risks,
    missingData: getMissingData(rawNotifications),
    summary:
      activeNotifications.length === 0
        ? "No active notifications require attention."
        : `${activeNotifications.length} active notifications across ${Object.keys(groupNotifications(activeNotifications, groupBy)).length} groups.`,
    generatedAt: new Date().toISOString(),
  };
}

export function updateNotificationState(stateById = {}, notificationId, updates = {}) {
  return {
    ...stateById,
    [notificationId]: {
      ...(stateById[notificationId] || {}),
      ...updates,
      updatedAt: new Date().toISOString(),
    },
  };
}
