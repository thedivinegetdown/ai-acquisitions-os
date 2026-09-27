const CODE_ENFORCEMENT_LIEN_SOURCE = "orange-county-code-enforcement-lien";
const CODE_ENFORCEMENT_LIEN_MAX_PAGE_SIZE = 200;
const CODE_ENFORCEMENT_LIEN_UNAVAILABLE_REASON =
  "UNAVAILABLE: no authoritative Orange County structured Code Enforcement lien source has been proven.";
const CODE_ENFORCEMENT_LIEN_FIELDS = [
  "ObjectID",
  "Permits_Pl",
  "CRM_SR_",
  "ADDRESS",
  "PARCEL_NO",
  "BALANCE",
];
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

async function fetchOrangeCountyCodeEnforcementLienPage() {
  const error = new Error(CODE_ENFORCEMENT_LIEN_UNAVAILABLE_REASON);
  error.status = 503;
  throw error;
}

module.exports = {
  CODE_ENFORCEMENT_LIEN_FIELDS,
  CODE_ENFORCEMENT_LIEN_MAX_PAGE_SIZE,
  CODE_ENFORCEMENT_LIEN_SOURCE,
  CODE_ENFORCEMENT_LIEN_UNAVAILABLE_REASON,
  buildExternalIdentity,
  fetchOrangeCountyCodeEnforcementLienPage,
  normalizeCodeEnforcementLienFeature,
  normalizeCodeEnforcementLienPage,
  reportedBalanceOrNull,
};
