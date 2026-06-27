import {
  generateNotifications,
  updateNotificationState,
} from "./notificationService";
import { hasText } from "../../utils/validation";

export function buildActionInbox(input = {}) {
  return generateNotifications(input);
}

export function markNotificationSeen(stateById, notificationId) {
  if (!hasText(notificationId)) return stateById;
  return updateNotificationState(stateById, notificationId, { status: "Seen" });
}

export function markNotificationCompleted(stateById, notificationId) {
  if (!hasText(notificationId)) return stateById;
  return updateNotificationState(stateById, notificationId, { status: "Completed" });
}

export function dismissNotification(stateById, notificationId) {
  if (!hasText(notificationId)) return stateById;
  return updateNotificationState(stateById, notificationId, { status: "Dismissed" });
}

export function snoozeNotification(stateById, notificationId, snoozedUntil = "") {
  if (!hasText(notificationId)) return stateById;
  return updateNotificationState(stateById, notificationId, {
    status: "Snoozed",
    snoozedUntil,
  });
}
