import { normalizeEvidenceReference, normalizeConflictReference, normalizeDecisionTimestamp } from "../../decision-intelligence/decisionContracts";
import { ASSET_CLASSIFICATION_STATES } from "../../asset-strategy/assetStrategyContracts";
import { compactText, uniqueStrings } from "../../../utils/text";
import {
  CONFLICT_COMPARISON_TYPES,
  CONFLICT_CRITICALITIES,
  CONFLICT_LIMITS,
  CONFLICT_STATES,
  CONFLICT_TYPES,
  normalizeConflictCandidate,
  normalizeConflictReadModel,
  normalizeConflictRecord,
  normalizeConflictResolutionReference,
} from "./conflictContracts";
import { isConcreteEvidenceValue, normalizeConflictComparableValue } from "./comparisonPolicies";
import { buildConflictDetectionProfiles } from "./conflictProfiles";

const ACTIVE_STATES = new Set(["open", "review-required", "resolution-proposed", "unresolved"]);

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value, max = 240) {
  if (!["string", "number", "boolean"].includes(typeof value)) return null;
  return compactText(String(value)).slice(0, max) || null;
}

function tenantContext(deal, context) {
  return {
    organizationId: text(context?.organizationId || deal?.organization_id || deal?.organizationId, 160),
    tenantId: text(context?.tenantId || deal?.tenant_id || deal?.tenantId, 160),
  };
}

function matchesTenant(value, context) {
  const source = object(value);
  const organizationId = text(source.organizationId || source.organization_id, 160);
  const tenantId = text(source.tenantId || source.tenant_id, 160);
  if (context.organizationId && organizationId && context.organizationId !== organizationId) return false;
  return !(context.tenantId && tenantId && context.tenantId !== tenantId);
}

function encode(value) {
  return encodeURIComponent(String(value || "unknown"));
}

function summary(value) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (["string", "number"].includes(typeof value)) return text(value, 240);
  return null;
}

function candidateId({ canonicalField, comparable, evidenceId, sourceField, sourceRecordId }) {
  return `candidate:field:${encode(canonicalField)}:source:${encode(evidenceId || `${sourceRecordId || "record"}:${sourceField || "unknown"}`)}:value:${encode(comparable)}`;
}

function candidateFromDeal({ context, deal, descriptor, evaluatedTimestamp, warnings }) {
  const candidates = [];
  descriptor.aliases.forEach((sourceField) => {
    try {
      const rawValue = deal?.[sourceField];
      const comparable = normalizeConflictComparableValue(descriptor.comparisonType, rawValue, {
        evaluatedTimestamp,
        statusMappings: descriptor.statusMappings,
      });
      if (comparable === null) return;
      const sourceTimestampField = `${sourceField}_updated_at`;
      const sourceTimestamp = normalizeDecisionTimestamp(deal?.[sourceTimestampField]);
      const candidate = normalizeConflictCandidate({
        candidateId: candidateId({ canonicalField: descriptor.canonicalField, comparable, sourceField, sourceRecordId: context.dealId }),
        canonicalField: descriptor.canonicalField,
        factId: descriptor.factId,
        requirementId: descriptor.requirementIds[0],
        rawValueSummary: summary(rawValue),
        normalizedComparableValue: comparable,
        comparisonValueType: descriptor.comparisonType,
        sourceField,
        sourceSystem: "Deal record",
        sourceType: "crm-current-state",
        sourceRecordId: context.dealId,
        organizationId: context.organizationId,
        tenantId: context.tenantId,
        sourceTimestamp,
        verificationState: "unknown",
        freshnessState: "unknown",
        conflictState: "unknown",
        extractionMethod: "conflict-alias-comparison",
        compatibilityEvidence: true,
        partialDataWarning: "Current CRM fields are compatibility Evidence and are not independently verified.",
      });
      if (candidate) candidates.push(candidate);
    } catch {
      warnings.push(`The stored ${sourceField} field could not be compared for conflicts.`);
    }
  });
  return candidates;
}

function evidenceValue(evidence) {
  const provenance = object(evidence.provenanceDetails);
  for (const key of ["canonicalValue", "normalizedValue", "storedValue", "mappedCanonicalAssetType"]) {
    if (isConcreteEvidenceValue(provenance[key])) return provenance[key];
  }
  return isConcreteEvidenceValue(evidence.valueSummary) ? evidence.valueSummary : null;
}

