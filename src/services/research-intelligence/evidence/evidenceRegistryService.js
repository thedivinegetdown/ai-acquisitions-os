import { uniqueStrings } from "../../../utils/text";
import {
  EVIDENCE_CONFLICT_STATES,
  EVIDENCE_LIMITATION_CODES,
  EVIDENCE_LIMITS,
  EVIDENCE_RELATIONSHIPS,
  EVIDENCE_STATUSES,
  normalizeCanonicalEvidence,
} from "./evidenceContracts";

function text(value) {
  return ["string", "number"].includes(typeof value) ? String(value).trim() || null : null;
}

function tenantContext(value = {}) {
  return {
    organizationId: text(value.organizationId || value.organization_id),
    tenantId: text(value.tenantId || value.tenant_id),
  };
}

function matchesTenant(record, context) {
  if (context.organizationId && record.organizationId && context.organizationId !== record.organizationId) return false;
  return !(context.tenantId && record.tenantId && context.tenantId !== record.tenantId);
}

function materialValue(record, key) {
  const value = record[key];
  return value !== null && value !== undefined && value !== "" ? JSON.stringify(value) : null;
}

function mergeEvidence(existing, incoming, warnings) {
  const materialKeys = ["sourceKind", "sourceType", "sourceSystem", "sourceRecordId", "sourceField", "relatedCanonicalField", "normalizedValue", "relationship"];
  const disagreements = materialKeys.filter((key) => materialValue(existing, key) && materialValue(incoming, key) && materialValue(existing, key) !== materialValue(incoming, key));
  if (disagreements.length) warnings.push(`Duplicate Evidence ${existing.evidenceId} contains disagreeing metadata and was not silently overwritten.`);
  const merged = { ...existing };
  Object.entries(incoming).forEach(([key, value]) => {
    if ((merged[key] === null || merged[key] === undefined || merged[key] === "") && value !== null && value !== undefined && value !== "") merged[key] = value;
  });
  merged.parentEvidenceIds = uniqueStrings([...existing.parentEvidenceIds, ...incoming.parentEvidenceIds]).slice(0, EVIDENCE_LIMITS.REFERENCES);
  merged.derivedFromEvidenceIds = uniqueStrings([...existing.derivedFromEvidenceIds, ...incoming.derivedFromEvidenceIds]).slice(0, EVIDENCE_LIMITS.REFERENCES);
  merged.supportingDocumentIds = uniqueStrings([...existing.supportingDocumentIds, ...incoming.supportingDocumentIds]).slice(0, EVIDENCE_LIMITS.REFERENCES);
  merged.warnings = uniqueStrings([...existing.warnings, ...incoming.warnings]).slice(0, EVIDENCE_LIMITS.WARNINGS);
  const normalized = normalizeCanonicalEvidence(merged);
  return {
    ...normalized,
    warnings: uniqueStrings([...merged.warnings, ...(normalized?.warnings || [])]).slice(0, EVIDENCE_LIMITS.WARNINGS),
  };
}

function applyConflictState(records, conflictReadModel) {
  const conflictEvidenceIds = new Set((conflictReadModel?.activeConflicts || []).flatMap((conflict) => conflict.evidenceIds || []));
  return records.map((record) => conflictEvidenceIds.has(record.evidenceId)
    ? {
        ...record,
        conflictState: EVIDENCE_CONFLICT_STATES.CONFLICTING,
        relationship: EVIDENCE_RELATIONSHIPS.CHALLENGES,
        limitationCodes: uniqueStrings([...record.limitationCodes, EVIDENCE_LIMITATION_CODES.CONFLICTING_EVIDENCE]),
      }
    : record);
}

function groupBy(records, key) {
  return records.reduce((groups, record) => {
    const group = record[key] || "unknown";
    if (!groups[group]) groups[group] = [];
    groups[group].push(record);
    return groups;
  }, {});
}

