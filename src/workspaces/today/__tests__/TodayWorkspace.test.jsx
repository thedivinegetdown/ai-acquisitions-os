import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const completeTodayCommitment = vi.fn();
const revisitTodayCommitment = vi.fn();
vi.mock("../../../services/today/todayCommitmentService", () => ({
  completeTodayCommitment,
  revisitTodayCommitment,
}));

import TodayWorkspace from "../TodayWorkspace";

const deal = {
  id: "deal-1",
  property_address: "123 Main Street",
  owner_name: "Alex Seller",
  phone: "+15551234567",
  stage: "New Lead",
  due_date: "2026-07-29",
  created_at: "2026-07-01T10:00:00.000Z",
};

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-30T12:00:00.000Z"));
  completeTodayCommitment.mockReset();
  revisitTodayCommitment.mockReset();
  completeTodayCommitment.mockResolvedValue({ success: true, data: {} });
  revisitTodayCommitment.mockResolvedValue({ success: true, data: {} });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TodayWorkspace", () => {
  it("renders loading state", () => {
    render(<TodayWorkspace loading />);

    expect(screen.getByLabelText("Loading Today workspace")).toBeInTheDocument();
  });

  it("renders briefing, source warning, and category navigation", () => {
    render(<TodayWorkspace deals={[deal]} />);

    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByText("Daily Acquisition Briefing")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Some Today sources are incomplete");
    expect(screen.getByRole("tab", { name: /Act Now/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /At Risk/ })).toBeInTheDocument();
    expect(screen.getByText(/ordered by Cost of Delay/i)).toBeInTheDocument();
  });

  it("supports keyboard category navigation", () => {
    render(<TodayWorkspace deals={[deal]} />);
    const tabList = screen.getByRole("tablist", { name: "Today categories" });
    const actNowTab = within(tabList).getByRole("tab", { name: /Act Now/ });

    actNowTab.focus();
    fireEvent.keyDown(actNowTab, { key: "ArrowRight" });

    expect(within(tabList).getByRole("tab", { name: /Approvals/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(localStorage.getItem("ai-today-category")).toBe("approvals");
  });

  it("routes the Approvals category to the Universal Approval Inbox", () => {
    const onNavigateWorkspace = vi.fn();
    render(
      <TodayWorkspace
        deals={[{ ...deal, next_action: "" }]}
        onNavigateWorkspace={onNavigateWorkspace}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: /Approvals/ }));

    expect(onNavigateWorkspace).toHaveBeenCalledWith("approvals");
    expect(localStorage.getItem("ai-today-category")).toBe("approvals");
  });

  it("navigates to existing deal context for item actions", () => {
    const openDeal = vi.fn();
    render(<TodayWorkspace deals={[deal]} openDeal={openDeal} />);

    fireEvent.click(screen.getByRole("tab", { name: /At Risk/ }));
    fireEvent.click(screen.getByRole("button", { name: "Open deal" }));

    expect(openDeal).toHaveBeenCalledWith(deal);
  });

  it("opens the normalized seller conversation selected by Today", () => {
    const onNavigateWorkspace = vi.fn();
    const setSelectedPhone = vi.fn();
    render(
      <TodayWorkspace
        conversations={[
          {
            compatibilityKey: "phone:5555550100",
            phone: "+15555550100",
            lastMessageDirection: "inbound",
            lastMessagePreview: "Please call me",
            lastMessageTimestamp: "2026-07-30T11:00:00.000Z",
          },
        ]}
        deals={[]}
        onNavigateWorkspace={onNavigateWorkspace}
        setSelectedPhone={setSelectedPhone}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open inbox" }));

    expect(screen.getByText("Delay: High")).toBeInTheDocument();
    expect(screen.getAllByText("Act Now")).toHaveLength(2);
    expect(setSelectedPhone).toHaveBeenCalledWith("+15555550100");
    expect(onNavigateWorkspace).toHaveBeenCalledWith("inbox");
  });

  it("uses safe empty states for selected empty categories", () => {
    render(<TodayWorkspace deals={[deal]} />);

    fireEvent.click(screen.getByRole("tab", { name: /Completed/ }));

    expect(screen.getByText("No Completed items")).toBeInTheDocument();
  });

  it("renders a zero-work state without fabricated metrics", () => {
    render(<TodayWorkspace deals={[]} />);

    expect(screen.getByText("No work queued for Today")).toBeInTheDocument();
    expect(screen.getByText(/No Today items require attention/)).toBeInTheDocument();
  });

  it("runs manual refresh through the existing refresh callback", async () => {
    const refresh = vi.fn().mockResolvedValue();
    render(<TodayWorkspace deals={[]} refresh={refresh} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    });

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("completes and reschedules durable commitments through Today controls", async () => {
    const refresh = vi.fn().mockResolvedValue();
    const refreshCommitments = vi.fn().mockResolvedValue();
    render(
      <TodayWorkspace
        deals={[deal]}
        refresh={refresh}
        refreshCommitments={refreshCommitments}
        sellerTasks={[
          {
            id: "task-1",
            deal_id: "deal-1",
            title: "Call seller",
            due_at: "2026-07-29T12:00:00.000Z",
            status: "open",
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: /At Risk/ }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Complete" }));
    });
    expect(completeTodayCommitment).toHaveBeenCalledWith(
      expect.objectContaining({ commitment: { sourceType: "seller-task", sourceId: "task-1", dealId: "deal-1" } })
    );

    fireEvent.change(screen.getByLabelText("Future revisit date for Call seller"), {
      target: { value: "2026-08-05" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Wait / revisit" }));
    });
    expect(revisitTodayCommitment).toHaveBeenCalledWith(expect.any(Object), "2026-08-05");
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(refreshCommitments).toHaveBeenCalledTimes(2);
  });

  it("keeps dark mode compatible through token-based rendering", () => {
    document.documentElement.dataset.theme = "dark";
    render(<TodayWorkspace deals={[deal]} />);

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByText("Daily Acquisition Briefing")).toBeInTheDocument();
  });
});
