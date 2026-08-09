import { uniqueStrings } from "../../../utils/text";
import {
  ASSET_CLASSIFICATION_STATES,
  ASSET_TYPES,
} from "../assetStrategyContracts";
import {
  ASSET_STRATEGY_SUPPORT_STATES,
  buildAssetStrategyContext,
} from "../assetStrategyContextService";
import { scoreStrategyTimelineDays } from "../strategyTimeline";
import {
  DECISION_SOURCE_MODES,
  normalizeDecisionTimestamp,
} from "../../decision-intelligence/decisionContracts";
import {
  PURSUIT_SCORING_EVALUATION_STATES,
  PURSUIT_SCORING_EXECUTION_MODES,
  PURSUIT_SCORING_INFORMATION_STATES,
  evaluatePursuitScore,
  normalizePursuitScoringObservation,
} from "../../decision-intelligence/pursuit-scoring";
import {
  INFORMATION_STATES,
  evaluateMissingInformation,
} from "../../research-intelligence";
import { adaptVacantLandFacts, getVacantLandFact } from "./vacantLandFactAdapter";
import {
  VACANT_LAND_ACQUISITION_STRATEGY,
  VACANT_LAND_CAPABILITY_SUPPORT,
  VACANT_LAND_EXIT_CANDIDATE_STATES,
  VACANT_LAND_FACT_IDS,
  VACANT_LAND_PURSUIT_PROFILE_ID,
  VACANT_LAND_PURSUIT_RULESET_VERSION,
  VACANT_LAND_REQUIREMENT_IDS,
  VACANT_LAND_REVIEW_STATES,
  VACANT_LAND_STRATEGY_ID,
  VACANT_LAND_STRATEGY_READ_MODEL_VERSION,
  VACANT_LAND_STRATEGY_VERSION,
  normalizeVacantLandExitCandidate,
  normalizeVacantLandFeasibilitySignal,
  validateVacantLandStrategyContract,
} from "./vacantLandStrategyContracts";
import {
  VACANT_LAND_PURSUIT_FACTOR_IDS,
  VACANT_LAND_PURSUIT_SCORING_PROFILE,
  validateVacantLandPursuitProfile,
} from "./vacantLandPursuitProfile";
import { evaluateVacantLandValuation } from "./vacantLandValuationService";

// Distinct responsibility: orchestrate pure land facts, valuation, feasibility,
// review paths, observations, and scoring into one bounded strategy read model.
export const VACANT_LAND_FEASIBILITY_RULESET_VERSION = "vacant-land-feasibility-v1";
export const VACANT_LAND_EXIT_RULESET_VERSION = "vacant-land-exit-candidates-v1";

const safeObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const finiteNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const fact = (model, id) => getVacantLandFact(model, id);
const factValue = (model, id) => fact(model, id)?.state === INFORMATION_STATES.PRESENT ? fact(model, id).value : null;
const evidenceFor = (model, ids) => uniqueStrings(ids.flatMap((id) => fact(model, id)?.evidenceReferenceIds || [])).slice(0, 100);
const conflictsFor = (model, ids) => uniqueStrings(ids.flatMap((id) => fact(model, id)?.conflictIds || [])).slice(0, 40);

function informationState(model, ids) {
  const states = ids.map((id) => fact(model, id)?.state);
  for (const state of [INFORMATION_STATES.CONFLICTING, INFORMATION_STATES.STALE, INFORMATION_STATES.UNVERIFIED, INFORMATION_STATES.UNKNOWN, INFORMATION_STATES.MISSING]) {
    if (states.includes(state)) return state;
  }
  return states.length && states.every((state) => state === INFORMATION_STATES.PRESENT)
    ? PURSUIT_SCORING_INFORMATION_STATES.PRESENT
    : PURSUIT_SCORING_INFORMATION_STATES.MISSING;
}

