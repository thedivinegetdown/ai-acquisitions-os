import { normalizeText } from "../../utils/text";
import { safeString } from "../../utils/validation";
import { buildSuggestedActions } from "./commandCenterService";
import {
  DEFAULT_SEARCH_FILTERS,
  buildFilterOptions,
  filterSearchResults,
} from "./searchFilterService";
import { buildSearchIndex } from "./searchIndexService";

function scoreResult(result, query = "") {
  const normalizedQuery = normalizeText(safeString(query, 200));
  if (!normalizedQuery) return 1;

  if (normalizeText(result.title).includes(normalizedQuery)) return 5;
  if (normalizeText(result.subtitle).includes(normalizedQuery)) return 4;
  if (result.searchText.includes(normalizedQuery)) return 2;
  return 0;
}

function groupResults(results = []) {
  return results.reduce((groups, result) => {
    if (!groups[result.type]) groups[result.type] = [];
    groups[result.type].push(result);
    return groups;
  }, {});
}

function getMissingData(index = []) {
  const missing = [];

  if (index.length === 0) {
    missing.push("No searchable records are loaded.");
  }

  if (!index.some((item) => item.type === "conversation")) {
    missing.push("Conversation records are not loaded into the search index yet.");
  }

  if (!index.some((item) => item.type === "campaign")) {
    missing.push("Campaign records are local/manual unless added in the campaign panel.");
  }

  return missing;
}

export function runGlobalSearch({
  query = "",
  filters = DEFAULT_SEARCH_FILTERS,
  deals = [],
  campaigns = [],
} = {}) {
  const index = buildSearchIndex({ deals, campaigns });
  const normalizedQuery = normalizeText(query);
  const scored = index
    .map((result) => ({
      ...result,
      relevance: scoreResult(result, normalizedQuery),
    }))
    .filter((result) => !normalizedQuery || result.relevance > 0)
    .sort((left, right) => right.relevance - left.relevance);
  const results = filterSearchResults(scored, filters);
  const groupedResults = groupResults(results);
  const filterOptions = buildFilterOptions(index);

  return {
    results,
    groupedResults,
    filters: {
      active: {
        ...DEFAULT_SEARCH_FILTERS,
        ...filters,
      },
      options: filterOptions,
    },
    suggestedActions: buildSuggestedActions(results),
    missingData: getMissingData(index),
    summary:
      results.length === 0
        ? "No command center results match the current query and filters."
        : `${results.length} results found across ${Object.keys(groupedResults).length} groups.`,
    generatedAt: new Date().toISOString(),
  };
}
