import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WorkspaceRoutes from "../WorkspaceRoutes";

vi.mock("../../components/MorningBriefing", () => ({ default: () => <div>Morning Briefing Mock</div> }));
vi.mock("../../components/ActionInboxPanel", () => ({ default: () => <div>Action Inbox Mock</div> }));
vi.mock("../../components/NotificationsCenter", () => ({
  default: () => <div>Notifications Mock</div>,
}));
vi.mock("../../components/TaskDashboard", () => ({ default: () => <div>Task Dashboard Mock</div> }));
vi.mock("../deals/DealDecisionRoom", () => ({ default: () => <div>Decision Room Mock</div> }));
vi.mock("../approvals/ApprovalInboxWorkspace", () => ({
  default: () => <div>Approval Inbox Mock</div>,
}));
vi.mock("../pipeline/PipelineWorkspace", () => ({
  default: () => (
    <section>
      <h1>Pipeline</h1>
      <div>Pipeline Workspace Mock</div>
    </section>
  ),
}));
vi.mock("../inbox/InboxWorkspace", () => ({
  default: () => (
    <section>
      <h1>Inbox</h1>
      <div>Unified Inbox Workspace Mock</div>
    </section>
  ),
}));

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

    await waitFor(() => expect(screen.getByText("Pipeline Workspace Mock")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Pipeline" })).toBeInTheDocument();
    expect(screen.queryByText("Action Inbox Mock")).not.toBeInTheDocument();
    expect(screen.queryByText("Search Filters Mock")).not.toBeInTheDocument();
  });

  it("lazy loads the Unified Inbox without mounting legacy Inbox products", async () => {
    render(<WorkspaceRoutes {...baseProps} workspaceId="inbox" />);

    await waitFor(() =>
      expect(screen.getByText("Unified Inbox Workspace Mock")).toBeInTheDocument()
    );
    expect(screen.getByRole("heading", { name: "Inbox" })).toBeInTheDocument();
    expect(screen.queryByText("Chat Inbox Mock")).not.toBeInTheDocument();
    expect(screen.queryByText("Conversation Thread Mock")).not.toBeInTheDocument();
  });

  it("renders the route-level Deal Decision Room workspace", async () => {
    render(<WorkspaceRoutes {...baseProps} workspaceId="deal-decision-room" />);

    await waitFor(() => expect(screen.getByText("Decision Room Mock")).toBeInTheDocument());
  });

  it("lazy loads the contextual Universal Approval Inbox workspace", async () => {
    render(<WorkspaceRoutes {...baseProps} workspaceId="approvals" />);

    await waitFor(() => expect(screen.getByText("Approval Inbox Mock")).toBeInTheDocument());
    expect(screen.queryByText("Pipeline Board Mock")).not.toBeInTheDocument();
  });

  it("renders a safe unknown-route fallback", () => {
    render(<WorkspaceRoutes {...baseProps} isUnknownRoute workspaceId="unknown" />);

    expect(screen.getByRole("heading", { name: "Workspace not found" })).toBeInTheDocument();
    expect(screen.getByText("Unknown workspace")).toBeInTheDocument();
  });
});
