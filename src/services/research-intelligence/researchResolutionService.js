import { buildAssetStrategyContext } from "../asset-strategy";
import { normalizeEvidenceReference } from "../decision-intelligence/decisionContracts";
import { evaluateConflictingData } from "./conflicts/conflictEngine";
import { normalizeConflictResolutionReference } from "./conflicts/conflictContracts";

// Bounded operator surface. These are existing authoritative columns, not new facts.
export const RESEARCH_FIELDS = Object.freeze([
  { field: "deal.askingPrice", label: "Asking price", columns: ["price", "asking_price"], numeric: true },
  { field: "property.afterRepairValue", label: "After-repair value", columns: ["arv"], numeric: true, asset: "residential-home" },
  { field: "property.repairs", label: "Repair estimate", columns: ["repairs"], numeric: true, asset: "residential-home" },
  { field: "property.condition", label: "Property condition", columns: ["property_condition"], asset: "residential-home" },
  { field: "property.legalAccess", label: "Legal access", columns: ["legal_access"], asset: "vacant-residential-land" },
  { field: "property.zoning", label: "Zoning", columns: ["zoning"], asset: "vacant-residential-land" },
  { field: "property.comparableLandValue", label: "Comparable land value", columns: ["comparable_land_value"], numeric: true, asset: "vacant-residential-land" },
]);

function conflictModel(deal, evidence, resolutions = [], now) {
  return evaluateConflictingData({ deal, assetStrategyContext: buildAssetStrategyContext(deal),
    evidenceReferences: evidence, explicitResolutionReferences: resolutions, evaluatedTimestamp: now });
}

export function assembleResearchContext(deal, now, additionalEvidence = []) {
  const evidence = [...(deal.research_evidence || []), ...additionalEvidence];
  const detected = conflictModel(deal, evidence, [], now);
  // A resolution only applies while its selected value still matches the CRM and
  // all represented evidence is covered. New disagreement requires human review.
  const resolutions = (deal.research_resolutions || []).filter((resolution) => {
    const conflict = detected.conflicts.find((entry) => entry.conflictId === resolution.conflictId);
    const selected = conflict?.candidateValues.find((entry) => entry.candidateId === resolution.selectedCandidateId);
    return selected && conflict.candidateValues.every((candidate) =>
      candidate.evidenceId
        ? resolution.evidenceIds.includes(candidate.evidenceId)
        : candidate.normalizedComparableValue === selected.normalizedComparableValue);
  });
  const selectedByField = new Map(resolutions.map((resolution) => {
    const conflict = detected.conflicts.find((entry) => entry.conflictId === resolution.conflictId);
    return [conflict.canonicalField, conflict.candidateValues.find((entry) => entry.candidateId === resolution.selectedCandidateId)];
  }));
  return {
    conflictEvidenceReferences: evidence,
    conflictResolutions: resolutions,
    evidenceReferences: evidence.filter((entry) => {
      const selected = selectedByField.get(entry.relatedCanonicalField);
      return !selected || entry.evidenceId === selected.evidenceId;
    }),
    conflictReadModel: conflictModel(deal, evidence, resolutions, now),
  };
}

function requiredText(value, label, max = 200) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new Error(`${label} is required (maximum ${max} characters).`);
  return value.trim();
}

