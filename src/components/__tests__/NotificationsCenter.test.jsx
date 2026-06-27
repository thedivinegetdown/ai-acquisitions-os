import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NotificationsCenter from "../NotificationsCenter";

describe("NotificationsCenter", () => {
  it("renders deal alerts and opens the selected deal", () => {
    const deal = {
      id: "deal-1",
      property_address: "123 Main",
      due_date: "2000-01-01",
      stage: "New Lead",
    };
    const openDeal = vi.fn();

    render(<NotificationsCenter deals={[deal]} openDeal={openDeal} />);

    fireEvent.click(screen.getByText(/Overdue follow-up/i));

    expect(openDeal).toHaveBeenCalledWith(deal);
  });

  it("renders an empty state when no alerts exist", () => {
    render(<NotificationsCenter deals={[]} openDeal={vi.fn()} />);

    expect(screen.getByText("No alerts right now.")).toBeInTheDocument();
  });
});
