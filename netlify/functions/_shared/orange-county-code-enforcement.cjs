const CODE_ENFORCEMENT_SOURCE = "orange-county-code-enforcement";
const CODE_ENFORCEMENT_SOURCE_URL =
  "https://apps.ocfl.net/dept/cesrvcs/codeenforcement/ActiveCodeEnforcementCases.xls";
const CODE_ENFORCEMENT_JURISDICTION_EVIDENCE_URL =
  "https://www.orangecountyfl.net/Portals/0/Library/Neighbors-Housing/docs/Title%20Company%20FTP%5B1%5D.pdf";
const CODE_ENFORCEMENT_JURISDICTION = Object.freeze({
  county: "Orange County",
  state: "Florida",
  country: "US",
  evidenceUrl: CODE_ENFORCEMENT_JURISDICTION_EVIDENCE_URL,
});
const CODE_ENFORCEMENT_MAX_PAGE_SIZE = 200;
const CODE_ENFORCEMENT_TIMEOUT_MS = 10000;
const CODE_ENFORCEMENT_FIELDS = [
  "Incident ID",
  "Parcel ID",
  "Incident Address",
  "Incident Type",
  "Incident Status",
  "Violation Recorded Date",
];
const XLSX = require("@e965/xlsx");
const {
  enrichCandidatesWithOcpa,
} = require("./orange-county-property-appraiser.cjs");

function clean(value, maxLength = 240) {
  if (value === null || value === undefined) return "";
  const normalized = String(value).trim().replace(/\s+/g, " ");
  return /^(null|n\/a)$/i.test(normalized) ? "" : normalized.slice(0, maxLength);
}

