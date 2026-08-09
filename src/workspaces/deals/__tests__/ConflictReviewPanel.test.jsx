import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConflictReviewPanel from "../ConflictReviewPanel";

function candidate(overrides = {}) {
  return {
    candidateId: "candidate:verified",
    rawValueSummary: "$180,000",
    normalizedComparableValue: 180000,
    sourceField: "arv",
    sourceSystem: "crm",
    sourceType: "deal-record",
    verificationState: "verified",
    freshnessState: "current",
    sourceTimestamp: "2026-08-01T12:00:00.000Z",
    evidenceId: "evidence:arv",
    compatibilityEvidence: false,
    ...overrides,
  };
}

function conflict(overrides = {}) {
  return {
    conflictId: "conflict:deal:deal-1:field:property.afterRepairValue",
    label: "After-repair value",
    canonicalField: "property.afterRepairValue",
    description: "Explicit after-repair values disagree.",
    state: "review-required",
    criticality: "blocking",
    candidateValues: [
      candidate(),
      candidate({
        candidateId: "candidate:compatibility",
        rawValueSummary: "$195,000",
        normalizedComparableValue: 195000,
        sourceField: "after_repair_value",
        evidenceId: "evidence:compatibility",
        verificationState: "unknown",
        compatibilityEvidence: true,
      }),
    ],
    distinctNormalizedValues: [180000, 195000],
    evidenceIds: ["evidence:arv", "evidence:compatibility"],
    relatedSection: "numbers",
    explicitResolutionReference: null,
    ...overrides,
  };
}

function readModel(overrides = {}) {
  const active = conflict();
  return {
    assetType: "residential-home",
    activeConflicts: [active],
    resolvedConflicts: [],
    highestPriorityConflict: active,
    evaluatedTimestamp: "2026-08-09T12:00:00.000Z",
    counts: { open: 1, blocking: 1, advisory: 0, resolvedExisting: 0 },
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("ConflictReviewPanel", () => {
  it("does not render an empty conflict surface", () => {
    const { container } = render(
      <ConflictReviewPanel readModel={{ activeConflicts: [], resolvedConflicts: [] }} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders prioritized candidates and provenance without selecting a winner", () => {
    render(<ConflictReviewPanel readModel={readModel()} />);

    expect(screen.getByRole("heading", { name: "Conflicting Data" })).toBeInTheDocument();
    expect(screen.getByText("1 open / 1 blocking / 0 advisory")).toBeInTheDocument();
    expect(screen.getByText("After-repair value", { selector: "p" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Compare candidate values and Evidence"));
    expect(screen.getByText(/does not select the correct value/i)).toBeInTheDocument();
    expect(screen.getByText("$180,000").closest("li")).toHaveTextContent("Verified");
    expect(screen.getByText("$195,000").closest("li")).toHaveTextContent("compatibility Evidence");
    expect(screen.queryByText(/winner|authoritative|recommended value/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resolve|choose this value|update crm|approve/i })).not.toBeInTheDocument();
  });

  it("supports safe navigation and accessible clipboard failure status", async () => {
    const onNavigateSection = vi.fn();
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    render(
      <ConflictReviewPanel
        onNavigateSection={onNavigateSection}
        readModel={readModel()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open Numbers" }));
    expect(onNavigateSection).toHaveBeenCalledWith("numbers");
    fireEvent.click(screen.getByRole("button", { name: "Copy Evidence Reference" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Unable to copy"));
  });

  it("renders only explicitly supplied resolution details", () => {
    const resolved = conflict({
      state: "resolved",
      explicitResolutionReference: {
        selectedCandidateId: "candidate:verified",
        reason: "Reviewed against the signed appraisal.",
        actorReference: "user-1",
        approvalReference: "approval-1",
        decidedTimestamp: "2026-08-08T16:00:00.000Z",
      },
    });
    render(
      <ConflictReviewPanel
        readModel={readModel({
          activeConflicts: [],
          resolvedConflicts: [resolved],
          highestPriorityConflict: null,
          counts: { open: 0, blocking: 0, advisory: 0, resolvedExisting: 1 },
        })}
      />
    );

    expect(screen.getAllByText("Resolved").length).toBeGreaterThan(0);
    expect(screen.getByText("Reviewed against the signed appraisal.")).toBeInTheDocument();
    expect(screen.getByText("user-1")).toBeInTheDocument();
    expect(screen.getByText("approval-1")).toBeInTheDocument();
  });

  it("uses land context labels without residential content", () => {
    const landConflict = conflict({
      conflictId: "conflict:deal:deal-1:field:property.legalAccess",
      label: "Legal access",
      canonicalField: "property.legalAccess",
      description: "Explicit legal-access values disagree.",
      relatedSection: "property",
      candidateValues: [
        candidate({ candidateId: "candidate:access-yes", rawValueSummary: "Documented", normalizedComparableValue: "documented", sourceField: "legal_access" }),
        candidate({ candidateId: "candidate:access-no", rawValueSummary: "No access", normalizedComparableValue: "none", sourceField: "access_status" }),
      ],
      distinctNormalizedValues: ["documented", "none"],
    });
    render(
      <ConflictReviewPanel
        readModel={readModel({
          assetType: "vacant-residential-land",
          activeConflicts: [landConflict],
          highestPriorityConflict: landConflict,
        })}
      />
    );

    expect(screen.getByRole("button", { name: "Open Parcel" })).toBeInTheDocument();
    expect(screen.queryByText(/after-repair value|repair estimate|rent estimate|house mao/i)).not.toBeInTheDocument();
  });
});
