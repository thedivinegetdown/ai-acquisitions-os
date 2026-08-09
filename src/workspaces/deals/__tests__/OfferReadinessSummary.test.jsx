import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OfferReadinessSummary from "../OfferReadinessSummary";

const result = {
  assetType: "vacant-residential-land",
  strategyLabel: "Vacant Land Acquisition Strategy v1",
  rulesetVersion: "vacant-land-offer-readiness-ruleset-v1",
  readinessState: "manual-review-required",
  displayLabel: "Manual Review Required",
  explanation: "A flood constraint requires human review.",
  blockingGateResults: [{ gateId: "flood" }],
  manualReviewGates: [{ gateId: "flood" }],
  advisoryGateResults: [{ gateId: "utilities" }],
  recommendedNextAction: {
    enabled: true,
    label: "Review flood status",
    explanation: "Review stored environmental Evidence.",
    targetSection: "property",
  },
  approvalRequirement: {
    required: true,
    reason: "A significant land feasibility condition requires approval review.",
  },
  gateResults: [
    {
      gateId: "flood",
      label: "Flood status",
      category: "Property or Parcel Feasibility",
      criticality: "blocking",
      evaluationState: "manual-review",
      reason: "A stored flood constraint requires human review.",
      evidenceIds: ["evidence:flood"],
    },
  ],
  operatorDisclaimer: "Offer Readiness supports preparing an offer for human review. It is not an instruction to purchase.",
};

describe("OfferReadinessSummary", () => {
  it("renders strategy-aware non-numeric gates, approval, and safe navigation", () => {
    const onNavigateSection = vi.fn();
    const onNavigateWorkspace = vi.fn();
    render(<OfferReadinessSummary onNavigateSection={onNavigateSection} onNavigateWorkspace={onNavigateWorkspace} result={result} />);
    expect(screen.getByRole("heading", { name: "Offer Readiness" })).toBeInTheDocument();
    expect(screen.getByText("Manual Review Required")).toBeInTheDocument();
    expect(screen.getByText("Approval Required")).toBeInTheDocument();
    expect(screen.queryByText(/ready to buy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Parcel" }));
    expect(onNavigateSection).toHaveBeenCalledWith("property");
    fireEvent.click(screen.getByText("Readiness gates and Evidence"));
    expect(screen.getByRole("heading", { name: "Property or Parcel Feasibility" })).toBeInTheDocument();
    expect(screen.getByText("1 Evidence reference")).toBeInTheDocument();
  });

  it("opens the existing Approval Inbox for a readiness approval action", () => {
    const onNavigateWorkspace = vi.fn();
    render(
      <OfferReadinessSummary
        onNavigateWorkspace={onNavigateWorkspace}
        result={{
          ...result,
          recommendedNextAction: {
            enabled: true,
            label: "Open Approvals",
            explanation: "Review the represented approval.",
            targetSection: "approvals",
          },
        }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Open approvals" }));
    expect(onNavigateWorkspace).toHaveBeenCalledWith("approvals");
  });
});
