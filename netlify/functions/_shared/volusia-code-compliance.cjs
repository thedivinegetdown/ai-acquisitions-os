const {
  VOLUSIA_PARCEL_OWNERSHIP_FIELDS,
  VOLUSIA_PARCEL_OWNERSHIP_LAYER_URL,
  normalizeVolusiaParcelFeature,
} = require("./volusia-parcel-ownership.cjs");

const VOLUSIA_CODE_COMPLIANCE_SOURCE = "volusia-code-compliance";
const VOLUSIA_CONNECTLIVE_BASE_URL =
  "https://connectlivepermits.org/citizenportal/rest";
const VOLUSIA_CONNECTLIVE_APP_URL =
  "https://connectlivepermits.org/citizenportal/app/";
const VOLUSIA_CONNECTLIVE_PUBLIC_TOKEN_URL =
  `${VOLUSIA_CONNECTLIVE_BASE_URL}/securityservice/publicAccessToken/`;
const VOLUSIA_CONNECTLIVE_PAGE_CONFIGURATION_URL =
  `${VOLUSIA_CONNECTLIVE_BASE_URL}/configurationservices/pageConfiguration/`;
const VOLUSIA_CONNECTLIVE_TRANSACTION_URL =
  `${VOLUSIA_CONNECTLIVE_BASE_URL}/amandaservice/executeCustomTransaction/`;
const VOLUSIA_CODE_COMPLIANCE_DEFAULT_WINDOW_DAYS = 30;
const VOLUSIA_CODE_COMPLIANCE_MAX_WINDOW_DAYS = 30;
const VOLUSIA_CODE_COMPLIANCE_MAX_RESULTS = 250;
const VOLUSIA_CODE_COMPLIANCE_TIMEOUT_MS = 20000;

const REQUIRED_COLUMNS = Object.freeze([
  "File Number",
  "FolderRSN",
  "Type",
  "Date",
  "Description",
  "Name",
  "Status",
  "Property",
  "Actions",
  "_id",
]);

function clean(value, maxLength = 240) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeFileNumber(value) {
  const normalized = clean(value, 40).toUpperCase().replace(/\s+/g, "");
  return /^[A-Z0-9-]+$/.test(normalized) ? normalized : null;
}

function buildExternalIdentity(fileNumber) {
  const normalized = normalizeFileNumber(fileNumber);
  return normalized
    ? `${VOLUSIA_CODE_COMPLIANCE_SOURCE}:${normalized.toLowerCase()}`
    : "";
}

function normalizeFolderRsn(value) {
  const normalized = clean(value, 30);
  return /^\d+$/.test(normalized) ? normalized : null;
}

function normalizePropertyPid(value) {
  const normalized = clean(value, 20);
  return /^\d{12}$/.test(normalized) ? normalized : null;
}

function normalizeIsoDate(value) {
  const normalized = clean(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized
    ? null
    : normalized;
}

function normalizeSourceAddress(value) {
  const normalized = clean(value, 180);
  if (!/^\d{1,6}\s+/i.test(normalized)) return null;
  const streetSuffix =
    /\b(?:ALY|ALLEY|AVE|AVENUE|BLVD|BOULEVARD|CIR|CIRCLE|CT|COURT|DR|DRIVE|HWY|HIGHWAY|LN|LANE|PKWY|PARKWAY|PL|PLACE|RD|ROAD|ST|STREET|TER|TERRACE|TRL|TRAIL|WAY)\b/i;
  return streetSuffix.test(normalized) ? normalized : null;
}

function windowDates({ windowDays, asOfDate }) {
  const days = Number(windowDays);
  if (
    !Number.isInteger(days) ||
    days < 1 ||
    days > VOLUSIA_CODE_COMPLIANCE_MAX_WINDOW_DAYS
  ) {
    const error = new Error(
      `Window days must be 1-${VOLUSIA_CODE_COMPLIANCE_MAX_WINDOW_DAYS}.`
    );
    error.status = 400;
    throw error;
  }

  const end = new Date(asOfDate);
  if (Number.isNaN(end.getTime())) {
    const error = new Error("A valid as-of date is required.");
    error.status = 400;
    throw error;
  }
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    windowDays: days,
  };
}

