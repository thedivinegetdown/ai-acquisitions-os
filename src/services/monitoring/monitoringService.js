import { logger } from "../logging";

const monitoringEvents = [];

export function recordMonitoringEvent(event = {}) {
  const normalizedEvent = {
    type: event.type || "event",
    name: event.name || "unknown",
    durationMs: event.durationMs ?? null,
    status: event.status || "recorded",
    metadata: event.metadata || {},
    timestamp: new Date().toISOString(),
  };

  monitoringEvents.unshift(normalizedEvent);

  if (monitoringEvents.length > 100) {
    monitoringEvents.pop();
  }

  logger.debug("[monitoring] event", normalizedEvent);
  return normalizedEvent;
}

export async function monitorAsync(name, operation, metadata = {}) {
  const startedAt = performance.now();

  try {
    const result = await operation();
    recordMonitoringEvent({
      type: "async",
      name,
      status: result?.success === false ? "failed" : "success",
      durationMs: Math.round(performance.now() - startedAt),
      metadata,
    });
    return result;
  } catch (error) {
    recordMonitoringEvent({
      type: "async",
      name,
      status: "error",
      durationMs: Math.round(performance.now() - startedAt),
      metadata: {
        ...metadata,
        error: error?.message || "Unknown error",
      },
    });
    throw error;
  }
}

export function recordUserAction(name, metadata = {}) {
  return recordMonitoringEvent({
    type: "user_action",
    name,
    metadata,
  });
}

export function getMonitoringEvents() {
  return [...monitoringEvents];
}
