import { fetchVolusiaParcelOwnership } from "../leadDiscovery/volusiaParcelOwnershipSource";
import { buildVolusiaVerifiedPropertyIdentity } from "./propertyIdentityService";
import { listDeals, persistImportedDeals } from "../repositories/dealRepository";
import { saveSupportingEvidenceBatchCommand } from "../repositories/researchRepository";
import { requireActiveOrganizationContext } from "../organizations";
import { buildSupportingEvidenceAppendMutation } from "../research-intelligence/supportingEvidenceService";
import { ASSET_TYPES } from "../asset-strategy/assetStrategyContracts";

export const LAND_RESEARCH_NEXT_ACTION = "Verify zoning/buildability, utilities, legal access, flood/wetlands, and water/septic feasibility before any acquisition action.";
const COUNTY_URL = "https://maps5.vcgov.org/arcgis/rest/services/Open_Data/Open_Data_3/FeatureServer/34";
const TERMINAL = new Set(["closed", "dead lead"]);

async function ownerContext(expectedOrganization) {
  const context = await requireActiveOrganizationContext();
  if (context.role !== "owner") throw new Error("Only an organization owner may confirm external land research.");
  if (expectedOrganization && expectedOrganization !== context.organizationId) {
    throw new Error("The active organization changed. Review the parcel again.");
  }
  return context;
}

function required(value, label, max = 320) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new Error(`${label} is required (maximum ${max} characters).`);
  }
  return value.trim();
}

function httpUrl(value, label) {
  const text = required(value, label, 500);
  const url = new URL(text);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
    throw new Error(`${label} must be an HTTP or HTTPS URL without credentials.`);
  }
  return url.href;
}

function date(value, label) {
  if (!value || !Number.isFinite(new Date(value).getTime())) throw new Error(`${label} is required.`);
  return new Date(value).toISOString();
}

function normalizeInput(input) {
  const parid = required(input.parid, "Seven-digit Volusia PARID", 7);
  if (!/^\d{7}$/.test(parid)) throw new Error("An exact seven-digit Volusia PARID is required; PID and addresses cannot substitute.");
  const listingPrice = input.listingPrice === "" || input.listingPrice == null ? null : Number(input.listingPrice);
  if (listingPrice !== null && (!Number.isFinite(listingPrice) || listingPrice < 0)) throw new Error("Listing price must be nonnegative or unknown.");
  const countyZoning = input.countyZoning?.trim() || "";
  return {
    parid,
    originalParcel: input.originalParcel ? required(input.originalParcel, "Original parcel identifier", 160) : parid,
    location: required(input.location, "Address / location"),
    listingName: required(input.listingName, "Listing source name", 120),
    listingUrl: httpUrl(input.listingUrl, "Listing source URL"),
    listingRetrievedAt: date(input.listingRetrievedAt, "Listing retrieval date"),
    listingPrice,
    listingZoning: input.listingZoning ? required(input.listingZoning, "Listing zoning", 100) : "",
    listingClaims: input.listingClaims ? required(input.listingClaims, "Other listing claims") : "",
    countyZoning: countyZoning ? required(countyZoning, "Reviewed county zoning", 100) : "",
    countyZoningUrl: countyZoning ? httpUrl(input.countyZoningUrl, "Official county zoning source URL") : "",
    countyZoningRetrievedAt: countyZoning ? date(input.countyZoningRetrievedAt, "County zoning retrieval date") : null,
  };
}

async function verify(parid) {
  const response = await fetchVolusiaParcelOwnership(parid);
  const verification = response.success ? response.data : null;
  const identity = buildVolusiaVerifiedPropertyIdentity(verification);
  if (!identity || identity.authoritativeParcelId !== parid) {
    throw new Error("One exact official Volusia parcel match is required. Unavailable, unmatched, and ambiguous results cannot be saved.");
  }
  const classification = verification.parcel.propertyUse?.description?.trim().toUpperCase();
  if (!["VACANT RES", "VACANT RESIDENTIAL"].includes(classification)) {
    throw new Error("The official county record must identify vacant residential land. Review other classifications outside this intake.");
  }
  return { verification, identity };
}

