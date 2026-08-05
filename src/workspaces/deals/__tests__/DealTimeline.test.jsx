import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  TIMELINE_CATEGORIES,
  TIMELINE_RELIABILITY_LABELS,
  TIMELINE_SORT_DIRECTIONS,
  buildTimelineReadModel,
  normalizeTimelineEvent,
} from "../../../services/timeline";
import DealTimeline from "../DealTimeline";

const deal = {
  id: "deal-1",
  owner_name: "Sam Seller",
  phone: "5551112222",
  property_address: "123 Main Street",
};

function event(overrides = {}) {
  return normalizeTimelineEvent({
    id: overrides.id || "event-1",
    dealId: "deal-1",
    category: TIMELINE_CATEGORIES.COMMUNICATION,
    type: "record",
    timestamp: overrides.timestamp || new Date().toISOString(),
    title: overrides.title || "Seller replied",
    summary: "Persisted timeline summary.",
    sourceSystem: "Test record",
    sourceRecordId: overrides.id || "event-1",
    reliability: TIMELINE_RELIABILITY_LABELS.PERSISTED,
    deduplicationKey: overrides.id || "event-1",
    ...overrides,
  });
}

function model(events = [], sourceOverrides = {}) {
  return buildTimelineReadModel({
    sourceResults: [
      {
        sourceId: "test",
        label: "Test source",
        status: "complete",
        events,
        warnings: [],
        ...sourceOverrides,
      },
    ],
  });
}

function renderTimeline(readModel, overrides = {}) {
  const loadTimeline = overrides.loadTimeline || vi.fn().mockResolvedValue({
    success: true,
    data: readModel,
  });
  const onOpenContext = overrides.onOpenContext || vi.fn();
  const rendered = render(
    <DealTimeline
      deal={deal}
      loadTimeline={loadTimeline}
      onOpenContext={onOpenContext}
    />
  );
  return { ...rendered, loadTimeline, onOpenContext };
}

