import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const conversationMocks = vi.hoisted(() => ({
  loadInboxThread: vi.fn(),
  subscribeToMessageInserts: vi.fn(),
}));
const smsMocks = vi.hoisted(() => ({
  sendOutboundSms: vi.fn(),
}));

vi.mock("../../../services/conversations", async (importOriginal) => ({
  ...(await importOriginal()),
  loadInboxThread: conversationMocks.loadInboxThread,
  subscribeToMessageInserts: conversationMocks.subscribeToMessageInserts,
}));

vi.mock("../../../services/sms", () => ({
  sendOutboundSms: smsMocks.sendOutboundSms,
}));

import {
  buildInboxReadModel,
  normalizeInboxThreadMessage,
} from "../../../services/conversations/inboxService";
import InboxWorkspace from "../InboxWorkspace";

const NOW = new Date("2026-08-04T12:00:00.000Z").getTime();
let realtimeMessageCallback;
let realtimeStatusCallback;

function summary(overrides = {}) {
  return {
    id: "message-1",
    phone: "+15555550100",
    message: "Can you call me this afternoon?",
    direction: "inbound",
    created_at: "2026-08-04T11:00:00.000Z",
    status: "received",
    statusWasExplicit: true,
    ...overrides,
  };
}

const deals = [
  {
    id: "deal-1",
    phone: "+1 (555) 555-0100",
    owner_name: "Alex Seller",
    property_address: "123 Main Street",
    stage: "Contacted",
  },
];

function readModel(overrides = {}) {
  return buildInboxReadModel({
    conversationSummaries: [
      summary(),
      summary({
        id: "failed-message",
        phone: "+15555550200",
        message: "Follow-up attempt",
        direction: "outbound",
        status: "failed",
      }),
    ],
    deals,
    now: NOW,
    ...overrides,
  });
}

function normalizedMessage(overrides = {}) {
  return normalizeInboxThreadMessage(
    summary({
      conversation_id: "conversation-1",
      ...overrides,
    }),
    { compatibilityKey: "phone:5555550100", dealId: "deal-1" }
  );
}

function latestThreadResult(overrides = {}) {
  return {
    success: true,
    data: {
      messages: [
        normalizedMessage({
          id: "thread-old",
          message: "First message",
          created_at: "2026-08-04T10:00:00.000Z",
        }),
        normalizedMessage({
          id: "thread-new",
          message: "Latest seller reply",
          created_at: "2026-08-04T11:00:00.000Z",
        }),
      ],
      hasEarlier: false,
      nextOffset: 2,
      sourceWarnings: [],
      ...overrides,
    },
  };
}

function renderInbox(overrides = {}) {
  return render(
    <InboxWorkspace
      conversationReadModel={readModel()}
      navigateToDeal={vi.fn()}
      refreshConversations={vi.fn().mockResolvedValue({ success: true })}
      selectedPhone="+15555550100"
      setSelectedPhone={vi.fn()}
      {...overrides}
    />
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  realtimeMessageCallback = null;
  realtimeStatusCallback = null;
  conversationMocks.loadInboxThread.mockReset();
  conversationMocks.loadInboxThread.mockResolvedValue(latestThreadResult());
  conversationMocks.subscribeToMessageInserts.mockReset();
  conversationMocks.subscribeToMessageInserts.mockImplementation((onMessage, onStatus) => {
    realtimeMessageCallback = onMessage;
    realtimeStatusCallback = onStatus;
    onStatus?.("SUBSCRIBED");
    return vi.fn();
  });
  smsMocks.sendOutboundSms.mockReset();
  smsMocks.sendOutboundSms.mockResolvedValue({
    success: true,
    data: { mode: "live", status: "queued" },
  });
});

afterEach(() => {
  delete document.documentElement.dataset.theme;
});

