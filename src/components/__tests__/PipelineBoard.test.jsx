import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PipelineBoard from "../PipelineBoard";

vi.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ children }) => <div>{children}</div>,
  Droppable: ({ children, droppableId }) =>
    children({
      droppableProps: { "data-droppable-id": droppableId },
      innerRef: vi.fn(),
      placeholder: null,
    }),
  Draggable: ({ children, draggableId }) =>
    children({
      draggableProps: { "data-draggable-id": draggableId, style: {} },
      dragHandleProps: {},
      innerRef: vi.fn(),
    }),
}));

vi.mock("../../services/sms", () => ({
  sendOutboundSms: vi.fn(),
}));

vi.mock("../../services/repositories", () => ({
  updateDeal: vi.fn(),
}));

describe("PipelineBoard", () => {
  const deals = [
    {
      id: "1",
      property_address: "123 Main",
      stage: "New Lead",
      lead_score: 7,
      motivation: 8,
      owner_name: "Alex",
    },
    {
      id: "2",
      property_address: "456 Oak",
      stage: "Closed",
    },
  ];

  it("groups deals by pipeline stage", () => {
    render(
      <PipelineBoard
        deals={deals}
        openDeal={vi.fn()}
        selectedIds={[]}
        toggleSelect={vi.fn()}
        refresh={vi.fn()}
      />
    );

    expect(screen.getByText("New Lead (1)")).toBeInTheDocument();
    expect(screen.getByText("Closed (1)")).toBeInTheDocument();
    expect(screen.getByText("123 Main")).toBeInTheDocument();
  });

  it("opens a deal and toggles selection from card controls", () => {
    const openDeal = vi.fn();
    const toggleSelect = vi.fn();

    render(
      <PipelineBoard
        deals={deals}
        openDeal={openDeal}
        selectedIds={["1"]}
        toggleSelect={toggleSelect}
        refresh={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("123 Main"));
    fireEvent.click(screen.getAllByRole("checkbox")[0]);

    expect(openDeal).toHaveBeenCalledWith(deals[0]);
    expect(toggleSelect).toHaveBeenCalledWith("1");
  });
});