function observation({ evaluatedTimestamp, explanation, factIds, factorId, missingInformationReadModel, normalizedScore, rawValue, requirementIds = [], factReadModel, evidenceIds = [] }) {
  const score = finiteNumber(normalizedScore);
  const state = informationState(factReadModel, factIds);
  const sourceFacts = factIds.map((id) => fact(factReadModel, id)).filter(Boolean);
  return normalizePursuitScoringObservation({
    observationId: factReadModel?.dealId ? `land-score-observation:${encodeURIComponent(factReadModel.dealId)}:${factorId}` : null,
    factorId,
    strategyId: VACANT_LAND_STRATEGY_ID,
    assetType: ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
    evaluationState: score !== null ? PURSUIT_SCORING_EVALUATION_STATES.EVALUATED : PURSUIT_SCORING_EVALUATION_STATES.NOT_EVALUATED,
    informationState: score !== null ? PURSUIT_SCORING_INFORMATION_STATES.PRESENT : state,
    rawValue,
    normalizedValue: rawValue,
    normalizedScore: score,
    applicable: true,
    evidenceReferenceIds: uniqueStrings([...evidenceFor(factReadModel, factIds), ...evidenceIds]).slice(0, 100),
    missingInformationItemIds: (missingInformationReadModel?.openItems || []).filter((item) => requirementIds.includes(item.requirementId)).map((item) => item.itemId || item.requirementId),
    conflictIds: conflictsFor(factReadModel, factIds),
    verificationState: sourceFacts.some((item) => item.verificationState === "unverified") ? "unverified" : "unknown",
    freshnessState: sourceFacts.some((item) => item.freshnessState === "stale") ? "stale" : "unknown",
    sourceMode: sourceFacts.some((item) => item.sourceMode === DECISION_SOURCE_MODES.DETERMINISTIC_COMPATIBILITY) ? DECISION_SOURCE_MODES.DETERMINISTIC_COMPATIBILITY : DECISION_SOURCE_MODES.DETERMINISTIC,
    explanation,
    evaluatedTimestamp,
    sourceTimestamp: sourceFacts.map((item) => item.sourceTimestamp).filter(Boolean).sort().at(-1) || null,
    partialDataWarnings: uniqueStrings(sourceFacts.flatMap((item) => item.partialDataWarnings || [])).slice(0, 16),
  });
}

export function scoreLandDiscount(value) {
  const ratio = finiteNumber(value); if (ratio === null) return null;
  if (ratio >= 0.4) return 100; if (ratio >= 0.3) return 90; if (ratio >= 0.2) return 80;
  if (ratio >= 0.1) return 65; if (ratio >= 0) return 45; if (ratio >= -0.1) return 20; return 0;
}
export const scoreLandAccess = (value) => ({ documented: 100, "easement-review": 65, disputed: 25, none: 0 })[value] ?? null;
export function scoreLandZoningUse(zoning, permittedUse) {
  if (!zoning) return null;
  return permittedUse ? 100 : 55;
}
export function scoreLandFloodWetlands(flood, wetlands) {
  if (!flood || !wetlands) return null;
  const constraints = [flood, wetlands].filter((value) => value === "constraint-present").length;
  return constraints === 0 ? 100 : constraints === 1 ? 50 : 25;
}
export function scoreLandServices(utilities, siteServices) {
  if (!utilities && !siteServices) return null;
  if (utilities === "available" && siteServices === "available") return 100;
  if (utilities === "unavailable" || siteServices === "unavailable") return 35;
  return 70;
}
export const scoreLandFrontage = (value) => ({ positive: 100, "easement-only": 60, none: 25 })[value] ?? null;
export const scoreLandDemand = (value) => ({ strong: 100, moderate: 70, low: 40, "none-known": 25 })[value] ?? null;
export function scoreLandComparableSupport(valuation) {
  const count = Number(valuation?.comparableCount || 0);
  if (count >= 3) return 100; if (count === 2) return 85; if (count === 1) return 65;
  return valuation?.valuationSource === "explicit-stored-indicated-land-value" ? 45 : null;
}

