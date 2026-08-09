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
vi.mock("../../../components/NegotiationTracker", () => ({
  default: () => <div>Existing Negotiation Tracker Panel</div>,
}));
vi.mock("../../../components/PropertyIntelligencePanel", () => ({
  default: () => <div>Existing Property Intelligence Panel</div>,
}));
vi.mock("../../../components/CompsEngine", () => ({
  default: () => <div>Existing Comps Engine Panel</div>,
}));
vi.mock("../../../components/BuyerMatches", () => ({
  default: () => <div>Existing Buyer Matches Panel</div>,
}));
vi.mock("../../../components/BuyerBlast", () => ({
  default: () => <div>Existing Buyer Blast Panel</div>,
}));
vi.mock("../../../components/CloseoutPanel", () => ({
  default: () => <div>Existing Closeout Panel</div>,
}));
vi.mock("../../../components/MessageCenter", () => ({
  default: () => <div>Existing Message Center Panel</div>,
}));
vi.mock("../../../components/SequenceEngine", () => ({
  default: () => <div>Existing Sequence Engine Panel</div>,
}));
vi.mock("../../../components/ActivityTimeline", () => ({
  default: () => <div>Existing Activity Timeline Panel</div>,
}));
vi.mock("../../../components/TaskPanel", () => ({
  default: () => <div>Existing Task Panel</div>,
}));
vi.mock("../../../components/TeamPanel", () => ({
  default: () => <div>Existing Team Panel</div>,
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
vi.mock("../PursuitScoreSummary", () => ({
  default: () => <div>Future Pursuit Score Summary</div>,
}));
vi.mock("../ResidentialStrategySummary", () => ({
  default: () => <div>Residential Strategy Summary</div>,
}));
vi.mock("../VacantLandStrategySummary", () => ({
  default: () => <div>Vacant Land Strategy Summary</div>,
}));
vi.mock("../OfferReadinessSummary", () => ({
  default: ({ result }) => <div>Offer Readiness Summary: {result.displayLabel}</div>,
}));
vi.mock("../ConflictReviewPanel", () => ({
  default: ({ readModel }) => <div>Conflict Review: {readModel.counts.open} open</div>,
}));
vi.mock("../../../components/DocumentVault", () => ({
  default: () => <div>Existing Document Vault Panel</div>,
}));
vi.mock("../../../components/DocumentContractPrepPanel", () => ({
  default: () => <div>Existing Document Prep Panel</div>,
}));

const deal = {
  id: "deal-123",
  asset_type: "residential-home",
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
      screen.getAllByText("How would you describe the property's current condition?").length
    ).toBeGreaterThan(0);
    expect(await screen.findByText("Offer readiness: Needs Information")).toBeInTheDocument();
    expect(await screen.findByText("Offer Readiness Summary: Needs Information")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prepare Offer" })).toBeInTheDocument();
    expect(
      screen.getAllByText("Residential home - Implemented").length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Residential Acquisition Strategy v1").length
    ).toBeGreaterThan(0);
    expect(await screen.findByText("Residential Strategy Summary")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Existing AI Insights Panel")).toBeInTheDocument());
  });

  it("requires classification for an unknown asset and does not mount residential insight", () => {
    renderRoom({ deals: [{ ...deal, asset_type: undefined }] });

    expect(
      screen.getAllByText("Asset Type Unknown - Classification Required").length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Classification Required").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Prepare Offer" })).toBeDisabled();
    expect(screen.getByRole("heading", { name: "Residential analysis unavailable" })).toBeInTheDocument();
    expect(screen.queryByText("Existing AI Insights Panel")).not.toBeInTheDocument();
  });

  it("requires review for conflicting classifications and exposes both sources", async () => {
    renderRoom({ deals: [{ ...deal, property_type: "Vacant land" }] });

    expect(
      screen.getAllByText("Asset Type Conflict - Review Required").length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Review Required").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Decision Basis"));
    expect(screen.getByText("Stored value: residential-home")).toBeInTheDocument();
    expect(screen.getByText("Stored value: Vacant land")).toBeInTheDocument();
    expect(
      screen.getByText(/map to different canonical asset types/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/approved persistent path/i)).toBeInTheDocument();
    expect(await screen.findByText("Conflict Review: 1 open")).toBeInTheDocument();
  });

  it("does not mount conflict review for a conflict-free deal", () => {
    renderRoom();
    expect(screen.queryByText(/Conflict Review:/)).not.toBeInTheDocument();
  });

  it.each([
    ["vacant-residential-land", "Vacant residential land - Implemented"],
    ["small-multifamily", "Small multifamily - Strategy Not Yet Implemented"],
    ["manufactured-home", "Manufactured home - Deferred"],
    ["commercial", "Commercial - Deferred"],
  ])("shows truthful strategy status for %s", (assetType, expectedStatus) => {
    renderRoom({ deals: [{ ...deal, asset_type: assetType }] });

    expect(screen.getAllByText(expectedStatus).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Prepare Offer" })).toBeDisabled();
    expect(screen.queryByText("Existing AI Insights Panel")).not.toBeInTheDocument();
  });

  it("shows classification provenance and blocked reasons in the existing Decision Basis", () => {
    renderRoom({
      deals: [{ ...deal, asset_type: "vacant-residential-land" }],
    });

    fireEvent.click(screen.getByText("Decision Basis"));

    expect(
      screen.getByText("Stored value: vacant-residential-land")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Mapped value: vacant-residential-land")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/maps to Vacant residential land/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/cannot use residential property intelligence/i)
    ).toBeInTheDocument();
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
    expect(screen.getByText("Evidence records")).toBeInTheDocument();
    expect(screen.getByText("Evidence ruleset")).toBeInTheDocument();
    expect(screen.getByText("evidence-provenance-ruleset-v1")).toBeInTheDocument();
    expect(screen.getByText("Pursuit Scoring Framework")).toBeInTheDocument();
    expect(screen.getByText("Production Strategy Profile")).toBeInTheDocument();
    expect(screen.getByText("residential-pursuit-profile-v1")).toBeInTheDocument();
    expect(screen.getByText("residential-underwriting-policy-v1")).toBeInTheDocument();
    expect(screen.queryByText("Pursuit Score")).not.toBeInTheDocument();
    expect(screen.queryByText("Future Pursuit Score Summary")).not.toBeInTheDocument();
    expect(screen.queryByText("Recommendation Confidence")).not.toBeInTheDocument();
    expect(screen.queryByText("Data Reliability")).not.toBeInTheDocument();
    expect(screen.queryByText("Cost of Delay")).not.toBeInTheDocument();
  });

  it("does not convert or display a legacy lead score as Pursuit Score", () => {
    renderRoom({ deals: [{ ...deal, lead_score: 100 }] });

    expect(screen.queryByRole("heading", { name: "Pursuit Score" })).not.toBeInTheDocument();
    expect(screen.queryByText("Future Pursuit Score Summary")).not.toBeInTheDocument();
    expect(screen.queryByText("100/100")).not.toBeInTheDocument();
  });

  it("renders the production Pursuit Score only when residential factors are complete", async () => {
    renderRoom({
      deals: [
        {
          ...deal,
          price: 120000,
          asking_price: 120000,
          arv: 210000,
          repairs_needed: 25000,
          motivation_score: 8,
          seller_timeline: "within 30 days",
          mortgage_balance: 90000,
          mortgage_status: "Current",
          occupancy_status: "Vacant",
        },
      ],
    });

    expect(await screen.findByText("Future Pursuit Score Summary")).toBeInTheDocument();
    expect(screen.getByText("Residential Strategy Summary")).toBeInTheDocument();
  });

  it("keeps deterministic Decision Intelligence separate from optional AI-assisted insight", async () => {
    renderRoom();

    expect(screen.getAllByText(/Deterministic Residential Strategy|Deterministic strategy/).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "AI-assisted insight" })).toBeInTheDocument();
    expect(
      screen.getByText(/separate from deterministic Residential Strategy underwriting/i)
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

  it("renders a partial usable decision when one compatibility field throws", () => {
    const brokenDeal = { ...deal };
    Object.defineProperty(brokenDeal, "price", {
      get() {
        throw new Error("service_role secret should not render");
      },
    });

    renderRoom({ deals: [brokenDeal] });

    expect(screen.getAllByText(/Decision basis is partial/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Decision information unavailable")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("service_role");
    expect(
      screen.getAllByText("Residential home - Implemented").length
    ).toBeGreaterThan(0);
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
    expect(screen.getByText("Existing Negotiation Tracker Panel")).toBeInTheDocument();
  });

  it("mounts existing residential property and buyer tools only after selection", async () => {
    renderRoom();

    fireEvent.click(screen.getByRole("tab", { name: "Property" }));
    expect(
      await screen.findByText("Existing Property Intelligence Panel")
    ).toBeInTheDocument();
    expect(screen.getByText("Existing Comps Engine Panel")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Closing" }));
    expect(await screen.findByText("Existing Buyer Matches Panel")).toBeInTheDocument();
    expect(screen.getByText("Existing Buyer Blast Panel")).toBeInTheDocument();
    expect(screen.getByText("Existing Closeout Panel")).toBeInTheDocument();
  });

  it("does not mount residential property, numbers, or buyer bundles for vacant land", async () => {
    renderRoom({
      deals: [{ ...deal, asset_type: "vacant-residential-land" }],
    });

    fireEvent.click(screen.getByRole("tab", { name: "Parcel" }));
    expect(screen.getAllByText("123 Main Street").length).toBeGreaterThan(0);
    expect(screen.queryByText("Existing Property Intelligence Panel")).not.toBeInTheDocument();
    expect(screen.queryByText("Existing Comps Engine Panel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Land Analysis" }));
    expect(screen.queryByText("Existing Deal Analyzer Panel")).not.toBeInTheDocument();
    expect(screen.queryByText("Existing Offer Engine Panel")).not.toBeInTheDocument();
    expect(screen.queryByText("Existing Negotiation Tracker Panel")).not.toBeInTheDocument();
    expect(screen.queryByText(/\$0/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Closing" }));
    expect(screen.queryByText("Existing Buyer Matches Panel")).not.toBeInTheDocument();
    expect(screen.queryByText("Existing Buyer Blast Panel")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Existing Closeout Panel")).toBeInTheDocument()
    );
  });

  it("keeps generic CRM sections available for a non-residential asset", async () => {
    renderRoom({ deals: [{ ...deal, asset_type: "commercial" }] });

    fireEvent.click(screen.getByRole("tab", { name: "Seller" }));
    expect(await screen.findByText("Existing Task Panel")).toBeInTheDocument();
    expect(screen.getByText("Existing Team Panel")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Communication" }));
    expect(await screen.findByText("Existing Message Center Panel")).toBeInTheDocument();
    expect(screen.getByText("Existing Sequence Engine Panel")).toBeInTheDocument();
    expect(screen.getByText("Existing Activity Timeline Panel")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Activity" }));
    expect(await screen.findByText("Unified Deal Timeline")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Documents" }));
    expect(await screen.findByText("Existing Document Vault Panel")).toBeInTheDocument();
    expect(screen.getByText("Existing Document Prep Panel")).toBeInTheDocument();
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
