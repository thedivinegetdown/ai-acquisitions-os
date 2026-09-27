const VOLUSIA_CIRCUIT_FORECLOSURE_SOURCE = "volusia-circuit-foreclosure";
const VOLUSIA_CIRCUIT_FORECLOSURE_INDEX_URL =
  "https://app02.clerk.org/cm_rpt/inquiry.aspx?ty=CI";
const VOLUSIA_CIRCUIT_FORECLOSURE_DEFAULT_REPORT_LIMIT = 4;
const VOLUSIA_CIRCUIT_FORECLOSURE_MAX_REPORT_LIMIT = 4;
const VOLUSIA_CIRCUIT_FORECLOSURE_TIMEOUT_MS = 15000;
const REPORT_HEADERS = [
  "Case Number",
  "Plaintiff",
  "Defendant",
  "Judge",
  "Filing Date",
];

const MONTHS = Object.freeze({
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
});

function clean(value, maxLength = 500) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function decodeHtml(value) {
  return String(value || "").replace(
    /&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi,
    (entity, token) => {
      const normalized = token.toLowerCase();
      if (normalized === "amp") return "&";
      if (normalized === "quot") return '"';
      if (normalized === "apos") return "'";
      if (normalized === "lt") return "<";
      if (normalized === "gt") return ">";
      if (normalized === "nbsp") return " ";
      const codePoint = normalized.startsWith("#x")
        ? Number.parseInt(normalized.slice(2), 16)
        : Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
  );
}

function htmlLines(fragment) {
  return decodeHtml(
    String(fragment || "")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .split("\n")
    .map((line) => clean(line))
    .filter(Boolean);
}

function htmlText(fragment) {
  return clean(htmlLines(fragment).join(" "));
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

function discoverRecentReports(
  indexHtml,
  { indexUrl = VOLUSIA_CIRCUIT_FORECLOSURE_INDEX_URL } = {}
) {
  const reports = [];
  const seen = new Set();
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowPattern.exec(String(indexHtml || "")))) {
    const rowHtml = rowMatch[1];
    const rowText = htmlText(rowHtml);
    if (!/Week Ending:/i.test(rowText)) continue;
    const linkMatch = rowHtml.match(
      /<a\b[^>]*href\s*=\s*(['"])(\/cm_rpt\/circuit\/CI_(\d{4})_(\d{2})_(\d{2})\.html)\1[^>]*>\s*View\s*<\/a>/i
    );
    if (!linkMatch) {
      throw new Error("Volusia foreclosure report index structure changed.");
    }

    const labelMatch = rowText.match(
      /Week Ending:\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+View/i
    );
    const month = labelMatch ? MONTHS[labelMatch[2].toLowerCase()] : null;
    const labelDate = labelMatch && month
      ? isoDate(labelMatch[3], month, labelMatch[1])
      : null;
    const pathDate = isoDate(linkMatch[3], linkMatch[4], linkMatch[5]);

    if (!labelDate || !pathDate || labelDate !== pathDate) {
      throw new Error("Volusia foreclosure report index structure changed.");
    }

    const url = new URL(linkMatch[2], indexUrl).toString();
    if (!seen.has(url)) {
      seen.add(url);
      reports.push({ reportWeekEnding: labelDate, url });
    }
  }

  if (reports.length === 0) {
    throw new Error("Volusia foreclosure report index contains no recognized weekly reports.");
  }

  return reports.sort((left, right) =>
    right.reportWeekEnding.localeCompare(left.reportWeekEnding)
  );
}

function extractCells(rowHtml) {
  return [...String(rowHtml || "").matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
    (match) => match[1]
  );
}

function normalizeCourtCaseNumber(value) {
  return clean(value, 120).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function buildExternalIdentity(caseNumber) {
  const normalized = normalizeCourtCaseNumber(caseNumber).toLowerCase();
  return normalized ? `${VOLUSIA_CIRCUIT_FORECLOSURE_SOURCE}:${normalized}` : "";
}

function rejectedRow({ sourceRow, reportWeekEnding, retrievedAt, caseNumber = null, reasons }) {
  return {
    accepted: false,
    candidate: {
      source: VOLUSIA_CIRCUIT_FORECLOSURE_SOURCE,
      sourceRow,
      caseNumber,
      reportWeekEnding,
      retrievedAt,
    },
    rejectionReasons: reasons,
  };
}

function normalizeReportCells(cells, { sourceRow, reportWeekEnding, retrievedAt }) {
  if (!Array.isArray(cells) || cells.length !== REPORT_HEADERS.length) {
    return rejectedRow({
      sourceRow,
      reportWeekEnding,
      retrievedAt,
      reasons: ["malformed report row"],
    });
  }

  const caseNumber = htmlText(cells[0]);
  const plaintiffLines = htmlLines(cells[1]);
  const defendantLines = htmlLines(cells[2]);
  const judge = htmlText(cells[3]);
  const filingDate = normalizeUsDate(htmlText(cells[4]));
  const reasons = [];

  if (!caseNumber) reasons.push("missing court case number");
  else if (!/^\d{4}\s+\d+\s+CI[A-Z0-9]+$/i.test(caseNumber)) {
    reasons.push("malformed court case number");
  }
  if (!plaintiffLines[0] || !defendantLines[0] || !filingDate) {
    reasons.push("malformed report row");
  }

  const candidate = {
    source: VOLUSIA_CIRCUIT_FORECLOSURE_SOURCE,
    externalId: buildExternalIdentity(caseNumber),
    caseNumber: caseNumber || null,
    filingDate,
    plaintiff: plaintiffLines[0] || null,
    defendant: defendantLines[0] || null,
    judge: judge || null,
    partyReportAddress: clean(defendantLines.slice(1).join(" ")) || null,
    partyReportAddressRole: "defendant",
    reportWeekEnding,
    retrievedAt,
    propertyVerificationState: "UNVERIFIED",
    reviewState: "preview",
  };

  return reasons.length
    ? {
        accepted: false,
        candidate,
        rejectionReasons: [...new Set(reasons)],
      }
    : { accepted: true, candidate, rejectionReasons: [] };
}

function parseWeeklyReport(
  reportHtml,
  { expectedReportWeekEnding, retrievedAt = new Date().toISOString() } = {}
) {
  const body = String(reportHtml || "");
  const headingMatch = htmlText(body).match(
    /Weekly Circuit Civil Foreclosures Report\s+for Week of Sunday,\s*(\d{1,2}\/\d{1,2}\/\d{4}),\s*to Saturday,\s*(\d{1,2}\/\d{1,2}\/\d{4})/i
  );
  const reportWeekEnding = headingMatch ? normalizeUsDate(headingMatch[2]) : null;
  if (
    !headingMatch ||
    !normalizeUsDate(headingMatch[1]) ||
    !reportWeekEnding ||
    (expectedReportWeekEnding && reportWeekEnding !== expectedReportWeekEnding)
  ) {
    throw new Error("Volusia foreclosure report heading structure changed.");
  }

  const tables = [...body.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)];
  if (tables.length !== 1) {
    throw new Error("Volusia foreclosure report table structure changed.");
  }

  const rows = [...tables[0][1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(
    (match) => match[1]
  );
  if (rows.length === 0) {
    throw new Error("Volusia foreclosure report contains no table header.");
  }

  const headerCells = extractCells(rows[0]).map(htmlText);
  if (
    headerCells.length !== REPORT_HEADERS.length ||
    headerCells.some((header, index) => header !== REPORT_HEADERS[index])
  ) {
    throw new Error("Volusia foreclosure report column structure changed.");
  }

  const candidates = [];
  const rejected = [];
  rows.slice(1).forEach((rowHtml, index) => {
    const normalized = normalizeReportCells(extractCells(rowHtml), {
      sourceRow: index + 1,
      reportWeekEnding,
      retrievedAt,
    });
    if (normalized.accepted) candidates.push(normalized.candidate);
    else rejected.push(normalized);
  });

  return { candidates, rejected, reportWeekEnding };
}

async function fetchHtml(url, { fetchImpl, signal, unavailableMessage }) {
  const response = await fetchImpl(url, {
    method: "GET",
    headers: { Accept: "text/html" },
    signal,
  });
  const html = await response.text().catch(() => "");
  if (!response.ok || !html) {
    const error = new Error(unavailableMessage);
    error.status = response.status || 502;
    throw error;
  }
  return html;
}

async function fetchVolusiaCircuitForeclosurePreview({
  reportLimit = VOLUSIA_CIRCUIT_FORECLOSURE_DEFAULT_REPORT_LIMIT,
  fetchImpl = fetch,
  retrievedAt = new Date().toISOString(),
  timeoutMs = VOLUSIA_CIRCUIT_FORECLOSURE_TIMEOUT_MS,
} = {}) {
  const safeLimit = Number(reportLimit);
  if (
    !Number.isInteger(safeLimit) ||
    safeLimit < 1 ||
    safeLimit > VOLUSIA_CIRCUIT_FORECLOSURE_MAX_REPORT_LIMIT
  ) {
    const error = new Error("Volusia foreclosure report limit must be between 1 and 4.");
    error.status = 400;
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const indexHtml = await fetchHtml(VOLUSIA_CIRCUIT_FORECLOSURE_INDEX_URL, {
      fetchImpl,
      signal: controller.signal,
      unavailableMessage: "Volusia foreclosure report index is unavailable.",
    });
    const reports = discoverRecentReports(indexHtml).slice(0, safeLimit);
    if (reports.length !== safeLimit) {
      throw new Error("Volusia foreclosure report index did not provide the requested recent window.");
    }

    const candidates = [];
    const rejected = [];
    const seen = new Set();
    for (const report of reports) {
      const reportHtml = await fetchHtml(report.url, {
        fetchImpl,
        signal: controller.signal,
        unavailableMessage: `Volusia foreclosure report ${report.reportWeekEnding} is unavailable.`,
      });
      const parsed = parseWeeklyReport(reportHtml, {
        expectedReportWeekEnding: report.reportWeekEnding,
        retrievedAt,
      });
      rejected.push(...parsed.rejected);
      for (const candidate of parsed.candidates) {
        if (seen.has(candidate.externalId)) {
          rejected.push({
            accepted: false,
            candidate,
            rejectionReasons: ["duplicate external identity across report window"],
          });
          continue;
        }
        seen.add(candidate.externalId);
        candidates.push(candidate);
      }
    }

    return {
      status: "available",
      source: VOLUSIA_CIRCUIT_FORECLOSURE_SOURCE,
      candidates,
      rejected,
      reports,
      retrievedAt,
      reportWindow: {
        limit: safeLimit,
        reportCount: reports.length,
      },
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("Volusia foreclosure reports request timed out.");
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  REPORT_HEADERS,
  VOLUSIA_CIRCUIT_FORECLOSURE_DEFAULT_REPORT_LIMIT,
  VOLUSIA_CIRCUIT_FORECLOSURE_INDEX_URL,
  VOLUSIA_CIRCUIT_FORECLOSURE_MAX_REPORT_LIMIT,
  VOLUSIA_CIRCUIT_FORECLOSURE_SOURCE,
  buildExternalIdentity,
  discoverRecentReports,
  fetchVolusiaCircuitForeclosurePreview,
  normalizeCourtCaseNumber,
  normalizeReportCells,
  parseWeeklyReport,
};