function signal(model, id, label, explanation, severity, factIds, section = "property") {
  return normalizeVacantLandFeasibilitySignal({
    signalId: `land-signal:${id}`, label, explanation, severity, relatedFactIds: factIds,
    evidenceReferenceIds: evidenceFor(model, factIds), relatedSection: section,
    rulesetVersion: VACANT_LAND_FEASIBILITY_RULESET_VERSION,
  });
}

export function evaluateVacantLandFeasibilitySignals({ factReadModel, valuation } = {}) {
  const items = [];
  const access = factValue(factReadModel, VACANT_LAND_FACT_IDS.LEGAL_ACCESS);
  const zoning = factValue(factReadModel, VACANT_LAND_FACT_IDS.ZONING);
  const use = factValue(factReadModel, VACANT_LAND_FACT_IDS.PERMITTED_USE);
  const flood = factValue(factReadModel, VACANT_LAND_FACT_IDS.FLOOD_STATUS);
  const wetlands = factValue(factReadModel, VACANT_LAND_FACT_IDS.WETLANDS_STATUS);
  const utilities = factValue(factReadModel, VACANT_LAND_FACT_IDS.UTILITIES);
  const site = factValue(factReadModel, VACANT_LAND_FACT_IDS.WATER_SEWER_SEPTIC);
  const taxes = factValue(factReadModel, VACANT_LAND_FACT_IDS.TAXES_AND_LIENS);
  if (!access) items.push(signal(factReadModel, "access-unknown", "Legal access is unknown", "Documented legal access is required before stronger parcel conclusions.", "blocking", [VACANT_LAND_FACT_IDS.LEGAL_ACCESS]));
  else if (access === "none") items.push(signal(factReadModel, "no-access", "No documented legal access", "The stored record explicitly indicates no legal access; human title and access review is required.", "blocking", [VACANT_LAND_FACT_IDS.LEGAL_ACCESS]));
  if (!zoning) items.push(signal(factReadModel, "zoning-unknown", "Zoning is unknown", "Review stored zoning evidence before evaluating permitted uses.", "blocking", [VACANT_LAND_FACT_IDS.ZONING]));
  if (!use) items.push(signal(factReadModel, "use-unknown", "Permitted use is unknown", "The strategy cannot determine legal use from an address or parcel description.", "blocking", [VACANT_LAND_FACT_IDS.PERMITTED_USE]));
  if (!flood) items.push(signal(factReadModel, "flood-unknown", "Flood status is unknown", "Manual flood-record research remains pending.", "blocking", [VACANT_LAND_FACT_IDS.FLOOD_STATUS]));
  else if (flood === "constraint-present") items.push(signal(factReadModel, "flood-present", "Flood constraint recorded", "A stored flood constraint requires parcel-specific human review and does not by itself determine buildability.", "significant", [VACANT_LAND_FACT_IDS.FLOOD_STATUS]));
  if (!wetlands) items.push(signal(factReadModel, "wetlands-unknown", "Wetlands status is unknown", "Manual wetlands-record research remains pending.", "blocking", [VACANT_LAND_FACT_IDS.WETLANDS_STATUS]));
  else if (wetlands === "constraint-present") items.push(signal(factReadModel, "wetlands-present", "Wetlands constraint recorded", "A stored wetlands constraint requires parcel-specific human review and does not by itself determine buildability.", "significant", [VACANT_LAND_FACT_IDS.WETLANDS_STATUS]));
  if (!utilities && !site) items.push(signal(factReadModel, "services-unknown", "Utilities and site services are unknown", "Confirm utility and water, sewer, or septic context through approved manual research.", "attention", [VACANT_LAND_FACT_IDS.UTILITIES, VACANT_LAND_FACT_IDS.WATER_SEWER_SEPTIC]));
  else if (utilities === "unavailable" || site === "unavailable") items.push(signal(factReadModel, "services-unavailable", "Site service limitation recorded", "One or more stored service facts indicate unavailable infrastructure and require feasibility review.", "significant", [VACANT_LAND_FACT_IDS.UTILITIES, VACANT_LAND_FACT_IDS.WATER_SEWER_SEPTIC]));
  if (taxes === "issue-present") items.push(signal(factReadModel, "tax-lien-issue", "Tax or lien issue recorded", "The stored record indicates a tax or lien issue requiring approved title review; this is not legal advice.", "blocking", [VACANT_LAND_FACT_IDS.TAXES_AND_LIENS], "documents"));
  if (!scoreLandComparableSupport(valuation)) items.push(signal(factReadModel, "market-support-missing", "Land-market Evidence is insufficient", "Add explicit land comparable Evidence or a stored indicated land value before relying on valuation context.", "blocking", [VACANT_LAND_FACT_IDS.LAND_COMPARABLES, VACANT_LAND_FACT_IDS.COMPARABLE_LAND_VALUE], "numbers"));
  (factReadModel?.facts || []).forEach((item) => {
    if (item.state === INFORMATION_STATES.CONFLICTING) items.push(signal(factReadModel, `conflict-${item.factId}`, `${item.label || item.factId} conflicts`, "An explicit supplied conflict requires human review.", "blocking", [item.factId], "decision"));
    if (item.state === INFORMATION_STATES.STALE) items.push(signal(factReadModel, `stale-${item.factId}`, `${item.label || item.factId} is stale`, "The supplied freshness state indicates this fact needs review.", "significant", [item.factId]));
    if (item.state === INFORMATION_STATES.UNVERIFIED) items.push(signal(factReadModel, `unverified-${item.factId}`, `${item.label || item.factId} is unverified`, "The supplied verification state remains unverified.", "attention", [item.factId]));
  });
  if ((factReadModel?.evidenceReferences || []).some((entry) => entry.sourceMode === DECISION_SOURCE_MODES.DETERMINISTIC_COMPATIBILITY || entry.provenanceDetails?.compatibilityCurrentState)) items.push(signal(factReadModel, "compatibility-evidence", "Compatibility Evidence is in use", "Current CRM fields provide compatibility Evidence and have not been independently verified.", "attention", []));
  return items.slice(0, 30);
}

