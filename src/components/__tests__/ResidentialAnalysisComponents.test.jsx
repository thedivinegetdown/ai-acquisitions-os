import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAssetStrategyContext,
  evaluateResidentialStrategy,
} from "../../services/asset-strategy";
import DealAnalyzer from "../DealAnalyzer";
import BuyerBlast from "../BuyerBlast";
import OfferEngine from "../OfferEngine";

const updateDeal = vi.fn();

vi.mock("../../services/repositories", () => ({
  updateDeal: (...args) => updateDeal(...args),
}));

const deal = {
  id: "deal-1",
  asset_type: "residential-home",
  property_address: "123 Main Street",
  asking_price: 120000,
  price: 120000,
  arv: 210000,
  repairs: 25000,
  repairs_needed: 25000,
  motivation_score: 8,
  seller_timeline: "within 30 days",
  mortgage_balance: 90000,
  mortgage_status: "Current",
  occupancy_status: "Vacant",
  rent: 1800,
};

function result() {
  return evaluateResidentialStrategy({
    assetStrategyContext: buildAssetStrategyContext(deal),
    deal,
    evaluatedTimestamp: "2026-08-05T15:00:00.000Z",
  });
}

describe("residential analysis consumers", () => {
  beforeEach(() => {
    updateDeal.mockReset();
    updateDeal.mockResolvedValue({ success: true, data: {} });
  });

  it("renders DealAnalyzer previews from the canonical Residential Strategy formulas", () => {
    const { container } = render(<DealAnalyzer deal={deal} refresh={vi.fn()} />);

    expect(screen.getByText("$122,000")).toBeInTheDocument();
    expect(screen.getByText("$2,000")).toBeInTheDocument();
    expect(screen.getByText("$112,000")).toBeInTheDocument();
    expect(screen.getByText("$48,200")).toBeInTheDocument();
    expect(screen.queryByText("Cashflow:")).not.toBeInTheDocument();
    expect(container.querySelector("[style]")).not.toBeInTheDocument();
  });

  it("preserves the approved save path without writing blank values as zero", async () => {
    render(<DealAnalyzer deal={deal} refresh={vi.fn()} />);
    const rent = screen.getByLabelText("Monthly rent, optional");
    fireEvent.change(rent, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Analysis Inputs" }));

    await waitFor(() => expect(updateDeal).toHaveBeenCalledTimes(1));
    expect(updateDeal).toHaveBeenCalledWith("deal-1", {
      arv: 210000,
      price: 120000,
      repairs: 25000,
    });
    expect(screen.getByText("Analysis inputs saved.")).toHaveAttribute("aria-live", "polite");
  });

  it("does not revive a stale repair alias after the editable value is cleared", () => {
    render(<DealAnalyzer deal={deal} refresh={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Repair estimate"), {
      target: { value: "" },
    });

    expect(screen.getAllByText("Missing required facts").length).toBeGreaterThan(0);
    expect(screen.queryByText("$122,000")).not.toBeInTheDocument();
  });

  it("uses the canonical result in OfferEngine and generates no arbitrary finance terms", () => {
    render(<OfferEngine deal={deal} strategyResult={result()} />);

    expect(screen.getByRole("heading", { name: "Offer review" })).toBeInTheDocument();
    expect(screen.getByText("$122,000")).toBeInTheDocument();
    expect(screen.getByText("$112,000")).toBeInTheDocument();
    expect(screen.getAllByText("Manual Review Required")).toHaveLength(2);
    expect(document.body).not.toHaveTextContent(/\$12,000 down|\/mo|0\.0065/);
  });

  it("uses stored numeric values and strategy review paths in BuyerBlast", () => {
    render(<BuyerBlast deal={deal} strategyResult={result()} />);
    const draft = screen.getByLabelText("Review-only buyer campaign draft").value;

    expect(draft).toContain("Asking: $120,000");
    expect(draft).toContain("ARV estimate: $210,000");
    expect(draft).toContain("Repair estimate: $25,000");
  });

  it("does not show zero values when offer review is unavailable", () => {
    const incomplete = { ...deal, arv: undefined, repairs: undefined, repairs_needed: undefined };
    render(<OfferEngine deal={incomplete} />);

    expect(screen.getByText(/not evaluated until the required residential facts/i)).toBeInTheDocument();
    expect(screen.queryByText("$0")).not.toBeInTheDocument();
  });
});
