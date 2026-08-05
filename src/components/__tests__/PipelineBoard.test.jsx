import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getPipelineStageColumns, normalizePipelineItem } from "../../services/pipeline";
import PipelineBoard from "../PipelineBoard";

function item(overrides = {}, selectedIds = []) {
  return normalizePipelineItem(
    {
      id: overrides.id || "deal-1",
      property_address: "123 Main",
      owner_name: "Alex Seller",
      phone: "+15555550100",
      stage: "New Lead",
      status: "Active",
      source: "Referral",
      acquisitions_rep: "Morgan",
      next_action: "Call seller",
      updated_at: "2026-08-03T10:00:00.000Z",
      ...overrides,
    },
    { now: new Date("2026-08-04T12:00:00.000Z").getTime(), selectedIds }
  );
}

describe("PipelineBoard", () => {
  it("groups normalized opportunities by stable pipeline stage", () => {
    const items = [item(), item({ id: "deal-2", property_address: "456 Oak", stage: "Closed" })];

    render(
      <PipelineBoard
        onOpenDeal={vi.fn()}
        stageColumns={getPipelineStageColumns(items)}
      />
    );

    expect(screen.getByRole("heading", { name: "New Lead" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Closed" })).toBeInTheDocument();
    expect(screen.getByText("123 Main")).toBeInTheDocument();
  });

  it("opens a deal and preserves existing selection controls", () => {
    const openDeal = vi.fn();
    const toggleSelect = vi.fn();
    const selectedItem = item({}, ["deal-1"]);

    render(
      <PipelineBoard
        onOpenDeal={openDeal}
        onToggleSelect={toggleSelect}
        stageColumns={getPipelineStageColumns([selectedItem])}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open deal 123 Main" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select 123 Main" }));

    expect(openDeal).toHaveBeenCalledWith(selectedItem);
    expect(toggleSelect).toHaveBeenCalledWith("deal-1");
    expect(screen.getByRole("article")).toHaveClass("pipeline-card--selected");
  });

  it("bounds cards per column and reveals the next safe batch", () => {
    const items = Array.from({ length: 14 }, (_, index) =>
      item({ id: `deal-${index}`, property_address: `${index} Main` })
    );

    render(
      <PipelineBoard
        onOpenDeal={vi.fn()}
        stageColumns={getPipelineStageColumns(items)}
      />
    );

    expect(screen.getAllByRole("article")).toHaveLength(12);
    fireEvent.click(screen.getByRole("button", { name: "Show 2 more" }));
    expect(screen.getAllByRole("article")).toHaveLength(14);
  });

  it("does not expose drag, stage mutation, or messaging controls", () => {
    render(
      <PipelineBoard
        onOpenDeal={vi.fn()}
        stageColumns={getPipelineStageColumns([item()])}
      />
    );

    expect(screen.queryByText(/change stage/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/send sms/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("pipeline-board")).toHaveAttribute("tabindex", "0");
  });
});