function responseHeader(response, name) {
  return clean(response?.headers?.get?.(name), 8192);
}

function extractSessionCookie(response) {
  const setCookie = responseHeader(response, "set-cookie");
  const match = setCookie.match(/^([^=;,\s]+=[^;,\s]+)/);
  return match?.[1] || "";
}

function requirePublicToken(value) {
  const token = clean(value, 8192);
  if (!token || token.length > 4096) {
    throw new Error("ConnectLive did not issue a valid anonymous session token.");
  }
  return token;
}

async function openAnonymousSession({ fetchImpl, signal }) {
  const response = await fetchImpl(VOLUSIA_CONNECTLIVE_APP_URL, {
    method: "GET",
    headers: { Accept: "text/html" },
    redirect: "error",
    signal,
  });
  await response.text();
  if (!response.ok) {
    throw new Error("ConnectLive anonymous session is unavailable.");
  }
  const cookie = extractSessionCookie(response);
  if (!cookie) {
    throw new Error("ConnectLive did not issue an anonymous session cookie.");
  }
  return cookie;
}

async function readJsonResponse(response, unavailableMessage) {
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${unavailableMessage} Response was not valid JSON.`);
  }
  if (!response.ok || body === null || body?.errorMessage || body?.error) {
    const error = new Error(unavailableMessage);
    error.status = response.status || 502;
    throw error;
  }
  return body;
}

async function postConnectLiveJson({
  fetchImpl,
  url,
  body,
  token = "",
  cookie = "",
  signal,
  unavailableMessage,
}) {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "Content-Language": "en",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;

  const response = await fetchImpl(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    redirect: "error",
    signal,
  });
  return {
    body: await readJsonResponse(response, unavailableMessage),
    token: responseHeader(response, "x-auth-token") || token,
    cookie: extractSessionCookie(response) || cookie,
  };
}

function resolveSearchConfiguration(configuration) {
  const table = configuration?.openfolders?.dataTable;
  const transactionCode = clean(
    table?.dataLoad?.parameters?.transactionCode,
    200
  );
  if (
    table?.dataLoad?.service !== "executeCustomTransaction" ||
    !transactionCode ||
    table?.limit !== 25 ||
    table?.totalRowLimit !== 7500
  ) {
    throw new Error("ConnectLive public search configuration changed.");
  }
  return { transactionCode, portalRowLimit: table.totalRowLimit };
}

function columnMap(payload) {
  if (!Array.isArray(payload)) {
    throw new Error("ConnectLive compliance response structure changed.");
  }
  if (payload.length === 0) return { columns: new Map(), rowCount: 0 };
  const columns = new Map();
  for (const entry of payload) {
    const name = clean(entry?.columnName, 80);
    if (!name || columns.has(name) || !Array.isArray(entry?.columnValues)) {
      throw new Error("ConnectLive compliance response structure changed.");
    }
    columns.set(name, entry.columnValues);
  }
  if (REQUIRED_COLUMNS.some((name) => !columns.has(name))) {
    throw new Error("ConnectLive compliance response fields changed.");
  }
  const counts = new Set(REQUIRED_COLUMNS.map((name) => columns.get(name).length));
  if (counts.size !== 1) {
    throw new Error("ConnectLive compliance response columns were incomplete.");
  }
  return { columns, rowCount: columns.get("File Number").length };
}

function normalizeComplianceRows(payload, retrievedAt) {
  const { columns, rowCount } = columnMap(payload);
  const candidates = new Map();
  let rejectedCount = 0;

  for (let index = 0; index < rowCount; index += 1) {
    const fileNumber = normalizeFileNumber(columns.get("File Number")[index]);
    const folderRsn = normalizeFolderRsn(columns.get("FolderRSN")[index]);
    const date = normalizeIsoDate(columns.get("Date")[index]);
    if (!fileNumber || !folderRsn || !date) {
      rejectedCount += 1;
      continue;
    }

    const externalId = buildExternalIdentity(fileNumber);
    const candidate = {
      source: VOLUSIA_CODE_COMPLIANCE_SOURCE,
      externalId,
      fileNumber,
      folderRsn,
      complianceType: clean(columns.get("Type")[index], 80) || null,
      date,
      status: clean(columns.get("Status")[index], 80) || null,
      propertyPid: normalizePropertyPid(columns.get("Property")[index]),
      propertyAddress: normalizeSourceAddress(columns.get("Name")[index]),
      retrievedAt,
      reviewState: "unreviewed",
    };

    const existing = candidates.get(externalId);
    if (existing) {
      if (
        existing.folderRsn !== candidate.folderRsn ||
        existing.propertyPid !== candidate.propertyPid
      ) {
        throw new Error("ConnectLive returned conflicting duplicate case identities.");
      }
      continue;
    }
    candidates.set(externalId, candidate);
  }

  return { candidates: [...candidates.values()], rejectedCount, rowCount };
}

function requireBoundedResultCount(rowCount, portalRowLimit) {
  if (
    !Number.isInteger(rowCount) ||
    rowCount < 0 ||
    rowCount >= portalRowLimit ||
    rowCount >= VOLUSIA_CODE_COMPLIANCE_MAX_RESULTS
  ) {
    const error = new Error(
      "ConnectLive result limit reached; choose a narrower date window."
    );
    error.status = 409;
    error.code = "NARROWER_WINDOW_REQUIRED";
    throw error;
  }
}

function minimalParcelFacts(parcel) {
  if (!parcel) return null;
  return {
    source: parcel.source,
    parcelId: parcel.parcelId,
    situsAddress: parcel.situsAddress,
    propertyUse: parcel.propertyUse,
    beds: parcel.beds,
    baths: parcel.baths,
    livingAreaSquareFeet: parcel.livingAreaSquareFeet,
    acreage: parcel.acreage,
  };
}

function parcelState(status, verifiedParcelId = null, parcel = null) {
  return {
    status,
    source: "volusia-parcel-ownership",
    verifiedParcelId,
    parcel: minimalParcelFacts(parcel),
  };
}

async function enrichCandidatesByExactPid({
  candidates,
  fetchImpl,
  retrievedAt,
  signal,
}) {
  const pids = [...new Set(candidates.map((candidate) => candidate.propertyPid).filter(Boolean))];
  const matches = new Map();

  if (pids.length > 0) {
    const params = new URLSearchParams({
      f: "json",
      where: `PID IN (${pids.map((pid) => `'${pid}'`).join(",")})`,
      outFields: VOLUSIA_PARCEL_OWNERSHIP_FIELDS.join(","),
      returnGeometry: "false",
      resultRecordCount: String(Math.max(2, pids.length * 2)),
    });
    const response = await fetchImpl(
      `${VOLUSIA_PARCEL_OWNERSHIP_LAYER_URL}?${params}`,
      { method: "GET", headers: { Accept: "application/json" }, signal }
    );
    const body = await response.json().catch(() => null);
    if (!response.ok || !body || body.error || !Array.isArray(body.features)) {
      throw new Error("Volusia Parcel Ownership exact PID lookup is unavailable.");
    }
    if (body.exceededTransferLimit === true) {
      return candidates.map((candidate) => ({
        ...candidate,
        propertyVerificationState: "AMBIGUOUS",
        parcelEnrichment: parcelState("ambiguous"),
      }));
    }
    for (const feature of body.features) {
      const pid = normalizePropertyPid(feature?.attributes?.PID);
      if (!pid || !pids.includes(pid)) {
        throw new Error("Volusia Parcel Ownership returned an unrequested PID.");
      }
      const grouped = matches.get(pid) || [];
      grouped.push(feature);
      matches.set(pid, grouped);
    }
  }

  return candidates.map((candidate) => {
    if (!candidate.propertyPid) {
      return {
        ...candidate,
        propertyVerificationState: "UNVERIFIED",
        parcelEnrichment: parcelState("invalid"),
      };
    }
    const features = matches.get(candidate.propertyPid) || [];
    if (features.length === 0) {
      return {
        ...candidate,
        propertyVerificationState: "UNVERIFIED",
        parcelEnrichment: parcelState("unmatched"),
      };
    }
    if (features.length !== 1) {
      return {
        ...candidate,
        propertyVerificationState: "AMBIGUOUS",
        parcelEnrichment: parcelState("ambiguous"),
      };
    }
    const parcel = normalizeVolusiaParcelFeature(features[0], retrievedAt);
    return {
      ...candidate,
      propertyVerificationState: "PARCEL_VERIFIED",
      parcelEnrichment: parcelState("matched", parcel.parcelId, parcel),
    };
  });
}

async function fetchVolusiaCodeCompliancePreview({
  windowDays = VOLUSIA_CODE_COMPLIANCE_DEFAULT_WINDOW_DAYS,
  fetchImpl = fetch,
  retrievedAt = new Date().toISOString(),
  timeoutMs = VOLUSIA_CODE_COMPLIANCE_TIMEOUT_MS,
} = {}) {
  const dateWindow = windowDates({ windowDays, asOfDate: retrievedAt });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const anonymousCookie = await openAnonymousSession({
      fetchImpl,
      signal: controller.signal,
    });
    let session = await postConnectLiveJson({
      fetchImpl,
      url: VOLUSIA_CONNECTLIVE_PUBLIC_TOKEN_URL,
      body: { currentPage: "public-search" },
      cookie: anonymousCookie,
      signal: controller.signal,
      unavailableMessage: "ConnectLive anonymous bootstrap is unavailable.",
    });
    session.token = requirePublicToken(session.token);

    session = await postConnectLiveJson({
      fetchImpl,
      url: VOLUSIA_CONNECTLIVE_PAGE_CONFIGURATION_URL,
      body: { currentPage: "search-advanced" },
      token: session.token,
      cookie: session.cookie,
      signal: controller.signal,
      unavailableMessage: "ConnectLive search configuration is unavailable.",
    });
    const { transactionCode, portalRowLimit } = resolveSearchConfiguration(session.body);

    session = await postConnectLiveJson({
      fetchImpl,
      url: VOLUSIA_CONNECTLIVE_TRANSACTION_URL,
      body: {
        transactionCode,
        transactionParameters: [
          { fieldName: "folderType", fieldValue: "C" },
          { fieldName: "district", fieldValue: "A" },
          { fieldName: "inDateFrom", fieldValue: dateWindow.startDate },
          { fieldName: "inDateTo", fieldValue: dateWindow.endDate },
        ],
      },
      token: session.token,
      cookie: session.cookie,
      signal: controller.signal,
      unavailableMessage: "ConnectLive compliance search is unavailable.",
    });

    const normalized = normalizeComplianceRows(session.body, retrievedAt);
    requireBoundedResultCount(normalized.rowCount, portalRowLimit);

    const candidates = await enrichCandidatesByExactPid({
      candidates: normalized.candidates,
      fetchImpl,
      retrievedAt,
      signal: controller.signal,
    });

    return {
      status: "available",
      access: "internal-only",
      source: VOLUSIA_CODE_COMPLIANCE_SOURCE,
      retrievedAt,
      dateWindow,
      rowCount: normalized.rowCount,
      rejectedCount: normalized.rejectedCount,
      candidates,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("Volusia Code Compliance request timed out.");
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  VOLUSIA_CODE_COMPLIANCE_DEFAULT_WINDOW_DAYS,
  VOLUSIA_CODE_COMPLIANCE_MAX_RESULTS,
  VOLUSIA_CODE_COMPLIANCE_MAX_WINDOW_DAYS,
  VOLUSIA_CODE_COMPLIANCE_SOURCE,
  VOLUSIA_CONNECTLIVE_APP_URL,
  VOLUSIA_CONNECTLIVE_PAGE_CONFIGURATION_URL,
  VOLUSIA_CONNECTLIVE_PUBLIC_TOKEN_URL,
  VOLUSIA_CONNECTLIVE_TRANSACTION_URL,
  buildExternalIdentity,
  enrichCandidatesByExactPid,
  fetchVolusiaCodeCompliancePreview,
  normalizeComplianceRows,
  normalizeFileNumber,
  normalizePropertyPid,
  requireBoundedResultCount,
  resolveSearchConfiguration,
  windowDates,
};
