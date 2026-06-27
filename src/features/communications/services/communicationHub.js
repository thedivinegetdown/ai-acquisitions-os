import { calculateCommunicationAnalytics } from "./communicationAnalytics";
import { loadCommunicationHistory } from "./communicationHistory";
import { filterCommunications, searchCommunications } from "./communicationSearch";

export async function loadCommunicationsHub(input = {}) {
  const historyResult = await loadCommunicationHistory(input);

  if (!historyResult.success) return historyResult;

  const timeline = historyResult.data.timeline || [];

  return {
    success: true,
    data: {
      timeline,
      messages: historyResult.data.messages || [],
      analytics: calculateCommunicationAnalytics(timeline),
      generatedAt: new Date().toISOString(),
    },
  };
}

export function deriveCommunicationsView({
  timeline = [],
  query = "",
  filters = {},
} = {}) {
  const searched = searchCommunications(timeline, query);
  const filtered = filterCommunications(searched, filters);

  return {
    timeline: filtered,
    totalCount: timeline.length,
    visibleCount: filtered.length,
    analytics: calculateCommunicationAnalytics(filtered),
  };
}