function timestamp(value, label) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} is invalid.`);
  return date.toISOString();
}

export function buildResearchMutation({ deal, command, actorReference, now }) {
  if (!deal?.id || !deal.organization_id) throw new Error("An owned deal is required.");
  const observedTimestamp = timestamp(now, "Observation time");
  if (!observedTimestamp || !actorReference) throw new Error("An actor and observation time are required.");
  const descriptor = RESEARCH_FIELDS.find((entry) => entry.field === command.field);
  if (!descriptor || (descriptor.asset && descriptor.asset !== buildAssetStrategyContext(deal).assetType)) throw new Error("This research field is unavailable for this asset.");
  let evidence = [...(deal.research_evidence || [])];
  let resolutions = [...(deal.research_resolutions || [])];
  const changes = {};
  const setValue = (value) => descriptor.columns.forEach((column) => { changes[column] = value; });
  if (command.type === "record") {
    const source = requiredText(command.source, "Source");
    const sourceType = command.sourceType || "manual-research";
    if (!["manual-research", "seller-statement", "document", "property-record", "comparable-sale", "land-comparable-sale"].includes(sourceType)) throw new Error("Unsupported research source type.");
    if (!["verified", "unverified", "unknown"].includes(command.verificationState)) throw new Error("Choose a verification state.");
    const raw = requiredText(String(command.value ?? ""), "Fact value");
    const numberText = raw.replace(/[$,]/g, "").trim();
    if (descriptor.numeric && !/^(?:\d+\.?\d*|\.\d+)$/.test(numberText)) throw new Error("Enter a number; unknown values must remain missing.");
    const value = descriptor.numeric ? Number(numberText) : raw;
    if (descriptor.numeric && (!Number.isFinite(value) || value < 0)) throw new Error("Enter a nonnegative number; unknown values must remain missing.");
    const sourceTimestamp = timestamp(command.sourceTimestamp, "Source time");
    if (sourceTimestamp && sourceTimestamp > observedTimestamp) throw new Error("Source time cannot be later than observation time.");
    // Preserve every prior CRM value as compatibility evidence before editing.
    descriptor.columns.forEach((column) => {
      const prior = deal[column];
      if (prior == null || prior === "" || evidence.some((entry) => entry.relatedCanonicalField === command.field && entry.provenanceDetails?.storedValue === prior)) return;
      evidence.push(normalizeEvidenceReference({
        evidenceId: `research:${deal.id}:${column}:baseline:${deal.research_revision || 0}`,
        relatedCanonicalField: command.field, sourceType: "crm-current-state", sourceSystem: "Deal record",
        sourceRecordId: deal.id, sourceField: column, valueSummary: String(prior),
        sourceTimestamp: deal[`${column}_updated_at`] || null,
        organizationId: deal.organization_id, verificationState: "unknown", freshnessState: "unknown",
        relationship: "contextual", extractionMethod: "compatibility-current-state-read",
        provenanceDetails: { storedValue: prior, compatibilityCurrentState: true },
      }));
    });
    const existing = evidence.find((entry) => entry.relatedCanonicalField === command.field && entry.sourceRecordId === source && entry.sourceType === sourceType && entry.provenanceDetails?.storedValue === value);
    const record = normalizeEvidenceReference({
      evidenceId: existing?.evidenceId || `research:${deal.id}:${descriptor.columns[0]}:${(deal.research_revision || 0) + 1}`,
      relatedCanonicalField: command.field, sourceType, sourceSystem: source, sourceRecordId: source,
      sourceField: descriptor.columns[0], sourceTimestamp: sourceTimestamp || existing?.sourceTimestamp || null, observedTimestamp,
      verificationState: command.verificationState, freshnessState: "unknown", conflictState: "none",
      extractionMethod: "manual-research", relationship: "supports", valueSummary: String(value),
      organizationId: deal.organization_id,
      provenanceDetails: { storedValue: value, actorReference },
    });
    evidence = evidence.filter((entry) => entry.evidenceId !== record.evidenceId).concat(record);
    const conflictId = `conflict:deal:${encodeURIComponent(deal.id)}:field:${encodeURIComponent(command.field)}`;
    resolutions = resolutions.filter((entry) => entry.conflictId !== conflictId);
    if (descriptor.columns.every((column) => deal[column] == null || deal[column] === "")) setValue(value);
  } else if (command.type === "resolve") {
    const conflict = assembleResearchContext(deal, now).conflictReadModel.activeConflicts.find((entry) => entry.canonicalField === command.field);
    const selected = conflict?.candidateValues.find((entry) => entry.candidateId === command.candidateId);
    const source = evidence.find((entry) => entry.evidenceId === selected?.evidenceId);
    if (!selected || !source) throw new Error("Select a persisted source-linked candidate. Record its source first if needed.");
    const value = source.provenanceDetails?.storedValue;
    if (value == null) throw new Error("The selected source has no explicit value.");
    setValue(value);
    const resolution = normalizeConflictResolutionReference({
      resolutionId: `resolution:${deal.id}:${(deal.research_revision || 0) + 1}`,
      conflictId: conflict.conflictId, status: "resolved", selectedCandidateId: selected.candidateId,
      canonicalValueSummary: String(value), actorReference,
      reason: requiredText(command.reason, "Resolution reason", 320),
      evidenceIds: conflict.evidenceIds, decidedTimestamp: observedTimestamp,
    });
    resolutions = resolutions.filter((entry) => entry.conflictId !== conflict.conflictId).concat(resolution);
  } else throw new Error("Unsupported research command.");
  // Refuse overflow rather than let bounded canonical contracts hide candidates.
  if (evidence.length > 48 || evidence.filter((entry) => entry.relatedCanonicalField === command.field).length > 9) throw new Error("This deal has reached the bounded research evidence limit; no evidence was removed.");
  return { ...changes, research_evidence: evidence, research_resolutions: resolutions, research_revision: (deal.research_revision || 0) + 1 };
}
