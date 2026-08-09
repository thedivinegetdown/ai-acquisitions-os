import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAssetStrategyContext } from "../../../services/asset-strategy";
import { evaluateMissingInformation } from "../../../services/research-intelligence";
import MissingInformationAutopilot from "../MissingInformationAutopilot";

const EVALUATED_AT = "2026-08-05T15:00:00Z";

function completeDeal(overrides = {}) {
  return {
    id: "deal-1",
    asset_type: "residential-home",
    property_address: "123 Main Street",
    owner_name: "Sam Seller",
    phone: "5551112222",
    stage: "Contacted",
    asking_price: 120000,
    property_condition: "Needs repairs",
    motivation_score: 8,
    seller_timeline: "Within 30 days",
    mortgage_status: "Current",
    repairs_needed: 25000,
    occupancy_status: "Vacant",
    arv: 210000,
    ...overrides,
  };
}

function readModel(deal, options = {}) {
  const assetStrategyContext = buildAssetStrategyContext(deal);
  return evaluateMissingInformation({
    assetStrategyContext,
    conflicts: assetStrategyContext.classificationConflicts,
    deal,
    evaluatedTimestamp: EVALUATED_AT,
    ...options,
  });
}

function renderPanel(model, props = {}) {
  return render(
    <MissingInformationAutopilot
      onNavigateSection={vi.fn()}
      readModel={model}
      {...props}
    />
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MissingInformationAutopilot", () => {
  it("renders the active profile, summary, grouped item, and safe next action", () => {
    const model = readModel(
      completeDeal({ asking_price: null, property_condition: null })
    );
    renderPanel(model);

    expect(screen.getByRole("heading", { name: "Missing Information" })).toBeInTheDocument();
    expect(screen.getByText("Residential Strategy Requirements")).toBeInTheDocument();
    expect(screen.getByText(/Blocking: 1/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Financial" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Property condition" })).toBeInTheDocument();
    expect(screen.getByText(/Highest-priority next information action/i)).toBeInTheDocument();
    expect(screen.queryByText(/completeness percentage/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Pursuit Score")).not.toBeInTheDocument();
    expect(screen.queryByText("Data Reliability")).not.toBeInTheDocument();
  });

  it("opens the existing Decision Room section without mutating data", () => {
    const onNavigateSection = vi.fn();
    const model = readModel(completeDeal({ property_condition: null }));
    renderPanel(model, { onNavigateSection });

    fireEvent.click(screen.getByRole("button", { name: "Open Property" }));
    expect(onNavigateSection).toHaveBeenCalledWith("property");
  });

  it("copies an editable seller question and announces success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderPanel(readModel(completeDeal({ property_condition: null })));

    fireEvent.click(screen.getAllByRole("button", { name: "Copy Seller Question" })[0]);

    await waitFor(() =>
      expect(screen.getByText(/Seller question copied/)).toHaveAttribute(
        "role",
        "status"
      )
    );
    expect(writeText).toHaveBeenCalledWith(
      "How would you describe the property's current condition?"
    );
  });

  it("keeps visible guidance and announces clipboard failure", async () => {
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    renderPanel(readModel(completeDeal({ property_condition: null })));

    fireEvent.click(screen.getAllByRole("button", { name: "Copy Seller Question" })[0]);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Unable to copy to the clipboard"
      )
    );
    expect(
      screen.getAllByText(
        "How would you describe the property's current condition?"
      ).length
    ).toBeGreaterThan(0);
  });

  it("shows Evidence and Provenance in keyboard-operable disclosures", () => {
    renderPanel(readModel(completeDeal({ property_condition: null })));
    const disclosure = screen.getAllByText("Evidence and Provenance")[0];

    disclosure.focus();
    expect(disclosure).toHaveFocus();
    fireEvent.click(disclosure);
    expect(screen.getByText("property.condition")).toBeInTheDocument();
    expect(screen.getByText("No evidence reference is attached to this missing fact.")).toBeInTheDocument();
  });

  it("renders implemented vacant-land requirements without residential facts", () => {
    renderPanel(
      readModel(completeDeal({ asset_type: "vacant-residential-land" }))
    );

    expect(screen.getByText("Vacant Land Strategy Requirements")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Legal access" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Strategy and Capability Limitations" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Repairs needed" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "ARV / comps status" })).not.toBeInTheDocument();
  });

  it("renders unknown and conflicting classification states without a strategy profile", () => {
    const { rerender } = render(
      <MissingInformationAutopilot
        readModel={readModel(completeDeal({ asset_type: undefined }))}
      />
    );
    expect(
      screen.getByRole("heading", { name: "Asset Classification Required" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Vacant Land Safety Preflight")).not.toBeInTheDocument();

    rerender(
      <MissingInformationAutopilot
        readModel={readModel(
          completeDeal({ property_type: "Vacant land" })
        )}
      />
    );
    expect(
      screen.getByRole("heading", {
        name: "Asset Classification Review Required",
      })
    ).toBeInTheDocument();
  });

  it.each([
    ["small-multifamily", "Small Multifamily Strategy is not yet implemented."],
    ["manufactured-home", "Manufactured Home Strategy is deferred."],
    ["commercial", "Commercial Strategy is deferred."],
  ])("shows core-only limitations for %s", (assetType, limitation) => {
    renderPanel(readModel(completeDeal({ asset_type: assetType })));
    expect(screen.getByText("Common Acquisition Core")).toBeInTheDocument();
    expect(screen.getByText(limitation)).toBeInTheDocument();
  });

  it("uses a cautious empty state instead of claiming purchase readiness", () => {
    renderPanel(readModel(completeDeal()));

    expect(screen.getByRole("heading", { name: "No currently evaluated gaps" })).toBeInTheDocument();
    expect(screen.getByText(/does not establish purchase readiness/i)).toBeInTheDocument();
    expect(screen.queryByText(/ready to purchase/i)).not.toBeInTheDocument();
  });

  it("shows partial and full evaluation failures truthfully", () => {
    const { rerender } = renderPanel(
      readModel(completeDeal(), {
        sourceErrors: [new Error("private source detail")],
      })
    );
    expect(screen.getByText("Partial evaluation")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("private source detail");

    rerender(<MissingInformationAutopilot readModel={{ status: "failed" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Missing Information unavailable"
    );
  });

  it("remains token-based in dark mode without inline styles", () => {
    const { container } = render(
      <div data-theme="dark">
        <MissingInformationAutopilot
          readModel={readModel(completeDeal({ property_condition: null }))}
        />
      </div>
    );

    expect(container.querySelector(".missing-autopilot")).toBeInTheDocument();
    expect(container.querySelector("[style]")).not.toBeInTheDocument();
  });
});
