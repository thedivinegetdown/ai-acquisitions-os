const VOLUSIA_PARCEL_OWNERSHIP_SOURCE = "volusia-parcel-ownership";
const VOLUSIA_PARCEL_OWNERSHIP_LAYER_URL =
  "https://maps5.vcgov.org/arcgis/rest/services/Open_Data/Open_Data_3/FeatureServer/34/query";
const VOLUSIA_PARCEL_OWNERSHIP_TIMEOUT_MS = 10000;
const VOLUSIA_PARCEL_OWNERSHIP_FIELDS = [
  "PARID",
  "PID",
  "DORPID",
  "ADDRFULL",
  "CITYNAME",
  "STATECODE",
  "ZIP1",
  "OWNER1",
  "OWNER2",
  "MAILADDR1",
  "MAILADDR2",
  "MAILADDR3",
  "MAILCITY",
  "MAILSTATE",
  "MAILZIP",
  "PC",
  "PC_DESC",
  "RES_BEDROOM",
  "RES_BATHROOM",
  "RES_TOTAL_SFLA",
  "CALCACRES",
  "LANDACRES",
  "LANDJUST",
  "IMPRJUST",
  "TOTJUST",
  "LASTSALEDT",
  "LASTSALEPRICE",
];

function clean(value, maxLength = 240) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeVerifiedParcelId(value) {
  const parcelId = clean(value, 30);
  return /^\d{7}$/.test(parcelId) ? parcelId : null;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeArcGisDate(value) {
  const timestamp = nullableNumber(value);
  if (timestamp === null) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function compactStrings(values) {
  return values.map((value) => clean(value)).filter(Boolean);
}

function normalizeVolusiaParcelFeature(feature, retrievedAt) {
  const attributes = feature?.attributes || {};
  const parcelId = normalizeVerifiedParcelId(attributes.PARID);
  if (!parcelId) {
    throw new Error("Volusia parcel response did not contain a valid PARID.");
  }

  return {
    source: VOLUSIA_PARCEL_OWNERSHIP_SOURCE,
    retrievedAt,
    parcelId,
    situsAddress: {
      addressLine: clean(attributes.ADDRFULL) || null,
      city: clean(attributes.CITYNAME, 80) || null,
      state: clean(attributes.STATECODE, 2) || null,
      postalCode: clean(attributes.ZIP1, 10) || null,
    },
    ownerNames: compactStrings([attributes.OWNER1, attributes.OWNER2]),
    ownerMailingAddress: {
      addressLines: compactStrings([
        attributes.MAILADDR1,
        attributes.MAILADDR2,
        attributes.MAILADDR3,
      ]),
      city: clean(attributes.MAILCITY, 80) || null,
      state: clean(attributes.MAILSTATE, 2) || null,
      postalCode: clean(attributes.MAILZIP, 10) || null,
    },
    propertyUse: {
      code: clean(attributes.PC, 20) || null,
      description: clean(attributes.PC_DESC, 120) || null,
    },
    beds: nullableNumber(attributes.RES_BEDROOM),
    baths: nullableNumber(attributes.RES_BATHROOM),
    livingAreaSquareFeet: nullableNumber(attributes.RES_TOTAL_SFLA),
    acreage: {
      calculated: nullableNumber(attributes.CALCACRES),
      land: nullableNumber(attributes.LANDACRES),
    },
    justValueContext: {
      land: nullableNumber(attributes.LANDJUST),
      improvement: nullableNumber(attributes.IMPRJUST),
      total: nullableNumber(attributes.TOTJUST),
    },
    latestSale: {
      date: normalizeArcGisDate(attributes.LASTSALEDT),
      price: nullableNumber(attributes.LASTSALEPRICE),
    },
  };
}

async function fetchVolusiaParcelOwnership({
  verifiedParcelId,
  fetchImpl = fetch,
  retrievedAt = new Date().toISOString(),
  timeoutMs = VOLUSIA_PARCEL_OWNERSHIP_TIMEOUT_MS,
} = {}) {
  const parcelId = normalizeVerifiedParcelId(verifiedParcelId);
  if (!parcelId) {
    const error = new Error("A verified seven-digit Volusia PARID is required.");
    error.status = 400;
    throw error;
  }

  const params = new URLSearchParams({
    f: "json",
    where: `PARID = '${parcelId}'`,
    outFields: VOLUSIA_PARCEL_OWNERSHIP_FIELDS.join(","),
    returnGeometry: "false",
    resultRecordCount: "2",
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(
      `${VOLUSIA_PARCEL_OWNERSHIP_LAYER_URL}?${params}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      }
    );
    const body = await response.json().catch(() => null);
    if (!response.ok || !body || body.error || !Array.isArray(body.features)) {
      const error = new Error("Volusia Parcel Ownership data is unavailable.");
      error.status = response.status || 502;
      throw error;
    }

    if (body.features.length === 0) {
      return {
        status: "unmatched",
        source: VOLUSIA_PARCEL_OWNERSHIP_SOURCE,
        verifiedParcelId: parcelId,
        propertyVerificationState: "UNVERIFIED",
        parcel: null,
        retrievedAt,
      };
    }
    if (body.features.length !== 1 || body.exceededTransferLimit === true) {
      return {
        status: "ambiguous",
        source: VOLUSIA_PARCEL_OWNERSHIP_SOURCE,
        verifiedParcelId: parcelId,
        propertyVerificationState: "UNVERIFIED",
        parcel: null,
        retrievedAt,
      };
    }

    const parcel = normalizeVolusiaParcelFeature(body.features[0], retrievedAt);
    if (parcel.parcelId !== parcelId) {
      const error = new Error("Volusia parcel response identity did not match the requested PARID.");
      error.status = 502;
      throw error;
    }
    return {
      status: "matched",
      source: VOLUSIA_PARCEL_OWNERSHIP_SOURCE,
      verifiedParcelId: parcelId,
      propertyVerificationState: "PARCEL_VERIFIED",
      parcel,
      retrievedAt,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("Volusia Parcel Ownership request timed out.");
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  VOLUSIA_PARCEL_OWNERSHIP_FIELDS,
  VOLUSIA_PARCEL_OWNERSHIP_LAYER_URL,
  VOLUSIA_PARCEL_OWNERSHIP_SOURCE,
  fetchVolusiaParcelOwnership,
  normalizeVerifiedParcelId,
  normalizeVolusiaParcelFeature,
};
