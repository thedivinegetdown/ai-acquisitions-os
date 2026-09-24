import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildOwnerOperatingReport } from "../../../services/reporting";

vi.mock("../../../hooks/useOwnerOperatingReport", () => ({
  useOwnerOperatingReport: () => ({ error: "", loading: false, refresh: vi.fn(), report: null }),
}));

import ReportsWorkspace from "../ReportsWorkspace";

const ORG = "org-report";

function owned(record) {
  return {
    organization_id: ORG,
    created_at: "2026-09-20T12:00:00.000Z",
    ...record,
  };
}

describe("ReportsWorkspace", () => {
  it("renders canonical durable results and explicit unavailable states", () => {
    const report = buildOwnerOperatingReport({
      organizationId: ORG,
      evaluatedAt: "2026-09-23T16:00:00.000Z",
      sources: {
        deals: [owned({ id: "deal-1", stage: "Closed" })],
        sellerTasks: [owned({ id: "task-1", status: "open", due_at: "2026-09-22T12:00:00Z" })],
        sequenceSteps: [],
        offerRevisions: [owned({ id: "offer-1", deal_id: "deal-1", revision_number: 1, status: "accepted" })],
        closingRevisions: [owned({
          id: "closing-1",
          deal_id: "deal-1",
          revision_number: 1,
          status: "closed",
          actual_realized_proceeds: 50000,
          actual_costs: 12000,
        })],
        messages: [],
      },
    });

    render(<ReportsWorkspace report={report} />);

    expect(screen.getByRole("heading", { name: "Owner report" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Current workload" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Funnel and outcomes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Financial results" })).toBeInTheDocument();
    expect(screen.getByText("$38,000")).toBeInTheDocument();
    expect(screen.getByText("No durable qualification decision or qualification timestamp is persisted.")).toBeInTheDocument();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(screen.queryByText("Business Intelligence")).not.toBeInTheDocument();
    expect(screen.queryByText(/AI Business Insights/i)).not.toBeInTheDocument();
  });
});
