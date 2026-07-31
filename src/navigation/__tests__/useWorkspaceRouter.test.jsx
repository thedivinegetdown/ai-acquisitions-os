import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useWorkspaceRouter } from "../useWorkspaceRouter";

function RouterHarness() {
  const router = useWorkspaceRouter();
  return (
    <div>
      <div data-testid="workspace-id">{router.currentWorkspaceId}</div>
      <div data-testid="unknown">{String(router.isUnknownRoute)}</div>
      <button onClick={() => router.navigateToWorkspace("pipeline")} type="button">
        Pipeline
      </button>
      <button onClick={() => router.navigateToWorkspace("inbox")} type="button">
        Inbox
      </button>
      <button onClick={() => router.navigateToDeal("deal-123")} type="button">
        Deal
      </button>
    </div>
  );
}

function setPath(path) {
  window.history.pushState({}, "", path);
}

afterEach(() => {
  setPath("/");
});

describe("useWorkspaceRouter", () => {
  it("uses Today for the root route and changes browser history", () => {
    setPath("/");
    render(<RouterHarness />);

    expect(screen.getByTestId("workspace-id")).toHaveTextContent("today");

    fireEvent.click(screen.getByRole("button", { name: "Pipeline" }));

    expect(screen.getByTestId("workspace-id")).toHaveTextContent("pipeline");
    expect(window.location.pathname).toBe("/pipeline");
  });

  it("supports browser back and forward navigation", async () => {
    setPath("/today");
    render(<RouterHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Pipeline" }));
    fireEvent.click(screen.getByRole("button", { name: "Inbox" }));
    expect(screen.getByTestId("workspace-id")).toHaveTextContent("inbox");

    await act(async () => {
      window.history.back();
    });
    await waitFor(() => expect(screen.getByTestId("workspace-id")).toHaveTextContent("pipeline"));

    await act(async () => {
      window.history.forward();
    });
    await waitFor(() => expect(screen.getByTestId("workspace-id")).toHaveTextContent("inbox"));
  });

  it("navigates directly to a Deal Decision Room route", () => {
    setPath("/today");
    render(<RouterHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Deal" }));

    expect(screen.getByTestId("workspace-id")).toHaveTextContent("deal-decision-room");
    expect(window.location.pathname).toBe("/deals/deal-123");
  });

  it("reports unknown routes without redirecting", () => {
    setPath("/not-a-workspace");
    render(<RouterHarness />);

    expect(screen.getByTestId("workspace-id")).toHaveTextContent("unknown");
    expect(screen.getByTestId("unknown")).toHaveTextContent("true");
  });
});
