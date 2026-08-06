import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  PURSUIT_SCORING_PROFILE_STATUSES,
  evaluatePursuitScore,
  toPursuitScoreMetric,
} from "../../../services/decision-intelligence";
import {
  createResidentialScoringProfile,
  createScoringInput,
} from "../../../services/decision-intelligence/pursuit-scoring/__tests__/fixtures/pursuitScoringFixtures";
import PursuitScoreSummary from "../PursuitScoreSummary";

function createPresentation({ partial = false, testOnly = false } = {}) {
  const profile = createResidentialScoringProfile({
    status: testOnly
      ? PURSUIT_SCORING_PROFILE_STATUSES.TEST_ONLY
      : PURSUIT_SCORING_PROFILE_STATUSES.ACTIVE,
  });
  const input = createScoringInput(profile);
  const factorObservations = partial
    ? input.factorObservations.filter(
        (entry) => entry.factorId !== "res-rent-potential"
      )
    : input.factorObservations;
  const result = evaluatePursuitScore({
    ...input,
    factorObservations,
    executionMode: testOnly ? "test" : "production",
  });
  const metric = toPursuitScoreMetric(result, {
    assetStrategyContext: input.assetStrategyContext,
    productionOnly: true,
  });
  return { assetStrategyContext: input.assetStrategyContext, metric, result };
}

describe("PursuitScoreSummary", () => {
  it("renders nothing for absent, blocked, or test-only results", () => {
    const { container, rerender } = render(
      <PursuitScoreSummary
        assetStrategyContext={null}
        metric={null}
        result={null}
      />
    );
    expect(container).toBeEmptyDOMElement();

    const testOnly = createPresentation({ testOnly: true });
    rerender(<PursuitScoreSummary {...testOnly} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Pursuit Score")).not.toBeInTheDocument();
  });

  it("renders only an evaluated production score with neutral wording", () => {
    const presentation = createPresentation();
    render(<PursuitScoreSummary {...presentation} />);

    expect(screen.getByRole("heading", { name: "Pursuit Score" })).toBeInTheDocument();
    expect(screen.getByLabelText("Pursuit Score 75 out of 100")).toBeInTheDocument();
    expect(screen.getByText("High pursuit priority")).toBeInTheDocument();
    expect(screen.getByText("Economics")).toBeInTheDocument();
    expect(screen.getByText("25.2 weighted points")).toBeInTheDocument();
    expect(screen.queryByText(/purchase recommendation/i)).not.toBeInTheDocument();
  });

  it("provides a keyboard-operable explanation with ruleset and Evidence", () => {
    const presentation = createPresentation();
    render(<PursuitScoreSummary {...presentation} />);

    const disclosure = screen.getByText("Score explanation and Evidence");
    disclosure.focus();
    expect(disclosure).toHaveFocus();
    fireEvent.click(disclosure);

    expect(screen.getByText("residential-pursuit-test-profile / test-profile-v1")).toBeInTheDocument();
    expect(screen.getByText(/pursuit-scoring-engine/)).toBeInTheDocument();
    expect(screen.getByLabelText("Pursuit Score Evidence and Provenance references")).toBeInTheDocument();
    expect(screen.getByText("evidence:res-acquisition-spread")).toBeInTheDocument();
    expect(screen.getByText(/not an instruction to purchase/i)).toBeInTheDocument();
  });

  it("labels a permitted partial evaluation without hiding omitted-weight warnings", () => {
    const presentation = createPresentation({ partial: true });
    render(<PursuitScoreSummary {...presentation} />);

    expect(screen.getByText("Partial evaluation")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Score explanation and Evidence"));
    expect(screen.getAllByText(/omitted/i).length).toBeGreaterThan(0);
  });

  it("uses token-based classes in dark mode without inline styling", () => {
    const presentation = createPresentation();
    const { container } = render(
      <div data-theme="dark">
        <PursuitScoreSummary {...presentation} />
      </div>
    );

    expect(container.querySelector(".pursuit-score-summary")).toBeInTheDocument();
    expect(container.querySelector("[style]")).not.toBeInTheDocument();
  });
});
