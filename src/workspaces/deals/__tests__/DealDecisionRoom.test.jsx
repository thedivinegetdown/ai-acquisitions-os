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
    expect(screen.getByText("Lifecycle: Verify")).toBeInTheDocument();
    expect(screen.getByText("Recommended Next Action")).toBeInTheDocument();
    expect(
      screen.getByText("Ask about repairs and current property condition.")
    ).toBeInTheDocument();
    expect(screen.getByText("Offer readiness: Not Ready")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prepare Offer" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Existing AI Insights Panel")).toBeInTheDocument());
  });

  it("renders the existing route loading state before decision evaluation", () => {
    renderRoom({ loading: true });

    expect(screen.getByRole("heading", { name: "Deal Decision Room" })).toBeInTheDocument();
    expect(screen.getByText("Loading deal...")).toBeInTheDocument();
    expect(screen.queryByText("Decision Snapshot")).not.toBeInTheDocument();
  });

  it("renders the canonical Decision Basis without future metric clutter", () => {
    renderRoom();

    const disclosure = screen.getByText("Decision Basis");
    expect(disclosure).toBeInTheDocument();
    fireEvent.click(disclosure);

    expect(screen.getByRole("heading", { name: "Evidence and Provenance" })).toBeInTheDocument();
    expect(screen.getByText(/deal-decision-compatibility/)).toBeInTheDocument();
    expect(screen.getAllByText("Deal record").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Source timestamp: Not available/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Pursuit Score")).not.toBeInTheDocument();
    expect(screen.queryByText("Recommendation Confidence")).not.toBeInTheDocument();
    expect(screen.queryByText("Data Reliability")).not.toBeInTheDocument();
    expect(screen.queryByText("Cost of Delay")).not.toBeInTheDocument();
  });

  it("keeps deterministic Decision Intelligence separate from optional AI-assisted insight", async () => {
    renderRoom();

    expect(screen.getAllByText("Deterministic compatibility").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "AI-assisted insight" })).toBeInTheDocument();
    expect(
      screen.getByText(/separate from the deterministic compatibility recommendation/i)
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Existing AI Insights Panel")).toBeInTheDocument());
  });

  it("shows partial source warnings without hiding the usable decision", () => {
    renderRoom({
      decisionContext: {
        sourceErrors: [new Error("Approval context could not be loaded.")],
      },
    });

    expect(screen.getByText(/Decision basis is partial/)).toHaveAttribute("role", "status");
    expect(screen.getByText("Approval context could not be loaded.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prepare Offer" })).toBeEnabled();
  });

  it("renders a safe decision error without exposing an internal secret", () => {
    const brokenDeal = { ...deal };
    Object.defineProperty(brokenDeal, "price", {
      get() {
        throw new Error("service_role secret should not render");
      },
    });

    renderRoom({ deals: [brokenDeal] });

    expect(screen.getByRole("alert")).toHaveTextContent("Decision information unavailable");
    expect(screen.getByRole("alert")).not.toHaveTextContent("service_role");
    expect(screen.getByText("Readiness unavailable")).toBeInTheDocument();
  });

  it("shows only represented approval context and keeps unsupported mutations disabled", () => {
    renderRoom({
      decisionContext: {
        approvalItems: [
          {
            id: "approval-1",
            relatedDeal: { id: "deal-123" },
            status: "pending",
          },
        ],
      },
    });

    expect(screen.getByText("pending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Waiting" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Archive" })).toBeDisabled();
  });

  it("keeps the disclosure keyboard-focusable and token-based in dark mode", () => {
    const { container } = render(
      <div data-theme="dark">
        <DealDecisionRoom
          currentPath="/deals/deal-123"
          deals={[deal]}
          loading={false}
          onNavigateWorkspace={vi.fn()}
          refresh={vi.fn()}
          selectedPhone={null}
          setSelectedPhone={vi.fn()}
        />
      </div>
    );

    const disclosure = screen.getByText("Decision Basis");
    disclosure.focus();
    expect(disclosure).toHaveFocus();
    expect(container.querySelector(".decision-room__decision")).toBeInTheDocument();
    expect(container.querySelector("[style]")).not.toBeInTheDocument();
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

  it("preserves safe Decision action navigation from the canonical action list", async () => {
    renderRoom();

    fireEvent.click(screen.getByRole("button", { name: "Prepare Offer" }));
    await waitFor(() => expect(screen.getByRole("tab", { name: "Numbers" })).toHaveAttribute(
      "aria-selected",
      "true"
    ));
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
