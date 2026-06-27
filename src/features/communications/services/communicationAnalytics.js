import { hoursSince, toSafeDate } from "../../../utils/dates";
import { normalizePhone } from "../../../utils/phone";

function average(values = []) {
  const validValues = values.filter((value) => Number.isFinite(value));
  if (validValues.length === 0) return null;
  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

function calculateAverageResponseHours(events = []) {
  const chronological = [...events].sort((left, right) => {
    const leftTime = toSafeDate(left.timestamp)?.getTime() || 0;
    const rightTime = toSafeDate(right.timestamp)?.getTime() || 0;
    return leftTime - rightTime;
  });
  const responseHours = [];
  let lastInboundAt = null;

  chronological.forEach((event) => {
    if (event.channel !== "sms") return;

    if (event.direction === "inbound") {
      lastInboundAt = event.timestamp;
      return;
    }

    if (event.direction === "outbound" && lastInboundAt) {
      const inbound = toSafeDate(lastInboundAt);
      const outbound = toSafeDate(event.timestamp);
      if (inbound && outbound && outbound.getTime() >= inbound.getTime()) {
        responseHours.push((outbound.getTime() - inbound.getTime()) / (1000 * 60 * 60));
        lastInboundAt = null;
      }
    }
  });

  return average(responseHours);
}

function getMostActiveSellers(events = []) {
  const counts = new Map();

  events.forEach((event) => {
    const key =
      event.sellerName ||
      event.phone ||
      event.sender ||
      event.relatedDealId ||
      "Unknown Seller";
    const current = counts.get(key) || {
      label: key,
      count: 0,
      normalizedPhone: normalizePhone(event.phone),
    };

    current.count += 1;
    counts.set(key, current);
  });

  return [...counts.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
}

export function calculateCommunicationAnalytics(events = []) {
  const smsEvents = events.filter((event) => event.channel === "sms");
  const outboundMessages = smsEvents.filter((event) => event.direction === "outbound");
  const inboundMessages = smsEvents.filter((event) => event.direction === "inbound");
  const latestEvent = events[0] || null;
  const averageResponseHours = calculateAverageResponseHours(events);
  const responseRate =
    inboundMessages.length === 0
      ? null
      : Math.round((outboundMessages.length / inboundMessages.length) * 100);

  return {
    messagesSent: outboundMessages.length,
    messagesReceived: inboundMessages.length,
    averageResponseHours,
    averageResponseLabel:
      averageResponseHours === null
        ? "Insufficient Data"
        : `${averageResponseHours.toFixed(1)}h`,
    responseRate,
    responseRateLabel: responseRate === null ? "Insufficient Data" : `${responseRate}%`,
    conversationLength: events.length,
    mostActiveSellers: getMostActiveSellers(events),
    followUpFrequency:
      latestEvent && latestEvent.direction === "outbound"
        ? `${Math.max(0, Math.round(hoursSince(latestEvent.timestamp) || 0))}h since last follow-up`
        : "No recent outbound follow-up",
    generatedAt: new Date().toISOString(),
  };
}
