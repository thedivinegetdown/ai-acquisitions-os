import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DecisionTimingSummary from "../DecisionTimingSummary";

const costOfDelay = {
  level: "high",
  displayLabel: "High",
  explanation: "A linked seller reply requires prompt operator attention.",
  directOperationalTrigger: true,
  sellerTimelineDays: 30,
  rulesetVersion: "cost-of-delay-ruleset-v1",
  operatorDisclaimer: "Cost of Delay is not a dollar estimate or instruction to transact.",
};

const windowResult = {
  basisType: "seller-reply",
  windowType: "act-now",
  displayLabel: "Act Now",
  explanation: "No response deadline was created.",
  sourceDueTimestamp: null,
  sourceExpirationTimestamp: null,
  sourceEventTimestamp: "2026-08-09T12:00:00.000Z",
  policyDerived: true,
  evidenceIds: ["evidence-reply"],
  rulesetVersion: "recommended-action-window-ruleset-v1",
  operatorDisclaimer: "The action window does not create a contractual deadline.",
};

describe("DecisionTimingSummary", () => {
  it("presents Cost of Delay and Action Window as separate categorical concepts", () => {
    render(
      <DecisionTimingSummary
        costOfDelay={costOfDelay}
        recommendationBasis={{ basisType: "seller-reply" }}
        windowResult={windowResult}
      />
    );
    expect(screen.getByRole("heading", { name: "Cost of Delay" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recommended Action Window" })).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Act Now")).toBeInTheDocument();
    expect(screen.getByText("Policy-derived timing")).toBeInTheDocument();
    expect(screen.getAllByText(/not a dollar estimate/i)).toHaveLength(2);
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
  });

  it("discloses real source timestamps and bounded Evidence references", () => {
    render(
      <DecisionTimingSummary
        costOfDelay={costOfDelay}
        recommendationBasis={{ basisType: "seller-reply" }}
        windowResult={windowResult}
      />
    );
    fireEvent.click(screen.getByText("Timing references"));
    expect(screen.getByText("2026-08-09T12:00:00.000Z")).toBeInTheDocument();
    expect(screen.getByText("evidence-reply")).toBeInTheDocument();
    expect(screen.getByText("recommended-action-window-ruleset-v1")).toBeInTheDocument();
  });

  it("renders no surface without canonical timing results", () => {
    const { container } = render(<DecisionTimingSummary />);
    expect(container).toBeEmptyDOMElement();
  });
});
