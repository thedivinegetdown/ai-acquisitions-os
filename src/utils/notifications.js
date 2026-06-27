export function createNotification({
  type = "info",
  title = "",
  message = "",
  metadata = {},
} = {}) {
  return {
    id: `notification-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    title,
    message,
    metadata,
    createdAt: new Date().toISOString(),
  };
}