describe("DealTimeline", () => {
  it("renders an understandable loading state", () => {
    const loadTimeline = vi.fn(() => new Promise(() => {}));
    const { unmount } = renderTimeline(null, { loadTimeline });

    expect(screen.getByRole("status")).toHaveTextContent("Loading timeline history");
    expect(screen.getByText("Loading timeline history...")).toBeInTheDocument();
    unmount();
  });

  it("renders semantic date groups, source labels, and backed category filters", async () => {
    const communication = event({
      id: "message-1",
      title: "Inbound SMS message",
      direction: "inbound",
      status: "received",
    });
    const document = event({
      id: "document-1",
      category: TIMELINE_CATEGORIES.DOCUMENTS,
      title: "Document added: Purchase agreement",
      sourceSystem: "Document record",
    });
    renderTimeline(model([communication, document]));

    expect(await screen.findByRole("heading", { name: "Timeline" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Today timeline events" })).toBeInTheDocument();
    expect(screen.getByText("Source: Test record")).toBeInTheDocument();
    expect(screen.getAllByText("Reliability: Persisted Record")).toHaveLength(2);
    expect(screen.getByText("Direction: inbound")).toBeInTheDocument();
    expect(screen.getByText("Status: received")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Communication (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Documents (1)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Offers/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Communication (1)" }));
    expect(screen.getByRole("heading", { name: "Inbound SMS message" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Document added: Purchase agreement" })
    ).not.toBeInTheDocument();
  });

  it("shows partial source failures without hiding successful events", async () => {
    renderTimeline(
      model([event()], {
        status: "partial",
        warnings: ["Document history could not be loaded."],
      })
    );

    expect(await screen.findByText("Partial source results")).toBeInTheDocument();
    expect(screen.getByText("Review source warnings")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Review source warnings"));
    expect(screen.getByText("Document history could not be loaded.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Seller replied" })).toBeInTheDocument();
  });

  it("renders a full error and retries safely", async () => {
    const loadTimeline = vi
      .fn()
      .mockResolvedValueOnce({
        success: false,
        error: { message: "Timeline history could not be loaded." },
      })
      .mockResolvedValueOnce({ success: true, data: model([event()]) });
    renderTimeline(null, { loadTimeline });

    expect(await screen.findByRole("heading", { name: "Timeline unavailable" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Seller replied" })).toBeInTheDocument();
    expect(loadTimeline).toHaveBeenLastCalledWith({ deal, force: true });
  });

  it("renders a calm empty state without fabricated events", async () => {
    renderTimeline(model([]));

    expect(await screen.findByRole("heading", { name: "No history yet" })).toBeInTheDocument();
    expect(screen.getByText("0 events")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("bounds the initial UI batch and reveals more records safely", async () => {
    const events = Array.from({ length: 45 }, (_, index) =>
      event({
        id: `event-${index}`,
        title: `Timeline event ${index}`,
        timestamp: new Date(Date.now() - index * 1000).toISOString(),
      })
    );
    renderTimeline(model(events));

    await screen.findByRole("heading", { name: "Timeline event 0" });
    expect(screen.getAllByRole("article")).toHaveLength(40);
    expect(screen.getByText("Showing 40 of 45")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show More" }));
    expect(screen.getAllByRole("article")).toHaveLength(45);
  });

  it("refreshes in place and preserves a supported category selection", async () => {
    const firstModel = model([
      event({ id: "message-1" }),
      event({
        id: "document-1",
        category: TIMELINE_CATEGORIES.DOCUMENTS,
        title: "Document one",
      }),
    ]);
    const secondModel = model([
      event({ id: "message-2", title: "New seller reply" }),
      event({
        id: "document-2",
        category: TIMELINE_CATEGORIES.DOCUMENTS,
        title: "Document two",
      }),
    ]);
    const loadTimeline = vi
      .fn()
      .mockResolvedValueOnce({ success: true, data: firstModel })
      .mockResolvedValueOnce({ success: true, data: secondModel });
    renderTimeline(null, { loadTimeline });

    fireEvent.click(await screen.findByRole("button", { name: "Documents (1)" }));
    expect(screen.getByRole("heading", { name: "Document one" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh deal timeline" }));
    expect(await screen.findByRole("heading", { name: "Document two" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "New seller reply" })).not.toBeInTheDocument();
    expect(loadTimeline).toHaveBeenLastCalledWith({ deal, force: true });
  });

  it("switches sort order without losing undated events", async () => {
    const older = event({
      id: "older",
      title: "Older event",
      timestamp: "2026-08-01T10:00:00.000Z",
    });
    const newer = event({
      id: "newer",
      title: "Newer event",
      timestamp: "2026-08-05T10:00:00.000Z",
    });
    const undated = event({ id: "undated", title: "Undated event", timestamp: null });
    renderTimeline(model([older, newer, undated]));

    await screen.findByRole("heading", { name: "Newer event" });
    fireEvent.change(screen.getByLabelText("Timeline sort order"), {
      target: { value: TIMELINE_SORT_DIRECTIONS.OLDEST },
    });
    const headings = screen.getAllByRole("heading", { level: 4 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Older event",
      "Newer event",
      "Undated event",
    ]);
  });

  it("exposes only navigation actions and supports keyboard-operable source disclosure", async () => {
    const onOpenContext = vi.fn();
    const navigationEvent = event({
      id: "document-1",
      category: TIMELINE_CATEGORIES.DOCUMENTS,
      title: "Document added",
      targetSection: "documents",
      availableActions: [{ id: "open-context", targetSection: "documents" }],
      evidence: [{ label: "Document type", value: "Purchase Agreement" }],
    });
    renderTimeline(model([navigationEvent]), { onOpenContext });

    const sourceDetails = await screen.findByText("Source details");
    sourceDetails.focus();
    expect(sourceDetails).toHaveFocus();
    fireEvent.click(sourceDetails);
    expect(screen.getByText("Purchase Agreement")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open Context" }));
    expect(onOpenContext).toHaveBeenCalledWith(navigationEvent);
    expect(screen.queryByRole("button", { name: /Complete|Send|Approve|Delete|Stage/i })).not.toBeInTheDocument();
  });

  it("renders the same accessible timeline contract in dark-mode context", async () => {
    const loadTimeline = vi.fn().mockResolvedValue({
      success: true,
      data: model([event()]),
    });
    render(
      <div data-theme="dark">
        <DealTimeline deal={deal} loadTimeline={loadTimeline} onOpenContext={vi.fn()} />
      </div>
    );

    const timelineHeading = await screen.findByRole("heading", { name: "Timeline" });
    expect(timelineHeading.closest("[data-theme='dark']")).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Today timeline events" });
    expect(within(list).getByRole("article")).toBeInTheDocument();
  });
});
