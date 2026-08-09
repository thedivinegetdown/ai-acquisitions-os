import { DEAL_FIELD_ALIASES } from "../../../utils/dealFields";
import { ASSET_TYPES } from "../../asset-strategy/assetStrategyContracts";
import {
  RESIDENTIAL_ACQUISITION_STRATEGY,
  RESIDENTIAL_FACT_IDS,
} from "../../asset-strategy/residential/residentialStrategyContracts";
import {
  VACANT_LAND_FACT_IDS,
  VACANT_LAND_FACT_REGISTRY,
} from "../../asset-strategy/vacant-land/vacantLandStrategyContracts";
import { selectMissingInformationProfiles } from "../missingInformationProfiles";
import { RESIDENTIAL_READINESS_POLICY } from "../../decision-intelligence/readiness/residentialReadinessPolicy";
import { VACANT_LAND_READINESS_POLICY } from "../../decision-intelligence/readiness/vacantLandReadinessPolicy";
import {
  CONFLICT_ACTION_TYPES,
  CONFLICT_COMPARISON_TYPES,
  CONFLICT_CRITICALITIES,
} from "./conflictContracts";

export const CONFLICT_PROFILE_IDS = Object.freeze({
  COMMON: "common-acquisition-conflicts-v1",
  RESIDENTIAL: "residential-conflicts-v1",
  VACANT_LAND: "vacant-land-conflicts-v1",
});

const RESIDENTIAL_FACTS = new Map(
  (RESIDENTIAL_ACQUISITION_STRATEGY.capabilities?.requiredFacts || []).map((entry) => [entry.canonicalField, entry.factId])
);
const LAND_FACTS = new Map(VACANT_LAND_FACT_REGISTRY.map((entry) => [entry.canonicalField, entry.factId]));
const RESIDENTIAL_READINESS_FACTS = new Set(RESIDENTIAL_READINESS_POLICY.gates.flatMap((gate) => gate.requiredFactIds || []));
const LAND_READINESS_FACTS = new Set(VACANT_LAND_READINESS_POLICY.gates.flatMap((gate) => gate.requiredFactIds || []));

const STATUS_MAPPINGS = Object.freeze({
  "property.legalAccess": { yes: "documented", documented: "documented", "documented access": "documented", easement: "easement review", "easement access": "easement review", no: "none", "no access": "none" },
  "property.floodZoneStatus": { no: "no known constraint", none: "no known constraint", clear: "no known constraint", yes: "constraint present", "in flood zone": "constraint present" },
  "property.wetlandsStatus": { no: "no known constraint", none: "no known constraint", clear: "no known constraint", yes: "constraint present", present: "constraint present" },
  "property.occupancy": { vacant: "vacant", "owner occupied": "owner occupied", "tenant occupied": "tenant occupied", rented: "tenant occupied" },
  "property.mortgageStatus": { none: "no mortgage", "no mortgage": "no mortgage", paid: "no mortgage", current: "current", delinquent: "delinquent" },
});

const SUPPLEMENTAL = Object.freeze({
  [ASSET_TYPES.RESIDENTIAL_HOME]: [
    ["property.mortgageBalance", RESIDENTIAL_FACT_IDS.MORTGAGE_BALANCE, DEAL_FIELD_ALIASES.mortgageBalance, "Mortgage balance", CONFLICT_COMPARISON_TYPES.MONEY, "seller"],
    ["property.rentEstimate", RESIDENTIAL_FACT_IDS.RENT_ESTIMATE, DEAL_FIELD_ALIASES.rent, "Rent estimate", CONFLICT_COMPARISON_TYPES.MONEY, "numbers"],
  ],
  [ASSET_TYPES.VACANT_RESIDENTIAL_LAND]: [
    ["property.buyerDemand", VACANT_LAND_FACT_IDS.BUYER_DEMAND, DEAL_FIELD_ALIASES.landBuyerDemand, "Land-buyer demand", CONFLICT_COMPARISON_TYPES.KNOWN_STATUS, "closing"],
  ],
});

function comparisonType(canonicalField) {
  if (canonicalField === "property.assetType") return CONFLICT_COMPARISON_TYPES.ASSET_TYPE;
  if (["property.parcelIdentity", "property.identity", "deal.id"].includes(canonicalField)) return CONFLICT_COMPARISON_TYPES.PARCEL_IDENTIFIER;
  if (canonicalField === "seller.timeline") return CONFLICT_COMPARISON_TYPES.TIMELINE;
  if (/askingPrice|afterRepairValue|repairs|mortgageBalance|rentEstimate|comparableLandValue/.test(canonicalField)) return CONFLICT_COMPARISON_TYPES.MONEY;
  if (/motivation|parcelSize|roadFrontage/.test(canonicalField)) return CONFLICT_COMPARISON_TYPES.NUMBER;
  if (/Status|condition|occupancy|legalAccess|zoning|permittedUse|utilities|waterSewerSeptic|topography|deedRestrictions|subdivisionPotential|builderDemand|buyerDemand/.test(canonicalField)) return CONFLICT_COMPARISON_TYPES.KNOWN_STATUS;
  return CONFLICT_COMPARISON_TYPES.TEXT;
}

function priority(canonicalField, blocking) {
  if (canonicalField === "property.assetType") return 0;
  if (/legalAccess|taxesAndLiens|flood|wetlands|zoning|permittedUse/.test(canonicalField)) return blocking ? 10 : 60;
  if (/afterRepairValue|repairs|comparableLandValue/.test(canonicalField)) return 20;
  if (/askingPrice|motivation|timeline/.test(canonicalField)) return 30;
  if (/marketValue|landComps/.test(canonicalField)) return 40;
  return blocking ? 50 : 70;
}