function candidateFromEvidence(evidence, descriptor, evaluatedTimestamp) {
  const rawValue = evidenceValue(evidence);
  if (rawValue === null) return null;
  const comparable = normalizeConflictComparableValue(descriptor.comparisonType, rawValue, {
    evaluatedTimestamp,
    statusMappings: descriptor.statusMappings,
  });
  if (comparable === null) return null;
  return normalizeConflictCandidate({
    candidateId: candidateId({ canonicalField: descriptor.canonicalField, comparable, evidenceId: evidence.evidenceId, sourceField: evidence.sourceField, sourceRecordId: evidence.sourceRecordId }),
    canonicalField: descriptor.canonicalField,
    factId: descriptor.factId,
    requirementId: descriptor.requirementIds[0],
    rawValueSummary: summary(rawValue),
    normalizedComparableValue: comparable,
    comparisonValueType: descriptor.comparisonType,
    sourceField: evidence.sourceField,
    sourceSystem: evidence.sourceSystem,
    sourceType: evidence.sourceType,
    sourceRecordId: evidence.sourceRecordId,
    evidenceId: evidence.evidenceId,
    organizationId: evidence.organizationId,
    tenantId: evidence.tenantId,
    sourceTimestamp: evidence.sourceTimestamp,
    observedTimestamp: evidence.observedTimestamp,
    verificationState: evidence.verificationState,
    freshnessState: evidence.freshnessState,
    conflictState: evidence.conflictState,
    extractionMethod: evidence.extractionMethod,
    compatibilityEvidence: evidence.reliabilityLabel === "Compatibility Record" || evidence.provenanceDetails?.compatibilityCurrentState === true || evidence.provenanceDetails?.compatibilityMapping === true,
    partialDataWarning: evidence.partialDataWarning,
  });
}

function evidenceMatches(evidence, descriptor) {
  return evidence.relatedCanonicalField === descriptor.canonicalField ||
    (evidence.sourceField && descriptor.aliases.includes(evidence.sourceField));
}

function reviewOrder(left, right) {
  const rank = (candidate) => [
    candidate.verificationState === "verified" ? 0 : 1,
    candidate.freshnessState === "stale" ? 1 : 0,
    candidate.sourceSystem && candidate.sourceRecordId ? 0 : 1,
    candidate.sourceTimestamp ? 0 : 1,
    candidate.compatibilityEvidence ? 1 : 0,
    candidate.candidateId,
  ];
  const a = rank(left);
  const b = rank(right);
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] < b[index]) return -1;
    if (a[index] > b[index]) return 1;
  }
  return 0;
}

function dedupeCandidates(values) {
  const bySourceAndValue = new Map();
  values.forEach((candidate) => {
    const key = [candidate.evidenceId, candidate.sourceSystem, candidate.sourceRecordId, candidate.sourceField, JSON.stringify(candidate.normalizedComparableValue)].join("|");
    if (!bySourceAndValue.has(key)) bySourceAndValue.set(key, candidate);
  });
  return [...bySourceAndValue.values()].sort(reviewOrder).slice(0, CONFLICT_LIMITS.CANDIDATES);
}

function explicitForField(conflicts, canonicalField) {
  return conflicts.find((entry) => entry.relatedCanonicalField === canonicalField || entry.canonicalField === canonicalField) || null;
}

function normalizedState(explicit, resolution) {
  if (resolution?.status && Object.values(CONFLICT_STATES).includes(resolution.status)) return resolution.status;
  if (Object.values(CONFLICT_STATES).includes(explicit?.state)) return explicit.state;
  return ACTIVE_STATES.has(explicit?.state) ? CONFLICT_STATES.REVIEW_REQUIRED : CONFLICT_STATES.REVIEW_REQUIRED;
}