function evidenceCommands(input, verification) {
  const parcel = verification.parcel;
  const conflict = Boolean(input.countyZoning && input.listingZoning && input.countyZoning.toUpperCase() !== input.listingZoning.toUpperCase());
  const county = (fact, extra = {}) => ({
    category: "other_due_diligence", fact, sourceName: "Volusia County Parcel Ownership",
    sourceUrl: COUNTY_URL, sourceReference: `PARID ${parcel.parcelId}`,
    retrievedAt: verification.retrievedAt, status: "VERIFIED", resolutionState: "SUPPORTING",
    parcelIdentifier: parcel.parcelId,
    notes: "Official county record; does not establish buildability, legal access, utility or water/septic feasibility, flood safety, wetlands, or acquisition authority.",
    ...extra,
  });
  const listing = (fact, extra = {}) => ({
    category: "other_due_diligence", fact, sourceName: input.listingName,
    sourceUrl: input.listingUrl, sourceReference: input.originalParcel,
    retrievedAt: input.listingRetrievedAt, status: "INDICATIVE", resolutionState: "SUPPORTING",
    parcelIdentifier: parcel.parcelId, notes: "Owner-reviewed listing claim; not independently verified or promoted to canonical property facts.",
    ...extra,
  });
  const commands = [
    county(`Official parcel PARID ${parcel.parcelId}; classification ${parcel.propertyUse.description}; use code ${parcel.propertyUse.code || "unknown"}.`),
    listing(`External listing reference for ${input.location}.`, { notes: `Original owner-supplied parcel identifier: ${input.originalParcel}; authoritative match is PARID ${parcel.parcelId}. No listing URL is crawled. No outreach authorized.` }),
  ];
  for (const [label, value] of Object.entries(parcel.acreage || {})) {
    if (value != null) commands.push(county(`County acreage (${label}): ${value} acres.`));
  }
  for (const name of parcel.ownerNames || []) commands.push(county(`Public-record owner: ${name}`, {
    category: "ownership_title", ownerPartyName: name, notes: "Public-record ownership is evidence only; participating seller identity and outreach permission remain unknown.",
  }));
  for (const [label, value] of Object.entries(parcel.justValueContext || {})) {
    if (value != null) commands.push(county(`County assessment context (${label}): ${value}.`, { notes: "Assessment context only; not land value, ARV, or seller asking price." }));
  }
  if (input.listingPrice !== null) commands.push(listing(`Public listing asking price observed: $${input.listingPrice}.`, {
    notes: "Public listing price at the supplied retrieval date; not seller negotiation authority, land value, or ARV. Not necessarily current today.",
  }));
  if (input.countyZoning) commands.push(county(`County zoning: ${input.countyZoning}`, {
    sourceName: "Owner-reviewed Volusia county zoning evidence", sourceUrl: input.countyZoningUrl,
    retrievedAt: input.countyZoningRetrievedAt,
    resolutionState: conflict ? "CONFLICTING" : "SUPPORTING",
    notes: "Owner-reviewed official county source; not fetched by this lookup. Zoning alone does not establish buildability. Any listing disagreement remains unresolved.",
  }));
  if (input.listingZoning) commands.push(listing(`Listing zoning claim: ${input.listingZoning}`, { resolutionState: conflict ? "CONFLICTING" : "SUPPORTING" }));
  if (input.listingClaims) commands.push(listing(input.listingClaims));
  return commands;
}

export async function reviewExternalLandCandidate(input) {
  const context = await ownerContext();
  const normalized = normalizeInput(input);
  const { verification, identity } = await verify(normalized.parid);
  const existing = await listDeals();
  if (!existing.success || !existing.metadata?.complete) throw new Error("The organization duplicate check could not complete. Review again before saving.");
  const matches = existing.data.filter((deal) => deal.organization_id === context.organizationId &&
    deal.property_jurisdiction === identity.jurisdiction && deal.authoritative_parcel_id === identity.authoritativeParcelId &&
    !TERMINAL.has(String(deal.stage || "").trim().toLowerCase()));
  if (matches.length > 1) throw new Error("Conflicting active property records require review; no save is allowed.");
  return {
    organizationId: context.organizationId, input: normalized, verification, identity,
    commands: evidenceCommands(normalized, verification), existingDeal: matches[0] || null,
    // Independent source attempt, stable across retries of this reviewed intake.
    importId: `external-land:${identity.jurisdiction}:${identity.authoritativeParcelId}:${crypto.randomUUID()}`,
  };
}

export async function confirmExternalLandCandidate(review) {
  const context = await ownerContext(review.organizationId);
  const { verification, identity } = await verify(review.input.parid);
  const comparable = (parcel) => JSON.stringify({ ...parcel, retrievedAt: null });
  if (comparable(verification.parcel) !== comparable(review.verification.parcel)) {
    throw new Error("The official parcel record changed. Review the evidence again before confirming.");
  }
  // Build the entire bounded evidence list before admission; failure creates no deal.
  let evidenceDeal = { id: review.importId, organization_id: context.organizationId, research_revision: 0, research_evidence: [] };
  for (const command of review.commands) evidenceDeal = { ...evidenceDeal, ...buildSupportingEvidenceAppendMutation({ deal: evidenceDeal, command, actorReference: context.userId }) };
  const parcel = verification.parcel;
  const result = await persistImportedDeals([{
    rowNumber: 1, verifiedPropertyIdentity: identity,
    payload: {
      source: "external-land-research", source_record_id: review.input.listingUrl,
      import_id: review.importId, imported_at: new Date().toISOString(),
      operating_scope: "research_only", asset_type: ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
      stage: "New Lead", status: "Unqualified property research",
      owner_name: null, phone: null, email: null, asking_price: null, arv: null, repairs: null,
      property_address: parcel.situsAddress?.addressLine || review.input.location,
      city: parcel.situsAddress?.city || null, state: "FL", zip: parcel.situsAddress?.postalCode || null,
      county: "Volusia County", parcel_number: identity.authoritativeParcelId,
      next_action: LAND_RESEARCH_NEXT_ACTION, research_evidence: evidenceDeal.research_evidence,
    },
  }]);
  const saved = result.success && result.data?.results?.[0];
  if (!saved?.deal?.id || !["imported", "existing"].includes(saved.status)) {
    throw new Error("The research lead was not confirmed as saved. No unsafe fallback was attempted; review before retrying.");
  }
  return saved;
}

export async function appendExternalLandEvidence(review, deal) {
  await ownerContext(review.organizationId);
  if (deal.organization_id !== review.organizationId || deal.property_jurisdiction !== review.identity.jurisdiction ||
      deal.authoritative_parcel_id !== review.identity.authoritativeParcelId) throw new Error("Evidence must belong to the reviewed organization and parcel.");
  return saveSupportingEvidenceBatchCommand(deal, review.commands);
}
