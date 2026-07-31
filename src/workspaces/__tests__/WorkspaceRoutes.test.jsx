import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WorkspaceRoutes from "../WorkspaceRoutes";

vi.mock("../../components/ChatInbox", () => ({ default: () => <div>Chat Inbox Mock</div> }));
vi.mock("../../components/ConversationInbox", () => ({
  default: () => <div>Conversation Inbox Mock</div>,
}));
vi.mock("../../components/ConversationThread", () => ({
  default: () => <div>Conversation Thread Mock</div>,
}));
vi.mock("../../components/PipelineBoard", () => ({ default: () => <div>Pipeline Board Mock</div> }));
vi.mock("../../components/SearchFilters", () => ({ default: () => <div>Search Filters Mock</div> }));
vi.mock("../../components/SavedViewsBar", () => ({ default: () => <div>Saved Views Mock</div> }));
vi.mock("../../components/BulkActionsBar", () => ({ default: () => <div>Bulk Actions Mock</div> }));
vi.mock("../../components/MorningBriefing", () => ({ default: () => <div>Morning Briefing Mock</div> }));
vi.mock("../../components/ActionInboxPanel", () => ({ default: () => <div>Action Inbox Mock</div> }));
vi.mock("../../components/NotificationsCenter", () => ({
  default: () => <div>Notifications Mock</div>,
}));
vi.mock("../../components/TaskDashboard", () => ({ default: () => <div>Task Dashboard Mock</div> }));
vi.mock("../deals/DealDecisionRoom", () => ({ default: () => <div>Decision Room Mock</div> }));

const baseProps = {
  clearSelection: vi.fn(),
  deals: [],
  filteredDeals: [],
  loading: false,
  onNavigateHome: vi.fn(),
  openDeal: vi.fn(),
  refresh: vi.fn(),
  selectedIds: [],
  selectedPhone: null,
  setFilteredDeals: vi.fn(),
  setSelectedPhone: vi.fn(),
  toggleSelect: vi.fn(),
};

describe("WorkspaceRoutes", () => {
  it("renders the active Pipeline workspace without loading every legacy panel", async () => {
    render(<WorkspaceRoutes {...baseProps} workspaceId="pipeline" />);

    expect(screen.getByRole("heading", { name: "Pipeline" })).toBeInTheDocument();
    expect(screen.getByText("Pipeline Board Mock")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Search Filters Mock")).toBeInTheDocument());
    expect(screen.queryByText("Action Inbox Mock")).not.toBeInTheDocument();
  });

  it("preserves the existing Inbox entry points in the Inbox workspace", async () => {
    render(<WorkspaceRoutes {...baseProps} workspaceId="inbox" />);

    expect(screen.getByRole("heading", { name: "Inbox" })).toBeInTheDocument();
    expect(screen.getByText("Chat Inbox Mock")).toBeInTheDocument();
    expect(screen.getByText("Conversation Inbox Mock")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Conversation Thread Mock")).toBeInTheDocument());
  });

  it("renders the route-level Deal Decision Room workspace", async () => {
    render(<WorkspaceRoutes {...baseProps} workspaceId="deal-decision-room" />);

    await waitFor(() => expect(screen.getByText("Decision Room Mock")).toBeInTheDocument());
  });

  it("renders a safe unknown-route fallback", () => {
    render(<WorkspaceRoutes {...baseProps} isUnknownRoute workspaceId="unknown" />);

    expect(screen.getByRole("heading", { name: "Workspace not found" })).toBeInTheDocument();
    expect(screen.getByText("Unknown workspace")).toBeInTheDocument();
  });
});
