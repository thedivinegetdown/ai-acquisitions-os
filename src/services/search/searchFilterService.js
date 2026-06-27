import { normalizeText } from "../../utils/text";

export const DEFAULT_SEARCH_FILTERS = {
  entityType: "all",
  stage: "all",
  market: "all",
  leadSource: "all",
  priority: "all",
  status: "all",
  dateFrom: "",
  dateTo: "",
};

function matchesValue(value, filter) {
  return filter === "all" || !filter || normalizeText(value) === normalizeText(filter);
}

function matchesDateRange(dateValue, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  if (!dateValue) return false;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  if (dateFrom && date < new Date(dateFrom)) return false;
  if (dateTo && date > new Date(dateTo)) return false;

  return true;
}

export function filterSearchResults(results = [], filters = {}) {
  const mergedFilters = {
    ...DEFAULT_SEARCH_FILTERS,
    ...filters,
  };

  return results.filter(
    (result) =>
      matchesValue(result.type, mergedFilters.entityType) &&
      matchesValue(result.stage || "all", mergedFilters.stage) &&
      matchesValue(result.market || "all", mergedFilters.market) &&
      matchesValue(result.leadSource || "all", mergedFilters.leadSource) &&
      matchesValue(result.priority || "all", mergedFilters.priority) &&
      matchesValue(result.status || "all", mergedFilters.status) &&
      matchesDateRange(result.date, mergedFilters.dateFrom, mergedFilters.dateTo)
  );
}

export function buildFilterOptions(results = []) {
  const collect = (field) => [
    "all",
    ...new Set(results.map((result) => result[field]).filter(Boolean)),
  ];

  return {
    entityTypes: ["all", ...new Set(results.map((result) => result.type))],
    stages: collect("stage"),
    markets: collect("market"),
    leadSources: collect("leadSource"),
    priorities: collect("priority"),
    statuses: collect("status"),
  };
}