function actionFor(section, assetType) {
  const actionBySection = {
    documents: CONFLICT_ACTION_TYPES.REVIEW_DOCUMENTS,
    property: assetType === ASSET_TYPES.VACANT_RESIDENTIAL_LAND ? CONFLICT_ACTION_TYPES.REVIEW_PARCEL : CONFLICT_ACTION_TYPES.REVIEW_PROPERTY,
    numbers: CONFLICT_ACTION_TYPES.REVIEW_NUMBERS,
    seller: CONFLICT_ACTION_TYPES.REVIEW_SELLER,
    communication: CONFLICT_ACTION_TYPES.REVIEW_COMMUNICATION,
  };
  return actionBySection[section] || CONFLICT_ACTION_TYPES.REVIEW_CONFLICT;
}

function factIdFor(canonicalField, assetType) {
  if (canonicalField === "property.assetType") {
    return assetType === ASSET_TYPES.VACANT_RESIDENTIAL_LAND
      ? VACANT_LAND_FACT_IDS.ASSET_CLASSIFICATION
      : RESIDENTIAL_FACT_IDS.ASSET_CLASSIFICATION;
  }
  return assetType === ASSET_TYPES.VACANT_RESIDENTIAL_LAND
    ? LAND_FACTS.get(canonicalField) || null
    : RESIDENTIAL_FACTS.get(canonicalField) || null;
}

function isReadinessBlocking(factId, assetType) {
  return assetType === ASSET_TYPES.VACANT_RESIDENTIAL_LAND
    ? LAND_READINESS_FACTS.has(factId)
    : RESIDENTIAL_READINESS_FACTS.has(factId);
}

function mergeRequirements(requirements, assetType) {
  const byField = new Map();
  requirements.forEach((requirement) => {
    if (["seller.contact", "property.marketValueSupport"].includes(requirement.canonicalField)) return;
    const factId = factIdFor(requirement.canonicalField, assetType);
    const blocking = requirement.criticality === "blocking" || isReadinessBlocking(factId, assetType);
    const current = byField.get(requirement.canonicalField);
    const descriptor = {
      canonicalField: requirement.canonicalField,
      factId,
      requirementIds: [requirement.requirementId],
      label: requirement.label,
      description: requirement.description,
      aliases: requirement.canonicalField === "property.identity"
        ? assetType === ASSET_TYPES.VACANT_RESIDENTIAL_LAND
          ? DEAL_FIELD_ALIASES.parcelIdentity
          : DEAL_FIELD_ALIASES.address
        : requirement.acceptedFieldAliases || [],
      comparisonType: comparisonType(requirement.canonicalField),
      statusMappings: STATUS_MAPPINGS[requirement.canonicalField] || {},
      criticality: blocking ? CONFLICT_CRITICALITIES.BLOCKING : CONFLICT_CRITICALITIES.ADVISORY,
      relatedSection: requirement.relatedSection || "decision",
      priority: priority(requirement.canonicalField, blocking),
    };
    if (!current) byField.set(requirement.canonicalField, descriptor);
    else {
      current.aliases = [...new Set([...current.aliases, ...descriptor.aliases])];
      current.requirementIds = [...new Set([...current.requirementIds, ...descriptor.requirementIds])];
      if (blocking) current.criticality = CONFLICT_CRITICALITIES.BLOCKING;
      current.priority = Math.min(current.priority, descriptor.priority);
    }
  });
  (SUPPLEMENTAL[assetType] || []).forEach(([canonicalField, factId, aliases, label, type, section]) => {
    if (!byField.has(canonicalField)) {
      byField.set(canonicalField, {
        canonicalField, factId, requirementIds: [], label,
        description: `${label} is optional strategy context.`, aliases,
        comparisonType: type, statusMappings: STATUS_MAPPINGS[canonicalField] || {},
        criticality: CONFLICT_CRITICALITIES.ADVISORY,
        relatedSection: section, priority: priority(canonicalField, false),
      });
    }
  });
  return [...byField.values()].map((descriptor, index) => ({
    ...descriptor,
    fieldOrder: index,
    affectedMetricIds: descriptor.factId ? ["offer-readiness", "pursuit-score"] : [],
    affectedCapabilityIds: descriptor.factId ? [assetType === ASSET_TYPES.VACANT_RESIDENTIAL_LAND ? "land-strategy-analysis" : "residential-strategy-analysis"] : [],
    safeReviewActions: [{
      actionId: `review:${descriptor.canonicalField}`,
      actionType: actionFor(descriptor.relatedSection, assetType),
      label: `Review ${descriptor.label}`,
      explanation: `Compare the represented ${descriptor.label.toLowerCase()} values and their Evidence without selecting automatically.`,
      targetSection: descriptor.relatedSection,
    }],
  }));
}

export function buildConflictDetectionProfiles(assetStrategyContext = {}) {
  const selection = selectMissingInformationProfiles(assetStrategyContext);
  const requirements = selection.profiles.flatMap((profile) => profile.requirements || []);
  const assetType = assetStrategyContext.assetType;
  return [{
    profileId: CONFLICT_PROFILE_IDS.COMMON,
    assetType,
    descriptors: mergeRequirements(requirements, assetType),
  }, ...(assetType === ASSET_TYPES.RESIDENTIAL_HOME
    ? [{ profileId: CONFLICT_PROFILE_IDS.RESIDENTIAL, assetType, descriptors: [] }]
    : assetType === ASSET_TYPES.VACANT_RESIDENTIAL_LAND
      ? [{ profileId: CONFLICT_PROFILE_IDS.VACANT_LAND, assetType, descriptors: [] }]
      : [])];
}
