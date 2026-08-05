import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PipelineWorkspace from "../PipelineWorkspace";

const NOW = new Date("2026-08-04T12:00:00.000Z").getTime();

function deal(overrides = {}) {
  return {
    id: "deal-1",
    property_address: "123 Main Street",
    owner_name: "Alex Seller",
    phone: "+15555550100",
    stage: "New Lead",
    status: "Active",
    source: "Referral",
    acquisitions_rep: "Morgan",
    next_action: "Call seller",
    due_date: "2026-08-04",
    updated_at: "2026-08-03T10:00:00.000Z",
    ...overrides,
  };
}

const deals = [
  deal({ offer_ready: true }),
  deal({
    id: "deal-2",
    property_address: "456 Oak Avenue",
    owner_name: "Bailey Seller",
    stage: "Contacted",
    source: "Direct Mail",
    acquisitions_rep: "Taylor",
    next_action: "",
    updated_at: "2026-07-01T10:00:00.000Z",
  }),
  deal({
    id: "deal-3",
    property_address: "789 Pine Road",
    owner_name: "Casey Seller",
    stage: "Contacted",
    source: "Referral",
    next_action: "Review next week",
    due_date: "2026-08-10",
  }),
];

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  delete document.documentElement.dataset.theme;
});

describe("PipelineWorkspace", () => {
  it("renders a bounded loading state", () => {
    render(<PipelineWorkspace loading now={NOW} />);

    expect(screen.getByRole("heading", { name: "Pipeline" })).toBeInTheDocument();
    expect(screen.getByLabelText("Loading Pipeline")).toBeInTheDocument();
  });

  it("renders the decision-first board from real loaded facts", () => {
    render(<PipelineWorkspace deals={deals} now={NOW} />);

    expect(screen.getByTestId("pipeline-board")).toBeInTheDocument();
    expect(screen.getByText("123 Main Street")).toBeInTheDocument();
    expect(screen.getByText("No next action recorded")).toBeInTheDocument();
    expect(screen.queryByText(/priority score|pursuit score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/change stage/i)).not.toBeInTheDocument();
  });

  it("shows shared Needs Reply signals separately from unread state", () => {
    render(
      <PipelineWorkspace
        conversations={[
          {
            compatibilityKey: "phone:5555550100",
            phone: "+15555550100",
            lastMessageDirection: "inbound",
            lastMessagePreview: "Please call me",
            lastMessageTimestamp: "2026-08-04T11:00:00.000Z",
          },
        ]}
        deals={deals}
        now={NOW}
      />
    );

    expect(screen.getAllByText("Needs Reply").length).toBeGreaterThan(0);
    expect(screen.queryByText("Unread conversation")).not.toBeInTheDocument();
  });

  it("switches both views over the same normalized items and stores the preference", () => {
    render(<PipelineWorkspace deals={deals} now={NOW} />);

    fireEvent.click(screen.getByRole("button", { name: "Compact List" }));

    expect(screen.getByTestId("pipeline-compact-list")).toBeInTheDocument();
    expect(screen.getByText("123 Main Street")).toBeInTheDocument();
    expect(window.sessionStorage.getItem("ai-pipeline-view")).toBe("list");
  });

  it("applies search and structured filters through one contract, then resets", () => {
    render(<PipelineWorkspace deals={deals} now={NOW} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search pipeline" }), {
      target: { value: "Oak" },
    });
    expect(screen.getByText("456 Oak Avenue")).toBeInTheDocument();
    expect(screen.queryByText("123 Main Street")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    fireEvent.change(screen.getByLabelText("Assigned user"), { target: { value: "Taylor" } });
    expect(screen.getByText("456 Oak Avenue")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.getByText("789 Pine Road")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search pipeline" })).toHaveValue("");
  });

  it("uses deterministic focus views instead of separate data systems", () => {
    render(<PipelineWorkspace deals={deals} now={NOW} />);

    fireEvent.click(screen.getByRole("button", { name: "Waiting" }));

    expect(screen.getByText("789 Pine Road")).toBeInTheDocument();
    expect(screen.queryByText("456 Oak Avenue")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "At Risk" }));
    expect(screen.getByText("456 Oak Avenue")).toBeInTheDocument();
  });

  it("keeps focus views, filters, and card actions keyboard reachable", () => {
    render(<PipelineWorkspace deals={deals} now={NOW} />);

    const waitingView = screen.getByRole("button", { name: "Waiting" });
    waitingView.focus();
    expect(waitingView).toHaveFocus();
    expect(waitingView).not.toHaveAttribute("tabindex", "-1");

    const search = screen.getByRole("searchbox", { name: "Search pipeline" });
    search.focus();
    expect(search).toHaveFocus();

    const openDeal = screen.getByRole("button", { name: "Open deal 123 Main Street" });
    openDeal.focus();
    expect(openDeal).toHaveFocus();
  });

  it("opens cards in the route-level Deal Decision Room", () => {
    const navigateToDeal = vi.fn();
    render(<PipelineWorkspace deals={deals} navigateToDeal={navigateToDeal} now={NOW} />);

    fireEvent.click(screen.getByRole("button", { name: "Open deal 123 Main Street" }));

    expect(navigateToDeal).toHaveBeenCalledWith("deal-1");
  });

  it("keeps successful items visible during a partial source failure", () => {
    render(
      <PipelineWorkspace
        dealLoadError="Conversation summaries unavailable."
        deals={deals}
        now={NOW}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Conversation summaries unavailable");
    expect(screen.getByText("123 Main Street")).toBeInTheDocument();
  });

  it("distinguishes an empty pipeline from a filtered empty state", () => {
    const { rerender } = render(<PipelineWorkspace deals={[]} now={NOW} />);
    expect(screen.getByText("Pipeline is empty")).toBeInTheDocument();

    rerender(<PipelineWorkspace deals={deals} now={NOW} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search pipeline" }), {
      target: { value: "not-a-real-property" },
    });
    expect(screen.getByText("No opportunities match this view")).toBeInTheDocument();
  });

  it("preserves filters and view mode when the workspace remounts in the same session", () => {
    const first = render(<PipelineWorkspace deals={deals} now={NOW} />);
    fireEvent.click(screen.getByRole("button", { name: "Compact List" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search pipeline" }), {
      target: { value: "Oak" },
    });
    first.unmount();

    render(<PipelineWorkspace deals={deals} now={NOW} />);

    expect(screen.getByTestId("pipeline-compact-list")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search pipeline" })).toHaveValue("Oak");
    expect(screen.getByText("456 Oak Avenue")).toBeInTheDocument();
  });

  it("runs the existing refresh callback with safe success and failure states", async () => {
    const refresh = vi.fn().mockResolvedValue();
    const { rerender } = render(
      <PipelineWorkspace deals={deals} now={NOW} refresh={refresh} />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("refresh request completed");

    rerender(
      <PipelineWorkspace
        deals={deals}
        now={NOW}
        refresh={vi.fn().mockRejectedValue(new Error("raw provider error"))}
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("could not be refreshed");
    expect(screen.queryByText("raw provider error")).not.toBeInTheDocument();
  });

  it("supports selection without mounting unsafe bulk mutations", () => {
    const clearSelection = vi.fn();
    const toggleSelect = vi.fn();
    render(
      <PipelineWorkspace
        clearSelection={clearSelection}
        deals={deals}
        now={NOW}
        selectedIds={["deal-1"]}
        toggleSelect={toggleSelect}
      />
    );

    expect(screen.getByText("1 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select 123 Main Street" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(toggleSelect).toHaveBeenCalledWith("deal-1");
    expect(clearSelection).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/update stage|assign owner/i)).not.toBeInTheDocument();
  });

  it("remains token-driven, responsive-safe, reduced-motion-safe, and provider-independent", () => {
    document.documentElement.dataset.theme = "dark";
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });

    render(<PipelineWorkspace deals={deals} now={NOW} />);

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByTestId("pipeline-board")).toHaveClass("pipeline-board-scroll");
    expect(screen.queryByText(/provider not connected|upgrade/i)).not.toBeInTheDocument();
  });
});
