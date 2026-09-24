import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DecisionMemoryPanel from "../DecisionMemoryPanel";

const mockUseDecisionMemory = vi.hoisted(() => vi.fn());
vi.mock("../../../hooks/useDecisionMemory", () => ({ default: mockUseDecisionMemory }));

const first = {
  id: "snapshot-1",
  snapshot_number: 1,
  decision_contract_version: "decision-contract-v1",
  canonical_input_fingerprint: "fingerprint-1",
  recommendation_result: { label: "Verify seller timeline", explanation: "More information is required." },
  recommendation_basis: { basisType: "missing-information" },
  evaluated_at: "2026-09-24T12:00:00.000Z",
};
const current = {
  ...first,
  id: "snapshot-2",
  snapshot_number: 2,
  canonical_input_fingerprint: "fingerprint-2",
  recommendation_result: { label: "Prepare offer", explanation: "Inputs are ready for owner review." },
  recommendation_basis: { basisType: "offer-readiness" },
  evaluated_at: "2026-09-24T13:00:00.000Z",
};

describe("DecisionMemoryPanel", () => {
  const recordDecision = vi.fn();

  beforeEach(() => {
    recordDecision.mockReset().mockResolvedValue({ success: true });
    mockUseDecisionMemory.mockReturnValue({
      currentEntry: { snapshot: current, decisions: [], outcomes: [] },
      error: "",
      history: {
        limitation: "Later lifecycle records are chronologically linked references, not evidence of causation.",
        entries: [
          { snapshot: first, decisions: [], outcomes: [] },
          {
            snapshot: current,
            decisions: [{
              id: "decision-1", override_flag: true,
              alternative_result: { label: "Review title first" }, reason: "Lien review",
              actor_reference: "owner-1", decided_at: "2026-09-24T13:05:00.000Z",
            }],
            outcomes: [{
              id: "closing-revision:closing-2", type: "closing-revision", sourceRecord: {
                id: "closing-2", revision_number: 2, status: "closed",
                accepted_offer_revision_id: "offer-4", actual_realized_proceeds: 14500, actual_costs: 500,
              },
            }],
          },
        ],
      },
      loading: false,
      recordDecision,
    });
  });

  it("shows bounded recommendation-to-decision-to-outcome history without causal claims", () => {
    render(<DecisionMemoryPanel deal={{ id: "deal-1" }} readModel={{}} />);
    const history = screen.getByRole("list", { name: "Decision Memory history" });
    expect(history).toHaveTextContent("Recommendation 1");
    expect(history).toHaveTextContent("Recommendation 2");
    expect(history).toHaveTextContent("Owner override");
    expect(history).toHaveTextContent("Review title first");
    expect(history).toHaveTextContent("Closing revision 2: Closed");
    expect(history).toHaveTextContent("$14,500 realized, $500 costs");
    expect(screen.getByText(/not evidence of causation/i)).toBeInTheDocument();
  });

  it("records an explicit owner alternative and required reason", async () => {
    mockUseDecisionMemory.mockReturnValue({
      ...mockUseDecisionMemory(),
      currentEntry: { snapshot: current, decisions: [], outcomes: [] },
      history: { limitation: "No causal claim.", entries: [{ snapshot: current, decisions: [], outcomes: [] }] },
    });
    render(<DecisionMemoryPanel deal={{ id: "deal-1" }} readModel={{}} />);
    fireEvent.change(screen.getByLabelText("Owner decision"), { target: { value: "alternative" } });
    fireEvent.change(screen.getByLabelText("Explicit alternative"), { target: { value: "Review title first" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Decision reason/ }), { target: { value: "An unreleased lien needs review." } });
    fireEvent.click(screen.getByRole("button", { name: "Record owner decision" }));
    await waitFor(() => expect(recordDecision).toHaveBeenCalledWith({
      alternative: { label: "Review title first" },
      decisionType: "alternative",
      reason: "An unreleased lien needs review.",
    }));
  });
});
