const CODE_ENFORCEMENT_LIEN_SOURCE = "orange-county-code-enforcement-lien";
const CODE_ENFORCEMENT_LIEN_LAYER_URL =
  "https://services.arcgis.com/apTfC6SUmnNfnxuF/ArcGIS/rest/services/CodeEnforcementCasesMapService/FeatureServer/3/query";
const CODE_ENFORCEMENT_LIEN_MAX_PAGE_SIZE = 200;
const CODE_ENFORCEMENT_LIEN_TIMEOUT_MS = 10000;
const CODE_ENFORCEMENT_LIEN_FIELDS = [
  "ObjectID",
  "Permits_Pl",
  "CRM_SR_",
  "ADDRESS",
  "PARCEL_NO",
  "BALANCE",
];
const {
  enrichCandidatesWithOcpa,
} = require("./orange-county-property-appraiser.cjs");

function clean(value, maxLength = 240) {
  if (value === null || value === undefined) return "";
  const normalized = String(value).trim().replace(/\s+/g, " ");
  return /^(null|n\/a)$/i.test(normalized) ? "" : normalized.slice(0, maxLength);
}

function cleanBusinessIdentity(value, maxLength = 120) {
  const normalized = clean(value, maxLength);
  return normalized === "0" ? "" : normalized;
}

function positiveInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function reportedBalanceOrNull(value) {
  if (value === null || value === undefined) return null;
  const normalized = typeof value === "string" ? value.trim() : value;
  if (normalized === "") return null;
  const parsed = typeof normalized === "number" ? normalized : Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildExternalIdentity(caseId, identityField) {
  const normalized = cleanBusinessIdentity(caseId).toLowerCase();
  if (!normalized) return "";
  const namespace = identityField === "CRM_SR_" ? "crm" : "permit";
  return `${CODE_ENFORCEMENT_LIEN_SOURCE}:${namespace}:${normalized}`;
}

function normalizeCodeEnforcementLienFeature(feature, retrievedAt) {
  const attributes = feature?.attributes || {};
  const crmServiceRequestId = cleanBusinessIdentity(attributes.CRM_SR_);
  const permitsPlanningCaseId = cleanBusinessIdentity(attributes.Permits_Pl);
  const caseIdentityField = crmServiceRequestId
    ? "CRM_SR_"
    : permitsPlanningCaseId
      ? "Permits_Pl"
      : null;
  const lienCaseId = crmServiceRequestId || permitsPlanningCaseId;
  const rejectionReasons = [];

  if (!lienCaseId) rejectionReasons.push("missing stable lien identity");

  const candidate = {
    source: CODE_ENFORCEMENT_LIEN_SOURCE,
    externalId: buildExternalIdentity(lienCaseId, caseIdentityField),
    sourceCursor: positiveInteger(attributes.ObjectID, 0),
    lienCaseId,
    caseIdentityField,
    crmServiceRequestId: crmServiceRequestId || null,
    permitsPlanningCaseId: permitsPlanningCaseId || null,
    address: clean(attributes.ADDRESS) || null,
    parcelNumber: clean(attributes.PARCEL_NO, 80) || null,
    reportedLienBalance: reportedBalanceOrNull(attributes.BALANCE),
    retrievedAt,
    reviewState: "preview",
  };

  return rejectionReasons.length
    ? { accepted: false, candidate, rejectionReasons }
    : { accepted: true, candidate, rejectionReasons: [] };
}

function normalizeCodeEnforcementLienPage(features, retrievedAt) {
  const candidates = [];
  const rejected = [];
  const seen = new Set();

  for (const feature of features || []) {
    const normalized = normalizeCodeEnforcementLienFeature(feature, retrievedAt);
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

async function fetchOrangeCountyCodeEnforcementLienPage({
  cursor = 0,
  pageSize = 100,
  fetchImpl = fetch,
  parcelFetchImpl = fetchImpl,
  retrievedAt = new Date().toISOString(),
  timeoutMs = CODE_ENFORCEMENT_LIEN_TIMEOUT_MS,
} = {}) {
  const safeCursor = positiveInteger(cursor, 0);
  const safePageSize = Math.min(
    Math.max(1, positiveInteger(pageSize, 100)),
    CODE_ENFORCEMENT_LIEN_MAX_PAGE_SIZE
  );
  const params = new URLSearchParams({
    f: "json",
    where: `ObjectID > ${safeCursor}`,
    outFields: CODE_ENFORCEMENT_LIEN_FIELDS.join(","),
    returnGeometry: "false",
    orderByFields: "ObjectID ASC",
    resultRecordCount: String(safePageSize),
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${CODE_ENFORCEMENT_LIEN_LAYER_URL}?${params}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body || body.error || !Array.isArray(body.features)) {
      const error = new Error("Orange County Active Code Enforcement Liens are unavailable.");
      error.status = response.status || 502;
      throw error;
    }

    const { candidates, rejected } = normalizeCodeEnforcementLienPage(
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
      const error = new Error("Orange County lien pagination did not advance safely.");
      error.status = 502;
      throw error;
    }

    return {
      status: "available",
      source: CODE_ENFORCEMENT_LIEN_SOURCE,
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
      const timeoutError = new Error("Orange County Active Code Enforcement Liens request timed out.");
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  CODE_ENFORCEMENT_LIEN_FIELDS,
  CODE_ENFORCEMENT_LIEN_LAYER_URL,
  CODE_ENFORCEMENT_LIEN_MAX_PAGE_SIZE,
  CODE_ENFORCEMENT_LIEN_SOURCE,
  buildExternalIdentity,
  fetchOrangeCountyCodeEnforcementLienPage,
  normalizeCodeEnforcementLienFeature,
  normalizeCodeEnforcementLienPage,
  reportedBalanceOrNull,
};
