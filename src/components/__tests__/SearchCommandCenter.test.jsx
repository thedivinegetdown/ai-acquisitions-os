import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SearchCommandCenter from "../SearchCommandCenter";

describe("SearchCommandCenter", () => {
  const deal = {
    id: "deal-1",
    property_address: "123 Main Street",
    owner_name: "Jane Seller",
    phone: "5551234567",
    stage: "New Lead",
    source: "Referral",
  };

  it("searches loaded deals and opens matching records", async () => {
    const openDeal = vi.fn();

    render(
      <SearchCommandCenter
        deals={[deal]}
        openDeal={openDeal}
        setSelectedPhone={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/Search seller/i), {
      target: { value: "Jane" },
    });
    expect((await screen.findAllByText("123 Main Street")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: /open/i })[0]);

    expect(openDeal).toHaveBeenCalledWith(expect.objectContaining({ id: "deal-1" }));
  });
});
