const {
  VOLUSIA_PARCEL_OWNERSHIP_FIELDS,
  VOLUSIA_PARCEL_OWNERSHIP_LAYER_URL,
  normalizeVolusiaParcelFeature,
} = require("./volusia-parcel-ownership.cjs");

const VOLUSIA_TAX_DEED_SALE_SOURCE = "volusia-tax-deed-sale";
const VOLUSIA_TAX_DEED_INQUIRY_URL =
  "https://app02.clerk.org/or_td/inquiry.aspx";
const VOLUSIA_TAX_DEED_SERVICE_URL =
  "https://app02.clerk.org/or_td/TaxDeedService.asmx";
const VOLUSIA_TAX_DEED_DEFAULT_SALE_DATE_LIMIT = 1;
const VOLUSIA_TAX_DEED_MAX_SALE_DATE_LIMIT = 2;
const VOLUSIA_TAX_DEED_MAX_PREVIEW_SIZE = 50;
const VOLUSIA_TAX_DEED_TIMEOUT_MS = 20000;
const TAX_DEED_FIELDS = Object.freeze([
  "certNum",
  "saleDate",
  "parcel",
  "status",
  "statusDate",
  "openBid",
  "highBid",
  "surplus",
]);

function clean(value, maxLength = 240) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function decodeXml(value) {
  return String(value || "").replace(
    /&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi,
    (entity, token) => {
      const normalized = token.toLowerCase();
      if (normalized === "amp") return "&";
      if (normalized === "quot") return '"';
      if (normalized === "apos") return "'";
      if (normalized === "lt") return "<";
      if (normalized === "gt") return ">";
      const codePoint = normalized.startsWith("#x")
        ? Number.parseInt(normalized.slice(2), 16)
        : Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
  );
}

function isoDate(year, month, day) {
  const parsedYear = Number(year);
  const parsedMonth = Number(month);
  const parsedDay = Number(day);
  const date = new Date(Date.UTC(parsedYear, parsedMonth - 1, parsedDay));
  if (
    date.getUTCFullYear() !== parsedYear ||
    date.getUTCMonth() + 1 !== parsedMonth ||
    date.getUTCDate() !== parsedDay
  ) {
    return null;
  }
  return `${String(parsedYear).padStart(4, "0")}-${String(parsedMonth).padStart(2, "0")}-${String(parsedDay).padStart(2, "0")}`;
}

function normalizeUsDate(value) {
  const match = clean(value, 40).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match ? isoDate(match[3], match[1], match[2]) : null;
}

function normalizeCertificateNumber(value) {
  const certificateNumber = clean(value, 80).toUpperCase();
  return /^\d+-\d{2}$/.test(certificateNumber) ? certificateNumber : null;
}

function buildExternalIdentity(certificateNumber) {
  const normalized = normalizeCertificateNumber(certificateNumber);
  return normalized
    ? `${VOLUSIA_TAX_DEED_SALE_SOURCE}:${normalized.toLowerCase()}`
    : "";
}

function normalizeTaxDeedParcelNumber(value) {
  const parcelNumber = clean(value, 30);
  return /^\d{12}$/.test(parcelNumber) ? parcelNumber : null;
}

function normalizeMoney(value) {
  const amount = clean(value, 40);
  if (!amount) return null;
  if (!/^\$\s*\d+(?:\.\d{2})$/.test(amount)) return undefined;
  const parsed = Number(amount.replace(/[$\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function extractTag(rowXml, tag) {
  const matches = [...String(rowXml || "").matchAll(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>|<${tag}(?:\\s[^>]*)?\\s*\\/>`, "gi")
  )];
  if (matches.length !== 1) return { valid: false, value: "" };
  return { valid: true, value: clean(decodeXml(matches[0][1] || "")) };
}

function normalizeTaxDeedRow(rowXml, { sourceRow, retrievedAt }) {
  const extracted = Object.fromEntries(
    TAX_DEED_FIELDS.map((field) => [field, extractTag(rowXml, field)])
  );
  if (TAX_DEED_FIELDS.some((field) => !extracted[field].valid)) {
    throw new Error("Volusia Tax Deed response structure changed.");
  }

  const certificateNumber = normalizeCertificateNumber(extracted.certNum.value);
  const saleDate = normalizeUsDate(extracted.saleDate.value);
  const parcelNumber = normalizeTaxDeedParcelNumber(extracted.parcel.value);
  const status = clean(extracted.status.value, 80).toUpperCase() || null;
  const statusDate = extracted.statusDate.value
    ? normalizeUsDate(extracted.statusDate.value)
    : null;
  const openingBid = normalizeMoney(extracted.openBid.value);
  const rejectionReasons = [];

  if (!certificateNumber) rejectionReasons.push("missing or malformed certificate number");
  if (!saleDate || !status) rejectionReasons.push("malformed tax deed row");
  if (extracted.statusDate.value && !statusDate) rejectionReasons.push("malformed tax deed row");
  if (openingBid === undefined) rejectionReasons.push("malformed opening bid");

  const candidate = {
    source: VOLUSIA_TAX_DEED_SALE_SOURCE,
    externalId: buildExternalIdentity(certificateNumber),
    certificateNumber,
    parcelNumber: parcelNumber || extracted.parcel.value || null,
    saleDate,
    status,
    statusDate,
    openingBid: openingBid === undefined ? null : openingBid,
    sourceRecordUrl: VOLUSIA_TAX_DEED_INQUIRY_URL,
    retrievedAt,
    opportunityType: "TAX DEED SALE / AUCTION OPPORTUNITY",
    propertyVerificationState: "UNVERIFIED",
    parcelEnrichment: {
      status: parcelNumber ? "pending" : "invalid",
      source: "volusia-parcel-ownership",
      verifiedParcelId: null,
      parcel: null,
      retrievedAt,
    },
    reviewState: "preview",
    sourceRow,
  };

  return rejectionReasons.length
    ? { accepted: false, candidate, rejectionReasons: [...new Set(rejectionReasons)] }
    : { accepted: true, candidate, rejectionReasons: [] };
}

function parseTaxDeedSoap(xml, { retrievedAt = new Date().toISOString() } = {}) {
  const body = String(xml || "");
  if (
    !/<get_taxDeedtableResponse\b/i.test(body) ||
    !/<get_taxDeedtableResult\b/i.test(body) ||
    !/<xs:schema\b/i.test(body) ||
    !/<diffgr:diffgram\b/i.test(body)
  ) {
    throw new Error("Volusia Tax Deed response structure changed.");
  }

  const schemaFields = [...body.matchAll(/<xs:element\s+name="([^"]+)"[^>]*\/>/gi)]
    .map((match) => match[1])
    .filter((field) => TAX_DEED_FIELDS.includes(field));
  if (
    schemaFields.length !== TAX_DEED_FIELDS.length ||
    TAX_DEED_FIELDS.some((field, index) => schemaFields[index] !== field)
  ) {
    throw new Error("Volusia Tax Deed response structure changed.");
  }

  const candidates = [];
  const rejected = [];
  const rows = [...body.matchAll(/<taxDeeds\b[^>]*>([\s\S]*?)<\/taxDeeds>/gi)];
  rows.forEach((match, index) => {
    const normalized = normalizeTaxDeedRow(match[1], {
      sourceRow: index + 1,
      retrievedAt,
    });
    if (normalized.accepted) candidates.push(normalized.candidate);
    else rejected.push(normalized);
  });
  return { candidates, rejected, rowCount: rows.length };
}

function discoverRecentSaleDates(
  inquiryHtml,
  { asOfDate, limit = VOLUSIA_TAX_DEED_DEFAULT_SALE_DATE_LIMIT } = {}
) {
  const safeLimit = Number(limit);
  if (
    !Number.isInteger(safeLimit) ||
    safeLimit < 1 ||
    safeLimit > VOLUSIA_TAX_DEED_MAX_SALE_DATE_LIMIT
  ) {
    const error = new Error(
      `Volusia Tax Deed sale-date limit must be 1-${VOLUSIA_TAX_DEED_MAX_SALE_DATE_LIMIT}.`
    );
    error.status = 400;
    throw error;
  }
  const body = String(inquiryHtml || "");
  const selectMatches = [...body.matchAll(
    /<select\b[^>]*id="ctl00_Content1_saleDates_tx"[^>]*>([\s\S]*?)<\/select>/gi
  )];
  if (selectMatches.length !== 1) {
    throw new Error("Volusia Tax Deed inquiry structure changed.");
  }
  const dates = [...selectMatches[0][1].matchAll(/<option\b[^>]*value="\s*(\d{1,2}\/\d{1,2}\/\d{4})"[^>]*>/gi)]
    .map((match) => normalizeUsDate(match[1]));
  if (dates.length === 0 || dates.some((date) => !date) || new Set(dates).size !== dates.length) {
    throw new Error("Volusia Tax Deed inquiry sale dates changed.");
  }
  const normalizedAsOf = /^\d{4}-\d{2}-\d{2}$/.test(String(asOfDate || ""))
    ? String(asOfDate)
    : new Date().toISOString().slice(0, 10);
  const recent = dates
    .filter((date) => date <= normalizedAsOf)
    .sort((left, right) => right.localeCompare(left))
    .slice(0, safeLimit);
  if (recent.length !== safeLimit) {
    throw new Error("Volusia Tax Deed inquiry did not provide the requested recent window.");
  }
  return recent;
}

function soapRequestBody(saleDate, maxRows) {
  const usDate = `${saleDate.slice(5, 7)}/${saleDate.slice(8, 10)}/${saleDate.slice(0, 4)}`;
  return `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<soap:Body><get_taxDeedtable xmlns="http://app02.clerk.org/"><cert></cert><parcel></parcel><sale>${usDate}</sale><maxRows>${maxRows}</maxRows><startRows>0</startRows></get_taxDeedtable></soap:Body></soap:Envelope>`;
}

async function fetchText(url, options, unavailableMessage) {
  const response = await options.fetchImpl(url, {
    ...options.request,
    signal: options.signal,
  });
  const text = await response.text().catch(() => "");
  if (!response.ok || !text) {
    const error = new Error(unavailableMessage);
    error.status = response.status || 502;
    throw error;
  }
  return text;
}

async function fetchRecordCount(saleDate, { fetchImpl, signal }) {
  const usDate = `${saleDate.slice(5, 7)}/${saleDate.slice(8, 10)}/${saleDate.slice(0, 4)}`;
  const response = await fetchImpl(`${VOLUSIA_TAX_DEED_SERVICE_URL}/getCount_taxDeedTable`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ cert: "", parcel: "", sale: usDate }),
    signal,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body || !Number.isInteger(body.d) || body.d < 0) {
    const error = new Error("Volusia Tax Deed record count is unavailable.");
    error.status = response.status || 502;
    throw error;
  }
  return body.d;
}

function unenriched(candidate, status) {
  return {
    ...candidate,
    propertyVerificationState: "UNVERIFIED",
    parcelEnrichment: {
      status,
      source: "volusia-parcel-ownership",
      verifiedParcelId: null,
      parcel: null,
      retrievedAt: candidate.retrievedAt,
    },
  };
}

async function enrichExactParcels(candidates, { fetchImpl, signal, retrievedAt }) {
  const validParcelIds = [...new Set(
    candidates.map((candidate) => normalizeTaxDeedParcelNumber(candidate.parcelNumber)).filter(Boolean)
  )];
  if (validParcelIds.length === 0) return candidates.map((candidate) => unenriched(candidate, "invalid"));

  const params = new URLSearchParams({
    f: "json",
    where: `PID IN (${validParcelIds.map((parcel) => `'${parcel}'`).join(",")})`,
    outFields: VOLUSIA_PARCEL_OWNERSHIP_FIELDS.join(","),
    returnGeometry: "false",
    resultRecordCount: String(VOLUSIA_TAX_DEED_MAX_PREVIEW_SIZE * 2),
  });
  const response = await fetchImpl(`${VOLUSIA_PARCEL_OWNERSHIP_LAYER_URL}?${params}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });
  const body = await response.json().catch(() => null);
  if (
    !response.ok ||
    !body ||
    body.error ||
    !Array.isArray(body.features) ||
    body.exceededTransferLimit === true
  ) {
    throw new Error("Volusia Parcel Ownership exact PID lookup is unavailable.");
  }

  const byPid = new Map(validParcelIds.map((parcel) => [parcel, []]));
  for (const feature of body.features) {
    const pid = clean(feature?.attributes?.PID, 30);
    if (!byPid.has(pid)) {
      throw new Error("Volusia Parcel Ownership returned an unrequested PID.");
    }
    byPid.get(pid).push(feature);
  }

  return candidates.map((candidate) => {
    const sourceParcelId = normalizeTaxDeedParcelNumber(candidate.parcelNumber);
    if (!sourceParcelId) return unenriched(candidate, "invalid");
    const matches = byPid.get(sourceParcelId) || [];
    if (matches.length === 0) return unenriched(candidate, "unmatched");
    if (matches.length !== 1) return unenriched(candidate, "ambiguous");
    try {
      const parcel = normalizeVolusiaParcelFeature(matches[0], retrievedAt);
      return {
        ...candidate,
        propertyVerificationState: "PARCEL_VERIFIED",
        parcelEnrichment: {
          status: "matched",
          source: parcel.source,
          verifiedParcelId: parcel.parcelId,
          parcel,
          retrievedAt,
        },
      };
    } catch {
      return unenriched(candidate, "invalid");
    }
  });
}

async function fetchVolusiaTaxDeedSalePreview({
  saleDateLimit = VOLUSIA_TAX_DEED_DEFAULT_SALE_DATE_LIMIT,
  fetchImpl = fetch,
  retrievedAt = new Date().toISOString(),
  timeoutMs = VOLUSIA_TAX_DEED_TIMEOUT_MS,
} = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const inquiryHtml = await fetchText(
      VOLUSIA_TAX_DEED_INQUIRY_URL,
      { fetchImpl, signal: controller.signal, request: { method: "GET", headers: { Accept: "text/html" } } },
      "Volusia Tax Deed inquiry is unavailable."
    );
    const saleDates = discoverRecentSaleDates(inquiryHtml, {
      asOfDate: retrievedAt.slice(0, 10),
      limit: saleDateLimit,
    });

    const candidates = [];
    const rejected = [];
    const seen = new Set();
    const saleWindow = [];
    for (const saleDate of saleDates) {
      const count = await fetchRecordCount(saleDate, {
        fetchImpl,
        signal: controller.signal,
      });
      if (count > VOLUSIA_TAX_DEED_MAX_PREVIEW_SIZE || candidates.length + count > VOLUSIA_TAX_DEED_MAX_PREVIEW_SIZE) {
        throw new Error("Volusia Tax Deed recent window exceeds the bounded preview size.");
      }
      saleWindow.push({ saleDate, recordCount: count });
      if (count === 0) continue;
      const xml = await fetchText(
        VOLUSIA_TAX_DEED_SERVICE_URL,
        {
          fetchImpl,
          signal: controller.signal,
          request: {
            method: "POST",
            headers: {
              Accept: "text/xml",
              "Content-Type": "text/xml; charset=utf-8",
              SOAPAction: '"http://app02.clerk.org/get_taxDeedtable"',
            },
            body: soapRequestBody(saleDate, count),
          },
        },
        `Volusia Tax Deed records for ${saleDate} are unavailable.`
      );
      const parsed = parseTaxDeedSoap(xml, { retrievedAt });
      if (parsed.rowCount !== count) {
        throw new Error("Volusia Tax Deed record count changed during retrieval.");
      }
      rejected.push(...parsed.rejected);
      for (const candidate of parsed.candidates) {
        if (candidate.saleDate !== saleDate) {
          throw new Error("Volusia Tax Deed sale-date response did not match the requested window.");
        }
        if (seen.has(candidate.externalId)) {
          throw new Error("Volusia Tax Deed response contained duplicate stable identities.");
        }
        seen.add(candidate.externalId);
        candidates.push(candidate);
      }
    }

    candidates.sort((left, right) =>
      right.saleDate.localeCompare(left.saleDate) || left.externalId.localeCompare(right.externalId)
    );
    let enrichedCandidates;
    try {
      enrichedCandidates = await enrichExactParcels(candidates, {
        fetchImpl,
        signal: controller.signal,
        retrievedAt,
      });
    } catch {
      enrichedCandidates = candidates.map((candidate) =>
        unenriched(candidate, normalizeTaxDeedParcelNumber(candidate.parcelNumber) ? "unavailable" : "invalid")
      );
    }

    return {
      status: "available",
      source: VOLUSIA_TAX_DEED_SALE_SOURCE,
      candidates: enrichedCandidates,
      rejected,
      retrievedAt,
      saleWindow,
      previewLimit: VOLUSIA_TAX_DEED_MAX_PREVIEW_SIZE,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("Volusia Tax Deed request timed out.");
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  TAX_DEED_FIELDS,
  VOLUSIA_TAX_DEED_DEFAULT_SALE_DATE_LIMIT,
  VOLUSIA_TAX_DEED_INQUIRY_URL,
  VOLUSIA_TAX_DEED_MAX_PREVIEW_SIZE,
  VOLUSIA_TAX_DEED_MAX_SALE_DATE_LIMIT,
  VOLUSIA_TAX_DEED_SALE_SOURCE,
  VOLUSIA_TAX_DEED_SERVICE_URL,
  buildExternalIdentity,
  discoverRecentSaleDates,
  enrichExactParcels,
  fetchVolusiaTaxDeedSalePreview,
  normalizeCertificateNumber,
  normalizeTaxDeedParcelNumber,
  normalizeTaxDeedRow,
  parseTaxDeedSoap,
};
