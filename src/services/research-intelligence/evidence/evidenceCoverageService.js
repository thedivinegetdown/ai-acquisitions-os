import { uniqueStrings } from "../../../utils/text";
import {
  EVIDENCE_CONFLICT_STATES,
  EVIDENCE_RELATIONSHIPS,
  EVIDENCE_STATUSES,
  EVIDENCE_VERIFICATION_STATES,
} from "./evidenceContracts";

function coverageForField(canonicalField, records) {
  const limitations = uniqueStrings(records.flatMap((record) => record.limitationCodes || []));
  const supporting = records.filter((record) => record.relationship === EVIDENCE_RELATIONSHIPS.SUPPORTS);
  const challenging = records.filter((record) => record.relationship === EVIDENCE_RELATIONSHIPS.CHALLENGES);
  const contextual = records.filter((record) => record.relationship === EVIDENCE_RELATIONSHIPS.CONTEXTUAL);
  const statuses = new Set(records.map((record) => record.evidenceStatus));
  return {
    canonicalField,
    factId: records.find((record) => record.factId)?.factId || null,
    evidenceIds: records.map((record) => record.evidenceId),
    supportingCount: supporting.length,
    challengingCount: challenging.length,
    contextualCount: contextual.length,
    identifiedSourceCount: records.filter((record) => record.provenanceQuality.sourceIdentityState === "identified").length,
    explicitVerificationCount: records.filter((record) => record.verificationState !== EVIDENCE_VERIFICATION_STATES.UNKNOWN).length,
    sourceTimestampCount: records.filter((record) => record.sourceTimestamp).length,
    compatibilityOnlyCount: records.filter((record) => record.compatibility).length,
    conflictPresent: records.some((record) => record.conflictState === EVIDENCE_CONFLICT_STATES.CONFLICTING),
    evidenceStatus: statuses.has(EVIDENCE_STATUSES.USABLE)
      ? EVIDENCE_STATUSES.USABLE
      : statuses.has(EVIDENCE_STATUSES.LIMITED)
        ? EVIDENCE_STATUSES.LIMITED
        : EVIDENCE_STATUSES.UNAVAILABLE,
    limitationCodes: limitations,
    warnings: uniqueStrings(records.flatMap((record) => record.warnings || [])),
  };
}

export function buildEvidenceCoverage(registry = {}) {
  const byField = registry.evidenceByCanonicalField || {};
  const fields = Object.entries(byField)
    .filter(([canonicalField]) => canonicalField !== "unknown")
    .map(([canonicalField, records]) => coverageForField(canonicalField, records));
  return {
    contractVersion: registry.contractVersion || "evidence-provenance-contract-v1",
    rulesetVersion: registry.rulesetVersion || "evidence-provenance-ruleset-v1",
    fields,
    coverageByCanonicalField: Object.fromEntries(fields.map((field) => [field.canonicalField, field])),
    representedCanonicalFields: fields.map((field) => field.canonicalField),
    fieldsWithConflicts: fields.filter((field) => field.conflictPresent).map((field) => field.canonicalField),
    limitationCodes: uniqueStrings(fields.flatMap((field) => field.limitationCodes)),
    counts: {
      representedFields: fields.length,
      fieldsWithConflicts: fields.filter((field) => field.conflictPresent).length,
      supporting: registry.counts?.supporting || 0,
      challenging: registry.counts?.challenging || 0,
      contextual: registry.counts?.contextual || 0,
      limited: registry.counts?.limited || 0,
    },
  };
}

export function evaluateEvidenceRequirements({ registry = {}, requirements = [] } = {}) {
  const satisfiedRequirements = [];
  const limitedRequirements = [];
  const unsatisfiedRequirements = [];
  (Array.isArray(requirements) ? requirements : []).slice(0, 100).forEach((requirement) => {
    const records = (registry.evidenceByCanonicalField?.[requirement.canonicalField] || []).filter((record) => !requirement.factId || !record.factId || record.factId === requirement.factId);
    const supporting = records.filter((record) => record.relationship === EVIDENCE_RELATIONSHIPS.SUPPORTS);
    const usable = supporting.filter((record) => record.evidenceStatus === EVIDENCE_STATUSES.USABLE && record.conflictState !== EVIDENCE_CONFLICT_STATES.CONFLICTING);
    const result = {
      requirementId: requirement.requirementId || null,
      canonicalField: requirement.canonicalField || null,
      factId: requirement.factId || null,
      evidenceIds: records.map((record) => record.evidenceId),
      limitationCodes: uniqueStrings(records.flatMap((record) => record.limitationCodes || [])),
      reason: usable.length
        ? "Required supporting Evidence is available."
        : supporting.length
          ? "Supporting Evidence exists but is limited or conflicting."
          : "Required supporting Evidence is unavailable.",
    };
    if (usable.length >= Math.max(1, Number(requirement.minimumEvidenceCount) || 1)) satisfiedRequirements.push(result);
    else if (records.length) limitedRequirements.push(result);
    else unsatisfiedRequirements.push(result);
  });
  return {
    satisfiedRequirements,
    limitedRequirements,
    unsatisfiedRequirements,
    evidenceIds: uniqueStrings([...satisfiedRequirements, ...limitedRequirements].flatMap((result) => result.evidenceIds)),
    limitationCodes: uniqueStrings([...limitedRequirements, ...unsatisfiedRequirements].flatMap((result) => result.limitationCodes)),
  };
}