describe("InboxWorkspace states and navigation", () => {
  it("renders loading, full error, empty, and partial-result states distinctly", async () => {
    const loading = render(
      <InboxWorkspace conversationLoading conversationReadModel={null} />
    );
    expect(screen.getByLabelText("Loading Inbox")).toBeInTheDocument();
    loading.unmount();

    const failed = render(
      <InboxWorkspace
        conversationLoadError="Inbox conversations could not be loaded."
        conversationReadModel={null}
      />
    );
    expect(screen.getByText("Inbox unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/Supabase/i)).not.toBeInTheDocument();
    failed.unmount();

    const empty = render(
      <InboxWorkspace conversationReadModel={buildInboxReadModel({ now: NOW })} />
    );
    expect(screen.getByText("No conversations yet")).toBeInTheDocument();
    empty.unmount();

    renderInbox({ conversationLoadError: "Inbox summaries are temporarily incomplete." });
    expect(screen.getByText("Some Inbox data is incomplete.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Alex Seller" })).toBeInTheDocument();
  });

  it("renders a focused split view without legacy workspace tools or fabricated unread state", async () => {
    renderInbox();

    expect(screen.getByTestId("inbox-split-view")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Inbox" })).toBeInTheDocument();
    expect(screen.getAllByText("Needs Reply").length).toBeGreaterThan(0);
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.queryByText(/Unread/)).not.toBeInTheDocument();
    expect(screen.queryByText(/AI dashboard|underwriting|buyer matches|workflow dashboard/i)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Latest seller reply")).toBeInTheDocument());
  });

  it("searches and filters the bounded conversation list with keyboard-reachable rows", () => {
    renderInbox({ selectedPhone: null });
    const search = screen.getByRole("searchbox", { name: "Search conversations" });

    fireEvent.change(search, { target: { value: "Main" } });
    expect(screen.getByText("Alex Seller")).toBeInTheDocument();
    expect(screen.queryByText("Follow-up attempt")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Failed \(1\)/ }));
    expect(screen.getByText("Follow-up attempt")).toBeInTheDocument();
    expect(screen.queryByText("Alex Seller")).not.toBeInTheDocument();

    const row = screen.getByRole("button", { name: /Open conversation/ });
    row.focus();
    expect(row).toHaveFocus();
  });

  it("opens the intended Today-selected phone and preserves it through a safe refresh", async () => {
    const model = readModel();
    const { rerender } = renderInbox({ conversationReadModel: model });

    expect(screen.getByRole("heading", { name: "Alex Seller" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open conversation with Alex Seller/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    rerender(
      <InboxWorkspace
        conversationReadModel={{ ...model, generatedAt: "2026-08-04T12:05:00.000Z" }}
        navigateToDeal={vi.fn()}
        refreshConversations={vi.fn().mockResolvedValue({ success: true })}
        selectedPhone="+1 (555) 555-0100"
        setSelectedPhone={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByRole("heading", { name: "Alex Seller" })).toBeInTheDocument());
  });

  it("uses mobile list-to-thread behavior with a clear back action", async () => {
    const setSelectedPhone = vi.fn();
    const { container } = renderInbox({ selectedPhone: null, setSelectedPhone });
    const workspace = container.querySelector(".inbox-workspace");

    expect(workspace).not.toHaveClass("inbox-workspace--thread-open");
    fireEvent.click(screen.getByRole("button", { name: /Open conversation with Alex Seller/ }));
    expect(workspace).toHaveClass("inbox-workspace--thread-open");
    expect(setSelectedPhone).toHaveBeenCalledWith("+15555550100");

    await waitFor(() => expect(screen.getByRole("button", { name: "Back to conversations" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Back to conversations" }));
    expect(workspace).not.toHaveClass("inbox-workspace--thread-open");
  });

  it("opens linked conversations in the Deal Decision Room", async () => {
    const navigateToDeal = vi.fn();
    renderInbox({ navigateToDeal });

    await waitFor(() => expect(screen.getByRole("button", { name: "Open Deal" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Open Deal" }));
    expect(navigateToDeal).toHaveBeenCalledWith("deal-1");
  });
});

describe("InboxWorkspace thread, composer, and Realtime behavior", () => {
  it("renders thread messages chronologically with accessible direction and status", async () => {
    renderInbox();

    const timeline = await screen.findByRole("list", { name: "Message history" });
    const messages = within(timeline).getAllByRole("article");
    expect(messages[0]).toHaveTextContent("First message");
    expect(messages[1]).toHaveTextContent("Latest seller reply");
    expect(messages[0]).toHaveAccessibleName(/Inbound message/);
    expect(messages[0]).toHaveTextContent("Status: Received");
  });

  it("loads earlier messages through the bounded paging contract", async () => {
    conversationMocks.loadInboxThread
      .mockResolvedValueOnce(latestThreadResult({ hasEarlier: true }))
      .mockResolvedValueOnce({
        success: true,
        data: {
          messages: [
            normalizedMessage({
              id: "earliest",
              message: "Earlier history",
              created_at: "2026-08-04T09:00:00.000Z",
            }),
          ],
          hasEarlier: false,
          nextOffset: 3,
          sourceWarnings: [],
        },
      });
    renderInbox();

    const loadEarlier = await screen.findByRole("button", { name: "Load Earlier" });
    fireEvent.click(loadEarlier);

    await waitFor(() => expect(screen.getByText("Earlier history")).toBeInTheDocument());
    expect(conversationMocks.loadInboxThread).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 2 })
    );
  });

  it("preserves a session draft when the workspace remounts", async () => {
    const first = renderInbox();
    const composer = await screen.findByLabelText("Message");
    fireEvent.change(composer, { target: { value: "Session draft" } });
    first.unmount();

    renderInbox();
    expect(await screen.findByLabelText("Message")).toHaveValue("Session draft");
  });

  it("validates drafts, keeps ordinary Enter as a newline, and sends with Ctrl+Enter", async () => {
    renderInbox();
    const composer = await screen.findByLabelText("Message");

    fireEvent.click(screen.getByRole("button", { name: "Send SMS" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a message");
    expect(smsMocks.sendOutboundSms).not.toHaveBeenCalled();

    fireEvent.change(composer, { target: { value: "Seller response" } });
    fireEvent.keyDown(composer, { key: "Enter" });
    expect(smsMocks.sendOutboundSms).not.toHaveBeenCalled();

    fireEvent.keyDown(composer, { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(smsMocks.sendOutboundSms).toHaveBeenCalledTimes(1));
    expect(smsMocks.sendOutboundSms).toHaveBeenCalledWith({
      to: "+15555550100",
      message: "Seller response",
      dealId: "deal-1",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Delivery has not been confirmed"
    );
  });

  it("rejects an invalid recipient without exposing call or copy actions", async () => {
    const invalidPhoneModel = readModel({
      conversationSummaries: [summary({ phone: "123" })],
      deals: [],
    });
    renderInbox({
      conversationReadModel: invalidPhoneModel,
      selectedPhone: "123",
    });
    const composer = await screen.findByLabelText("Message");
    fireEvent.change(composer, { target: { value: "Do not send" } });
    fireEvent.click(screen.getByRole("button", { name: "Send SMS" }));

    expect(screen.getByRole("alert")).toHaveTextContent("valid recipient phone number");
    expect(screen.queryByRole("link", { name: "Call" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy Phone" })).not.toBeInTheDocument();
    expect(smsMocks.sendOutboundSms).not.toHaveBeenCalled();
  });

  it("prevents duplicate submissions while a send is pending", async () => {
    let resolveSend;
    smsMocks.sendOutboundSms.mockReturnValue(
      new Promise((resolve) => {
        resolveSend = resolve;
      })
    );
    renderInbox();
    const composer = await screen.findByLabelText("Message");
    fireEvent.change(composer, { target: { value: "One send only" } });

    fireEvent.keyDown(composer, { key: "Enter", ctrlKey: true });
    fireEvent.keyDown(composer, { key: "Enter", metaKey: true });
    expect(smsMocks.sendOutboundSms).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSend({ success: true, data: { mode: "live", status: "queued" } });
    });
  });

  it("shows test mode truthfully and never performs a client-side duplicate log insert", async () => {
    smsMocks.sendOutboundSms.mockResolvedValue({
      success: true,
      data: { mode: "test", status: "test" },
    });
    renderInbox();
    const composer = await screen.findByLabelText("Message");
    fireEvent.change(composer, { target: { value: "Test message" } });
    fireEvent.click(screen.getByRole("button", { name: "Send SMS" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Message saved in test mode. No live SMS was sent."
    );
    expect(smsMocks.sendOutboundSms).toHaveBeenCalledTimes(1);
    expect(conversationMocks.loadInboxThread).toHaveBeenCalledWith(
      expect.objectContaining({ force: true })
    );
  });

  it("preserves an unlinked draft when test mode cannot persist conversation history", async () => {
    smsMocks.sendOutboundSms.mockResolvedValue({
      success: true,
      data: { mode: "test", status: "test" },
    });
    renderInbox({ selectedPhone: "+15555550200" });
    const composer = await screen.findByLabelText("Message");
    fireEvent.change(composer, { target: { value: "Unlinked test draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Send SMS" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "no linked deal was available for persisted history"
    );
    expect(composer).toHaveValue("Unlinked test draft");
    expect(conversationMocks.loadInboxThread).toHaveBeenCalledTimes(1);
  });

  it("preserves the draft and appends no fake message after provider or send failure", async () => {
    smsMocks.sendOutboundSms.mockResolvedValue({
      success: false,
      error: { message: "Provider unavailable" },
      metadata: { status: 503 },
    });
    renderInbox();
    const composer = await screen.findByLabelText("Message");
    fireEvent.change(composer, { target: { value: "Keep this draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Send SMS" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("delivery is unavailable");
    expect(composer).toHaveValue("Keep this draft");
    expect(screen.queryByText("Keep this draft", { selector: ".inbox-message p" })).not.toBeInTheDocument();
    expect(conversationMocks.loadInboxThread).toHaveBeenCalledTimes(1);
  });

  it("deduplicates Realtime messages and exposes a non-blocking subscription failure", async () => {
    renderInbox();
    const timeline = await screen.findByRole("list", { name: "Message history" });
    expect(within(timeline).getAllByRole("article")).toHaveLength(2);

    await act(async () => {
      realtimeMessageCallback?.(
        summary({
          id: "thread-new",
          message: "Latest seller reply",
          created_at: "2026-08-04T11:00:00.000Z",
        })
      );
    });
    await waitFor(() => expect(within(timeline).getAllByRole("article")).toHaveLength(2));

    await act(async () => {
      realtimeMessageCallback?.(
        summary({
          id: "realtime-new",
          message: "Realtime seller update",
          created_at: "2026-08-04T11:30:00.000Z",
        })
      );
    });
    await waitFor(() => expect(screen.getByText("Realtime seller update")).toBeInTheDocument());

    act(() => realtimeStatusCallback?.("CHANNEL_ERROR"));
    expect(screen.getByText(/Live updates are unavailable/)).toBeInTheDocument();
  });

  it("remains token-driven, dark-mode compatible, responsive, and provider-independent", async () => {
    document.documentElement.dataset.theme = "dark";
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    const { container } = renderInbox();

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(container.querySelector(".inbox-split-view")).toBeInTheDocument();
    expect(screen.queryByText(/upgrade|connect Twilio to continue/i)).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Message")).toBeEnabled();
  });
});
