import { DEAL_FIELD_ALIASES } from "../../utils/dealFields";
import {
  ASSET_CLASSIFICATION_STATES,
  ASSET_TYPES,
} from "../asset-strategy/assetStrategyContracts";
import { ASSET_STRATEGY_SUPPORT_STATES } from "../asset-strategy/assetStrategyContextService";
import { OFFER_READINESS_CHECKLIST } from "../offers/offerReadinessService";
import {
  MISSING_INFORMATION_CRITICALITIES,
  MISSING_INFORMATION_RULESET_VERSION,
  MISSING_INFORMATION_SCOPES,
  STRATEGY_LIMITATION_TYPES,
  VALUE_PRESENCE_POLICIES,
  normalizeMissingInformationProfile,
  normalizeStrategyLimitation,
} from "./missingInformationContracts";

// Distinct responsibility: declare bounded asset-aware requirement profiles by
// adapting existing CRM aliases and the existing residential readiness checklist.
export const MISSING_INFORMATION_PROFILE_IDS = Object.freeze({
  COMMON_ACQUISITION_CORE: "common-acquisition-core-v1",
  RESIDENTIAL_COMPATIBILITY: "residential-compatibility-requirements-v1",
  VACANT_LAND_PREFLIGHT: "vacant-land-preflight-compatibility-v1",
  SAFE_IDENTITY: "safe-opportunity-identity-v1",
});

export const RESIDENTIAL_REQUIREMENT_CANONICAL_FIELDS = Object.freeze({
  "Asking price": "deal.askingPrice",
  "Property condition": "property.condition",
  "Motivation level": "seller.motivation",
  "Seller timeline": "seller.timeline",
  "Mortgage status": "property.mortgageStatus",
  "Repairs needed": "property.repairs",
  "Occupancy status": "property.occupancy",
  "ARV / comps status": "property.arvOrComps",
});

