const RENTCAST_API_BASE_URL = "https://api.rentcast.io/v1";
const RENTCAST_REQUEST_COUNT = 2;
const RENTCAST_TIMEOUT_MS = 8000;

function text(value, max = 320) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function number(value) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function iso(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function latestEntry(entries) {
  return Object.values(entries || {})
    .filter((entry) => entry && typeof entry === "object")
    .sort((left, right) => Number(right.year || 0) - Number(left.year || 0))[0] || null;
}

function saleHistory(entries) {
  return Object.values(entries || {})
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      date: iso(entry.date),
      price: number(entry.price),
      event: text(entry.event, 40),
    }))
    .filter((entry) => entry.date || entry.price !== null)
    .sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")))
    .slice(0, 5);
}

function normalizeComparable(entry = {}) {
  return {
    providerRecordId: text(entry.id, 240),
    address: text(entry.formattedAddress, 320),
    propertyType: text(entry.propertyType, 80),
    bedrooms: number(entry.bedrooms),
    bathrooms: number(entry.bathrooms),
    squareFeet: number(entry.squareFootage),
    lotSize: number(entry.lotSize),
    listingPrice: number(entry.price),
    listedDate: iso(entry.listedDate),
    removedDate: iso(entry.removedDate),
    distanceMiles: number(entry.distance),
    correlation: number(entry.correlation),
    status: text(entry.status, 60),
  };
}

function normalizeRentCastResult({ propertyRecords, valuation, retrievedAt }) {
  const record = Array.isArray(propertyRecords) ? propertyRecords[0] || {} : {};
  const subject = valuation?.subjectProperty || {};
  const assessment = latestEntry(record.taxAssessments);
  const propertyTax = latestEntry(record.propertyTaxes);
  const address = text(record.formattedAddress || subject.formattedAddress, 320);

  return {
    source: "rentcast",
    generatedAt: retrievedAt,
    providerRecordId: text(record.id || subject.id, 240),
    property: {
      id: text(record.id || subject.id, 240),
      address,
      normalizedAddress: address,
      city: text(record.city || subject.city, 120),
      state: text(record.state || subject.state, 2),
      zip: text(record.zipCode || subject.zipCode, 10),
      county: text(record.county || subject.county, 120),
      propertyType: text(record.propertyType || subject.propertyType, 80),
      beds: number(record.bedrooms ?? subject.bedrooms),
      baths: number(record.bathrooms ?? subject.bathrooms),
      squareFeet: number(record.squareFootage ?? subject.squareFootage),
      lotSize: number(record.lotSize ?? subject.lotSize),
      yearBuilt: number(record.yearBuilt ?? subject.yearBuilt),
      assessorId: text(record.assessorID, 160),
      legalDescription: text(record.legalDescription, 500),
      zoning: text(record.zoning, 120),
      latitude: number(record.latitude ?? subject.latitude),
      longitude: number(record.longitude ?? subject.longitude),
      source: "rentcast-property-record",
    },
    owner: null,
    tax: assessment || propertyTax ? {
      assessedValue: number(assessment?.value),
      landAssessedValue: number(assessment?.land),
      improvementAssessedValue: number(assessment?.improvements),
      annualTaxes: number(propertyTax?.total),
      taxYear: number(propertyTax?.year ?? assessment?.year),
      source: "rentcast-property-record",
    } : null,
    saleHistory: saleHistory(record.history),
    valuation: valuation && typeof valuation === "object" ? {
      estimatedValue: number(valuation.price),
      lowValue: number(valuation.priceRangeLow),
      highValue: number(valuation.priceRangeHigh),
      arvEstimate: null,
      confidence: "Provider estimate",
      source: "rentcast-avm",
    } : null,
    comps: Array.isArray(valuation?.comparables)
      ? valuation.comparables.slice(0, 5).map(normalizeComparable)
      : [],
    confidence: "Unknown",
    missingData: [
      !address ? "Property address match" : null,
      !record.id ? "Property record" : null,
      !assessment && !propertyTax ? "Tax/assessment context" : null,
      number(valuation?.price) === null ? "Value estimate" : null,
      !valuation?.comparables?.length ? "Comparable-sale context" : null,
    ].filter(Boolean),
    limitations: [
      "Provider data is evidence and has not been independently verified.",
      "Public-record sale and assessment updates may lag county processing.",
      "The AVM is not automatically treated as canonical ARV or underwriting.",
      "Comparable prices are provider listing observations, not guaranteed closed-sale prices.",
    ],
  };
}

async function fetchJson(fetchImpl, url, apiKey, signal) {
  const response = await fetchImpl(url, {
    method: "GET",
    headers: { Accept: "application/json", "X-Api-Key": apiKey },
    signal,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(response.status === 429
      ? "RentCast request limit reached."
      : "RentCast property data is unavailable.");
    error.status = response.status;
    throw error;
  }
  return body;
}

async function fetchRentCastPropertyData({
  address,
  apiKey,
  fetchImpl = fetch,
  retrievedAt = new Date().toISOString(),
  timeoutMs = RENTCAST_TIMEOUT_MS,
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const query = new URLSearchParams({ address, suppressLogging: "true" });
  const valueQuery = new URLSearchParams({
    address,
    compCount: "5",
    lookupSubjectAttributes: "true",
    suppressLogging: "true",
  });
  try {
    const [propertyRecords, valuation] = await Promise.all([
      fetchJson(fetchImpl, `${RENTCAST_API_BASE_URL}/properties?${query}`, apiKey, controller.signal),
      fetchJson(fetchImpl, `${RENTCAST_API_BASE_URL}/avm/value?${valueQuery}`, apiKey, controller.signal),
    ]);
    return normalizeRentCastResult({ propertyRecords, valuation, retrievedAt });
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("RentCast property data request timed out.");
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  RENTCAST_API_BASE_URL,
  RENTCAST_REQUEST_COUNT,
  RENTCAST_TIMEOUT_MS,
  fetchRentCastPropertyData,
  normalizeRentCastResult,
};
