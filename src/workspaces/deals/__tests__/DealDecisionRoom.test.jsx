import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DealDecisionRoom from "../DealDecisionRoom";

vi.mock("../../../components/AIInsights", () => ({
  default: () => <div>Existing AI Insights Panel</div>,
}));
vi.mock("../../../components/DealAnalyzer", () => ({
  default: () => <div>Existing Deal Analyzer Panel</div>,
}));
vi.mock("../../../components/OfferEngine", () => ({
  default: () => <div>Existing Offer Engine Panel</div>,
}));
vi.mock("../../../components/MessageCenter", () => ({
  default: () => <div>Existing Message Center Panel</div>,
}));
vi.mock("../../../components/ActivityTimeline", () => ({
  default: () => <div>Existing Activity Timeline Panel</div>,
}));
vi.mock("../../../components/DocumentVault", () => ({
  default: () => <div>Existing Document Vault Panel</div>,
}));

const deal = {
  id: "deal-123",
  property_address: "123 Main Street",
  owner_name: "Sam Seller",
  phone: "5551112222",
  stage: "Contacted",
  price: 125000,
};

function renderRoom(overrides = {}) {
  return render(
    <DealDecisionRoom
      currentPath="/deals/deal-123"
      deals={[deal]}
      loading={false}
      onNavigateWorkspace={vi.fn()}
      refresh={vi.fn()}
      selectedPhone={null}
      setSelectedPhone={vi.fn()}
      {...overrides}
    />
  );
}

describe("DealDecisionRoom", () => {
  it("renders the selected deal as a route-level Decision Room", async () => {
    renderRoom();

    expect(screen.getByRole("heading", { level: 1, name: "123 Main Street" })).toBeInTheDocument();
    expect(screen.getAllByText("Sam Seller").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Contacted").length).toBeGreaterThan(0);
    expect(screen.getByText("Recommended Next Action:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prepare Offer" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Existing AI Insights Panel")).toBeInTheDocument());
  });

  it("keeps inactive section bundles unmounted until selected", async () => {
    renderRoom();

    expect(screen.queryByText("Existing Deal Analyzer Panel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Numbers" }));

    await waitFor(() => expect(screen.getByText("Existing Deal Analyzer Panel")).toBeInTheDocument());
    expect(screen.getByText("Existing Offer Engine Panel")).toBeInTheDocument();
  });

  it("routes primary actions to existing sections without mutating records", async () => {
    const setSelectedPhone = vi.fn();
    renderRoom({ setSelectedPhone });

    fireEvent.click(screen.getByRole("button", { name: "View Conversation" }));

    expect(setSelectedPhone).toHaveBeenCalledWith("5551112222");
    await waitFor(() => expect(screen.getByText("Existing Message Center Panel")).toBeInTheDocument());
  });

  it("renders a safe fallback when the route does not match a loaded deal", () => {
    const onNavigateWorkspace = vi.fn();
    renderRoom({
      currentPath: "/deals/missing",
      onNavigateWorkspace,
    });

    expect(screen.getByRole("heading", { name: "Deal not found" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to Deals" }));
    expect(onNavigateWorkspace).toHaveBeenCalledWith("deals");
  });
});
