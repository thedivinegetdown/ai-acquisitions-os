import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FreshnessAndRevalidationPanel from "../FreshnessAndRevalidationPanel";

const fact = {
  canonicalField: "property.afterRepairValue",
  label: "After-repair value",
  state: "stale",
  revalidationState: "required",
  criticality: "blocking",
  policyId: "market-value-freshness-v1",
  evidenceIds: ["evidence-arv"],
  activeConflictIds: [],
  selectedSourceTimestamps: ["2025-10-01T12:00:00.000Z"],
  oldestRelevantSourceTimestamp: "2025-10-01T12:00:00.000Z",
  newestRelevantSourceTimestamp: "2025-10-01T12:00:00.000Z",
  policyTimestamps: { revalidationDueTimestamp: "2025-12-30T12:00:00.000Z", staleTimestamp: "2026-03-30T12:00:00.000Z", expirationTimestamp: "2026-06-28T12:00:00.000Z", policyDerived: true },
  limitationCodes: [],
  explanation: "This fact requires revalidation before it should be treated as current decision support.",
};

describe("FreshnessAndRevalidationPanel", () => {
  it("does not render when no material freshness review exists", () => {
    const { container } = render(<FreshnessAndRevalidationPanel readModel={{ counts: {}, factAssessments: [], currentFacts: [], revalidationDueFacts: [], staleFacts: [], expiredFacts: [], unknownFacts: [], warnings: [] }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows categorical states, policy-derived dates, and read-only navigation", () => {
    const navigate = vi.fn();
    render(<FreshnessAndRevalidationPanel onNavigateSection={navigate} readModel={{ counts: { current: 1, stale: 1, criticalRevalidationRequired: 1 }, factAssessments: [fact], currentFacts: [], revalidationDueFacts: [], staleFacts: [fact], expiredFacts: [], unknownFacts: [], warnings: [] }} recommendationSupport={{ state: "revalidation-required" }} />);
    expect(screen.getByRole("heading", { name: "Freshness & Revalidation" })).toBeInTheDocument();
    expect(screen.getByText("Part of the current recommendation basis depends on Evidence that requires revalidation.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Review fact freshness"));
    expect(screen.getByText("market-value-freshness-v1")).toBeInTheDocument();
    expect(screen.getAllByText(/Policy-derived/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Mark Current|Revalidate|Create Task/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Evidence" }));
    expect(navigate).toHaveBeenCalledWith("decision");
  });
});
