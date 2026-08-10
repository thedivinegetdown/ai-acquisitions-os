import { uniqueStrings } from "../../../utils/text";
import {
  DATA_RELIABILITY_GRADES,
  RELIABILITY_ASSESSMENT_BASIS,
  normalizeDataReliabilityResult,
  normalizeFactReliabilityResult,
} from "./confidenceReliabilityContracts";

const OPEN_INFORMATION_STATES = new Set(["missing", "unknown", "unavailable"]);
const MATERIAL_LIMITATIONS = new Set([
  "compatibility-only",
  "conflicting-evidence",
  "derived-lineage-incomplete",
  "malformed-source",
  "missing-source-identity",
]);

function activeConflictMap(conflictReadModel) {
  const map = new Map();
  (conflictReadModel?.activeConflicts || []).forEach((conflict) => {
    const field = conflict.canonicalField || conflict.relatedCanonicalField;
    if (!field) return;
    if (!map.has(field)) map.set(field, []);
    map.get(field).push(conflict.conflictId);
  });
  return map;
}

function worstIdentity(records) {
  const states = records.map((record) => record.provenanceQuality?.sourceIdentityState);
  if (states.includes("unidentified")) return "unidentified";
  if (states.includes("partially-identified")) return "partially-identified";
  return states.includes("identified") ? "identified" : "unidentified";
}

function valueTraceability(records) {
  const states = records.map((record) => record.provenanceQuality?.valueTraceability);
  if (states.includes("direct")) return "direct";
  if (states.includes("derived")) return "derived";
  if (states.includes("contextual")) return "contextual";
  return "unavailable";
}

function verificationState(records) {
  const states = records.map((record) => record.verificationState);
  if (states.includes("verification-required")) return "verification-required";
  if (states.includes("unverified")) return "unverified";
  if (states.length && states.every((state) => ["verified", "not-applicable"].includes(state))) return "verified";
  return "unknown";
}

function freshnessState(records, canonicalField, freshnessReadModel) {
  const canonicalState = freshnessReadModel?.assessmentsByCanonicalField?.[canonicalField]?.state;
  if (canonicalState) return canonicalState;
  const states = records.map((record) => record.freshnessState);
  if (states.includes("stale")) return "stale";
  if (states.length && states.every((state) => ["current", "not-applicable"].includes(state))) return "current";
  return "unknown";
}

function sourceTimestampAvailability(records) {
  if (records.some((record) => record.sourceTimestamp)) return "source-time-present";
  if (records.some((record) => record.observedTimestamp)) return "observation-time-only";
  return "unavailable";
}

function factState({ activeConflictIds, compatibility, evidenceStatus, freshness, identity, limitations, lineageLimitation, records, traceability, verification }) {
  if (!records.length || records.every((record) => record.evidenceStatus === "unavailable")) return DATA_RELIABILITY_GRADES.UNAVAILABLE;
  const material = limitations.some((limitation) => MATERIAL_LIMITATIONS.has(limitation));
  if (activeConflictIds.length || compatibility || evidenceStatus === "limited" || ["stale", "expired"].includes(freshness) || ["unverified", "verification-required"].includes(verification) || identity !== "identified" || traceability === "contextual" || lineageLimitation || material) return DATA_RELIABILITY_GRADES.LIMITED;
  const allVerified = verification === "verified";
  const explicitlyCurrent = ["current", "not-applicable"].includes(freshness);
  const sourceTime = sourceTimestampAvailability(records) === "source-time-present";
  if (evidenceStatus === "usable" && ["direct", "derived"].includes(traceability) && allVerified && explicitlyCurrent && sourceTime) return DATA_RELIABILITY_GRADES.STRONG;
  return DATA_RELIABILITY_GRADES.MODERATE;
}