function conflictForDescriptor({ assetStrategyContext, candidates, context, descriptor, evaluatedTimestamp, explicit, resolution }) {
  const distinct = new Set(candidates.map((entry) => JSON.stringify(entry.normalizedComparableValue)));
  const explicitlyActive = explicit && ACTIVE_STATES.has(explicit.state || "unresolved");
  const explicitlyClosed = explicit && [CONFLICT_STATES.RESOLVED, CONFLICT_STATES.DISMISSED, CONFLICT_STATES.SUPERSEDED].includes(explicit.state);
  if (distinct.size < 2 && !explicitlyActive && !explicitlyClosed && !resolution) return null;
  const conflictId = text(explicit?.conflictId || resolution?.conflictId, 320) || `conflict:deal:${encode(context.dealId)}:field:${encode(descriptor.canonicalField)}`;
  const state = normalizedState(explicit, resolution);
  const warnings = [];
  if (state === CONFLICT_STATES.RESOLVED && resolution?.selectedCandidateId && distinct.size > 1) {
    warnings.push("An explicit resolution is supplied, but represented CRM candidates still disagree. No field was rewritten.");
  }
  return normalizeConflictRecord({
    conflictId,
    dealId: context.dealId,
    organizationId: context.organizationId,
    tenantId: context.tenantId,
    assetType: assetStrategyContext.assetType,
    strategyId: assetStrategyContext.selectedStrategyId,
    strategyVersion: assetStrategyContext.strategyVersion,
    canonicalField: descriptor.canonicalField,
    factId: descriptor.factId,
    requirementIds: descriptor.requirementIds,
    label: descriptor.label,
    description: explicit?.summary || `Explicit stored values disagree for ${descriptor.label}. Human review is required before relying on this fact.`,
    conflictType: descriptor.comparisonType === CONFLICT_COMPARISON_TYPES.ASSET_TYPE
      ? CONFLICT_TYPES.CLASSIFICATION_MISMATCH
      : explicit && distinct.size < 2
        ? CONFLICT_TYPES.EXPLICIT_CONFLICT
        : candidates.some((entry) => entry.evidenceId)
          ? CONFLICT_TYPES.SOURCE_DISAGREEMENT
          : CONFLICT_TYPES.VALUE_MISMATCH,
    state,
    criticality: descriptor.criticality,
    candidateValues: candidates,
    evidenceIds: uniqueStrings([...candidates.map((entry) => entry.evidenceId), ...(explicit?.evidenceReferenceIds || [])]),
    affectedMetricIds: descriptor.affectedMetricIds,
    affectedCapabilityIds: descriptor.affectedCapabilityIds,
    relatedSection: descriptor.relatedSection,
    safeReviewActions: descriptor.safeReviewActions,
    recommendedReviewPath: `Review ${descriptor.label} in ${descriptor.relatedSection} and compare Evidence. Review order does not select the correct value.`,
    explicitResolutionReference: resolution,
    evaluatedTimestamp,
    sourceTimestamps: candidates.flatMap((entry) => [entry.sourceTimestamp, entry.observedTimestamp]).filter(Boolean),
    warnings,
  });
}

function conflictPriority(conflict, descriptor) {
  const verifiedValues = new Set(conflict.candidateValues.filter((entry) => entry.verificationState === "verified").map((entry) => JSON.stringify(entry.normalizedComparableValue)));
  const hasStale = conflict.candidateValues.some((entry) => entry.freshnessState === "stale");
  const hasCurrent = conflict.candidateValues.some((entry) => entry.freshnessState && entry.freshnessState !== "stale");
  return [
    descriptor.priority,
    conflict.distinctNormalizedValues.length > 2 ? 0 : 1,
    conflict.conflictType === CONFLICT_TYPES.EXPLICIT_CONFLICT ? 0 : 1,
    verifiedValues.size > 1 ? 0 : 1,
    hasStale && hasCurrent ? 0 : 1,
    conflict.candidateValues.some((entry) => entry.compatibilityEvidence) ? 0 : 1,
    descriptor.fieldOrder,
    conflict.conflictId,
  ];
}

function comparePriority(left, right) {
  for (let index = 0; index < left.priority.length; index += 1) {
    if (left.priority[index] < right.priority[index]) return -1;
    if (left.priority[index] > right.priority[index]) return 1;
  }
  return 0;
}

