import { compactText } from "../../utils/text";

export const SUPPORTING_EVIDENCE_CONTRACT_VERSION = "supporting-deal-evidence-v1";

export const SUPPORTING_EVIDENCE_CATEGORIES = Object.freeze([
  "ownership_title",
  "mortgage_liens",
  "hoa",
  "municipal_code",
  "occupancy",
  "bankruptcy_probate",
  "other_due_diligence",
]);

export const SUPPORTING_EVIDENCE_STATUSES = Object.freeze([
  "VERIFIED",
  "INDICATIVE",
  "UNKNOWN",
]);

export const SUPPORTING_EVIDENCE_RESOLUTION_STATES = Object.freeze([
  "SUPPORTING",
  "CONFLICTING",
  "UNRESOLVED",
]);

const CATEGORY_SET = new Set(SUPPORTING_EVIDENCE_CATEGORIES);
const STATUS_SET = new Set(SUPPORTING_EVIDENCE_STATUSES);
const RESOLUTION_SET = new Set(SUPPORTING_EVIDENCE_RESOLUTION_STATES);

function text(value, maximum = 320) {
  if (!["string", "number", "boolean"].includes(typeof value)) return null;
  return compactText(String(value)).slice(0, maximum) || null;
}
function timestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function source(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    name: text(input.name, 120),
    url: text(input.url, 500),
    reference: text(input.reference, 240),
    sourceDate: timestamp(input.sourceDate),
    retrievedAt: timestamp(input.retrievedAt),
  };
}

function linkage(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    parcelIdentifier: text(input.parcelIdentifier, 160),
    ownerPartyName: text(input.ownerPartyName, 200),
  };
}

export function normalizeSupportingEvidenceMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const category = CATEGORY_SET.has(value.category) ? value.category : null;
  const status = STATUS_SET.has(value.status) ? value.status : null;
  const resolutionState = RESOLUTION_SET.has(value.resolutionState)
    ? value.resolutionState
    : null;
  const fact = text(value.fact, 320);
  const normalizedSource = source(value.source);
  if (!category || !status || !resolutionState || !fact || !normalizedSource.name || !normalizedSource.retrievedAt) {
    return null;
  }
  return {
    contractVersion: SUPPORTING_EVIDENCE_CONTRACT_VERSION,
    category,
    fact,
    source: normalizedSource,
    status,
    linkage: linkage(value.linkage),
    resolutionState,
    notes: text(value.notes, 500),
  };
}
