import { useMemo, useState } from "react";
import {
  COMMUNICATION_CHANNELS,
  calculateCommunicationAnalytics,
  deriveCommunicationsView,
} from "../services";
import { useConversationTimeline } from "./useConversationTimeline";

const DEFAULT_FILTERS = {
  channels: [],
  direction: "all",
  date: "",
  seller: "",
  deal: "",
  phone: "",
};

export function useCommunications({
  phone,
  deal = null,
  refreshKey = 0,
} = {}) {
  const [localEvents, setLocalEvents] = useState([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const timelineState = useConversationTimeline({
    phone,
    deal,
    refreshKey,
    localEvents,
  });

  const view = useMemo(
    () =>
      deriveCommunicationsView({
        timeline: timelineState.timeline,
        query,
        filters,
      }),
    [filters, query, timelineState.timeline]
  );

  const analytics = useMemo(
    () => calculateCommunicationAnalytics(timelineState.timeline),
    [timelineState.timeline]
  );

  function addLocalEvent(event) {
    setLocalEvents((current) => [event, ...current]);
  }

  function toggleChannel(channel) {
    setFilters((current) => {
      const channels = current.channels.includes(channel)
        ? current.channels.filter((value) => value !== channel)
        : [...current.channels, channel];

      return {
        ...current,
        channels,
      };
    });
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
    setQuery("");
  }

  return {
    ...timelineState,
    query,
    setQuery,
    filters,
    setFilters,
    toggleChannel,
    clearFilters,
    filteredTimeline: view.timeline,
    totalCount: view.totalCount,
    visibleCount: view.visibleCount,
    analytics,
    filteredAnalytics: view.analytics,
    addLocalEvent,
    supportedChannels: Object.values(COMMUNICATION_CHANNELS),
  };
}
