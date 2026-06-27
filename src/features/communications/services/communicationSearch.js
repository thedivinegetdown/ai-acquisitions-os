import { toSafeDate } from "../../../utils/dates";
import { normalizePhone, phonesMatch } from "../../../utils/phone";
import { normalizeText } from "../../../utils/text";

function searchableText(value) {
  if (value === null || value === undefined) return "";
  return normalizeText(String(value));
}

function matchesDate(eventDate, requestedDate) {
  if (!requestedDate) return true;

  const event = toSafeDate(eventDate);
  const requested = toSafeDate(requestedDate);

  if (!event || !requested) return false;

  return event.toDateString() === requested.toDateString();
}

export function searchCommunications(events = [], query = "") {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) return events;

  const phoneQuery = normalizePhone(query);

  return events.filter((event) => {
    const searchable = [
      event.body,
      event.summary,
      event.sender,
      event.sellerName,
      event.relatedDealId,
      event.relatedWorkflowId,
      event.channel,
      event.status,
      event.formattedTimestamp,
    ]
      .map(searchableText)
      .join(" ");

    return (
      searchable.includes(normalizedQuery) ||
      (phoneQuery && phonesMatch(event.phone, phoneQuery))
    );
  });
}

export function filterCommunications(events = [], filters = {}) {
  const channelFilters = filters.channels || [];
  const dateFilter = filters.date || "";
  const directionFilter = filters.direction || "all";
  const sellerFilter = normalizeText(filters.seller || "");
  const dealFilter = normalizeText(filters.deal || "");
  const phoneFilter = filters.phone || "";

  return events.filter((event) => {
    const channelMatches =
      channelFilters.length === 0 || channelFilters.includes(event.channel);
    const directionMatches =
      directionFilter === "all" || event.direction === directionFilter;
    const sellerMatches =
      !sellerFilter || searchableText(event.sellerName || event.sender).includes(sellerFilter);
    const dealMatches =
      !dealFilter || searchableText(event.relatedDealId).includes(dealFilter);
    const phoneMatches = !phoneFilter || phonesMatch(event.phone, phoneFilter);

    return (
      channelMatches &&
      directionMatches &&
      sellerMatches &&
      dealMatches &&
      phoneMatches &&
      matchesDate(event.timestamp, dateFilter)
    );
  });
}