export function evaluateVacantLandExitCandidates({ factReadModel, valuation } = {}) {
  const spread = valuation?.grossLandSpread;
  const supported = scoreLandComparableSupport(valuation) !== null;
  const zoning = factValue(factReadModel, VACANT_LAND_FACT_IDS.ZONING);
  const use = factValue(factReadModel, VACANT_LAND_FACT_IDS.PERMITTED_USE);
  const demand = factValue(factReadModel, VACANT_LAND_FACT_IDS.BUILDER_DEMAND) || factValue(factReadModel, VACANT_LAND_FACT_IDS.BUYER_DEMAND);
  const candidate = (id, label, state, explanation, factIds = []) => normalizeVacantLandExitCandidate({
    candidateId: `land-exit:${id}`, label, state, explanation,
    evidenceReferenceIds: evidenceFor(factReadModel, factIds),
    rulesetVersion: VACANT_LAND_EXIT_RULESET_VERSION,
    manualReviewRequirements: state === VACANT_LAND_EXIT_CANDIDATE_STATES.MANUAL_REVIEW_REQUIRED ? ["Human legal, financial, and transaction-specific review is required."] : [],
  });
  return [
    candidate("wholesale", "Land wholesale / assignment", spread > 0 && supported ? "candidate" : "blocked", spread > 0 && supported ? "Positive gross land spread and land-value Evidence support continued assignment-path review; spread is not guaranteed profit." : "Positive gross land spread and land-value Evidence are required.", [VACANT_LAND_FACT_IDS.ASKING_PRICE, VACANT_LAND_FACT_IDS.COMPARABLE_LAND_VALUE]),
    candidate("builder", "Builder disposition review", zoning && use && demand ? "reviewable" : "not-evaluated", zoning && use && demand ? "Stored zoning, use, and demand context support builder-disposition review; no builder purchase is assumed." : "Zoning, permitted use, and explicit builder-demand context are required.", [VACANT_LAND_FACT_IDS.ZONING, VACANT_LAND_FACT_IDS.PERMITTED_USE, VACANT_LAND_FACT_IDS.BUILDER_DEMAND]),
    candidate("resell", "Buy-and-resell review", spread > 0 && supported ? "candidate" : "blocked", spread > 0 && supported ? "Positive gross spread and land comparable support permit review; this is not net profit or a purchase instruction." : "Positive gross spread and comparable support are required."),
    candidate("seller-finance", "Seller-finance exploration", "manual-review-required", "Requires explicit seller willingness and negotiated terms; no terms are generated."),
    candidate("subdivision", "Subdivision exploration", "manual-review-required", "Requires authoritative local review; the strategy does not claim subdivision approval.", [VACANT_LAND_FACT_IDS.SUBDIVISION_POTENTIAL]),
    candidate("entitlement", "Entitlement exploration", "manual-review-required", "Requires authoritative legal and planning review; success is never promised."),
    candidate("hold", "Long-term hold review", "manual-review-required", "Requires human financial review; no appreciation is forecast."),
  ];
}

