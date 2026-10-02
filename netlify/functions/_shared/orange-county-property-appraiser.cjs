const OCPA_SOURCE = "orange-county-property-appraiser";
const OCPA_LAYER_URL =
  "https://vgispublic.ocpafl.org/server/rest/services/DynamicForJs/PARCEL/MapServer/1/query";
const OCPA_TIMEOUT_MS = 10000;
const OCPA_BATCH_SIZE = 50;
const OCPA_FIELDS = [
  "OBJECTID",
  "PARCEL",
  "NAME1",
  "NAME2",
  "PROP_NAME",
  "DOR_CODE",
  "PARCEL_CATEGORY",
  "BLDG_DOR_CODE",
  "SITUS",
  "SITUS_CITY",
  "SITUS_ZIP",
  "STYS",
  "BATH",
  "BEDS",
  "LIVING_AREA",
  "POOL",
  "AYB",
  "ACREAGE",
  "ZONING_CODE",
  "TOTAL_MKT",
  "TOTAL_ASSD",
  "TAXABLE",
  "TAXES",
  "SALE_DATE",
  "SALE_ADJ_VALUE",
  "QUAL_CODE",
];

function clean(value, maxLength = 240) {
  if (value === null || value === undefined) return "";
  return String(value).trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function textOrNull(value, maxLength) {
  return clean(value, maxLength) || null;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOrNull(value) {
  const timestamp = numberOrNull(value);
  if (timestamp === null) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeParcelId(value) {
  const normalized = clean(value, 80).replace(/[\s-]/g, "");
  return /^\d{15}$/.test(normalized) ? normalized : "";
}

function taxSaleParcelToOcpaId(value) {
  const match = clean(value, 80).match(/^(\d{2})-(\d{2})-(\d{2})-(\d{4})-(\d{2})-(\d{3})$/);
  return match ? `${match[3]}${match[2]}${match[1]}${match[4]}${match[5]}${match[6]}` : "";
}

function normalizeOcpaFeature(feature, retrievedAt) {
  const attributes = feature?.attributes || {};
  const owners = [textOrNull(attributes.NAME1, 100), textOrNull(attributes.NAME2, 100)].filter(
    Boolean
  );

  return {
    source: OCPA_SOURCE,
    retrievedAt,
    parcelId: normalizeParcelId(attributes.PARCEL),
    sourceRecordId: numberOrNull(attributes.OBJECTID),
    owner: owners.length ? owners.join(" / ") : null,
    propertyName: textOrNull(attributes.PROP_NAME, 100),
    address: textOrNull(attributes.SITUS, 120),
    city: textOrNull(attributes.SITUS_CITY, 50),
    zip: textOrNull(attributes.SITUS_ZIP, 10),
    propertyUse: {
      dorCode: textOrNull(attributes.DOR_CODE, 20),
      parcelCategory: textOrNull(attributes.PARCEL_CATEGORY, 20),
      buildingDorCode: textOrNull(attributes.BLDG_DOR_CODE, 120),
    },
    facts: {
      beds: numberOrNull(attributes.BEDS),
      baths: numberOrNull(attributes.BATH),
      livingArea: numberOrNull(attributes.LIVING_AREA),
      stories: numberOrNull(attributes.STYS),
      yearBuilt: numberOrNull(attributes.AYB),
      acreage: numberOrNull(attributes.ACREAGE),
      zoning: textOrNull(attributes.ZONING_CODE, 40),
      pool: textOrNull(attributes.POOL, 10),
    },
    assessment: {
      marketValue: numberOrNull(attributes.TOTAL_MKT),
      assessedValue: numberOrNull(attributes.TOTAL_ASSD),
      taxableValue: numberOrNull(attributes.TAXABLE),
      taxes: numberOrNull(attributes.TAXES),
    },
    recentSale: {
      date: dateOrNull(attributes.SALE_DATE),
      adjustedValue: numberOrNull(attributes.SALE_ADJ_VALUE),
      qualificationCode: textOrNull(attributes.QUAL_CODE, 10),
    },
  };
}

function splitIntoBatches(values, batchSize = OCPA_BATCH_SIZE) {
  const batches = [];
  for (let index = 0; index < values.length; index += batchSize) {
    batches.push(values.slice(index, index + batchSize));
  }
  return batches;
}

async function fetchOcpaBatch(parcelIds, { fetchImpl, timeoutMs }) {
  const where = `PARCEL IN (${parcelIds.map((parcelId) => `'${parcelId}'`).join(",")})`;
  const params = new URLSearchParams({
    f: "json",
    where,
    outFields: OCPA_FIELDS.join(","),
    returnGeometry: "false",
    resultRecordCount: "1000",
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${OCPA_LAYER_URL}?${params}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (
      !response.ok ||
      !body ||
      body.error ||
      !Array.isArray(body.features) ||
      body.exceededTransferLimit === true
    ) {
      const error = new Error("Orange County Property Appraiser data is unavailable.");
      error.status = response.status || 502;
      throw error;
    }
    return body.features;
  } finally {
    clearTimeout(timeout);
  }
}

async function enrichCandidatesWithOcpa(
  candidates,
  {
    fetchImpl = fetch,
    retrievedAt = new Date().toISOString(),
    timeoutMs = OCPA_TIMEOUT_MS,
  } = {},
  lookupParcelId = normalizeParcelId
) {
  const parcelIds = [
    ...new Set((candidates || []).map((candidate) => lookupParcelId(candidate.parcelNumber)).filter(Boolean)),
  ];
  const featureBatches = await Promise.all(
    splitIntoBatches(parcelIds).map((batch) => fetchOcpaBatch(batch, { fetchImpl, timeoutMs }))
  );
  const matchesByParcel = new Map(parcelIds.map((parcelId) => [parcelId, []]));

  for (const feature of featureBatches.flat()) {
    const parcelId = normalizeParcelId(feature?.attributes?.PARCEL);
    if (matchesByParcel.has(parcelId)) matchesByParcel.get(parcelId).push(feature);
  }

  return (candidates || []).map((candidate) => {
    const parcelId = lookupParcelId(candidate.parcelNumber);
    const matches = matchesByParcel.get(parcelId) || [];
    const matchState = {
      status: matches.length === 1 ? "matched" : matches.length > 1 ? "ambiguous" : "unmatched",
      source: OCPA_SOURCE,
      retrievedAt,
      parcelId,
      matchCount: matches.length,
    };

    return {
      ...candidate,
      enrichment:
        matches.length === 1
          ? { ...matchState, ...normalizeOcpaFeature(matches[0], retrievedAt) }
          : matchState,
    };
  });
}

function enrichTaxSaleCandidatesWithOcpa(candidates, options) {
  return enrichCandidatesWithOcpa(candidates, options, taxSaleParcelToOcpaId);
}

module.exports = {
  OCPA_FIELDS,
  OCPA_LAYER_URL,
  OCPA_SOURCE,
  enrichCandidatesWithOcpa,
  enrichTaxSaleCandidatesWithOcpa,
  normalizeOcpaFeature,
  normalizeParcelId,
  taxSaleParcelToOcpaId,
};
