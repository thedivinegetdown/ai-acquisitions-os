const CONDEMNATION_SOURCE = "orange-county-condemnation";
const CONDEMNATION_LAYER_URL =
  "https://services.arcgis.com/apTfC6SUmnNfnxuF/ArcGIS/rest/services/CodeEnforcementCasesMapService/FeatureServer/1/query";
const CONDEMNATION_MAX_PAGE_SIZE = 200;
const CONDEMNATION_TIMEOUT_MS = 10000;
const CONDEMNATION_FIELDS = [
  "ObjectID",
  "CASE_",
  "DATA_STATUS",
  "FOLIO",
  "ADDRESS",
];
const {
  enrichCandidatesWithOcpa,
} = require("./orange-county-property-appraiser.cjs");

function clean(value, maxLength = 240) {
  if (value === null || value === undefined) return "";
  const normalized = String(value).trim().replace(/\s+/g, " ");
  return /^(null|n\/a)$/i.test(normalized) ? "" : normalized.slice(0, maxLength);
}

function positiveInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function folioOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : null;
}

function buildExternalIdentity(caseId) {
  const normalized = clean(caseId, 120).toLowerCase();
  return normalized ? `${CONDEMNATION_SOURCE}:${normalized}` : "";
}

function normalizeCondemnationFeature(feature, retrievedAt) {
  const attributes = feature?.attributes || {};
  const condemnationCaseId = clean(attributes.CASE_, 120);
  const folioNumber = folioOrNull(attributes.FOLIO);
  const rejectionReasons = [];

  if (!condemnationCaseId) rejectionReasons.push("missing stable condemnation identity");

  const candidate = {
    source: CONDEMNATION_SOURCE,
    externalId: buildExternalIdentity(condemnationCaseId),
    sourceCursor: positiveInteger(attributes.ObjectID, 0),
    condemnationCaseId,
    caseIdentityField: "CASE_",
    folioNumber,
    parcelNumber: folioNumber,
    address: clean(attributes.ADDRESS, 240) || null,
    condemnationStatus: clean(attributes.DATA_STATUS, 120) || null,
    retrievedAt,
    reviewState: "preview",
  };

  return rejectionReasons.length
    ? { accepted: false, candidate, rejectionReasons }
    : { accepted: true, candidate, rejectionReasons: [] };
}

function normalizeCondemnationPage(features, retrievedAt) {
  const candidates = [];
  const rejected = [];
  const seen = new Set();

  for (const feature of features || []) {
    const normalized = normalizeCondemnationFeature(feature, retrievedAt);
    if (!normalized.accepted) {
      rejected.push(normalized);
      continue;
    }
    if (seen.has(normalized.candidate.externalId)) {
      rejected.push({
        ...normalized,
        accepted: false,
        rejectionReasons: ["duplicate external identity"],
      });
      continue;
    }
    seen.add(normalized.candidate.externalId);
    candidates.push(normalized.candidate);
  }

  return { candidates, rejected };
}

async function fetchOrangeCountyCondemnationPage({
  cursor = 0,
  pageSize = 100,
  fetchImpl = fetch,
  parcelFetchImpl = fetchImpl,
  retrievedAt = new Date().toISOString(),
  timeoutMs = CONDEMNATION_TIMEOUT_MS,
} = {}) {
  const safeCursor = positiveInteger(cursor, 0);
  const safePageSize = Math.min(
    Math.max(1, positiveInteger(pageSize, 100)),
    CONDEMNATION_MAX_PAGE_SIZE
  );
  const params = new URLSearchParams({
    f: "json",
    where: `ObjectID > ${safeCursor}`,
    outFields: CONDEMNATION_FIELDS.join(","),
    returnGeometry: "false",
    orderByFields: "ObjectID ASC",
    resultRecordCount: String(safePageSize),
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${CONDEMNATION_LAYER_URL}?${params}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body || body.error || !Array.isArray(body.features)) {
      const error = new Error("Orange County Active Condemnations are unavailable.");
      error.status = response.status || 502;
      throw error;
    }

    const { candidates, rejected } = normalizeCondemnationPage(
      body.features,
      retrievedAt
    );
    const enrichedCandidates = await enrichCandidatesWithOcpa(candidates, {
      fetchImpl: parcelFetchImpl,
      retrievedAt,
      timeoutMs,
    });
    const lastSourceCursor = body.features.reduce(
      (highest, feature) =>
        Math.max(highest, positiveInteger(feature?.attributes?.ObjectID, highest)),
      safeCursor
    );
    const hasMore =
      body.features.length > 0 &&
      (body.exceededTransferLimit === true || body.features.length === safePageSize);

    if (hasMore && lastSourceCursor <= safeCursor) {
      const error = new Error("Orange County condemnation pagination did not advance safely.");
      error.status = 502;
      throw error;
    }

    return {
      status: "available",
      source: CONDEMNATION_SOURCE,
      candidates: enrichedCandidates,
      rejected,
      retrievedAt,
      page: {
        cursor: safeCursor,
        nextCursor: hasMore ? lastSourceCursor : null,
        pageSize: safePageSize,
        sourceRowCount: body.features.length,
        hasMore,
      },
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("Orange County Active Condemnations request timed out.");
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  CONDEMNATION_FIELDS,
  CONDEMNATION_LAYER_URL,
  CONDEMNATION_MAX_PAGE_SIZE,
  CONDEMNATION_SOURCE,
  buildExternalIdentity,
  fetchOrangeCountyCondemnationPage,
  folioOrNull,
  normalizeCondemnationFeature,
  normalizeCondemnationPage,
};
