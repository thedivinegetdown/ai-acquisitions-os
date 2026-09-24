import { describe, expect, it } from "vitest";
import {
  buildClosingCommitments,
  buildClosingRevisionPayload,
  projectLatestClosingRevision,
} from "../closingLifecycleService";

const deal = { id: "deal-1" };
const acceptedOfferRevision = { id: "offer-3", status: "accepted" };

describe("closing lifecycle", () => {
  it("enters closing only from an accepted offer and preserves buyer/deadline fields", () => {
    const payload = buildClosingRevisionPayload({
      acceptedOfferRevision,
      closing: {
        contractDate: "2026-09-23",
        closingDate: "2026-10-23",
        materialDeadlines: [{ id: "inspection", label: "Inspection", dueDate: "2026-10-01" }],
        selectedBuyerId: "buyer-1",
        assignmentFee: "15000",
      },
      deal,
      status: "under_contract",
    });
    expect(payload).toMatchObject({
      accepted_offer_revision_id: "offer-3",
      selected_buyer_id: "buyer-1",
      assignment_fee: 15000,
      status: "under_contract",
      material_deadlines: [{ id: "inspection", label: "Inspection", dueDate: "2026-10-01" }],
    });
  });

  it("requires realized proceeds and costs when closed", () => {
    expect(() => buildClosingRevisionPayload({ acceptedOfferRevision, deal, latestRevision: { status: "under_contract" }, status: "closed" })).toThrow(/realized proceeds/i);
    expect(buildClosingRevisionPayload({
      acceptedOfferRevision,
      deal,
      latestRevision: { status: "under_contract", acceptedOfferRevision },
      closing: { actualRealizedProceeds: "18000", actualCosts: "1200" },
      status: "closed",
    })).toMatchObject({ actual_realized_proceeds: 18000, actual_costs: 1200 });
  });

  it("keeps cancellation as a new terminal snapshot and latest projection", () => {
    const history = [
      { id: "closing-1", revision_number: 1, status: "under_contract" },
      { id: "closing-2", revision_number: 2, status: "cancelled" },
    ];
    expect(projectLatestClosingRevision(history)).toMatchObject({ id: "closing-2", status: "cancelled" });
    expect(() => buildClosingRevisionPayload({ acceptedOfferRevision, deal, latestRevision: history[1], status: "under_contract" })).toThrow(/terminal/i);
  });

  it("projects only dated open milestones to the existing Today commitment model", () => {
    expect(buildClosingCommitments({ status: "closed", closing_date: "2026-10-23" })).toEqual([]);
    expect(buildClosingCommitments({
      status: "under_contract",
      closing_date: "2026-10-23",
      material_deadlines: [{ id: "inspection", label: "Inspection", dueDate: "2026-10-01" }],
    })).toEqual([
      { sourceKey: "deadline:inspection", title: "Inspection", dueDate: "2026-10-01" },
      { sourceKey: "closing-date", title: "Closing date", dueDate: "2026-10-23" },
    ]);
  });
});
