const WATER_CASE_SOURCE = "orange-county-water-case";
const WATER_CASE_MAX_PAGE_SIZE = 200;
const WATER_CASE_UNAVAILABLE_REASON =
  "UNAVAILABLE: no authoritative Orange County structured water-case source has been proven.";
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

async function fetchOrangeCountyWaterCasePage() {
  const error = new Error(WATER_CASE_UNAVAILABLE_REASON);
  error.status = 503;
  throw error;
}

module.exports = {
  WATER_CASE_FIELDS,
  WATER_CASE_MAX_PAGE_SIZE,
  WATER_CASE_SOURCE,
  WATER_CASE_UNAVAILABLE_REASON,
  buildExternalIdentity,
  fetchOrangeCountyWaterCasePage,
  normalizeWaterCaseFeature,
  normalizeWaterCasePage,
};
