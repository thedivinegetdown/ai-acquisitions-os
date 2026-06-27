export const NOTIFICATION_PRIORITIES = ["Low", "Medium", "High", "Critical"];
export const NOTIFICATION_STATUSES = [
  "New",
  "Seen",
  "Snoozed",
  "Completed",
  "Dismissed",
];

const PRIORITY_WEIGHT = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

export function getPriorityWeight(priority = "Low") {
  return PRIORITY_WEIGHT[priority] || PRIORITY_WEIGHT.Low;
}

export function sortNotificationsByPriority(notifications = []) {
  return [...notifications].sort((left, right) => {
    const priorityDiff =
      getPriorityWeight(right.priority) - getPriorityWeight(left.priority);
    if (priorityDiff !== 0) return priorityDiff;

    return new Date(right.createdAt) - new Date(left.createdAt);
  });
}

export function normalizeNotificationStatus(status = "New") {
  return NOTIFICATION_STATUSES.includes(status) ? status : "New";
}
