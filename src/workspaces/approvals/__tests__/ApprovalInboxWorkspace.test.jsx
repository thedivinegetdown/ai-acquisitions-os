import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ApprovalInboxWorkspace from "../ApprovalInboxWorkspace";

const offerDeal = {
  id: "deal-1",
  organization_id: "org-1",
  tenant_id: "tenant-1",
  owner_name: "Alex Seller",
  property_address: "123 Main Street",
  stage: "New Lead",
  next_action: "Call seller",
  offer_ready: true,
};

const messageDraft = {
  id: "draft-1",
  channel: "sms",
  body: "Hi Alex, is now a good time to talk?",
  to: "+15551234567",
  updatedAt: "2026-07-31T10:00:00.000Z",
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-31T12:00:00.000Z"));
  document.documentElement.removeAttribute("data-theme");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ApprovalInboxWorkspace", () => {
  it("renders a bounded loading state", () => {
    render(<ApprovalInboxWorkspace loading />);

    expect(screen.getByRole("heading", { name: "Approvals" })).toBeInTheDocument();
    expect(screen.getByLabelText("Loading Approval Inbox")).toBeInTheDocument();
  });

  it("renders summary, represented filters, and safe unsupported-action state", () => {
    render(<ApprovalInboxWorkspace deals={[offerDeal]} />);

    expect(screen.getByText("Compatibility approval foundation")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "All (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Offers (1)" })).toBeInTheDocument();
    expect(screen.getByText(/Manual completion required/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });

  it("labels optional provider cost and provider-disabled behavior without blocking review", () => {
    render(<ApprovalInboxWorkspace messageDrafts={[messageDraft]} />);

    expect(screen.getByText("MessagingProvider optional")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review in context" })).toBeEnabled();
    expect(screen.queryByText(/sent successfully/i)).not.toBeInTheDocument();
  });

  it("keeps successful items visible when one source reports a failure", () => {
    render(
      <ApprovalInboxWorkspace
        dealLoadError={new Error("Deal source unavailable")}
        messageDrafts={[messageDraft]}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Some approval sources are unavailable"
    );
    expect(screen.getByText("Review SMS draft")).toBeInTheDocument();
  });

  it("supports filter selection and keyboard navigation", () => {
    render(
      <ApprovalInboxWorkspace deals={[offerDeal]} messageDrafts={[messageDraft]} />
    );
    const tabList = screen.getByRole("tablist", { name: "Approval filters" });
    const all = within(tabList).getByRole("tab", { name: "All (2)" });

    all.focus();
    fireEvent.keyDown(all, { key: "ArrowRight" });
    expect(within(tabList).getByRole("tab", { name: "Offers (1)" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    fireEvent.click(within(tabList).getByRole("tab", { name: "Communications (1)" }));
    expect(within(screen.getByRole("tabpanel")).getByText("Review SMS draft")).toBeInTheDocument();
  });

  it("renders a calm empty state when no source exposes approval signals", () => {
    render(
      <ApprovalInboxWorkspace
        deals={[{ ...offerDeal, offer_ready: false, next_action: "Call seller" }]}
      />
    );

    expect(screen.getByText("No approvals waiting")).toBeInTheDocument();
    expect(screen.getByText(/No approval signals are represented/)).toBeInTheDocument();
  });

  it("defers an item only in session using a future interval", () => {
    render(<ApprovalInboxWorkspace deals={[offerDeal]} />);

    fireEvent.click(screen.getByRole("button", { name: "Defer" }));
    expect(screen.getByRole("heading", { name: "Defer approval review" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Review again"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Defer item" }));

    expect(screen.getByText(/deferred in this session until 2026-08-03/i)).toBeInTheDocument();
    expect(screen.getByText("Status: Deferred")).toBeInTheDocument();
  });

  it("opens related deals in the Deal Decision Room route", () => {
    const navigateToDeal = vi.fn();
    render(<ApprovalInboxWorkspace deals={[offerDeal]} navigateToDeal={navigateToDeal} />);

    fireEvent.click(screen.getByRole("button", { name: "Review in context" }));

    expect(navigateToDeal).toHaveBeenCalledWith("deal-1");
  });

  it("opens accessible approval details with evidence and provenance", () => {
    render(<ApprovalInboxWorkspace deals={[offerDeal]} />);

    fireEvent.click(screen.getByRole("button", { name: /Offer ready for review/ }));

    expect(screen.getByRole("dialog", { name: /Offer ready for review/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Evidence and provenance" })).toBeInTheDocument();
    expect(screen.getByText(/No paid provider is required/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close drawer" })).toHaveFocus();
  });

  it("confirms a real injected command and prevents duplicate submission", async () => {
    let resolveCommand;
    const approve = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveCommand = resolve;
        })
    );
    const approvalCommands = {
      "approval:notification:deal-1-offer-review": { approve },
    };
    render(
      <ApprovalInboxWorkspace
        approvalCommands={approvalCommands}
        deals={[offerDeal]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByRole("dialog", { name: "Approve approval" })).toHaveTextContent(
      "123 Main Street"
    );

    const confirm = screen.getByRole("button", { name: "Approve action" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(approve).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCommand({ success: true, approvalPersisted: false });
    });

    expect(screen.getByText(/Offer ready for review: 123 Main Street approved/)).toBeInTheDocument();
    expect(screen.getByText("Status: Approved")).toBeInTheDocument();
  });

  it("never claims success when an injected command does not confirm execution", async () => {
    const approve = vi.fn().mockResolvedValue({ success: false });
    render(
      <ApprovalInboxWorkspace
        approvalCommands={{
          "approval:notification:deal-1-offer-review": { approve },
        }}
        deals={[offerDeal]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Approve action" }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Nothing was marked approved");
    expect(screen.getByText("Status: Pending")).toBeInTheDocument();
    expect(screen.queryByText(/approved\.$/i)).not.toBeInTheDocument();
  });

  it("runs refresh with safe recovery", async () => {
    const refresh = vi.fn().mockResolvedValue();
    render(<ApprovalInboxWorkspace refresh={refresh} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Approval sources refreshed.")).toBeInTheDocument();
  });

  it("uses token-driven dark mode and responsive-safe list structure", () => {
    document.documentElement.dataset.theme = "dark";
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });

    render(<ApprovalInboxWorkspace deals={[offerDeal]} />);

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByLabelText("Approval review list")).toBeInTheDocument();
    expect(screen.getByRole("article")).toHaveClass("approval-item");
  });

  it("does not render beyond the bounded read-model limit", () => {
    const drafts = Array.from({ length: 80 }, (_, index) => ({
      id: `draft-${index}`,
      channel: "template",
      body: `Draft ${index}`,
    }));

    render(<ApprovalInboxWorkspace messageDrafts={drafts} />);

    expect(screen.getAllByRole("article")).toHaveLength(50);
  });
});
