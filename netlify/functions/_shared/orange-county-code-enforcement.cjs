const CODE_ENFORCEMENT_SOURCE = "orange-county-code-enforcement";
const CODE_ENFORCEMENT_LAYER_URL =
  "https://services.arcgis.com/apTfC6SUmnNfnxuF/ArcGIS/rest/services/CodeEnforcementCasesMapService/FeatureServer/0/query";
const CODE_ENFORCEMENT_MAX_PAGE_SIZE = 200;
const CODE_ENFORCEMENT_TIMEOUT_MS = 10000;
const CODE_ENFORCEMENT_FIELDS = [
  "ObjectID",
  "CRM_SR_",
  "ADDRESS",
  "ZIP_CODE",
  "PARCEL_NO_NO",
  "DUE_DATE",
  "STATUS",
  "Permits_Pl",
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

function buildExternalIdentity(caseId) {
  const normalized = clean(caseId).toLowerCase();
  return normalized ? `${CODE_ENFORCEMENT_SOURCE}:${normalized}` : "";
}

function normalizeCodeEnforcementFeature(feature, retrievedAt) {
  const attributes = feature?.attributes || {};
  const crmServiceRequestId = clean(attributes.CRM_SR_, 120);
  const permitsPlanningCaseId = clean(attributes.Permits_Pl, 120);
  const codeEnforcementCaseId = crmServiceRequestId || permitsPlanningCaseId;
  const rejectionReasons = [];

  if (!codeEnforcementCaseId) rejectionReasons.push("missing stable case identity");

  const candidate = {
    source: CODE_ENFORCEMENT_SOURCE,
    externalId: buildExternalIdentity(codeEnforcementCaseId),
    sourceRecordId: positiveInteger(attributes.ObjectID, 0),
    codeEnforcementCaseId,
    caseIdentityField: crmServiceRequestId ? "CRM_SR_" : permitsPlanningCaseId ? "Permits_Pl" : null,
    crmServiceRequestId: crmServiceRequestId || null,
    permitsPlanningCaseId: permitsPlanningCaseId || null,
    address: clean(attributes.ADDRESS, 240) || null,
    zipCode: clean(attributes.ZIP_CODE, 20) || null,
    parcelNumber: clean(attributes.PARCEL_NO_NO, 80) || null,
    dueDate: clean(attributes.DUE_DATE, 80) || null,
    caseStatus: clean(attributes.STATUS, 120) || null,
    retrievedAt,
    reviewState: "preview",
  };

  return rejectionReasons.length
    ? { accepted: false, candidate, rejectionReasons }
    : { accepted: true, candidate, rejectionReasons: [] };
}

function normalizeCodeEnforcementPage(features, retrievedAt) {
  const candidates = [];
  const rejected = [];
  const seen = new Set();

  for (const feature of features || []) {
    const normalized = normalizeCodeEnforcementFeature(feature, retrievedAt);
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

async function fetchOrangeCountyCodeEnforcementPage({
  cursor = 0,
  pageSize = 100,
  fetchImpl = fetch,
  parcelFetchImpl = fetchImpl,
  retrievedAt = new Date().toISOString(),
  timeoutMs = CODE_ENFORCEMENT_TIMEOUT_MS,
} = {}) {
  const safeCursor = positiveInteger(cursor, 0);
  const safePageSize = Math.min(
    Math.max(1, positiveInteger(pageSize, 100)),
    CODE_ENFORCEMENT_MAX_PAGE_SIZE
  );
  const params = new URLSearchParams({
    f: "json",
    where: `ObjectID > ${safeCursor}`,
    outFields: CODE_ENFORCEMENT_FIELDS.join(","),
    returnGeometry: "false",
    orderByFields: "ObjectID ASC",
    resultRecordCount: String(safePageSize),
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${CODE_ENFORCEMENT_LAYER_URL}?${params}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body || body.error || !Array.isArray(body.features)) {
      const error = new Error("Orange County Active Code Enforcement data is unavailable.");
      error.status = response.status || 502;
      throw error;
    }

    const { candidates, rejected } = normalizeCodeEnforcementPage(body.features, retrievedAt);
    const enrichedCandidates = await enrichCandidatesWithOcpa(candidates, {
      fetchImpl: parcelFetchImpl,
      retrievedAt,
      timeoutMs,
    });
    const lastSourceRecordId = body.features.reduce(
      (highest, feature) =>
        Math.max(highest, positiveInteger(feature?.attributes?.ObjectID, highest)),
      safeCursor
    );
    const hasMore =
      body.exceededTransferLimit === true || body.features.length === safePageSize;

    return {
      status: "available",
      source: CODE_ENFORCEMENT_SOURCE,
      candidates: enrichedCandidates,
      rejected,
      retrievedAt,
      page: {
        cursor: safeCursor,
        nextCursor: hasMore ? lastSourceRecordId : null,
        pageSize: safePageSize,
        sourceRowCount: body.features.length,
        hasMore,
      },
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("Orange County Active Code Enforcement request timed out.");
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  CODE_ENFORCEMENT_FIELDS,
  CODE_ENFORCEMENT_LAYER_URL,
  CODE_ENFORCEMENT_MAX_PAGE_SIZE,
  CODE_ENFORCEMENT_SOURCE,
  buildExternalIdentity,
  fetchOrangeCountyCodeEnforcementPage,
  normalizeCodeEnforcementFeature,
  normalizeCodeEnforcementPage,
};