function exitFitScore(candidates) {
  const active = candidates.filter((item) => ["candidate", "reviewable"].includes(item.state)).length;
  if (active >= 3) return 100; if (active === 2) return 80; if (active === 1) return 60;
  return candidates.some((item) => item.state === "manual-review-required") ? 30 : 10;
}

export function buildVacantLandScoringObservations({ evaluatedTimestamp, exitCandidates = [], factReadModel, missingInformationReadModel, valuation } = {}) {
  const f = VACANT_LAND_FACT_IDS;
  const r = VACANT_LAND_REQUIREMENT_IDS;
  const access = factValue(factReadModel, f.LEGAL_ACCESS);
  const zoning = factValue(factReadModel, f.ZONING);
  const use = factValue(factReadModel, f.PERMITTED_USE);
  const flood = factValue(factReadModel, f.FLOOD_STATUS);
  const wetlands = factValue(factReadModel, f.WETLANDS_STATUS);
  const utilities = factValue(factReadModel, f.UTILITIES);
  const site = factValue(factReadModel, f.WATER_SEWER_SEPTIC);
  const frontage = factValue(factReadModel, f.ROAD_FRONTAGE);
  const motivation = finiteNumber(factValue(factReadModel, f.SELLER_MOTIVATION));
  const timeline = finiteNumber(factValue(factReadModel, f.SELLER_TIMELINE));
  const demand = factValue(factReadModel, f.BUILDER_DEMAND) || factValue(factReadModel, f.BUYER_DEMAND);
  const valuationEvidence = valuation?.inputEvidenceIds || [];
  const make = (factorId, factIds, requirements, rawValue, score, explanation, evidenceIds = []) => observation({ evaluatedTimestamp, explanation, factIds, factorId, missingInformationReadModel, normalizedScore: score, rawValue, requirementIds: requirements, factReadModel, evidenceIds });
  return [
    make(VACANT_LAND_PURSUIT_FACTOR_IDS.DISCOUNT_TO_INDICATED_VALUE, [f.ASKING_PRICE, f.COMPARABLE_LAND_VALUE, f.LAND_COMPARABLES], [r.ASKING_PRICE, r.VALUE_SUPPORT], valuation?.discountToIndicatedValueRatio, scoreLandDiscount(valuation?.discountToIndicatedValueRatio), "Discount compares asking price with available indicated land-value Evidence and is not an offer threshold.", valuationEvidence),
    make(VACANT_LAND_PURSUIT_FACTOR_IDS.LEGAL_ACCESS, [f.LEGAL_ACCESS], [r.LEGAL_ACCESS], access, scoreLandAccess(access), "Legal access uses only the explicit stored access status and is never inferred from frontage."),
    make(VACANT_LAND_PURSUIT_FACTOR_IDS.ZONING_PERMITTED_USE, [f.ZONING, f.PERMITTED_USE], [r.ZONING, r.PERMITTED_USE], { zoning, permittedUse: use }, scoreLandZoningUse(zoning, use), "Zoning/use clarity measures stored fact coverage, not legal compliance."),
    make(VACANT_LAND_PURSUIT_FACTOR_IDS.FLOOD_WETLANDS, [f.FLOOD_STATUS, f.WETLANDS_STATUS], [r.FLOOD_STATUS, r.WETLANDS_STATUS], { flood, wetlands }, scoreLandFloodWetlands(flood, wetlands), "Flood/wetlands review measures known stored constraint status, not buildability."),
    make(VACANT_LAND_PURSUIT_FACTOR_IDS.UTILITIES_SITE_SERVICES, [f.UTILITIES, f.WATER_SEWER_SEPTIC], [r.UTILITIES, r.WATER_SEWER_SEPTIC], { utilities, site }, scoreLandServices(utilities, site), "Utilities/site services use strict stored states; unknown inputs are omitted."),
    make(VACANT_LAND_PURSUIT_FACTOR_IDS.ROAD_FRONTAGE, [f.ROAD_FRONTAGE], [r.ROAD_FRONTAGE], frontage, scoreLandFrontage(frontage), "Road frontage is optional and does not replace legal-access review."),
    make(VACANT_LAND_PURSUIT_FACTOR_IDS.SELLER_MOTIVATION, [f.SELLER_MOTIVATION], [r.SELLER_MOTIVATION], motivation, motivation !== null && motivation >= 0 && motivation <= 10 ? motivation * 10 : null, "Seller motivation requires an explicit numeric 0-10 value; lead scores and vague text are not converted."),
    make(VACANT_LAND_PURSUIT_FACTOR_IDS.SELLER_TIMELINE, [f.SELLER_TIMELINE], [r.SELLER_TIMELINE], timeline, scoreStrategyTimelineDays(timeline), "Seller timeline uses the shared narrow deterministic mapping and supplied evaluation timestamp."),
    make(VACANT_LAND_PURSUIT_FACTOR_IDS.COMPARABLE_LAND_SUPPORT, [f.COMPARABLE_LAND_VALUE, f.LAND_COMPARABLES], [r.VALUE_SUPPORT], valuation?.comparableCount || valuation?.valuationSource, scoreLandComparableSupport(valuation), "Comparable support counts only explicit valid land comparables or stored indicated land-value compatibility Evidence.", valuationEvidence),
    make(VACANT_LAND_PURSUIT_FACTOR_IDS.BUILDER_BUYER_DEMAND, [f.BUILDER_DEMAND, f.BUYER_DEMAND], [r.BUILDER_DEMAND], demand, scoreLandDemand(demand), "Demand uses only a strict stored state and is never inferred from general market activity."),
    make(VACANT_LAND_PURSUIT_FACTOR_IDS.EXIT_OPTION_FIT, [f.ASKING_PRICE, f.COMPARABLE_LAND_VALUE, f.LAND_COMPARABLES, f.ZONING, f.PERMITTED_USE, f.BUILDER_DEMAND], [r.VALUE_SUPPORT], exitCandidates.length, exitFitScore(exitCandidates), "Exit fit measures review paths and never recommends executing one.", valuationEvidence),
  ];
}

