import { canonicalFingerprint } from "./recalculationService";

export const DECISION_MEMORY_CONTRACT_VERSION = "decision-memory-v1";
export const DECISION_MEMORY_HISTORY_LIMIT = 25;
export const OWNER_DECISION_TYPES = Object.freeze({
  FOLLOWED: "followed",
  ALTERNATIVE: "alternative",
});

const USABLE_RECOMMENDATION_STATES = new Set([
  "compatibility-result",
  "evaluated",
  "expired",
  "superseded",
]);

function text(value, maximum = 480) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).trim().slice(0, maximum);
}

function timestamp(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function sameScope(record, { dealId, organizationId }) {
  return String(record?.deal_id || record?.dealId || "") === String(dealId || "")
    && String(record?.organization_id || record?.organizationId || "") === String(organizationId || "");
}

export function getRecommendationBoundaryFingerprint(readModel) {
  const fingerprints = readModel?.recalculation?.fingerprints;
  return fingerprints && typeof fingerprints === "object"
    ? canonicalFingerprint(fingerprints)
    : "";
}

export function buildRecommendationSnapshotPayload({
  actorReference,
  deal,
  readModel,
} = {}) {
  const decision = readModel?.decisionRecord;
  const recommendation = decision?.recommendation;
  const fingerprint = getRecommendationBoundaryFingerprint(readModel);
  const dealId = text(deal?.id || decision?.dealId, 160);
  const organizationId = text(
    deal?.organization_id || deal?.organizationId || decision?.organizationId,
    160
  );

  if (
    readModel?.recalculation?.state !== "recalculated"
    || !dealId
    || !organizationId
    || String(decision?.dealId || "") !== dealId
    || (decision?.organizationId && String(decision.organizationId) !== organizationId)
    || !fingerprint
    || !recommendation?.recommendationId
    || !USABLE_RECOMMENDATION_STATES.has(recommendation.status)
  ) {
    return null;
  }

  return {
    deal_id: dealId,
    organization_id: organizationId,
    memory_contract_version: DECISION_MEMORY_CONTRACT_VERSION,
    decision_contract_version: text(decision.contractVersion, 80),
    recalculation_contract_version: text(readModel.recalculation.contractVersion, 80),
    recommendation_result: structuredClone(recommendation),
    canonical_input_fingerprint: fingerprint,
    recommendation_basis: structuredClone(readModel.recommendationBasis || {}),
    evaluated_at: timestamp(decision.evaluatedTimestamp || recommendation.evaluatedTimestamp),
    actor_reference: text(actorReference, 240) || null,
  };
}

export function buildOwnerDecisionPayload({
  actorReference,
  alternative,
  decisionType,
  reason,
  snapshot,
} = {}) {
  const normalizedType = Object.values(OWNER_DECISION_TYPES).includes(decisionType)
    ? decisionType
    : "";
  const normalizedReason = text(reason, 1000);
  const alternativeLabel = text(alternative?.label || alternative?.action, 320);
  const actor = text(actorReference, 240);

  if (!snapshot?.id || !snapshot?.deal_id || !snapshot?.organization_id) {
    throw new Error("A persisted recommendation snapshot is required.");
  }
  if (!normalizedType) throw new Error("Choose whether the recommendation was followed or overridden.");
  if (!actor) throw new Error("An authenticated decision actor is required.");
  if (normalizedType === OWNER_DECISION_TYPES.ALTERNATIVE && !alternativeLabel) {
    throw new Error("An explicit alternative is required for an override.");
  }
  if (normalizedType === OWNER_DECISION_TYPES.ALTERNATIVE && !normalizedReason) {
    throw new Error("An override reason is required.");
  }

  return {
    recommendation_snapshot_id: snapshot.id,
    deal_id: snapshot.deal_id,
    organization_id: snapshot.organization_id,
    decision_type: normalizedType,
    override_flag: normalizedType === OWNER_DECISION_TYPES.ALTERNATIVE,
    alternative_result: normalizedType === OWNER_DECISION_TYPES.ALTERNATIVE
      ? { label: alternativeLabel }
      : null,
    reason: normalizedReason || null,
    actor_reference: actor,
  };
}

function chronological(left, right) {
  const timeDifference = String(left.timestamp || "").localeCompare(String(right.timestamp || ""));
  if (timeDifference) return timeDifference;
  return String(left.id || "").localeCompare(String(right.id || ""));
}

function outcomeReference(record, type, snapshot) {
  return {
    id: `${type}:${record.id}`,
    type,
    snapshotId: snapshot.id,
    timestamp: timestamp(record.created_at),
    sourceId: record.id,
    sourceRecord: record,
  };
}

// Historical memory is a projection over immutable memory records and the existing
// Build 3 lifecycle sources. Lifecycle values are referenced here, never persisted
// into Decision Memory and never described as caused by a recommendation.
export function buildDecisionMemoryHistory({
  closingRevisions = [],
  dealId,
  decisions = [],
  limit = DECISION_MEMORY_HISTORY_LIMIT,
  offerRevisions = [],
  organizationId,
  snapshots = [],
} = {}) {
  const scope = { dealId, organizationId };
  const boundedLimit = Math.min(DECISION_MEMORY_HISTORY_LIMIT, Math.max(1, Number(limit) || DECISION_MEMORY_HISTORY_LIMIT));
  const scopedSnapshots = snapshots
    .filter((record) => sameScope(record, scope))
    .sort((left, right) => Number(left.snapshot_number || 0) - Number(right.snapshot_number || 0))
    .slice(-boundedLimit);
  const snapshotById = new Map(scopedSnapshots.map((snapshot) => [snapshot.id, snapshot]));
  const entries = scopedSnapshots.map((snapshot) => ({
    snapshot,
    decisions: [],
    outcomes: [],
  }));
  const entryBySnapshotId = new Map(entries.map((entry) => [entry.snapshot.id, entry]));

  decisions
    .filter((record) => sameScope(record, scope) && snapshotById.has(record.recommendation_snapshot_id))
    .sort((left, right) => chronological(
      { id: left.id, timestamp: left.decided_at || left.created_at },
      { id: right.id, timestamp: right.decided_at || right.created_at }
    ))
    .forEach((decision) => entryBySnapshotId.get(decision.recommendation_snapshot_id).decisions.push(decision));

  const lifecycleRecords = [
    ...offerRevisions.filter((record) => sameScope(record, scope)).map((record) => ({ record, type: "offer-revision" })),
    ...closingRevisions.filter((record) => sameScope(record, scope)).map((record) => ({ record, type: "closing-revision" })),
  ].sort((left, right) => chronological(
    { id: left.record.id, timestamp: left.record.created_at },
    { id: right.record.id, timestamp: right.record.created_at }
  ));

  lifecycleRecords.forEach(({ record, type }) => {
    const outcomeTime = timestamp(record.created_at);
    if (!outcomeTime) return;
    let precedingEntry = null;
    entries.forEach((entry) => {
      const snapshotTime = timestamp(entry.snapshot.evaluated_at || entry.snapshot.created_at);
      if (snapshotTime && snapshotTime <= outcomeTime) precedingEntry = entry;
    });
    if (precedingEntry) precedingEntry.outcomes.push(outcomeReference(record, type, precedingEntry.snapshot));
  });

  return {
    contractVersion: DECISION_MEMORY_CONTRACT_VERSION,
    dealId: dealId || null,
    organizationId: organizationId || null,
    entries,
    counts: {
      snapshots: entries.length,
      decisions: entries.reduce((count, entry) => count + entry.decisions.length, 0),
      linkedOutcomes: entries.reduce((count, entry) => count + entry.outcomes.length, 0),
    },
    limitation: "Later lifecycle records are chronologically linked references, not evidence of causation.",
  };
}
