import { describe, expect, it } from "vitest";
import {
  buildDecisionMemoryHistory,
  buildOwnerDecisionPayload,
  buildRecommendationSnapshotPayload,
  OWNER_DECISION_TYPES,
} from "../decisionMemoryService";

const deal = { id: "deal-1", organization_id: "org-1", asset_type: "residential-home" };

function readModel(overrides = {}) {
  return {
    decisionRecord: {
      contractVersion: "decision-contract-v1",
      dealId: "deal-1",
      organizationId: "org-1",
      evaluatedTimestamp: "2026-09-24T12:00:00.000Z",
      recommendation: {
        recommendationId: "recommendation-1",
        label: "Prepare offer",
        explanation: "The verified inputs support offer preparation.",
        status: "evaluated",
      },
    },
    recalculation: {
      contractVersion: "recommendation-recalculation-v1",
      state: "recalculated",
      fingerprints: { facts: "facts-a", strategy: "strategy-a" },
    },
    recommendationBasis: { basisType: "offer-readiness", evidenceIds: ["evidence-1"] },
    ...overrides,
  };
}

function snapshot(overrides = {}) {
  return {
    id: "snapshot-1",
    deal_id: "deal-1",
    organization_id: "org-1",
    snapshot_number: 1,
    canonical_input_fingerprint: "fingerprint-1",
    recommendation_result: { label: "Prepare offer" },
    recommendation_basis: { basisType: "offer-readiness" },
    evaluated_at: "2026-09-24T12:00:00.000Z",
    created_at: "2026-09-24T12:00:01.000Z",
    ...overrides,
  };
}

describe("Decision Memory contract", () => {
  it("creates one minimal immutable-boundary payload only for a meaningful recalculation", () => {
    const current = readModel();
    const before = structuredClone(current);
    const payload = buildRecommendationSnapshotPayload({ actorReference: "user-1", deal, readModel: current });

    expect(payload).toMatchObject({
      deal_id: "deal-1",
      organization_id: "org-1",
      decision_contract_version: "decision-contract-v1",
      recalculation_contract_version: "recommendation-recalculation-v1",
      recommendation_result: { label: "Prepare offer" },
      recommendation_basis: { basisType: "offer-readiness" },
      actor_reference: "user-1",
    });
    expect(payload.canonical_input_fingerprint).toContain("facts-a");
    expect(current).toEqual(before);

    const unchanged = readModel({ recalculation: { ...current.recalculation, state: "unchanged" } });
    expect(buildRecommendationSnapshotPayload({ deal, readModel: unchanged })).toBeNull();
    const unavailable = readModel({
      decisionRecord: { ...current.decisionRecord, recommendation: { ...current.decisionRecord.recommendation, status: "unavailable" } },
    });
    expect(buildRecommendationSnapshotPayload({ deal, readModel: unavailable })).toBeNull();
  });

  it("gives materially changed canonical inputs a distinct fingerprint", () => {
    const first = buildRecommendationSnapshotPayload({ deal, readModel: readModel() });
    const next = readModel();
    next.recalculation.fingerprints.facts = "facts-b";
    const second = buildRecommendationSnapshotPayload({ deal, readModel: next });
    expect(second.canonical_input_fingerprint).not.toBe(first.canonical_input_fingerprint);
  });

  it("records followed recommendations and explicit overrides without rewriting the snapshot", () => {
    const original = snapshot();
    const before = structuredClone(original);
    expect(buildOwnerDecisionPayload({
      actorReference: "owner-1",
      decisionType: OWNER_DECISION_TYPES.FOLLOWED,
      snapshot: original,
    })).toMatchObject({ override_flag: false, alternative_result: null, actor_reference: "owner-1" });
    expect(buildOwnerDecisionPayload({
      actorReference: "owner-2",
      alternative: { label: "Request title review first" },
      decisionType: OWNER_DECISION_TYPES.ALTERNATIVE,
      reason: "An unreleased lien needs review.",
      snapshot: original,
    })).toMatchObject({
      override_flag: true,
      alternative_result: { label: "Request title review first" },
      reason: "An unreleased lien needs review.",
      actor_reference: "owner-2",
    });
    expect(() => buildOwnerDecisionPayload({
      actorReference: "owner-2",
      decisionType: OWNER_DECISION_TYPES.ALTERNATIVE,
      snapshot: original,
    })).toThrow(/alternative/i);
    expect(original).toEqual(before);
  });

  it("reproduces bounded chronological memory and links existing lifecycle truth by reference", () => {
    const snapshots = [
      snapshot(),
      snapshot({ id: "snapshot-2", snapshot_number: 2, canonical_input_fingerprint: "fingerprint-2", evaluated_at: "2026-09-24T13:00:00.000Z" }),
      snapshot({ id: "foreign", deal_id: "deal-2", organization_id: "org-2", snapshot_number: 3 }),
    ];
    const decisions = [{
      id: "decision-1",
      recommendation_snapshot_id: "snapshot-2",
      deal_id: "deal-1",
      organization_id: "org-1",
      decision_type: "alternative",
      override_flag: true,
      reason: "Review title first",
      decided_at: "2026-09-24T13:05:00.000Z",
    }];
    const acceptedOffer = {
      id: "offer-4", deal_id: "deal-1", organization_id: "org-1", revision_number: 4,
      status: "accepted", offer_amount: 100000, created_at: "2026-09-24T14:00:00.000Z",
    };
    const closed = {
      id: "closing-2", deal_id: "deal-1", organization_id: "org-1", revision_number: 2,
      accepted_offer_revision_id: "offer-4", status: "closed", actual_realized_proceeds: 14500,
      actual_costs: 500, created_at: "2026-09-24T15:00:00.000Z",
    };
    const inputs = {
      closingRevisions: [closed, { ...closed, id: "foreign-close", organization_id: "org-2" }],
      dealId: "deal-1",
      decisions,
      offerRevisions: [acceptedOffer],
      organizationId: "org-1",
      snapshots,
    };
    const firstLoad = buildDecisionMemoryHistory(inputs);
    const reload = buildDecisionMemoryHistory(structuredClone(inputs));

    expect(reload).toEqual(firstLoad);
    expect(firstLoad.entries.map((entry) => entry.snapshot.id)).toEqual(["snapshot-1", "snapshot-2"]);
    expect(firstLoad.entries[1].decisions).toEqual(decisions);
    expect(firstLoad.entries[1].outcomes.map((outcome) => outcome.sourceId)).toEqual(["offer-4", "closing-2"]);
    expect(firstLoad.entries[1].outcomes[0].sourceRecord).toBe(acceptedOffer);
    expect(firstLoad.entries[1].outcomes[1].sourceRecord).toBe(closed);
    expect(firstLoad).not.toHaveProperty("qualificationHistory");
    expect(firstLoad.limitation).toMatch(/not evidence of causation/i);
  });
});