function unavailable(context, timestamp, explanation) {
  return { contractVersion: VACANT_LAND_STRATEGY_READ_MODEL_VERSION, strategyId: VACANT_LAND_STRATEGY_ID, strategyVersion: VACANT_LAND_STRATEGY_VERSION, assetType: context.assetType || null, evaluationState: "unavailable", eligible: false, explanation, factReadModel: null, missingInformationReadModel: null, valuation: null, feasibilitySignals: [], exitCandidates: [], buyerMatchingInput: null, scoringObservations: [], pursuitScoreResult: null, reviewGuidance: { state: VACANT_LAND_REVIEW_STATES.UNAVAILABLE, label: "Vacant Land Strategy unavailable", explanation }, evidenceReferences: [], capabilitySupport: VACANT_LAND_CAPABILITY_SUPPORT, evaluatedTimestamp: timestamp, partialDataWarnings: [] };
}

function guidance(missing, signals, valuation, exits) {
  const blocking = missing?.blockingItems || [];
  if (blocking.length) return { state: VACANT_LAND_REVIEW_STATES.VERIFY_CRITICAL_FACTS, label: "Verify critical land facts", explanation: "Resolve the highest-priority blocking parcel fact before relying on valuation or scoring.", missingInformationItemIds: blocking.map((item) => item.itemId || item.requirementId), signalIds: [], exitCandidateIds: [] };
  const accessOrZoning = signals.filter((item) => ["land-signal:no-access", "land-signal:access-unknown", "land-signal:zoning-unknown", "land-signal:use-unknown"].includes(item.signalId));
  if (accessOrZoning.length) return { state: VACANT_LAND_REVIEW_STATES.REVIEW_ACCESS_ZONING, label: "Review access and zoning", explanation: "Document parcel access, zoning, and permitted-use context through approved manual research.", signalIds: accessOrZoning.map((item) => item.signalId) };
  if (valuation?.evaluationState !== "evaluated") return { state: VACANT_LAND_REVIEW_STATES.REVIEW_ECONOMICS, label: "Review land-value Evidence", explanation: "Add explicit land comparable Evidence or a stored indicated land value before reviewing economics." };
  return { state: VACANT_LAND_REVIEW_STATES.REVIEW_EXIT_OPTIONS, label: "Review supported land exit paths", explanation: "Continue human review using valuation context, feasibility signals, and review-only exit candidates.", exitCandidateIds: exits.filter((item) => ["candidate", "reviewable"].includes(item.state)).map((item) => item.candidateId) };
}

