import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import VacantLandStrategySummary from "../VacantLandStrategySummary";

const result = {
  eligible: true,
  strategyVersion: "vacant-land-strategy-v1",
  scoringProfileId: "vacant-land-pursuit-profile-v1",
  valuation: {
    evaluationState: "evaluated", askingPrice: 50000, parcelSizeAcres: 5,
    askingPricePerAcre: 10000, indicatedLandValue: 100000,
    indicatedValuePerAcre: 20000, grossLandSpread: 50000,
    discountToIndicatedValueRatio: 0.5, comparableCount: 2,
    valuationSource: "median-persisted-land-comparable-price-per-acre",
    assumptions: ["No location adjustment is applied."],
    operatorDisclosure: "Land valuation context is not an appraisal or instruction to purchase.",
    partialDataWarnings: ["Two comparables provide limited support."],
  },
  feasibilitySignals: [{ signalId: "access", severity: "attention", label: "Access review", explanation: "Review recorded access Evidence." }],
  exitCandidates: [{ candidateId: "land-exit", state: "candidate", label: "Land wholesale / assignment", explanation: "Review-only path; gross spread is not profit.", manualReviewRequirements: [] }],
};

describe("VacantLandStrategySummary", () => {
  it("renders land valuation, signals, exits, and limitations accessibly", () => {
    render(<VacantLandStrategySummary result={result} />);
    expect(screen.getByRole("heading", { name: "Vacant Land Strategy" })).toBeInTheDocument();
    expect(screen.getByText("Gross land spread")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Parcel feasibility signals" })).toBeInTheDocument();
    expect(screen.getByText("Review-only land exit candidates")).toBeInTheDocument();
    expect(screen.queryByText(/ARV|repairs|MAO/i)).not.toBeInTheDocument();
  });

  it("does not render unavailable values as zero", () => {
    render(<VacantLandStrategySummary result={{ ...result, valuation: { evaluationState: "not-evaluated" }, feasibilitySignals: [], exitCandidates: [] }} />);
    expect(screen.getAllByText("Not evaluated").length).toBeGreaterThan(0);
    expect(screen.queryByText("$0")).not.toBeInTheDocument();
  });
});