function describeFact(descriptor, registry, conflictsByField, freshnessReadModel) {
  const records = registry?.evidenceByCanonicalField?.[descriptor.canonicalField] || [];
  const supporting = records.filter((record) => record.relationship === "supports");
  const challenging = records.filter((record) => record.relationship === "challenges");
  const contextual = records.filter((record) => record.relationship === "contextual");
  const relevant = supporting.length ? supporting : records;
  const limitations = uniqueStrings(records.flatMap((record) => record.limitationCodes || []));
  const activeConflictIds = conflictsByField.get(descriptor.canonicalField) || [];
  const identity = worstIdentity(relevant);
  const traceability = valueTraceability(relevant);
  const verification = verificationState(relevant);
  const freshness = freshnessState(relevant, descriptor.canonicalField, freshnessReadModel);
  const compatibility = records.some((record) => record.compatibility);
  const lineageLimitation = limitations.includes("derived-lineage-incomplete");
  const evidenceStatus = records.some((record) => record.evidenceStatus === "usable") ? "usable" : records.some((record) => record.evidenceStatus === "limited") ? "limited" : "unavailable";
  const state = factState({ activeConflictIds, compatibility, evidenceStatus, freshness, identity, limitations, lineageLimitation, records, traceability, verification });
  return normalizeFactReliabilityResult({
    ...descriptor,
    state,
    evidenceIds: records.map((record) => record.evidenceId),
    supportingEvidenceCount: supporting.length,
    challengingEvidenceCount: challenging.length,
    contextualEvidenceCount: contextual.length,
    evidenceStatus,
    sourceIdentityState: identity,
    valueTraceability: traceability,
    verificationState: verification,
    freshnessState: freshness,
    sourceTimestampAvailability: sourceTimestampAvailability(relevant),
    compatibilityEvidence: compatibility,
    activeConflictIds,
    lineageLimitation,
    limitationCodes: limitations,
    explanation: state === "strong" ? "Evidence is directly traceable, explicitly verified and current, and has no active material conflict." : state === "moderate" ? "Evidence is usable and traceable, but one or more verification, freshness, timestamp, or provenance dimensions remain unknown." : state === "limited" ? "A material Evidence, conflict, verification, freshness, compatibility, or lineage limitation restricts reliance on this fact." : "No eligible Evidence safely supports this canonical fact.",
    warnings: records.flatMap((record) => record.warnings || []),
  });
}

function selectFactDescriptors({ conflictReadModel, missingInformationReadModel, recommendationBasis }) {
  const byField = new Map();
  (missingInformationReadModel?.allItems || []).forEach((item) => {
    if (!item.canonicalField) return;
    byField.set(item.canonicalField, {
      canonicalField: item.canonicalField,
      factId: item.requirementId,
      label: item.label,
      criticality: item.blocking ? "blocking" : "advisory",
      recommendationCritical: recommendationBasis?.relatedCanonicalFields?.includes(item.canonicalField) || recommendationBasis?.missingInformationIds?.includes(item.itemId),
      informationState: item.state,
      requirementId: item.requirementId,
    });
  });
  (conflictReadModel?.activeConflicts || []).forEach((conflict) => {
    const field = conflict.canonicalField || conflict.relatedCanonicalField;
    if (!field) return;
    const current = byField.get(field) || {};
    byField.set(field, {
      canonicalField: field,
      factId: current.factId || conflict.factId,
      label: current.label || conflict.label || field,
      criticality: conflict.blocking || conflict.criticality === "blocking" ? "blocking" : current.criticality || "advisory",
      recommendationCritical: recommendationBasis?.conflictIds?.includes(conflict.conflictId) || current.recommendationCritical === true,
      informationState: current.informationState || "conflicting",
      requirementId: current.requirementId || conflict.requirementIds?.[0],
    });
  });
  (recommendationBasis?.relatedCanonicalFields || []).forEach((field) => {
    if (byField.has(field)) return;
    byField.set(field, { canonicalField: field, label: field, criticality: "advisory", recommendationCritical: true, informationState: "present", requirementId: null });
  });
  return [...byField.values()];
}

