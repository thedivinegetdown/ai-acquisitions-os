import { ASSET_TYPES } from "../../asset-strategy/assetStrategyContracts";
import { FRESHNESS_POLICY_REGISTRY_VERSION } from "./freshnessContracts";

const DAY_MS = 24 * 60 * 60 * 1000;

function policy({ id, label, description, fields, assetTypes = [], current, revalidation, expiration, explicitOnly = false }) {
  return Object.freeze({
    policyId: id,
    policyVersion: `${id}-policy-v1`,
    registryVersion: FRESHNESS_POLICY_REGISTRY_VERSION,
    label,
    description,
    applicableCanonicalFields: Object.freeze(fields),
    applicableFactIds: Object.freeze([]),
    applicableAssetTypes: Object.freeze(assetTypes),
    currentThroughDays: current ?? null,
    revalidationThroughDays: revalidation ?? null,
    expireAfterDays: expiration ?? null,
    currentThroughMilliseconds: current == null ? null : current * DAY_MS,
    revalidationThroughMilliseconds: revalidation == null ? null : revalidation * DAY_MS,
    expirationMilliseconds: expiration == null ? null : expiration * DAY_MS,
    timestampRules: "source-timestamp-then-approved-observed-timestamp",
    explicitOnly,
    criticalityContext: "Derived from active strategy and Missing Information contracts.",
    operatorExplanation: explicitOnly
      ? "This stable identity fact does not age-expire automatically in v1."
      : "Freshness is calculated from a real eligible source or observation timestamp.",
  });
}

export const FRESHNESS_POLICIES = Object.freeze([
  policy({ id: "stable-identity-freshness-v1", label: "Stable Identity", description: "Stable identity uses explicit freshness only.", fields: ["property.assetType", "property.identity", "property.parcelIdentity", "property.parcelNumber", "property.legalDescription"], explicitOnly: true }),
  policy({ id: "seller-intent-freshness-v1", label: "Seller Intent", description: "Seller motivation and timeline may change quickly.", fields: ["seller.motivation", "seller.timeline"], current: 14, revalidation: 30, expiration: 60 }),
  policy({ id: "seller-price-freshness-v1", label: "Seller Price", description: "Seller price expectations require periodic confirmation.", fields: ["deal.askingPrice"], current: 30, revalidation: 60, expiration: 120 }),
  policy({ id: "residential-property-state-freshness-v1", label: "Residential Property State", description: "Residential condition and occupancy facts can change.", fields: ["property.condition", "property.repairs", "property.occupancy", "property.ownerOccupied", "property.tenantOccupied", "property.mortgageStatus", "property.mortgageBalance", "property.rentEstimate"], assetTypes: [ASSET_TYPES.RESIDENTIAL_HOME], current: 30, revalidation: 60, expiration: 120 }),
  policy({ id: "market-value-freshness-v1", label: "Market Value", description: "Market-value evidence is time-sensitive.", fields: ["property.afterRepairValue", "property.arvOrComps", "property.comparableSales", "property.comparableLandValue", "property.landComps"], current: 90, revalidation: 180, expiration: 270 }),
  policy({ id: "land-title-tax-freshness-v1", label: "Land Title and Tax", description: "Current title, tax, and lien context requires recent support.", fields: ["property.taxesAndLiens"], assetTypes: [ASSET_TYPES.VACANT_RESIDENTIAL_LAND], current: 30, revalidation: 60, expiration: 90 }),
  policy({ id: "land-regulatory-freshness-v1", label: "Land Regulatory, Legal, and Environmental", description: "Land regulatory and environmental context ages under a longer policy.", fields: ["property.legalAccess", "property.zoning", "property.permittedUse", "property.floodZoneStatus", "property.wetlandsStatus", "property.deedRestrictions", "property.subdivisionPotential"], assetTypes: [ASSET_TYPES.VACANT_RESIDENTIAL_LAND], current: 180, revalidation: 365, expiration: 730 }),
  policy({ id: "land-site-services-freshness-v1", label: "Land Site Services", description: "Site-service and physical context requires periodic review.", fields: ["property.roadFrontage", "property.utilities", "property.waterSewerSeptic", "property.topography"], assetTypes: [ASSET_TYPES.VACANT_RESIDENTIAL_LAND], current: 180, revalidation: 365, expiration: 730 }),
  policy({ id: "market-demand-freshness-v1", label: "Market Demand", description: "Current builder and buyer demand changes quickly.", fields: ["property.builderDemand", "property.buyerDemand"], assetTypes: [ASSET_TYPES.VACANT_RESIDENTIAL_LAND], current: 30, revalidation: 60, expiration: 90 }),
]);

export function validateFreshnessPolicy(policyValue) {
  const errors = [];
  if (!policyValue?.policyId || !policyValue?.policyVersion) errors.push("Policy identity and version are required.");
  if (policyValue?.explicitOnly) {
    if ([policyValue.currentThroughDays, policyValue.revalidationThroughDays, policyValue.expireAfterDays].some((value) => value !== null)) errors.push("Explicit-only policies cannot define age thresholds.");
  } else if (!(policyValue?.currentThroughDays >= 0 && policyValue.currentThroughDays <= policyValue.revalidationThroughDays && policyValue.revalidationThroughDays <= policyValue.expireAfterDays)) {
    errors.push("Freshness policy thresholds must be non-negative and ascending.");
  }
  return { valid: errors.length === 0, errors };
}

export function selectFreshnessPolicy({ assetType, canonicalField } = {}) {
  if (!canonicalField) return null;
  return FRESHNESS_POLICIES.find((candidate) =>
    candidate.applicableCanonicalFields.includes(canonicalField) &&
    (!candidate.applicableAssetTypes.length || candidate.applicableAssetTypes.includes(assetType))
  ) || null;
}