function positiveInteger(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function buildExternalIdentity(caseId) {
  const normalized = clean(caseId).toLowerCase();
  return normalized ? `${CODE_ENFORCEMENT_SOURCE}:${normalized}` : "";
}

function normalizeCodeEnforcementFeature(feature, retrievedAt) {
  const attributes = feature?.attributes || {};
  const incidentId = clean(attributes.Incident_ID, 120);
  const crmServiceRequestId = clean(attributes.CRM_SR_, 120);
  const permitsPlanningCaseId = clean(attributes.Permits_Pl, 120);
  const codeEnforcementCaseId = incidentId || crmServiceRequestId || permitsPlanningCaseId;
  const rejectionReasons = [];

  if (!codeEnforcementCaseId) rejectionReasons.push("missing stable case identity");

  const candidate = {
    source: CODE_ENFORCEMENT_SOURCE,
    externalId: buildExternalIdentity(codeEnforcementCaseId),
    sourceRecordId: positiveInteger(attributes.Incident_ID ?? attributes.ObjectID, 0),
    codeEnforcementCaseId,
    caseIdentityField: incidentId
      ? "Incident ID"
      : crmServiceRequestId
        ? "CRM_SR_"
        : permitsPlanningCaseId
          ? "Permits_Pl"
          : null,
    incidentId: incidentId || null,
    crmServiceRequestId: crmServiceRequestId || null,
    permitsPlanningCaseId: permitsPlanningCaseId || null,
    address: clean(attributes.Incident_Address ?? attributes.ADDRESS, 240) || null,
    zipCode: clean(attributes.ZIP_CODE, 20) || null,
    parcelNumber: clean(attributes.Parcel_ID ?? attributes.PARCEL_NO_NO, 80) || null,
    dueDate: clean(attributes.DUE_DATE, 80) || null,
    caseStatus: clean(attributes.Incident_Status ?? attributes.STATUS, 120) || null,
    violationType: clean(attributes.Incident_Type, 120) || null,
    violationRecordedDate: clean(attributes.Violation_Recorded_Date, 80) || null,
    sourceUrl: incidentId ? CODE_ENFORCEMENT_SOURCE_URL : null,
    sourceJurisdiction: incidentId ? CODE_ENFORCEMENT_JURISDICTION : null,
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

function parseOfficialCodeEnforcementWorkbook(arrayBuffer) {
  let workbook;
  try {
    workbook = XLSX.read(Buffer.from(arrayBuffer), { type: "buffer" });
  } catch {
    const error = new Error("Orange County Active Code Enforcement data is unavailable.");
    error.status = 502;
    throw error;
  }

  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = worksheet
    ? XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        raw: false,
        blankrows: false,
      })
    : [];
  const primaryFields = CODE_ENFORCEMENT_FIELDS.filter(
    (field) => field !== "Violation Recorded Date"
  );
  const headerRowIndex = rows.findIndex((row) =>
    primaryFields.every((field) => row.includes(field))
  );
  if (headerRowIndex < 0) {
    const error = new Error("Orange County Active Code Enforcement data is unavailable.");
    error.status = 502;
    throw error;
  }

  const header = rows[headerRowIndex];
  const precedingHeader = rows[headerRowIndex - 1] || [];
  const columnByField = new Map(
    CODE_ENFORCEMENT_FIELDS.map((field) => {
      const primaryIndex = header.indexOf(field);
      return [field, primaryIndex >= 0 ? primaryIndex : precedingHeader.indexOf(field)];
    })
  );
  if ([...columnByField.values()].some((index) => index < 0)) {
    const error = new Error("Orange County Active Code Enforcement data is unavailable.");
    error.status = 502;
    throw error;
  }
  const value = (row, field) => row[columnByField.get(field)] ?? "";

  return rows
    .slice(headerRowIndex + 1)
    .map((row) => ({
      incidentId: positiveInteger(value(row, "Incident ID"), 0),
      parcelId: clean(value(row, "Parcel ID"), 80),
      address: clean(value(row, "Incident Address"), 240),
      incidentType: clean(value(row, "Incident Type"), 120),
      incidentStatus: clean(value(row, "Incident Status"), 120),
      violationRecordedDate: clean(value(row, "Violation Recorded Date"), 80),
    }))
    .filter((row) => row.incidentId > 0)
    .sort((left, right) => left.incidentId - right.incidentId);
}

function officialRecordToFeature(record) {
  return {
    attributes: {
      Incident_ID: String(record.incidentId),
      Parcel_ID: record.parcelId,
      Incident_Address: record.address,
      Incident_Type: record.incidentType,
      Incident_Status: record.incidentStatus,
      Violation_Recorded_Date: record.violationRecordedDate,
    },
  };
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(CODE_ENFORCEMENT_SOURCE_URL, {
      method: "GET",
      headers: { Accept: "application/vnd.ms-excel" },
      signal: controller.signal,
    });
    if (!response.ok || typeof response.arrayBuffer !== "function") {
      const error = new Error("Orange County Active Code Enforcement data is unavailable.");
      error.status = response.status || 502;
      throw error;
    }

    const records = parseOfficialCodeEnforcementWorkbook(await response.arrayBuffer());
    const eligibleRecords = records.filter((record) => record.incidentId > safeCursor);
    const pageRecords = eligibleRecords.slice(0, safePageSize);
    const { candidates, rejected } = normalizeCodeEnforcementPage(
      pageRecords.map(officialRecordToFeature),
      retrievedAt
    );
    const enrichedCandidates = await enrichCandidatesWithOcpa(candidates, {
      fetchImpl: parcelFetchImpl,
      retrievedAt,
      timeoutMs,
    });
    const lastSourceRecordId = pageRecords.at(-1)?.incidentId || safeCursor;
    const hasMore = eligibleRecords.length > pageRecords.length;

    return {
      status: "available",
      source: CODE_ENFORCEMENT_SOURCE,
      sourceUrl: CODE_ENFORCEMENT_SOURCE_URL,
      jurisdiction: CODE_ENFORCEMENT_JURISDICTION,
      candidates: enrichedCandidates,
      rejected,
      retrievedAt,
      page: {
        cursor: safeCursor,
        nextCursor: hasMore ? lastSourceRecordId : null,
        pageSize: safePageSize,
        sourceRowCount: pageRecords.length,
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
  CODE_ENFORCEMENT_JURISDICTION,
  CODE_ENFORCEMENT_JURISDICTION_EVIDENCE_URL,
  CODE_ENFORCEMENT_MAX_PAGE_SIZE,
  CODE_ENFORCEMENT_SOURCE,
  CODE_ENFORCEMENT_SOURCE_URL,
  buildExternalIdentity,
  fetchOrangeCountyCodeEnforcementPage,
  normalizeCodeEnforcementFeature,
  normalizeCodeEnforcementPage,
  officialRecordToFeature,
  parseOfficialCodeEnforcementWorkbook,
};