export function buildEvidenceRegistry({
  context = {},
  conflictReadModel,
  evidenceReferences = [],
  evaluatedTimestamp = null,
} = {}) {
  const currentTenant = tenantContext(context);
  const warnings = [];
  const byId = new Map();
  (Array.isArray(evidenceReferences) ? evidenceReferences : []).slice(0, EVIDENCE_LIMITS.RECORDS * 2).forEach((value) => {
    try {
      const record = normalizeCanonicalEvidence(value);
      if (!record) {
        warnings.push("One malformed Evidence record was omitted from the registry.");
        return;
      }
      if (!matchesTenant(record, currentTenant)) {
        warnings.push("Cross-tenant Evidence was excluded from the registry.");
        return;
      }
      const contextIsScoped = Boolean(currentTenant.organizationId || currentTenant.tenantId);
      const recordIsUnscoped = !record.organizationId && !record.tenantId;
      if (contextIsScoped && recordIsUnscoped && !record.compatibility) {
        warnings.push("Unscoped Evidence was excluded from the tenant-scoped registry.");
        return;
      }
      if (contextIsScoped && recordIsUnscoped) {
        record.limitationCodes = uniqueStrings([...record.limitationCodes, EVIDENCE_LIMITATION_CODES.MISSING_SOURCE_IDENTITY]);
        record.evidenceStatus = EVIDENCE_STATUSES.LIMITED;
      }
      byId.set(record.evidenceId, byId.has(record.evidenceId) ? mergeEvidence(byId.get(record.evidenceId), record, warnings) : record);
    } catch {
      warnings.push("One malformed Evidence source could not be normalized.");
    }
  });
  const records = applyConflictState([...byId.values()], conflictReadModel).slice(0, EVIDENCE_LIMITS.RECORDS);
  return {
    contractVersion: records[0]?.contractVersion || "evidence-provenance-contract-v1",
    rulesetVersion: records[0]?.rulesetVersion || "evidence-provenance-ruleset-v1",
    organizationId: currentTenant.organizationId,
    tenantId: currentTenant.tenantId,
    evidenceRecords: records,
    evidenceById: Object.fromEntries(records.map((record) => [record.evidenceId, record])),
    evidenceByCanonicalField: groupBy(records, "relatedCanonicalField"),
    evidenceByFactId: groupBy(records.filter((record) => record.factId), "factId"),
    evidenceBySourceKind: groupBy(records, "sourceKind"),
    supportingEvidence: records.filter((record) => record.relationship === EVIDENCE_RELATIONSHIPS.SUPPORTS),
    challengingEvidence: records.filter((record) => record.relationship === EVIDENCE_RELATIONSHIPS.CHALLENGES),
    contextualEvidence: records.filter((record) => record.relationship === EVIDENCE_RELATIONSHIPS.CONTEXTUAL),
    limitedEvidence: records.filter((record) => record.evidenceStatus === EVIDENCE_STATUSES.LIMITED),
    unavailableEvidence: records.filter((record) => record.evidenceStatus === EVIDENCE_STATUSES.UNAVAILABLE),
    warnings: uniqueStrings(warnings).slice(0, EVIDENCE_LIMITS.WARNINGS),
    evaluatedTimestamp,
    counts: {
      total: records.length,
      supporting: records.filter((record) => record.relationship === EVIDENCE_RELATIONSHIPS.SUPPORTS).length,
      challenging: records.filter((record) => record.relationship === EVIDENCE_RELATIONSHIPS.CHALLENGES).length,
      contextual: records.filter((record) => record.relationship === EVIDENCE_RELATIONSHIPS.CONTEXTUAL).length,
      limited: records.filter((record) => record.evidenceStatus === EVIDENCE_STATUSES.LIMITED).length,
      unavailable: records.filter((record) => record.evidenceStatus === EVIDENCE_STATUSES.UNAVAILABLE).length,
    },
  };
}
