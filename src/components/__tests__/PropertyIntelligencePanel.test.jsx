import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PropertyIntelligencePanel from "../PropertyIntelligencePanel";

describe("PropertyIntelligencePanel", () => {
  it("renders an empty state when no deal is linked", () => {
    render(<PropertyIntelligencePanel deal={null} />);

    expect(screen.getByText("No Linked Property")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Link a deal to this conversation before running property intelligence."
      )
    ).toBeInTheDocument();
  });
});
