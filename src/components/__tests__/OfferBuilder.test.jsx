import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OfferBuilder from "../OfferBuilder";

describe("OfferBuilder", () => {
  it("renders internal offer planning and updates analysis from draft changes", () => {
    render(
      <OfferBuilder
        deal={{
          id: "deal-1",
          property_address: "123 Main",
          arv: 200000,
          repairs: 20000,
          asking_price: 120000,
        }}
      />
    );

    expect(screen.getByText("Internal Offer Planning")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Offer Amount/i), {
      target: { value: "100000" },
    });

    expect(screen.getByText("Offer Scenario Comparison")).toBeInTheDocument();
    expect(screen.getAllByText(/Recommended|Risk/i).length).toBeGreaterThan(0);
  });
});
