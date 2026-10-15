export const PROPERTY_JURISDICTIONS = Object.freeze({
  ORANGE_COUNTY_FL: "us-fl-orange-county",
  VOLUSIA_COUNTY_FL: "us-fl-volusia-county",
});

export const PROPERTY_VERIFICATION_SOURCES = Object.freeze({
  ORANGE_PROPERTY_APPRAISER: "orange-county-property-appraiser",
  VOLUSIA_PARCEL_OWNERSHIP: "volusia-parcel-ownership",
});

const CONTRACTS = Object.freeze({
  [PROPERTY_JURISDICTIONS.ORANGE_COUNTY_FL]: Object.freeze({
    source: PROPERTY_VERIFICATION_SOURCES.ORANGE_PROPERTY_APPRAISER,
    parcelPattern: /^\d{15}$/,
  }),
  [PROPERTY_JURISDICTIONS.VOLUSIA_COUNTY_FL]: Object.freeze({
    source: PROPERTY_VERIFICATION_SOURCES.VOLUSIA_PARCEL_OWNERSHIP,
    parcelPattern: /^\d{7}$/,
  }),
});

function timestamp(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

export function normalizeVerifiedPropertyIdentity(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const jurisdiction = String(value.jurisdiction || "").trim().toLowerCase();
  const authoritativeParcelId = String(value.authoritativeParcelId || "").trim();
  const verificationSource = String(value.verificationSource || "").trim();
  const verifiedAt = timestamp(value.verifiedAt);
  const contract = CONTRACTS[jurisdiction];
  if (
    !contract ||
    verificationSource !== contract.source ||
    !contract.parcelPattern.test(authoritativeParcelId) ||
    !verifiedAt
  ) {
    return null;
  }
  return { jurisdiction, authoritativeParcelId, verificationSource, verifiedAt };
}

export function buildOrangeVerifiedPropertyIdentity(enrichment) {
  if (
    enrichment?.status !== "matched" ||
    enrichment?.source !== PROPERTY_VERIFICATION_SOURCES.ORANGE_PROPERTY_APPRAISER
  ) {
    return null;
  }
  return normalizeVerifiedPropertyIdentity({
    jurisdiction: PROPERTY_JURISDICTIONS.ORANGE_COUNTY_FL,
    authoritativeParcelId: enrichment.parcelId,
    verificationSource: enrichment.source,
    verifiedAt: enrichment.retrievedAt,
  });
}

export function buildVolusiaVerifiedPropertyIdentity(result) {
  if (
    result?.status !== "matched" ||
    result?.propertyVerificationState !== "PARCEL_VERIFIED" ||
    result?.source !== PROPERTY_VERIFICATION_SOURCES.VOLUSIA_PARCEL_OWNERSHIP ||
    result?.verifiedParcelId !== result?.parcel?.parcelId
  ) {
    return null;
  }
  return normalizeVerifiedPropertyIdentity({
    jurisdiction: PROPERTY_JURISDICTIONS.VOLUSIA_COUNTY_FL,
    authoritativeParcelId: result.verifiedParcelId,
    verificationSource: result.source,
    verifiedAt: result.retrievedAt || result.parcel?.retrievedAt,
  });
}

export function propertyIdentityKey(value) {
  const identity = normalizeVerifiedPropertyIdentity(value);
  return identity
    ? `${identity.jurisdiction}:${identity.authoritativeParcelId}`
    : "";
}