const COMMON_REQUIREMENTS = [
  {
    requirementId: "opportunity-identity",
    canonicalField: "deal.id",
    acceptedFieldAliases: DEAL_FIELD_ALIASES.id,
    label: "Opportunity identity",
    description: "A stable opportunity identifier anchors decision evidence and actions.",
    category: "Identity",
    criticality: MISSING_INFORMATION_CRITICALITIES.BLOCKING,
    requiredFor: [MISSING_INFORMATION_SCOPES.IDENTIFICATION],
    relatedSection: "decision",
  },
  {
    requirementId: "property-or-parcel-identity",
    canonicalField: "property.identity",
    acceptedFieldAliases: [
      ...DEAL_FIELD_ALIASES.address,
      "parcel_id",
      "parcel_number",
      "apn",
    ],
    label: "Property or parcel identity",
    description: "The opportunity must identify the property or parcel under review.",
    category: "Identity",
    criticality: MISSING_INFORMATION_CRITICALITIES.BLOCKING,
    requiredFor: [MISSING_INFORMATION_SCOPES.IDENTIFICATION],
    sellerAnswerable: true,
    sellerQuestion: "What is the property address or parcel identification number?",
    relatedSection: "property",
  },
  {
    requirementId: "seller-identity",
    canonicalField: "seller.name",
    acceptedFieldAliases: DEAL_FIELD_ALIASES.ownerName,
    label: "Seller identity",
    description: "A named seller or owner is needed to maintain accountable seller context.",
    category: "Seller",
    criticality: MISSING_INFORMATION_CRITICALITIES.BLOCKING,
    requiredFor: [MISSING_INFORMATION_SCOPES.IDENTIFICATION],
    relatedSection: "seller",
  },
  {
    requirementId: "asset-classification",
    canonicalField: "property.assetType",
    acceptedFieldAliases: ["asset_type", "assetType", "property_type", "propertyType"],
    label: "Asset classification",
    description: "Asset type determines which strategy-specific requirements may run safely.",
    category: "Identity",
    criticality: MISSING_INFORMATION_CRITICALITIES.BLOCKING,
    requiredFor: [
      MISSING_INFORMATION_SCOPES.DECISION_REVIEW,
      MISSING_INFORMATION_SCOPES.UNDERWRITING,
    ],
    relatedSection: "decision",
  },
  {
    requirementId: "seller-contact-method",
    canonicalField: "seller.contact",
    acceptedFieldAliases: [...DEAL_FIELD_ALIASES.phone, "email", "seller_email", "owner_email"],
    label: "Seller contact method",
    description: "A current phone number or email is needed for active seller outreach.",
    category: "Communication",
    criticality: MISSING_INFORMATION_CRITICALITIES.BLOCKING,
    requiredFor: [MISSING_INFORMATION_SCOPES.SELLER_OUTREACH],
    relatedSection: "communication",
  },
  {
    requirementId: "pipeline-stage",
    canonicalField: "deal.stage",
    acceptedFieldAliases: DEAL_FIELD_ALIASES.stage,
    label: "Current pipeline stage",
    description: "The current stage provides decision and workflow context.",
    category: "Identity",
    criticality: MISSING_INFORMATION_CRITICALITIES.BLOCKING,
    requiredFor: [MISSING_INFORMATION_SCOPES.DECISION_REVIEW],
    relatedSection: "decision",
  },
  {
    requirementId: "seller-target-price",
    canonicalField: "deal.askingPrice",
    acceptedFieldAliases: DEAL_FIELD_ALIASES.askingPrice,
    label: "Asking price or seller target",
    description: "The seller's target helps frame the next information-gathering conversation.",
    category: "Financial",
    criticality: MISSING_INFORMATION_CRITICALITIES.ADVISORY,
    requiredFor: [MISSING_INFORMATION_SCOPES.DECISION_REVIEW],
    valuePresencePolicy: VALUE_PRESENCE_POLICIES.ANY_FINITE_NUMBER,
    sellerAnswerable: true,
    sellerQuestion: "What price are you hoping to receive for the property?",
    relatedSection: "seller",
  },
  {
    requirementId: "seller-motivation",
    canonicalField: "seller.motivation",
    acceptedFieldAliases: DEAL_FIELD_ALIASES.motivation,
    label: "Seller motivation",
    description: "Motivation provides context for a responsible acquisition decision.",
    category: "Seller",
    criticality: MISSING_INFORMATION_CRITICALITIES.ADVISORY,
    requiredFor: [MISSING_INFORMATION_SCOPES.DECISION_REVIEW],
    valuePresencePolicy: VALUE_PRESENCE_POLICIES.EXPLICIT_KNOWN_STATUS,
    sellerAnswerable: true,
    sellerQuestion: "What is motivating you to consider selling?",
    relatedSection: "seller",
  },
  {
    requirementId: "seller-timeline",
    canonicalField: "seller.timeline",
    acceptedFieldAliases: DEAL_FIELD_ALIASES.timeline,
    label: "Seller timeline",
    description: "The seller's intended timing informs the next safe follow-up.",
    category: "Seller",
    criticality: MISSING_INFORMATION_CRITICALITIES.ADVISORY,
    requiredFor: [MISSING_INFORMATION_SCOPES.DECISION_REVIEW],
    sellerAnswerable: true,
    sellerQuestion: "What timeline would work best for you?",
    relatedSection: "seller",
  },
];

