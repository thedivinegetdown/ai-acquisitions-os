const WATER_CASE_SOURCE = "orange-county-water-case";
const WATER_CASE_LAYER_URL =
  "https://services.arcgis.com/apTfC6SUmnNfnxuF/ArcGIS/rest/services/CodeEnforcementCasesMapService/FeatureServer/2/query";
const WATER_CASE_MAX_PAGE_SIZE = 200;
const WATER_CASE_TIMEOUT_MS = 10000;
const WATER_CASE_FIELDS = [
  "ObjectID",
  "Permits_Pl",
  "CRM_SR",
  "ADDRESS",
  "ZIP_CODE",
  "PARCEL_NO_NO",
  "DUE_DATE",
  "STATUS",
];
const {
  enrichCandidatesWithOcpa,
} = require("./orange-county-property-appraiser.cjs");

function clean(value, maxLength = 240) {
  if (value === null || value === undefined) return "";
  const normalized = String(value).trim().replace(/\s+/g, " ");
  return /^(null|n\s*\/?\s*a|none|unknown|-|0)$/i.test(normalized)
    ? ""
    : normalized.slice(0, maxLength);
}

function positiveInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function buildExternalIdentity(crmReference) {
  const normalized = clean(crmReference, 120).toLowerCase();
  return normalized ? `${WATER_CASE_SOURCE}:${normalized}` : "";
}

function normalizeWaterCaseFeature(feature, retrievedAt) {
  const attributes = feature?.attributes || {};
  const crmReference = clean(attributes.CRM_SR, 120);
  const permitReference = clean(attributes.Permits_Pl, 120);
  const rejectionReasons = [];

  if (!crmReference) rejectionReasons.push("missing stable CRM water-case identity");

  const candidate = {
    source: WATER_CASE_SOURCE,
    externalId: buildExternalIdentity(crmReference),
    sourceCursor: positiveInteger(attributes.ObjectID, 0),
    caseIdentityField: crmReference ? "CRM_SR" : null,
    crmReference: crmReference || null,
    permitReference: permitReference || null,
    address: clean(attributes.ADDRESS) || null,
    zip: clean(attributes.ZIP_CODE, 20) || null,
    parcelNumber: clean(attributes.PARCEL_NO_NO, 80) || null,
    dueDate: clean(attributes.DUE_DATE, 120) || null,
    status: clean(attributes.STATUS, 120) || null,
    retrievedAt,
    reviewState: "preview",
  };

  return rejectionReasons.length
    ? { accepted: false, candidate, rejectionReasons }
    : { accepted: true, candidate, rejectionReasons: [] };
}

function normalizeWaterCasePage(features, retrievedAt) {
  const candidates = [];
  const rejected = [];
  const seen = new Set();

  for (const feature of features || []) {
    const normalized = normalizeWaterCaseFeature(feature, retrievedAt);
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

async function fetchOrangeCountyWaterCasePage({
  cursor = 0,
  pageSize = 100,
  fetchImpl = fetch,
  parcelFetchImpl = fetchImpl,
  retrievedAt = new Date().toISOString(),
  timeoutMs = WATER_CASE_TIMEOUT_MS,
} = {}) {
  const safeCursor = positiveInteger(cursor, 0);
  const safePageSize = Math.min(
    Math.max(1, positiveInteger(pageSize, 100)),
    WATER_CASE_MAX_PAGE_SIZE
  );
  const params = new URLSearchParams({
    f: "json",
    where: `ObjectID > ${safeCursor}`,
    outFields: WATER_CASE_FIELDS.join(","),
    returnGeometry: "false",
    orderByFields: "ObjectID ASC",
    resultRecordCount: String(safePageSize),
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${WATER_CASE_LAYER_URL}?${params}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body || body.error || !Array.isArray(body.features)) {
      const error = new Error("Orange County Active Water Cases are unavailable.");
      error.status = response.status || 502;
      throw error;
    }

    const { candidates, rejected } = normalizeWaterCasePage(body.features, retrievedAt);
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
      const error = new Error("Orange County water-case pagination did not advance safely.");
      error.status = 502;
      throw error;
    }

    return {
      status: "available",
      source: WATER_CASE_SOURCE,
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
      const timeoutError = new Error("Orange County Active Water Cases request timed out.");
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  WATER_CASE_FIELDS,
  WATER_CASE_LAYER_URL,
  WATER_CASE_MAX_PAGE_SIZE,
  WATER_CASE_SOURCE,
  buildExternalIdentity,
  fetchOrangeCountyWaterCasePage,
  normalizeWaterCaseFeature,
  normalizeWaterCasePage,
};