export function evaluateDataReliability({ assetStrategyContext = {}, conflictReadModel = {}, evaluatedTimestamp, evidenceRegistry = {}, freshnessReadModel = {}, missingInformationReadModel = {}, recommendationBasis = {} } = {}) {
  try {
    const descriptors = selectFactDescriptors({ conflictReadModel, missingInformationReadModel, recommendationBasis });
    const conflictsByField = activeConflictMap(conflictReadModel);
    const facts = descriptors.map((descriptor) => describeFact(descriptor, evidenceRegistry, conflictsByField, freshnessReadModel));
    const critical = facts.filter((fact) => fact.criticality === "blocking" || fact.recommendationCritical);
    const advisory = facts.filter((fact) => !critical.includes(fact));
    const representedCritical = critical.filter((fact) => fact.evidenceIds.length && fact.state !== DATA_RELIABILITY_GRADES.UNAVAILABLE);
    const missingCriticalDescriptors = descriptors.filter((descriptor) => (descriptor.criticality === "blocking" || descriptor.recommendationCritical) && OPEN_INFORMATION_STATES.has(descriptor.informationState));
    const assessmentBasis = !critical.length || !representedCritical.length ? RELIABILITY_ASSESSMENT_BASIS.INSUFFICIENT : missingCriticalDescriptors.length || representedCritical.length < critical.length ? RELIABILITY_ASSESSMENT_BASIS.PARTIAL : RELIABILITY_ASSESSMENT_BASIS.SUFFICIENT;
    let grade = DATA_RELIABILITY_GRADES.MODERATE;
    if (assessmentBasis === RELIABILITY_ASSESSMENT_BASIS.INSUFFICIENT) grade = DATA_RELIABILITY_GRADES.UNAVAILABLE;
    else if (critical.some((fact) => fact.state === DATA_RELIABILITY_GRADES.LIMITED)) grade = DATA_RELIABILITY_GRADES.LIMITED;
    else if (critical.some((fact) => [DATA_RELIABILITY_GRADES.MODERATE, DATA_RELIABILITY_GRADES.UNAVAILABLE].includes(fact.state))) grade = DATA_RELIABILITY_GRADES.MODERATE;
    else if (assessmentBasis === RELIABILITY_ASSESSMENT_BASIS.PARTIAL) grade = DATA_RELIABILITY_GRADES.MODERATE;
    else if (critical.length && critical.every((fact) => fact.state === DATA_RELIABILITY_GRADES.STRONG)) grade = DATA_RELIABILITY_GRADES.STRONG;
    const dealId = assetStrategyContext.dealId || null;
    return normalizeDataReliabilityResult({
      resultId: dealId ? `data-reliability:deal:${encodeURIComponent(dealId)}` : null,
      dealId,
      organizationId: evidenceRegistry.organizationId,
      tenantId: evidenceRegistry.tenantId,
      assetType: assetStrategyContext.assetType,
      strategyId: assetStrategyContext.selectedStrategyId,
      strategyVersion: assetStrategyContext.strategyVersion,
      grade,
      assessmentBasis,
      criticalFactResults: critical,
      advisoryFactResults: advisory,
      evidenceIds: facts.flatMap((fact) => fact.evidenceIds),
      conflictIds: facts.flatMap((fact) => fact.activeConflictIds),
      limitationCodes: facts.flatMap((fact) => fact.limitationCodes),
      basisGapRequirementIds: missingCriticalDescriptors.map((descriptor) => descriptor.requirementId).filter(Boolean),
      explanation: grade === "unavailable" ? "Too little eligible Evidence represents the active critical fact set to issue a meaningful reliability assessment." : grade === "limited" ? "At least one current critical or recommendation-dependent fact has a material Evidence limitation." : grade === "strong" ? "All active critical facts have strong, traceable Evidence and the assessment basis is sufficient." : "The active Evidence basis is usable, but one or more provenance dimensions or critical fact representations remain incomplete.",
      evaluatedTimestamp,
      warnings: evidenceRegistry.warnings,
    });
  } catch {
    return normalizeDataReliabilityResult({ grade: "unavailable", assessmentBasis: "insufficient", evaluatedTimestamp, warnings: ["Data Reliability evaluation failed safely and did not issue a grade."] });
  }
}
