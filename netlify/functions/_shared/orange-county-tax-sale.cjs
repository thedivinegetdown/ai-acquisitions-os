const TAX_SALE_SOURCE = "orange-county-tax-sale";
const TAX_SALE_LAYER_URL =
  "https://services1.arcgis.com/0U8EQ1FrumPeIqDb/ArcGIS/rest/services/Tax_Sale_Data/FeatureServer/0/query";
const TAX_SALE_MAX_PAGE_SIZE = 200;
const TAX_SALE_TIMEOUT_MS = 10000;
const TAX_SALE_FIELDS = [
  "ObjectID",
  "USER_TDA_NUM",
  "USER_Sale_Date",
  "USER_Deed_Status",
  "USER_PARCEL",
];
const {
  enrichTaxSaleCandidatesWithOcpa,
} = require("./orange-county-property-appraiser.cjs");

function clean(value, maxLength = 240) {
  if (value === null || value === undefined) return "";
  return String(value).trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function positiveInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function buildExternalIdentity(tdaNumber) {
  const normalized = clean(tdaNumber).toLowerCase();
  return normalized ? `${TAX_SALE_SOURCE}:${normalized}` : "";
}

function normalizeTaxSaleFeature(feature, retrievedAt) {
  const attributes = feature?.attributes || {};
  const sourceRecordId = positiveInteger(attributes.ObjectID, 0);
  const externalTaxDeedNumber = clean(attributes.USER_TDA_NUM);
  const parcelNumber = clean(attributes.USER_PARCEL);
  const rejectionReasons = [];

  if (!externalTaxDeedNumber) rejectionReasons.push("missing TDA identity");
  if (!parcelNumber) rejectionReasons.push("missing parcel identity");

  const candidate = {
    source: TAX_SALE_SOURCE,
    externalId: buildExternalIdentity(externalTaxDeedNumber),
    supportingIdentity: parcelNumber
      ? `${TAX_SALE_SOURCE}:parcel:${parcelNumber.toLowerCase()}`
      : "",
    sourceRecordId,
    externalTaxDeedNumber,
    parcelNumber,
    saleDate: clean(attributes.USER_Sale_Date, 80) || null,
    deedStatus: clean(attributes.USER_Deed_Status, 120) || null,
    retrievedAt,
    reviewState: "preview",
  };

  return rejectionReasons.length
    ? { accepted: false, candidate, rejectionReasons }
    : { accepted: true, candidate, rejectionReasons: [] };
}

function normalizeTaxSalePage(features, retrievedAt) {
  const candidates = [];
  const rejected = [];
  const seen = new Set();

  for (const feature of features || []) {
    const normalized = normalizeTaxSaleFeature(feature, retrievedAt);
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

async function fetchOrangeCountyTaxSalePage({
  cursor = 0,
  pageSize = 100,
  fetchImpl = fetch,
  parcelFetchImpl = fetchImpl,
  retrievedAt = new Date().toISOString(),
  timeoutMs = TAX_SALE_TIMEOUT_MS,
} = {}) {
  const safeCursor = positiveInteger(cursor, 0);
  const safePageSize = Math.min(
    Math.max(1, positiveInteger(pageSize, 100)),
    TAX_SALE_MAX_PAGE_SIZE
  );
  const params = new URLSearchParams({
    f: "json",
    where: `ObjectID > ${safeCursor}`,
    outFields: TAX_SALE_FIELDS.join(","),
    returnGeometry: "false",
    orderByFields: "ObjectID ASC",
    resultRecordCount: String(safePageSize),
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${TAX_SALE_LAYER_URL}?${params}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body || body.error || !Array.isArray(body.features)) {
      const error = new Error("Orange County Tax Sale Data is unavailable.");
      error.status = response.status || 502;
      throw error;
    }

    const { candidates, rejected } = normalizeTaxSalePage(body.features, retrievedAt);
    const enrichedCandidates = await enrichTaxSaleCandidatesWithOcpa(candidates, {
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
      source: TAX_SALE_SOURCE,
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
      const timeoutError = new Error("Orange County Tax Sale Data request timed out.");
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  TAX_SALE_FIELDS,
  TAX_SALE_LAYER_URL,
  TAX_SALE_MAX_PAGE_SIZE,
  TAX_SALE_SOURCE,
  buildExternalIdentity,
  fetchOrangeCountyTaxSalePage,
  normalizeTaxSaleFeature,
  normalizeTaxSalePage,
};
