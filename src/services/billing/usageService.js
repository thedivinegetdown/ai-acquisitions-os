import { parseSafeNumber } from "../../utils/numbers";

export const USAGE_METRICS = [
  { key: "leads", label: "Leads" },
  { key: "smsMessages", label: "SMS messages" },
  { key: "aiRequests", label: "AI requests" },
  { key: "teamMembers", label: "Team members" },
  { key: "activeMarkets", label: "Active markets" },
  { key: "storageDocuments", label: "Storage/documents" },
];

export function buildPlaceholderUsage({
  deals = [],
  teamMembers = [],
  activeMarkets = [],
  documents = [],
} = {}) {
  const safeDeals = Array.isArray(deals) ? deals : [];

  return {
    leads: safeDeals.length,
    smsMessages: 0,
    aiRequests: 0,
    teamMembers: Array.isArray(teamMembers) ? teamMembers.length : 1,
    activeMarkets: Array.isArray(activeMarkets) ? activeMarkets.length : 0,
    storageDocuments: Array.isArray(documents) ? documents.length : 0,
  };
}

export function buildUsageSummary(usage = {}, limits = {}) {
  return USAGE_METRICS.map((metric) => {
    const used = parseSafeNumber(usage[metric.key], 0);
    const limit = limits[metric.key] ?? null;
    const percentUsed = limit ? Math.round((used / limit) * 100) : null;

    return {
      ...metric,
      used,
      limit,
      percentUsed,
      warning: Boolean(percentUsed !== null && percentUsed >= 80),
      overLimit: Boolean(percentUsed !== null && percentUsed > 100),
    };
  });
}

export function getUsageWarnings(usageSummary = []) {
  return usageSummary
    .filter((metric) => metric.warning || metric.overLimit)
    .map((metric) =>
      metric.overLimit
        ? `${metric.label} is over the placeholder plan limit.`
        : `${metric.label} is approaching the placeholder plan limit.`
    );
}
