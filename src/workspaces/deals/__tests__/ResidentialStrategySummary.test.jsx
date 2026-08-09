import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  buildAssetStrategyContext,
  evaluateResidentialStrategy,
} from "../../../services/asset-strategy";
import ResidentialStrategySummary from "../ResidentialStrategySummary";

const NOW = "2026-08-05T15:00:00.000Z";

function strategyResult(overrides = {}) {
  const deal = {
    id: "deal-1",
    asset_type: "residential-home",
    property_address: "123 Main Street",
    asking_price: 120000,
    arv: 210000,
    repairs_needed: 25000,
    motivation_score: 8,
    seller_timeline: "within 30 days",
    mortgage_balance: 90000,
    mortgage_status: "Current",
    occupancy_status: "Vacant",
    rent: 1800,
    ...overrides,
  };
  return evaluateResidentialStrategy({
    assetStrategyContext: buildAssetStrategyContext(deal),
    deal,
    evaluatedTimestamp: NOW,
  });
}

describe("ResidentialStrategySummary", () => {
  it("renders versioned underwriting, signals, and review-only exits", () => {
    render(<ResidentialStrategySummary result={strategyResult()} />);

    expect(screen.getByRole("heading", { name: "Residential Strategy" })).toBeInTheDocument();
    expect(screen.getByText("residential-strategy-v1")).toBeInTheDocument();
    expect(screen.getByText("residential-pursuit-profile-v1")).toBeInTheDocument();
    expect(screen.getByText("$122,000")).toBeInTheDocument();
    expect(screen.getByText("$2,000")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Risk signals" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Review-only exit candidates" })).toBeInTheDocument();
    expect(screen.getAllByText("Manual Review Required").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Low Risk|Medium Risk|High Risk/)).not.toBeInTheDocument();
  });

  it("discloses assumptions and excluded costs through keyboard-operable details", () => {
    render(<ResidentialStrategySummary result={strategyResult()} />);
    const disclosure = screen.getByText("Assumptions and excluded costs");

    disclosure.focus();
    expect(disclosure).toHaveFocus();
    fireEvent.click(disclosure);
    expect(screen.getByText(/70% acquisition ceiling/)).toBeInTheDocument();
    expect(screen.getByText(/excludes financing, holding costs/)).toBeInTheDocument();
    expect(screen.getByText(/not an instruction to purchase or make an offer/i)).toBeInTheDocument();
  });

  it("shows missing facts without zero-value placeholders", () => {
    render(
      <ResidentialStrategySummary
        result={strategyResult({ arv: undefined, repairs_needed: undefined })}
      />
    );

    expect(screen.getAllByText(/Missing required facts/).length).toBeGreaterThan(0);
    expect(screen.getByText(/not shown as zero/i)).toBeInTheDocument();
    expect(screen.queryByText("$0")).not.toBeInTheDocument();
  });

  it("renders nothing for a non-residential ineligible result", () => {
    const result = strategyResult({ asset_type: "vacant-residential-land" });
    const { container } = render(<ResidentialStrategySummary result={result} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("uses responsive token classes in dark mode without inline styles", () => {
    const { container } = render(
      <div data-theme="dark">
        <ResidentialStrategySummary result={strategyResult()} />
      </div>
    );

    expect(container.querySelector(".residential-strategy__metrics")).toBeInTheDocument();
    expect(container.querySelector("[style]")).not.toBeInTheDocument();
  });
});