// Distinct responsibility: detect bounded explicit canonical-value disagreement
// without choosing a value, grading sources, mutating records, or querying data.
export function evaluateConflictingData({
  assetStrategyContext = {},
  deal,
  evaluatedTimestamp,
  evidenceReferences = [],
  explicitConflictReferences = [],
  explicitResolutionReferences = [],
  conflictProfiles,
} = {}) {
  const safeDeal = object(deal);
  const context = {
    dealId: text(assetStrategyContext.dealId || safeDeal.id || safeDeal.deal_id, 200),
    ...tenantContext(safeDeal, assetStrategyContext),
  };
  const timestamp = normalizeDecisionTimestamp(evaluatedTimestamp);
  const profiles = Array.isArray(conflictProfiles) && conflictProfiles.length
    ? conflictProfiles
    : buildConflictDetectionProfiles(assetStrategyContext);
  const descriptors = profiles.flatMap((profile) => profile.descriptors || []);
  const warnings = [];
  const evidence = (Array.isArray(evidenceReferences) ? evidenceReferences : [])
    .filter((entry) => matchesTenant(entry, context))
    .map(normalizeEvidenceReference)
    .filter(Boolean)
    .slice(0, CONFLICT_LIMITS.REFERENCES);
  const explicit = (Array.isArray(explicitConflictReferences) ? explicitConflictReferences : [])
    .filter((entry) => matchesTenant(entry, context))
    .map((entry) => ({ ...object(entry), ...normalizeConflictReference(entry) }))
    .filter((entry) => entry.conflictId)
    .slice(0, CONFLICT_LIMITS.CONFLICTS);
  const resolutions = (Array.isArray(explicitResolutionReferences) ? explicitResolutionReferences : [])
    .filter((entry) => matchesTenant(entry, context))
    .map(normalizeConflictResolutionReference)
    .filter(Boolean)
    .slice(0, CONFLICT_LIMITS.CONFLICTS);
  const evaluated = [];

  descriptors.forEach((descriptor) => {
    try {
      const candidates = dedupeCandidates([
        ...candidateFromDeal({ context, deal: safeDeal, descriptor, evaluatedTimestamp: timestamp, warnings }),
        ...evidence.filter((entry) => evidenceMatches(entry, descriptor)).map((entry) => candidateFromEvidence(entry, descriptor, timestamp)).filter(Boolean),
      ]);
      const supplied = explicitForField(explicit, descriptor.canonicalField);
      const detectedConflictId = `conflict:deal:${encode(context.dealId)}:field:${encode(descriptor.canonicalField)}`;
      const resolution = resolutions.find((entry) => entry.conflictId === (supplied?.conflictId || detectedConflictId)) || null;
      const conflict = conflictForDescriptor({ assetStrategyContext, candidates, context, descriptor, evaluatedTimestamp: timestamp, explicit: supplied, resolution });
      if (conflict) evaluated.push({ conflict, priority: conflictPriority(conflict, descriptor) });
    } catch {
      warnings.push(`Conflict candidates for ${descriptor.label || descriptor.canonicalField} could not be fully evaluated.`);
    }
  });

  explicit.filter((entry) => !descriptors.some((descriptor) => descriptor.canonicalField === entry.relatedCanonicalField)).forEach((entry) => {
    const resolution = resolutions.find((item) => item.conflictId === entry.conflictId) || null;
    const conflict = normalizeConflictRecord({
      ...entry,
      canonicalField: entry.relatedCanonicalField || "unknown.canonicalField",
      dealId: context.dealId,
      organizationId: context.organizationId,
      tenantId: context.tenantId,
      assetType: assetStrategyContext.assetType,
      strategyId: assetStrategyContext.selectedStrategyId,
      strategyVersion: assetStrategyContext.strategyVersion,
      conflictType: CONFLICT_TYPES.EXPLICIT_CONFLICT,
      state: normalizedState(entry, resolution),
      criticality: entry.blocking ? CONFLICT_CRITICALITIES.BLOCKING : CONFLICT_CRITICALITIES.ADVISORY,
      explicitResolutionReference: resolution,
      evaluatedTimestamp: timestamp,
    });
    if (conflict) evaluated.push({ conflict, priority: [80, 1, 0, 1, 1, 1, 999, conflict.conflictId] });
  });

  const conflicts = evaluated.sort(comparePriority).map((entry) => entry.conflict).slice(0, CONFLICT_LIMITS.CONFLICTS);
  if (assetStrategyContext.classificationState === ASSET_CLASSIFICATION_STATES.AMBIGUOUS && !conflicts.some((entry) => entry.canonicalField === "property.assetType")) {
    warnings.push("Asset Classification reports an explicit conflict, but comparable source candidates were incomplete. The existing classification review requirement remains blocking.");
  }
  return normalizeConflictReadModel({
    dealId: context.dealId,
    organizationId: context.organizationId,
    tenantId: context.tenantId,
    assetType: assetStrategyContext.assetType,
    selectedProfiles: profiles.map((profile) => profile.profileId),
    conflicts,
    partialDataWarnings: warnings,
    evaluatedTimestamp: timestamp,
  });
}
