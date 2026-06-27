import { getMonitoringEvents } from "../monitoring";

export function buildSystemEvent({
  type = "system",
  name = "System event",
  status = "recorded",
  message = "",
  metadata = {},
} = {}) {
  return {
    id: `${type}-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    name,
    status,
    message,
    metadata,
    timestamp: new Date().toISOString(),
  };
}

export function getRecentSystemEvents({ limit = 8 } = {}) {
  const monitoringEvents = getMonitoringEvents().map((event) => ({
    id: `${event.type}-${event.name}-${event.timestamp}`,
    type: event.type,
    name: event.name,
    status: event.status,
    message:
      event.durationMs !== null && event.durationMs !== undefined
        ? `${event.name} completed in ${event.durationMs}ms.`
        : `${event.name} was recorded.`,
    metadata: event.metadata || {},
    timestamp: event.timestamp,
  }));

  const baselineEvents = [
    buildSystemEvent({
      type: "admin",
      name: "Health center loaded",
      status: "recorded",
      message: "Admin health center generated a local readiness snapshot.",
    }),
    buildSystemEvent({
      type: "security",
      name: "Secret exposure check",
      status: "recorded",
      message: "Health center displays environment variable names only, never values.",
    }),
  ];

  return [...monitoringEvents, ...baselineEvents]
    .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp))
    .slice(0, limit);
}