export function evaluateVacantLandStrategy({ assetStrategyContext: suppliedContext, comparables = [], conflicts = [], deal, evaluatedTimestamp, evidenceReferences = [], factReadModel: suppliedFacts, missingInformationReadModel: suppliedMissing, valuation: suppliedValuation } = {}) {
  const safeDeal = safeObject(deal);
  const context = suppliedContext || buildAssetStrategyContext(safeDeal);
  const timestamp = normalizeDecisionTimestamp(evaluatedTimestamp);
  const eligible = context.classificationState === ASSET_CLASSIFICATION_STATES.CLASSIFIED && context.assetType === ASSET_TYPES.VACANT_RESIDENTIAL_LAND && context.selectedStrategyId === VACANT_LAND_STRATEGY_ID && context.strategySupportState === ASSET_STRATEGY_SUPPORT_STATES.IMPLEMENTED && context.manualReviewRequired !== true && !(context.classificationConflicts || []).length;
  if (!eligible) return unavailable(context, timestamp, "Vacant Land Acquisition Strategy v1 requires an explicit, non-conflicting vacant-residential-land classification and never runs as a residential fallback.");
  if (!validateVacantLandStrategyContract().valid || !validateVacantLandPursuitProfile().valid) return unavailable(context, timestamp, "Vacant Land Strategy configuration is invalid and cannot be evaluated safely.");
  const factReadModel = suppliedFacts || adaptVacantLandFacts({ assetStrategyContext: context, conflicts, deal: safeDeal, evaluatedTimestamp: timestamp, evidenceReferences });
  const valuation = suppliedValuation || evaluateVacantLandValuation({ comparables, evaluatedTimestamp: timestamp, factReadModel });
  const combinedEvidence = [...(factReadModel.evidenceReferences || []), ...(valuation.evidenceReferences || [])].slice(0, 100);
  const informationStates = { ...(factReadModel.informationStates || {}) };
  if (valuation.indicatedLandValue > 0) informationStates["property.comparableLandValue"] = INFORMATION_STATES.PRESENT;
  const missingInformationReadModel = suppliedMissing || evaluateMissingInformation({ assetStrategyContext: context, conflicts, deal: safeDeal, evaluatedTimestamp: timestamp, evidenceReferences: combinedEvidence, freshnessStates: factReadModel.explicitFreshnessStates, informationStates, verificationStates: factReadModel.explicitVerificationStates });
  const feasibilitySignals = evaluateVacantLandFeasibilitySignals({ factReadModel, valuation });
  const exitCandidates = evaluateVacantLandExitCandidates({ factReadModel, valuation });
  const scoringObservations = buildVacantLandScoringObservations({ evaluatedTimestamp: timestamp, exitCandidates, factReadModel, missingInformationReadModel, valuation });
  const pursuitScoreResult = evaluatePursuitScore({ assetStrategyContext: context, assetStrategyContract: VACANT_LAND_ACQUISITION_STRATEGY, scoringProfile: VACANT_LAND_PURSUIT_SCORING_PROFILE, factorObservations: scoringObservations, missingInformationReadModel, evidenceReferences: combinedEvidence, evaluatedTimestamp: timestamp, executionMode: PURSUIT_SCORING_EXECUTION_MODES.PRODUCTION });
  const reviewGuidance = guidance(missingInformationReadModel, feasibilitySignals, valuation, exitCandidates);
  const buyerMatchingInput = { contractVersion: "vacant-land-buyer-input-v1", assetType: ASSET_TYPES.VACANT_RESIDENTIAL_LAND, parcelLocation: factValue(factReadModel, VACANT_LAND_FACT_IDS.PARCEL_IDENTITY), parcelSizeAcres: valuation.parcelSizeAcres, askingPrice: valuation.askingPrice, indicatedLandValue: valuation.indicatedLandValue, askingPricePerAcre: valuation.askingPricePerAcre, zoning: factValue(factReadModel, VACANT_LAND_FACT_IDS.ZONING), permittedUse: factValue(factReadModel, VACANT_LAND_FACT_IDS.PERMITTED_USE), legalAccessState: factValue(factReadModel, VACANT_LAND_FACT_IDS.LEGAL_ACCESS), strategyCandidateIds: exitCandidates.map((item) => item.candidateId), evidenceReferenceIds: uniqueStrings(valuation.inputEvidenceIds), partialDataWarnings: valuation.partialDataWarnings };
  return { contractVersion: VACANT_LAND_STRATEGY_READ_MODEL_VERSION, strategyId: VACANT_LAND_STRATEGY_ID, strategyVersion: VACANT_LAND_STRATEGY_VERSION, assetType: ASSET_TYPES.VACANT_RESIDENTIAL_LAND, scoringProfileId: VACANT_LAND_PURSUIT_PROFILE_ID, scoringRulesetVersion: VACANT_LAND_PURSUIT_RULESET_VERSION, evaluationState: [PURSUIT_SCORING_EVALUATION_STATES.BLOCKED, PURSUIT_SCORING_EVALUATION_STATES.PARTIAL].includes(pursuitScoreResult.evaluationState) ? "partial" : "evaluated", eligible: true, explanation: "Vacant Land Acquisition Strategy v1 evaluated explicit stored parcel facts through deterministic, versioned rules.", factReadModel, missingInformationReadModel, valuation, feasibilitySignals, exitCandidates, buyerMatchingInput, scoringObservations, pursuitScoreResult, reviewGuidance, evidenceReferences: combinedEvidence, capabilitySupport: VACANT_LAND_CAPABILITY_SUPPORT, evaluatedTimestamp: timestamp, partialDataWarnings: uniqueStrings([...factReadModel.partialDataWarnings, ...valuation.partialDataWarnings, ...pursuitScoreResult.partialDataWarnings, ...(!timestamp ? ["A supplied evaluation timestamp is required for reproducible strategy scoring."] : [])]).slice(0, 20) };
}
