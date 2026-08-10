import { uniqueStrings } from "../../../utils/text";
import {
  FRESHNESS_BASES,
  FRESHNESS_CONTRACT_VERSION,
  FRESHNESS_LIMITS,
  FRESHNESS_POLICY_REGISTRY_VERSION,
  FRESHNESS_RULESET_VERSION,
  FRESHNESS_SIGNAL_TYPES,
  FRESHNESS_STATES,
  normalizeEvidenceFreshnessAssessment,
  normalizeFactFreshnessAssessment,
  normalizeFreshnessSignal,
  revalidationStateForFreshness,
} from "./freshnessContracts";
import { selectFreshnessPolicy } from "./freshnessPolicyRegistry";

const OBSERVED_FALLBACK_KINDS = new Set(["seller-statement", "conversation", "manual-entry", "manual-research"]);
const STATE_RANK = Object.freeze({ expired: 6, stale: 5, "revalidation-due": 4, unknown: 3, current: 2, "not-applicable": 1 });

function iso(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function plusDays(timestamp, days) {
  return new Date(new Date(timestamp).getTime() + days * 86400000).toISOString();
}

function explicitState(value) {
  return ["current", "stale", "unknown", "not-applicable"].includes(value) ? value : "unknown";
}

export function selectFreshnessTimestamp(evidence = {}) {
  const warnings = [];
  const sourceTimestamp = iso(evidence.sourceTimestamp);
  const scope = evidence.provenanceDetails?.sourceTimestampScope;
  if (sourceTimestamp && scope !== "record") return { selectedTimestamp: sourceTimestamp, timestampSource: "sourceTimestamp", basis: FRESHNESS_BASES.SOURCE_TIMESTAMP, warnings };
  if (sourceTimestamp && scope === "record") warnings.push("record-level-timestamp-not-used-as-field-source-time");
  const observedTimestamp = iso(evidence.observedTimestamp);
  if (observedTimestamp && OBSERVED_FALLBACK_KINDS.has(evidence.sourceKind)) return { selectedTimestamp: observedTimestamp, timestampSource: "observedTimestamp", basis: FRESHNESS_BASES.OBSERVED_TIMESTAMP, warnings };
  if (observedTimestamp) warnings.push("observed-timestamp-not-eligible-for-source-age");
  return { selectedTimestamp: null, timestampSource: null, basis: FRESHNESS_BASES.UNAVAILABLE, warnings };
}

function ageState(policy, ageMilliseconds) {
  if (ageMilliseconds <= policy.currentThroughMilliseconds) return FRESHNESS_STATES.CURRENT;
  if (ageMilliseconds <= policy.revalidationThroughMilliseconds) return FRESHNESS_STATES.REVALIDATION_DUE;
  if (ageMilliseconds <= policy.expirationMilliseconds) return FRESHNESS_STATES.STALE;
  return FRESHNESS_STATES.EXPIRED;
}

function explanation(state) {
  if (state === FRESHNESS_STATES.CURRENT) return "Evidence remains within the current interval for its fact-specific policy.";
  if (state === FRESHNESS_STATES.REVALIDATION_DUE) return "Evidence remains usable under the policy, but revalidation is due soon.";
  if (state === FRESHNESS_STATES.STALE) return "This fact requires revalidation before it should be treated as current decision support.";
  if (state === FRESHNESS_STATES.EXPIRED) return "This Evidence is beyond the maximum v1 decision-support interval and requires revalidation.";
  if (state === FRESHNESS_STATES.NOT_APPLICABLE) return "This fact does not age-expire under the v1 policy.";
  return "No eligible source timestamp is available for this fact.";
}

export function evaluateEvidenceFreshness({ evidence = {}, evaluatedTimestamp, policy } = {}) {
  const evaluated = iso(evaluatedTimestamp);
  const original = explicitState(evidence.freshnessState);
  const selected = selectFreshnessTimestamp(evidence);
  const warnings = [...selected.warnings];
  const limitations = [];
  let state = FRESHNESS_STATES.UNKNOWN;
  let basis = FRESHNESS_BASES.UNAVAILABLE;
  let ageMilliseconds = null;
  if (!evaluated) {
    warnings.push("invalid-or-missing-evaluation-timestamp");
  } else if (!policy) {
    state = FRESHNESS_STATES.UNKNOWN;
  } else if (original === FRESHNESS_STATES.NOT_APPLICABLE || policy.explicitOnly) {
    state = original === FRESHNESS_STATES.STALE ? FRESHNESS_STATES.STALE : original === FRESHNESS_STATES.CURRENT ? FRESHNESS_STATES.CURRENT : FRESHNESS_STATES.NOT_APPLICABLE;
    basis = original !== FRESHNESS_STATES.UNKNOWN ? FRESHNESS_BASES.EXPLICIT_STATE : FRESHNESS_BASES.POLICY_NOT_APPLICABLE;
  } else if (!selected.selectedTimestamp) {
    if (original === FRESHNESS_STATES.CURRENT || original === FRESHNESS_STATES.STALE) {
      state = original;
      basis = FRESHNESS_BASES.EXPLICIT_ONLY_NO_TIMESTAMP;
    }
    limitations.push("missing-source-timestamp");
  } else {
    ageMilliseconds = new Date(evaluated).getTime() - new Date(selected.selectedTimestamp).getTime();
    if (ageMilliseconds < 0) {
      state = original === FRESHNESS_STATES.STALE ? FRESHNESS_STATES.STALE : FRESHNESS_STATES.UNKNOWN;
      warnings.push("future-source-timestamp");
      ageMilliseconds = null;
    } else {
      const derived = ageState(policy, ageMilliseconds);
      state = original === FRESHNESS_STATES.STALE && derived !== FRESHNESS_STATES.EXPIRED ? FRESHNESS_STATES.STALE : derived;
      basis = original === FRESHNESS_STATES.UNKNOWN ? selected.basis : FRESHNESS_BASES.EXPLICIT_STATE_PLUS_TIMESTAMP;
      if (original === FRESHNESS_STATES.CURRENT && state !== FRESHNESS_STATES.CURRENT) warnings.push("explicit-current-superseded-by-time-policy");
    }
  }
  const assessment = normalizeEvidenceFreshnessAssessment({
    assessmentId: evidence.evidenceId && policy ? `freshness:evidence:${encodeURIComponent(evidence.evidenceId)}:${encodeURIComponent(policy.policyVersion)}` : null,
    evidenceId: evidence.evidenceId,
    canonicalField: evidence.relatedCanonicalField,
    factId: evidence.factId,
    policyId: policy?.policyId,
    policyVersion: policy?.policyVersion,
    state,
    revalidationState: revalidationStateForFreshness(state),
    basis,
    selectedTimestamp: selected.selectedTimestamp,
    timestampSource: selected.timestampSource,
    evaluatedTimestamp: evaluated,
    ageDays: ageMilliseconds === null ? null : ageMilliseconds / 86400000,
    ageMilliseconds,
    revalidationDueTimestamp: selected.selectedTimestamp && policy && !policy.explicitOnly ? plusDays(selected.selectedTimestamp, policy.currentThroughDays) : null,
    staleTimestamp: selected.selectedTimestamp && policy && !policy.explicitOnly ? plusDays(selected.selectedTimestamp, policy.revalidationThroughDays) : null,
    expirationTimestamp: selected.selectedTimestamp && policy && !policy.explicitOnly ? plusDays(selected.selectedTimestamp, policy.expireAfterDays) : null,
    policyDerived: Boolean(selected.selectedTimestamp && policy && !policy.explicitOnly),
    explicitOriginalFreshnessState: original,
    relationship: evidence.relationship,
    evidenceStatus: evidence.evidenceStatus,
    warnings,
    limitationCodes: limitations,
  });
  return { ...assessment, explanation: explanation(state) };
}

function requirementContext(missingInformationReadModel, field) {
  const matches = (missingInformationReadModel?.allItems || []).filter((item) => item.canonicalField === field);
  return {
    criticality: matches.some((item) => item.blocking) ? "blocking" : "advisory",
    requirementIds: matches.map((item) => item.requirementId),
    label: matches[0]?.label || field,
  };
}

function activeConflicts(conflictReadModel, field) {
  return (conflictReadModel?.activeConflicts || []).filter((item) => (item.canonicalField || item.relatedCanonicalField) === field).map((item) => item.conflictId);
}

function aggregateFact(field, assessments, input) {
  const eligible = assessments.filter((item) => item.relationship === "supports");
  const relevant = eligible.length ? eligible : assessments;
  const worst = relevant.reduce((current, item) => STATE_RANK[item.state] > STATE_RANK[current] ? item.state : current, FRESHNESS_STATES.NOT_APPLICABLE);
  const context = requirementContext(input.missingInformationReadModel, field);
  const first = relevant[0];
  const timestamps = relevant.map((item) => item.selectedTimestamp).filter(Boolean).sort();
  const evidenceIdsFor = (state) => relevant.filter((item) => item.state === state).map((item) => item.evidenceId);
  return normalizeFactFreshnessAssessment({
    factFreshnessId: input.dealId ? `freshness:deal:${encodeURIComponent(input.dealId)}:field:${encodeURIComponent(field)}` : null,
    canonicalField: field,
    factId: first?.factId,
    label: context.label,
    assetType: input.assetType,
    strategyId: input.strategyId,
    strategyVersion: input.strategyVersion,
    criticality: context.criticality,
    state: relevant.length ? worst : FRESHNESS_STATES.UNKNOWN,
    policyId: first?.policyId,
    policyVersion: first?.policyVersion,
    evidenceIds: relevant.map((item) => item.evidenceId),
    currentEvidenceIds: evidenceIdsFor(FRESHNESS_STATES.CURRENT),
    revalidationDueEvidenceIds: evidenceIdsFor(FRESHNESS_STATES.REVALIDATION_DUE),
    staleEvidenceIds: evidenceIdsFor(FRESHNESS_STATES.STALE),
    expiredEvidenceIds: evidenceIdsFor(FRESHNESS_STATES.EXPIRED),
    unknownEvidenceIds: evidenceIdsFor(FRESHNESS_STATES.UNKNOWN),
    selectedSourceTimestamps: timestamps,
    ageDays: relevant.map((item) => item.ageDays).filter(Number.isFinite).sort((left, right) => right - left)[0] ?? null,
    oldestRelevantSourceTimestamp: timestamps[0],
    newestRelevantSourceTimestamp: timestamps.at(-1),
    policyTimestamps: {
      revalidationDueTimestamp: first?.revalidationDueTimestamp,
      staleTimestamp: first?.staleTimestamp,
      expirationTimestamp: first?.expirationTimestamp,
      policyDerived: first?.policyDerived,
    },
    activeConflictIds: activeConflicts(input.conflictReadModel, field),
    missingInformationRequirementIds: context.requirementIds,
    explanation: explanation(relevant.length ? worst : FRESHNESS_STATES.UNKNOWN),
    warnings: relevant.flatMap((item) => item.warnings || []),
    limitationCodes: relevant.flatMap((item) => item.limitationCodes || []),
  });
}

function signalId({ dealId, field, recommendationId, signalType }) {
  const subject = field ? `field:${encodeURIComponent(field)}` : `recommendation:${encodeURIComponent(recommendationId || "unknown")}`;
  return `freshness-signal:deal:${encodeURIComponent(dealId || "unknown")}:${subject}:${signalType}:${FRESHNESS_RULESET_VERSION}`;
}

function buildFactSignals(facts, previous, dealId) {
  const previousByField = previous?.assessmentsByCanonicalField || {};
  return facts.flatMap((fact) => {
    const types = [];
    if (fact.state === FRESHNESS_STATES.REVALIDATION_DUE) types.push(FRESHNESS_SIGNAL_TYPES.REVALIDATION_DUE);
    if ([FRESHNESS_STATES.STALE, FRESHNESS_STATES.EXPIRED].includes(fact.state)) types.push(FRESHNESS_SIGNAL_TYPES.REVALIDATION_REQUIRED);
    if (fact.state === FRESHNESS_STATES.EXPIRED) types.push(FRESHNESS_SIGNAL_TYPES.EVIDENCE_EXPIRED);
    if (fact.criticality === "blocking" && [FRESHNESS_STATES.STALE, FRESHNESS_STATES.EXPIRED].includes(fact.state)) types.push(FRESHNESS_SIGNAL_TYPES.CRITICAL_FACT_REVALIDATION_REQUIRED);
    const previousState = previousByField[fact.canonicalField]?.state;
    if ([FRESHNESS_STATES.CURRENT, FRESHNESS_STATES.REVALIDATION_DUE].includes(previousState) && [FRESHNESS_STATES.STALE, FRESHNESS_STATES.EXPIRED].includes(fact.state)) types.push(FRESHNESS_SIGNAL_TYPES.FACT_BECAME_STALE);
    return types.map((signalType) => normalizeFreshnessSignal({
      signalId: signalId({ dealId, field: fact.canonicalField, signalType }), signalType, dealId,
      canonicalField: fact.canonicalField, policyId: fact.policyId, state: fact.state,
      criticality: fact.criticality, evidenceIds: fact.evidenceIds, explanation: fact.explanation,
    }));
  });
}

export function evaluateFreshnessAndRevalidation({ assetStrategyContext = {}, conflictReadModel = {}, evaluatedTimestamp, evidenceRegistry = {}, missingInformationReadModel = {}, previousFreshnessReadModel = null } = {}) {
  const evaluated = iso(evaluatedTimestamp);
  const warnings = [];
  const evidenceAssessments = (evidenceRegistry.evidenceRecords || []).slice(0, FRESHNESS_LIMITS.EVIDENCE_ASSESSMENTS).map((evidence) => {
    try {
      const policy = selectFreshnessPolicy({ assetType: assetStrategyContext.assetType, canonicalField: evidence.relatedCanonicalField });
      return evaluateEvidenceFreshness({ evidence, evaluatedTimestamp: evaluated, policy });
    } catch {
      warnings.push(`Freshness could not be evaluated for Evidence ${evidence.evidenceId || "unknown"}.`);
      return evaluateEvidenceFreshness({ evidence, evaluatedTimestamp: evaluated, policy: null });
    }
  });
  const grouped = evidenceAssessments.reduce((result, item) => {
    if (!item.canonicalField) return result;
    if (!result[item.canonicalField]) result[item.canonicalField] = [];
    result[item.canonicalField].push(item);
    return result;
  }, {});
  const factAssessments = Object.entries(grouped).slice(0, FRESHNESS_LIMITS.FACT_ASSESSMENTS).map(([field, items]) => aggregateFact(field, items, {
    assetType: assetStrategyContext.assetType,
    conflictReadModel,
    dealId: assetStrategyContext.dealId,
    missingInformationReadModel,
    strategyId: assetStrategyContext.selectedStrategyId,
    strategyVersion: assetStrategyContext.strategyVersion,
  }));
  const factualSignals = buildFactSignals(factAssessments, previousFreshnessReadModel, assetStrategyContext.dealId).filter(Boolean).slice(0, FRESHNESS_LIMITS.SIGNALS);
  const byState = (state) => factAssessments.filter((fact) => fact.state === state);
  return {
    contractVersion: FRESHNESS_CONTRACT_VERSION,
    rulesetVersion: FRESHNESS_RULESET_VERSION,
    policyRegistryVersion: FRESHNESS_POLICY_REGISTRY_VERSION,
    dealId: assetStrategyContext.dealId || null,
    organizationId: evidenceRegistry.organizationId || null,
    tenantId: evidenceRegistry.tenantId || null,
    evidenceAssessments,
    factAssessments,
    assessmentsByEvidenceId: Object.fromEntries(evidenceAssessments.map((item) => [item.evidenceId, item])),
    assessmentsByCanonicalField: Object.fromEntries(factAssessments.map((item) => [item.canonicalField, item])),
    currentFacts: byState(FRESHNESS_STATES.CURRENT),
    revalidationDueFacts: byState(FRESHNESS_STATES.REVALIDATION_DUE),
    staleFacts: byState(FRESHNESS_STATES.STALE),
    expiredFacts: byState(FRESHNESS_STATES.EXPIRED),
    unknownFacts: byState(FRESHNESS_STATES.UNKNOWN),
    criticalRevalidationRequiredFacts: factAssessments.filter((fact) => fact.criticality === "blocking" && fact.revalidationState === "required"),
    advisoryRevalidationItems: factAssessments.filter((fact) => fact.criticality === "advisory" && ["due", "required"].includes(fact.revalidationState)),
    staleEvidenceIds: uniqueStrings(factAssessments.flatMap((fact) => fact.staleEvidenceIds)),
    expiredEvidenceIds: uniqueStrings(factAssessments.flatMap((fact) => fact.expiredEvidenceIds)),
    staleCanonicalFields: byState(FRESHNESS_STATES.STALE).map((fact) => fact.canonicalField),
    expiredCanonicalFields: byState(FRESHNESS_STATES.EXPIRED).map((fact) => fact.canonicalField),
    factualSignals,
    counts: { current: byState("current").length, revalidationDue: byState("revalidation-due").length, stale: byState("stale").length, expired: byState("expired").length, unknown: byState("unknown").length, criticalRevalidationRequired: factAssessments.filter((fact) => fact.criticality === "blocking" && fact.revalidationState === "required").length },
    warnings: uniqueStrings([...warnings, ...evidenceAssessments.flatMap((item) => item.warnings || [])]).slice(0, FRESHNESS_LIMITS.WARNINGS),
    evaluatedTimestamp: evaluated,
  };
}

export function applyFreshnessToFactReadModel(readModel, freshnessReadModel) {
  if (!readModel) return readModel;
  const facts = (readModel.facts || []).map((fact) => {
    const freshness = freshnessReadModel?.assessmentsByCanonicalField?.[fact.canonicalField];
    if (!freshness) return fact;
    const unusable = [FRESHNESS_STATES.STALE, FRESHNESS_STATES.EXPIRED].includes(freshness.state) && fact.state === "present";
    return {
      ...fact,
      state: unusable ? "stale" : fact.state,
      value: unusable ? null : fact.value,
      freshnessState: freshness.state,
      partialDataWarnings: uniqueStrings([...(fact.partialDataWarnings || []), ...(freshness.state === FRESHNESS_STATES.REVALIDATION_DUE ? ["This fact is still usable, but revalidation is due under the canonical freshness policy."] : []), ...(unusable ? ["This fact requires revalidation before strategy analysis can use it as current."] : [])]),
    };
  });
  return {
    ...readModel,
    facts,
    factsById: Object.fromEntries(facts.map((fact) => [fact.factId, fact])),
    informationStates: Object.fromEntries(facts.map((fact) => [fact.canonicalField, fact.state])),
    explicitFreshnessStates: Object.fromEntries(facts.filter((fact) => fact.freshnessState !== "unknown").map((fact) => [fact.canonicalField, fact.freshnessState])),
  };
}

export function evaluateRecommendationSupportFreshness({ freshnessReadModel = {}, recommendation = {}, recommendationBasis = {} } = {}) {
  const assessments = (recommendationBasis.evidenceIds || []).map((id) => freshnessReadModel.assessmentsByEvidenceId?.[id]).filter(Boolean);
  const states = assessments.map((item) => item.state);
  let state = "unknown";
  if (states.some((item) => ["stale", "expired"].includes(item))) state = "revalidation-required";
  else if (states.includes("revalidation-due")) state = "revalidation-due";
  else if (states.length && states.every((item) => ["current", "not-applicable"].includes(item))) state = "current";
  else if (!assessments.length && recommendationBasis.directTrigger) state = "not-applicable";
  const signals = state === "revalidation-required" ? [normalizeFreshnessSignal({
    signalId: signalId({ dealId: freshnessReadModel.dealId, recommendationId: recommendation.recommendationId, signalType: FRESHNESS_SIGNAL_TYPES.RECOMMENDATION_SUPPORT_REVALIDATION_REQUIRED }),
    signalType: FRESHNESS_SIGNAL_TYPES.RECOMMENDATION_SUPPORT_REVALIDATION_REQUIRED,
    dealId: freshnessReadModel.dealId,
    recommendationId: recommendation.recommendationId,
    state: FRESHNESS_STATES.STALE,
    evidenceIds: assessments.map((item) => item.evidenceId),
    explanation: "Part of the current recommendation basis depends on Evidence that requires revalidation.",
  })] : [];
  return {
    state,
    revalidationState: state === "revalidation-required" ? "required" : state === "revalidation-due" ? "due" : state === "current" ? "not-required" : state === "not-applicable" ? "not-applicable" : "unavailable",
    recommendationId: recommendation.recommendationId || null,
    evidenceIds: assessments.map((item) => item.evidenceId),
    signals,
    explanation: state === "revalidation-required" ? "Part of the current recommendation basis depends on Evidence that requires revalidation." : state === "revalidation-due" ? "Recommendation support remains usable, but revalidation is due soon." : state === "current" ? "Recommendation Evidence is current under its applicable policies." : state === "not-applicable" ? "This direct operational recommendation does not require age-based Evidence support." : "Recommendation-support freshness cannot be determined from eligible Evidence.",
  };
}
