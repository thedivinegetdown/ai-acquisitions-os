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
vi.mock("../DealTimeline", () => ({
  default: ({ onOpenContext }) => (
    <div>
      <div>Unified Deal Timeline</div>
      <button
        onClick={() =>
          onOpenContext({
            availableActions: [{ id: "open-context", targetSection: "documents" }],
          })
        }
        type="button"
      >
        Timeline document context
      </button>
      <button
        onClick={() =>
          onOpenContext({
            availableActions: [{ id: "open-context", targetWorkspace: "inbox" }],
            sellerReference: { phone: "5553334444" },
          })
        }
        type="button"
      >
        Timeline inbox context
      </button>
      <button
        onClick={() =>
          onOpenContext({
            availableActions: [{ id: "open-context", targetWorkspace: "approvals" }],
          })
        }
        type="button"
      >
        Timeline approval context
      </button>
    </div>
  ),
}));
vi.mock("../../../components/DocumentVault", () => ({
  default: () => <div>Existing Document Vault Panel</div>,
}));
vi.mock("../../../components/DocumentContractPrepPanel", () => ({
  default: () => <div>Existing Document Prep Panel</div>,
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

  it("lazy-loads the unified timeline only when Activity is selected", async () => {
    renderRoom();

    expect(screen.queryByText("Unified Deal Timeline")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Activity" }));

    await waitFor(() => expect(screen.getByText("Unified Deal Timeline")).toBeInTheDocument());
  });

  it("switches Decision Room sections from a timeline context action", async () => {
    renderRoom();
    fireEvent.click(screen.getByRole("tab", { name: "Activity" }));
    fireEvent.click(await screen.findByRole("button", { name: "Timeline document context" }));

    await waitFor(() => expect(screen.getByText("Existing Document Vault Panel")).toBeInTheDocument());
    expect(screen.getByRole("tab", { name: "Documents" })).toHaveAttribute("aria-selected", "true");
  });

  it("opens Inbox and Approvals from supported timeline contexts", async () => {
    const setSelectedPhone = vi.fn();
    const onNavigateWorkspace = vi.fn();
    renderRoom({ onNavigateWorkspace, setSelectedPhone });
    fireEvent.click(screen.getByRole("tab", { name: "Activity" }));

    fireEvent.click(await screen.findByRole("button", { name: "Timeline inbox context" }));
    expect(setSelectedPhone).toHaveBeenCalledWith("5553334444");
    expect(onNavigateWorkspace).toHaveBeenCalledWith("inbox");

    fireEvent.click(screen.getByRole("button", { name: "Timeline approval context" }));
    expect(onNavigateWorkspace).toHaveBeenCalledWith("approvals");
  });

  it("opens the selected seller conversation in the route-level Inbox", () => {
    const setSelectedPhone = vi.fn();
    const onNavigateWorkspace = vi.fn();
    renderRoom({ onNavigateWorkspace, setSelectedPhone });

    fireEvent.click(screen.getByRole("button", { name: "View Conversation" }));

    expect(setSelectedPhone).toHaveBeenCalledWith("5551112222");
    expect(onNavigateWorkspace).toHaveBeenCalledWith("inbox");
    expect(screen.queryByText("Existing Message Center Panel")).not.toBeInTheDocument();
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
