const CONDEMNATION_SOURCE = "orange-county-condemnation";
const CONDEMNATION_MAX_PAGE_SIZE = 200;
const CONDEMNATION_UNAVAILABLE_REASON =
  "UNAVAILABLE: no authoritative Orange County structured condemnation source has been proven.";
const CONDEMNATION_FIELDS = [
  "ObjectID",
  "CASE_",
  "DATA_STATUS",
  "FOLIO",
  "ADDRESS",
];
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

async function fetchOrangeCountyCondemnationPage() {
  const error = new Error(CONDEMNATION_UNAVAILABLE_REASON);
  error.status = 503;
  throw error;
}

module.exports = {
  CONDEMNATION_FIELDS,
  CONDEMNATION_MAX_PAGE_SIZE,
  CONDEMNATION_SOURCE,
  CONDEMNATION_UNAVAILABLE_REASON,
  buildExternalIdentity,
  fetchOrangeCountyCondemnationPage,
  folioOrNull,
  normalizeCondemnationFeature,
  normalizeCondemnationPage,
};
