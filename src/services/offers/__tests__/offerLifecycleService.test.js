import { describe, expect, it } from "vitest";
import {
  buildOfferCommitments,
  buildOfferRevisionPayload,
  canTransitionOffer,
  projectLatestOfferRevision,
} from "../offerLifecycleService";

const deal = {
  id: "deal-1",
  asset_type: "residential-home",
  asking_price: 120000,
  arv: 200000,
  repairs: 25000,
  research_revision: 4,
  updated_at: "2026-09-23T12:00:00.000Z",
};

describe("offer lifecycle", () => {
  it("builds the first immutable draft with a canonical decision reference", () => {
    const payload = buildOfferRevisionPayload({
      deal,
      revision: { offerAmount: "100000", offerType: "cash" },
      status: "draft",
    });
    expect(payload).toMatchObject({
      deal_id: "deal-1",
      offer_amount: 100000,
      revision_kind: "offer",
      status: "draft",
      decision_basis: {
        contractVersion: "decision-contract-v1",
        rulesetVersion: "decision-compatibility-v1",
        researchRevision: 4,
      },
    });
  });

  it("records a seller counter as a new snapshot without mutating the prior revision", () => {
    const first = Object.freeze({
      id: "revision-1",
      revision_number: 1,
      status: "sent",
      offer_amount: 100000,
      terms: { offerType: "cash" },
      decision_basis: { researchRevision: 4 },
    });
    const payload = buildOfferRevisionPayload({
      deal,
      latestRevision: first,
      revision: { offerAmount: 110000 },
      status: "countered",
    });
    expect(payload).toMatchObject({ offer_amount: 110000, revision_kind: "seller_counter", status: "countered" });
    expect(first).toMatchObject({ offer_amount: 100000, status: "sent" });
  });

  it("projects the latest revision deterministically and enforces terminal transitions", () => {
    expect(projectLatestOfferRevision([
      { id: "b", revision_number: 2, status: "countered" },
      { id: "a", revision_number: 1, status: "sent" },
    ])).toMatchObject({ id: "b" });
    expect(canTransitionOffer("sent", "accepted")).toBe(true);
    expect(canTransitionOffer("accepted", "draft")).toBe(false);
  });

  it("creates Today work only for real dated sent/counter commitments", () => {
    expect(buildOfferCommitments({ status: "draft", follow_up_date: "2026-10-01" })).toEqual([]);
    expect(buildOfferCommitments({ status: "sent", follow_up_date: "2026-10-01" })).toEqual([
      expect.objectContaining({ sourceKey: "offer-follow-up", dueDate: "2026-10-01" }),
    ]);
  });
});
