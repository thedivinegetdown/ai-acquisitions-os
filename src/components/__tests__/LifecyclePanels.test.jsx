import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OfferLifecyclePanel from "../OfferLifecyclePanel";
import ClosingLifecyclePanel from "../ClosingLifecyclePanel";

const mocks = vi.hoisted(() => ({
  appendClosingRevision: vi.fn(),
  appendOfferRevision: vi.fn(),
  listBuyers: vi.fn(),
  listClosingRevisionsByDeal: vi.fn(),
  listOfferRevisionsByDeal: vi.fn(),
}));

vi.mock("../../services/repositories", () => mocks);

const deal = { id: "deal-1", phone: "5551112222", asking_price: 120000 };

describe("manual lifecycle panels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listBuyers.mockResolvedValue({ success: true, data: [{ id: "buyer-1", name: "Buyer One" }] });
    mocks.listClosingRevisionsByDeal.mockResolvedValue({ success: true, data: [] });
    mocks.listOfferRevisionsByDeal.mockResolvedValue({ success: true, data: [] });
  });

  it("records draft, sent, and counter snapshots while preserving visible history", async () => {
    const records = [];
    mocks.appendOfferRevision.mockImplementation(async ({ revision, status }) => {
      const record = {
        id: `offer-${records.length + 1}`,
        revision_number: records.length + 1,
        status,
        offer_amount: Number(revision.offerAmount),
        terms: { offerType: revision.offerType },
        decision_basis: { researchRevision: 1 },
        follow_up_date: revision.followUpDate || null,
      };
      records.push(record);
      return { success: true, data: record };
    });

    render(<OfferLifecyclePanel deal={deal} />);
    await screen.findByText("No offer revisions yet.");
    fireEvent.change(screen.getByLabelText("Offer amount"), { target: { value: "100000" } });
    fireEvent.click(screen.getByRole("button", { name: "Save first draft" }));
    await screen.findByText(/Revision 1: Draft/);
    fireEvent.click(screen.getByRole("button", { name: "Record sent" }));
    await screen.findByText(/Revision 2: Sent/);
    fireEvent.change(screen.getByLabelText("Offer amount"), { target: { value: "110000" } });
    fireEvent.click(screen.getByRole("button", { name: "Record seller counter" }));
    await screen.findByText(/Revision 3: Countered/);

    expect(screen.getByRole("list", { name: "Offer revision history" })).toHaveTextContent("Revision 1: Draft — $100,000");
    expect(mocks.appendOfferRevision.mock.calls.map(([command]) => command.status)).toEqual(["draft", "sent", "countered"]);
    expect(screen.getByText(/nothing is sent/i)).toBeInTheDocument();
  });

  it("persists buyer, deadlines, actuals, and closing outcome through append commands", async () => {
    mocks.listOfferRevisionsByDeal.mockResolvedValue({ success: true, data: [{ id: "offer-accepted", revision_number: 3, status: "accepted", offer_amount: 100000 }] });
    const records = [];
    mocks.appendClosingRevision.mockImplementation(async ({ closing, status }) => {
      const record = {
        id: `closing-${records.length + 1}`,
        revision_number: records.length + 1,
        status,
        closing_date: closing.closingDate,
        material_deadlines: closing.materialDeadlines,
        selected_buyer_id: closing.selectedBuyerId,
        actual_realized_proceeds: closing.actualRealizedProceeds === "" ? null : Number(closing.actualRealizedProceeds),
        actual_costs: closing.actualCosts === "" ? null : Number(closing.actualCosts),
      };
      records.push(record);
      return { success: true, data: record };
    });

    render(<ClosingLifecyclePanel deal={deal} />);
    await screen.findByRole("button", { name: "Enter under contract" });
    fireEvent.change(screen.getByLabelText("Closing date"), { target: { value: "2026-10-23" } });
    fireEvent.change(screen.getByLabelText("Material deadline label"), { target: { value: "Inspection" } });
    fireEvent.change(screen.getByLabelText("Material deadline date"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Selected buyer"), { target: { value: "buyer-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Enter under contract" }));
    await screen.findByText(/Revision 1: Under Contract/);
    fireEvent.change(screen.getByLabelText("Realized proceeds"), { target: { value: "18000" } });
    fireEvent.change(screen.getByLabelText("Actual costs"), { target: { value: "1200" } });
    fireEvent.click(screen.getByRole("button", { name: "Record closed" }));
    await screen.findByText(/Revision 2: Closed/);

    await waitFor(() => expect(mocks.appendClosingRevision).toHaveBeenCalledTimes(2));
    expect(mocks.appendClosingRevision.mock.calls[0][0]).toMatchObject({
      closing: {
        selectedBuyerId: "buyer-1",
        materialDeadlines: [{ id: "material-1", label: "Inspection", dueDate: "2026-10-01" }],
      },
      status: "under_contract",
    });
    expect(mocks.appendClosingRevision.mock.calls[1][0]).toMatchObject({
      closing: { actualRealizedProceeds: "18000", actualCosts: "1200" },
      status: "closed",
    });
  });
});
