import { normalizeEvidenceReference } from "../decision-intelligence/decisionContracts";
import { RESEARCH_EVIDENCE_LIMIT } from "./researchResolutionService";
import {
  normalizeSupportingEvidenceMetadata,
  SUPPORTING_EVIDENCE_CATEGORIES,
  SUPPORTING_EVIDENCE_RESOLUTION_STATES,
  SUPPORTING_EVIDENCE_STATUSES,
} from "./supportingEvidenceContracts";

export {
  SUPPORTING_EVIDENCE_CATEGORIES,
  SUPPORTING_EVIDENCE_RESOLUTION_STATES,
  SUPPORTING_EVIDENCE_STATUSES,
};

const CATEGORY_SET = new Set(SUPPORTING_EVIDENCE_CATEGORIES);
const STATUS_SET = new Set(SUPPORTING_EVIDENCE_STATUSES);
const RESOLUTION_SET = new Set(SUPPORTING_EVIDENCE_RESOLUTION_STATES);

function requiredText(value, label, maximum = 320) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) {
    throw new Error(`${label} is required (maximum ${maximum} characters).`);
  }
  return value.trim();
}

function optionalText(value, label, maximum = 320) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > maximum) {
    throw new Error(`${label} must be no more than ${maximum} characters.`);
  }
  return value.trim() || null;
}

function requiredTimestamp(value, label) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) {
    throw new Error(`${label} is required and must be valid.`);
  }
  return date.toISOString();
}

function optionalTimestamp(value, label) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} is invalid.`);
  return date.toISOString();
}

function optionalUrl(value) {
  const url = optionalText(value, "Source URL", 500);
  if (!url) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Source URL must be a valid HTTP or HTTPS URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Source URL must be a valid HTTP or HTTPS URL.");
  }
  return parsed.toString();
}

function verificationState(status) {
  if (status === "VERIFIED") return "verified";
  if (status === "INDICATIVE") return "verification-required";
  return "unknown";
}

function relationship(state) {
  if (state === "SUPPORTING") return "supports";
  if (state === "CONFLICTING") return "challenges";
  return "contextual";
}

function conflictState(state) {
  if (state === "CONFLICTING") return "conflicting";
  if (state === "SUPPORTING") return "none";
  return "unknown";
}

function safeEvidenceList(deal) {
  return Array.isArray(deal?.research_evidence) ? deal.research_evidence : [];
}

export function buildSupportingEvidenceAppendMutation({ deal, command, actorReference }) {
  if (!deal?.id || !deal.organization_id) throw new Error("An owned deal is required.");
  if (!actorReference) throw new Error("An authenticated actor is required.");
  if (!CATEGORY_SET.has(command?.category)) throw new Error("Choose a supported evidence category.");
  if (!STATUS_SET.has(command?.status)) throw new Error("Choose a supported evidence status.");
  if (!RESOLUTION_SET.has(command?.resolutionState)) {
    throw new Error("Choose a supported resolution state.");
  }

  const fact = requiredText(command.fact, "Finding / value");
  const sourceName = requiredText(command.sourceName, "Source name", 120);
  const sourceUrl = optionalUrl(command.sourceUrl);
  const sourceReference = optionalText(command.sourceReference, "Source reference", 240);
  const sourceDate = optionalTimestamp(command.sourceDate, "Source date");
  const retrievedAt = requiredTimestamp(command.retrievedAt, "Retrieved at");
  if (sourceDate && sourceDate > retrievedAt) {
    throw new Error("Source date cannot be later than retrieval time.");
  }
  const parcelIdentifier = optionalText(command.parcelIdentifier, "Parcel identifier", 160);
  const ownerPartyName = optionalText(command.ownerPartyName, "Owner / party name", 200);
  const notes = optionalText(command.notes, "Notes / limitations", 500);
  const existing = safeEvidenceList(deal);
  if (existing.length >= RESEARCH_EVIDENCE_LIMIT) {
    throw new Error("This deal has reached the bounded research evidence limit; no evidence was removed.");
  }

  const revision = Number.isInteger(deal.research_revision) && deal.research_revision >= 0
    ? deal.research_revision
    : 0;
  const evidenceId = `supporting:${deal.id}:${command.category}:${revision + 1}`;
  const supportingEvidence = normalizeSupportingEvidenceMetadata({
    category: command.category,
    fact,
    source: {
      name: sourceName,
      url: sourceUrl,
      reference: sourceReference,
      sourceDate,
      retrievedAt,
    },
    status: command.status,
    linkage: { parcelIdentifier, ownerPartyName },
    resolutionState: command.resolutionState,
    notes,
  });
  if (!supportingEvidence) throw new Error("Supporting evidence is malformed.");

  const record = normalizeEvidenceReference({
    evidenceId,
    relatedCanonicalField: "supporting.dealEvidence",
    factId: `supporting:${command.category}`,
    sourceType: "manual-research",
    sourceSystem: sourceName,
    sourceRecordId: sourceReference || sourceUrl,
    sourceField: command.category,
    valueSummary: fact,
    sourceTimestamp: sourceDate,
    observedTimestamp: retrievedAt,
    verificationState: verificationState(command.status),
    freshnessState: "unknown",
    conflictState: conflictState(command.resolutionState),
    extractionMethod: "manual-research",
    relationship: relationship(command.resolutionState),
    organizationId: deal.organization_id,
    tenantId: deal.tenant_id || null,
    partialDataWarning: notes,
    provenanceDetails: {
      supportingEvidence: true,
      evidenceCategory: command.category,
      supportingStatus: command.status,
      resolutionState: command.resolutionState,
      sourceUrl,
      parcelIdentifier,
      ownerPartyName,
      retrievedAt,
      actorReference,
    },
    supportingEvidence,
  });
  if (!record?.supportingEvidence) throw new Error("Supporting evidence could not be normalized.");

  return {
    research_evidence: [...existing, record],
    research_revision: revision + 1,
  };
}
