import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ExecutiveDashboard from "../ExecutiveDashboard";

describe("ExecutiveDashboard smoke test", () => {
  it("renders with empty deals without crashing", () => {
    render(<ExecutiveDashboard deals={[]} />);

    expect(screen.getByText("Business Intelligence")).toBeInTheDocument();
    expect(screen.getByText("Business Overview")).toBeInTheDocument();
    expect(screen.getAllByText("Insufficient Data").length).toBeGreaterThan(0);
  });

  it("renders basic metrics with malformed deal data", () => {
    render(
      <ExecutiveDashboard
        deals={[
          {
            id: 1,
            stage: "Under Contract",
            property_address: "",
            assignment_fee: "bad",
          },
        ]}
      />
    );

    expect(screen.getByText("Pipeline Analytics")).toBeInTheDocument();
    expect(screen.getByText("Notifications")).toBeInTheDocument();
  });
});