function residentialRequirement(checklistItem) {
  const canonicalField = RESIDENTIAL_REQUIREMENT_CANONICAL_FIELDS[checklistItem.label];
  const questionByLabel = {
    "Asking price": "What price are you hoping to receive for the property?",
    "Property condition": "How would you describe the property's current condition?",
    "Motivation level": "What is motivating you to consider selling?",
    "Seller timeline": "What timeline would work best for you?",
    "Mortgage status": "Is there currently a mortgage or other loan on the property?",
    "Repairs needed": "What repairs or updates does the property currently need?",
    "Occupancy status": "Is the property currently occupied?",
  };
  const isMarketEvidence = checklistItem.label === "ARV / comps status";
  const isSellerContext = [
    "Asking price",
    "Motivation level",
    "Seller timeline",
  ].includes(checklistItem.label);
  return {
    requirementId: `residential-${canonicalField.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
    canonicalField,
    acceptedFieldAliases: checklistItem.keys,
    label: checklistItem.label,
    description: "Required by the existing residential offer-readiness compatibility checklist.",
    category: isMarketEvidence
      ? "Market and Exit"
      : isSellerContext
        ? checklistItem.label === "Asking price"
          ? "Financial"
          : "Seller"
        : "Property",
    criticality: MISSING_INFORMATION_CRITICALITIES.BLOCKING,
    requiredFor: [MISSING_INFORMATION_SCOPES.OFFER_READINESS],
    valuePresencePolicy: VALUE_PRESENCE_POLICIES.LEGACY_COMPATIBILITY_VALUE,
    sellerAnswerable: Boolean(questionByLabel[checklistItem.label]),
    sellerQuestion: questionByLabel[checklistItem.label],
    researchRequired: isMarketEvidence,
    researchGuidance: isMarketEvidence
      ? "Obtain and review comparable residential-sale evidence using the approved process."
      : null,
    relatedSection: isSellerContext ? "seller" : "property",
    compatibilityOnly: true,
    supersessionWarning:
      "AS-02 will define the final Residential Acquisition Strategy requirements.",
  };
}

const LAND_REQUIREMENTS = [
  ["parcel-identity", "property.parcelIdentity", ["parcel_id", "parcel_number", "apn", "parcel"], "Parcel identity", "Identity", true, "Do you have a survey or parcel identification number?", "Verify parcel identity using available county records.", "documents"],
  ["legal-access", "property.legalAccess", ["legal_access", "access_status", "road_access"], "Legal access", "Land Access and Buildability", true, "Do you know whether the parcel has legal road access?", "Confirm legal access using deed, survey, plat, or title evidence.", "documents"],
  ["road-frontage", "property.roadFrontage", ["road_frontage", "frontage", "road_frontage_feet"], "Road frontage", "Land Access and Buildability", false, "Do you know how much road frontage the property has?", "Review available survey, plat, or county parcel information for road frontage.", "property"],
  ["zoning", "property.zoning", ["zoning", "zoning_code", "zoning_classification"], "Zoning", "Land Access and Buildability", true, "Do you know the property's current zoning?", "Review zoning records using the approved research process.", "property"],
  ["permitted-use", "property.permittedUse", ["permitted_use", "permitted_uses", "allowed_use"], "Permitted use", "Land Access and Buildability", true, "Do you know what uses are currently permitted on the property?", "Review zoning and permitted-use records using the approved research process.", "property"],
  ["utilities", "property.utilities", ["utilities", "utility_access", "utilities_available"], "Utilities", "Land Access and Buildability", false, "Are utilities available at or near the property?", "Review available utility-access information and retain supporting evidence.", "property"],
  ["water-sewer-septic", "property.waterSewerSeptic", ["water_access", "sewer_access", "septic_feasibility", "perc_test", "water_sewer_septic"], "Water, sewer, or septic feasibility", "Land Access and Buildability", false, "Has the property had a septic or perc evaluation?", "Review available water, sewer, septic, or perc documentation without assuming feasibility.", "documents"],
  ["flood-zone-status", "property.floodZoneStatus", ["flood_zone", "flood_status", "flood_zone_status"], "Flood-zone status", "Environment", true, "Are you aware of any flood-zone issues affecting the property?", "Review available flood records and retain the source evidence.", "property"],
  ["wetlands-status", "property.wetlandsStatus", ["wetlands", "wetlands_status", "wetland_status"], "Wetlands status", "Environment", true, "Are you aware of any wetlands affecting the property?", "Review available wetlands records and retain the source evidence.", "property"],
  ["topography", "property.topography", ["topography", "slope", "terrain"], "Topography", "Environment", false, "How would you describe the terrain or slope of the property?", "Review available topography evidence without making a buildability determination.", "property"],
  ["deed-restrictions", "property.deedRestrictions", ["deed_restrictions", "restrictions", "covenants"], "Deed restrictions", "Legal and Title", false, "Are you aware of any deed restrictions or covenants?", "Review deed, title, and recorded restriction evidence using the approved process.", "documents"],
  ["subdivision-potential", "property.subdivisionPotential", ["subdivision_potential", "subdividable", "subdivision_status"], "Subdivision potential", "Land Access and Buildability", false, "Has anyone reviewed whether the parcel may be subdivided?", "Review applicable subdivision rules; do not treat potential as confirmed without evidence.", "property"],
  ["taxes-and-liens", "property.taxesAndLiens", ["taxes_and_liens", "tax_status", "liens", "delinquent_taxes"], "Taxes and liens", "Legal and Title", true, "Are you aware of any unpaid property taxes or recorded liens?", "Review taxes and recorded liens using approved research processes.", "documents"],
  ["comparable-land-sales", "property.landComps", ["land_comps", "comparable_land_sales", "land_sales_evidence"], "Comparable land sales", "Market and Exit", false, null, "Obtain comparable land-sale evidence using the approved research process.", "property"],
  ["builder-demand", "property.builderDemand", ["builder_demand", "buyer_demand", "land_buyer_demand"], "Builder demand", "Market and Exit", false, null, "Review available builder or buyer-demand evidence without assuming market demand.", "closing"],
].map(
  ([id, canonicalField, aliases, label, category, blocking, question, guidance, section]) => ({
    requirementId: `land-${id}`,
    canonicalField,
    acceptedFieldAliases: aliases,
    label,
    description: `${label} is part of the detection-only Vacant Land Safety Preflight.`,
    category,
    criticality: blocking
      ? MISSING_INFORMATION_CRITICALITIES.BLOCKING
      : MISSING_INFORMATION_CRITICALITIES.ADVISORY,
    requiredFor: [
      blocking
        ? MISSING_INFORMATION_SCOPES.BUILDABILITY_REVIEW
        : MISSING_INFORMATION_SCOPES.DECISION_REVIEW,
    ],
    valuePresencePolicy: VALUE_PRESENCE_POLICIES.EXPLICIT_KNOWN_STATUS,
    sellerAnswerable: Boolean(question),
    sellerQuestion: question,
    researchRequired: true,
    researchGuidance: guidance,
    relatedSection: section,
    compatibilityOnly: true,
    supersessionWarning:
      "AS-03 will define final vacant-land readiness and underwriting requirements.",
  })
);

export const COMMON_ACQUISITION_CORE_PROFILE = Object.freeze(
  normalizeMissingInformationProfile({
    profileId: MISSING_INFORMATION_PROFILE_IDS.COMMON_ACQUISITION_CORE,
    label: "Common Acquisition Core",
    description: "Shared identity, seller, and decision-context facts used across asset types.",
    requirements: COMMON_REQUIREMENTS,
  })
);

export const RESIDENTIAL_COMPATIBILITY_PROFILE = Object.freeze(
  normalizeMissingInformationProfile({
    profileId: MISSING_INFORMATION_PROFILE_IDS.RESIDENTIAL_COMPATIBILITY,
    label: "Residential Compatibility Requirements",
    description: "Detection-only adaptation of the existing offer-readiness compatibility checklist.",
    assetType: ASSET_TYPES.RESIDENTIAL_HOME,
    compatibilityOnly: true,
    supersessionWarning:
      "AS-02 will define the final Residential Acquisition Strategy requirements.",
    requirements: OFFER_READINESS_CHECKLIST.map(residentialRequirement),
  })
);

export const VACANT_LAND_PREFLIGHT_PROFILE = Object.freeze(
  normalizeMissingInformationProfile({
    profileId: MISSING_INFORMATION_PROFILE_IDS.VACANT_LAND_PREFLIGHT,
    label: "Vacant Land Safety Preflight",
    description: "Detection-only safety preflight; it does not evaluate land readiness, value, or buildability.",
    assetType: ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
    compatibilityOnly: true,
    supersessionWarning:
      "AS-03 will define final vacant-land readiness and underwriting requirements.",
    requirements: LAND_REQUIREMENTS,
  })
);

export const SAFE_IDENTITY_PROFILE = Object.freeze(
  normalizeMissingInformationProfile({
    profileId: MISSING_INFORMATION_PROFILE_IDS.SAFE_IDENTITY,
    label: "Safe Opportunity Identity",
    description: "Identity-only requirements for an unsupported asset classification.",
    requirements: COMMON_REQUIREMENTS.filter((entry) =>
      ["opportunity-identity", "property-or-parcel-identity", "seller-identity", "asset-classification"].includes(
        entry.requirementId
      )
    ),
  })
);

function limitationForContext(context) {
  const evidenceReferenceIds = (
    Array.isArray(context.classificationEvidence)
      ? context.classificationEvidence
      : []
  ).map((entry) => entry.evidenceId);
  const common = {
    assetType: context.assetType,
    strategyId: context.selectedStrategyId,
    evidenceReferenceIds,
    rulesetVersion: MISSING_INFORMATION_RULESET_VERSION,
    relatedSection: "decision",
  };

  if (
    context.classificationState === ASSET_CLASSIFICATION_STATES.UNCLASSIFIED ||
    context.classificationState === ASSET_CLASSIFICATION_STATES.AMBIGUOUS
  ) {
    const reviewRequired =
      context.classificationState === ASSET_CLASSIFICATION_STATES.AMBIGUOUS;
    return normalizeStrategyLimitation({
      ...common,
      limitationId: reviewRequired
        ? "limitation:asset-profile-classification-review"
        : "limitation:asset-profile-classification-required",
      type: STRATEGY_LIMITATION_TYPES.CAPABILITY_BLOCKED,
      label: reviewRequired
        ? "Asset-specific requirements are blocked pending classification review."
        : "Asset-specific requirements are blocked pending classification.",
      explanation:
        "Common Acquisition Core remains available. No residential or land profile is selected implicitly.",
    });
  }

  if (context.assetType === ASSET_TYPES.VACANT_RESIDENTIAL_LAND) {
    return normalizeStrategyLimitation({
      ...common,
      limitationId: "limitation:vacant-land-strategy-not-implemented",
      type: STRATEGY_LIMITATION_TYPES.STRATEGY_NOT_IMPLEMENTED,
      label: "Vacant Land Strategy is not yet implemented.",
      explanation: "The safety preflight detects missing facts only. AS-03 will define final land readiness and underwriting.",
    });
  }
  if (context.assetType === ASSET_TYPES.SMALL_MULTIFAMILY) {
    return normalizeStrategyLimitation({
      ...common,
      limitationId: "limitation:small-multifamily-strategy-not-implemented",
      type: STRATEGY_LIMITATION_TYPES.STRATEGY_NOT_IMPLEMENTED,
      label: "Small Multifamily Strategy is not yet implemented.",
      explanation: "Only Common Acquisition Core facts are evaluated in this execution order.",
    });
  }
  if (
    context.assetType === ASSET_TYPES.MANUFACTURED_HOME ||
    context.assetType === ASSET_TYPES.COMMERCIAL
  ) {
    return normalizeStrategyLimitation({
      ...common,
      limitationId: `limitation:${context.assetType}-strategy-deferred`,
      type: STRATEGY_LIMITATION_TYPES.STRATEGY_DEFERRED,
      label: `${context.strategyLabel} is deferred.`,
      explanation: "Only Common Acquisition Core facts are evaluated while this strategy remains deferred.",
    });
  }
  if (
    context.classificationState === ASSET_CLASSIFICATION_STATES.UNSUPPORTED ||
    context.strategySupportState === ASSET_STRATEGY_SUPPORT_STATES.UNSUPPORTED
  ) {
    return normalizeStrategyLimitation({
      ...common,
      limitationId: "limitation:unsupported-asset-type",
      type: STRATEGY_LIMITATION_TYPES.UNSUPPORTED_ASSET_TYPE,
      label: "The stored asset type is not supported.",
      explanation: "Only safe identity requirements can be evaluated until a supported asset type is recorded.",
    });
  }
  return null;
}

export function selectMissingInformationProfiles(assetStrategyContext = {}) {
  const context = assetStrategyContext || {};
  const classified =
    context.classificationState === ASSET_CLASSIFICATION_STATES.CLASSIFIED &&
    context.manualReviewRequired !== true;
  let profiles = [COMMON_ACQUISITION_CORE_PROFILE];
  let activeProfile = COMMON_ACQUISITION_CORE_PROFILE;

  if (classified && context.assetType === ASSET_TYPES.RESIDENTIAL_HOME) {
    profiles = [...profiles, RESIDENTIAL_COMPATIBILITY_PROFILE];
    activeProfile = RESIDENTIAL_COMPATIBILITY_PROFILE;
  } else if (
    classified &&
    context.assetType === ASSET_TYPES.VACANT_RESIDENTIAL_LAND
  ) {
    profiles = [...profiles, VACANT_LAND_PREFLIGHT_PROFILE];
    activeProfile = VACANT_LAND_PREFLIGHT_PROFILE;
  } else if (
    context.classificationState === ASSET_CLASSIFICATION_STATES.UNSUPPORTED
  ) {
    profiles = [SAFE_IDENTITY_PROFILE];
    activeProfile = SAFE_IDENTITY_PROFILE;
  }

  const limitation = limitationForContext(context);
  return {
    profiles,
    activeProfile,
    limitations: limitation ? [limitation] : [],
  };
}
