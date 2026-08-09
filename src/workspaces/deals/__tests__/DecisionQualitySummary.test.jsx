import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DecisionQualitySummary from "../DecisionQualitySummary";

const reliability = {
  grade: "limited",
  displayLabel: "Limited",
  assessmentBasis: "partial",
  explanation: "One critical fact has compatibility-only Evidence.",
  limitationCodes: ["compatibility-only"],
  basisGapRequirementIds: ["repairs"],
  conflictIds: ["conflict-arv"],
  criticalFactResults: [{
    canonicalField: "property.afterRepairValue",
    label: "After-repair value",
    state: "limited",
    evidenceIds: ["evidence-arv"],
    verificationState: "unknown",
    freshnessState: "unknown",
    activeConflictIds: ["conflict-arv"],
    limitationCodes: ["conflicting-evidence"],
  }],
  advisoryFactResults: [],
  operatorDisclaimer: "Data Reliability describes Evidence quality and does not guarantee correctness.",
};

const confidence = {
  level: "high",
  displayLabel: "High",
  explanation: "A deterministic conflict trigger supports review.",
  evidenceIds: ["evidence-arv"],
  missingInformationIds: ["missing-arv"],
  conflictIds: ["conflict-arv"],
  readinessGateIds: ["market-evidence"],
  positiveSupportingFactors: ["explicit-deterministic-trigger"],
  limitingFactors: ["limited-data-reliability"],
  operatorDisclaimer: "Recommendation Confidence is not a probability of deal success.",
};

describe("DecisionQualitySummary", () => {
  it("presents Reliability and Confidence separately without numeric precision", () => {
    render(
      <DecisionQualitySummary
        confidence={confidence}
        recommendation={{ label: "Review conflicting ARV values" }}
        recommendationBasis={{ basisType: "conflict-review" }}
        reliability={reliability}
      />
    );
    expect(screen.getByRole("heading", { name: "Data Reliability" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recommendation Confidence" })).toBeInTheDocument();
    expect(screen.getByText("Assessment basis")).toBeInTheDocument();
    expect(screen.getByText("Partial")).toBeInTheDocument();
    expect(screen.getByText("Confidence is not the probability that the deal succeeds.")).toBeInTheDocument();
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/combined quality score/i)).not.toBeInTheDocument();
  });

  it("discloses bounded fact and basis details with safe navigation", () => {
    const onNavigateSection = vi.fn();
    render(
      <DecisionQualitySummary
        confidence={confidence}
        onNavigateSection={onNavigateSection}
        recommendation={{ label: "Review conflicting ARV values" }}
        recommendationBasis={{ basisType: "conflict-review" }}
        reliability={reliability}
      />
    );
    fireEvent.click(screen.getByText("Reliability and recommendation basis"));
    expect(screen.getByText("After-repair value")).toBeInTheDocument();
    expect(screen.getAllByText("Conflict Review").length).toBeGreaterThan(0);
    expect(screen.getByText("evidence-arv")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Conflict Review" }));
    expect(onNavigateSection).toHaveBeenCalledWith("decision");
  });

  it("renders no surface when neither result exists", () => {
    const { container } = render(<DecisionQualitySummary />);
    expect(container).toBeEmptyDOMElement();
  });
});
