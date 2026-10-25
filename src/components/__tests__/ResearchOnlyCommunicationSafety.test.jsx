import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MessageCenter from "../MessageCenter";
import SequenceEngine from "../SequenceEngine";

const mocks = vi.hoisted(() => ({
  createSequenceSteps: vi.fn(),
  listSequencesByDeal: vi.fn(),
  loadMessageLogs: vi.fn(),
  sendOutboundSms: vi.fn(),
  updateSequenceStep: vi.fn(),
}));

vi.mock("../../services/conversations", () => ({
  buildSmsTemplates: () => ({
    initial: "Initial message",
    followup: "Follow-up message",
    offer: "Offer message",
    checkin: "Check-in message",
  }),
  loadMessageLogs: mocks.loadMessageLogs,
}));

vi.mock("../../services/sms", () => ({
  sendOutboundSms: mocks.sendOutboundSms,
}));

vi.mock("../../services/repositories", () => ({
  createSequenceSteps: mocks.createSequenceSteps,
  listSequencesByDeal: mocks.listSequencesByDeal,
  updateSequenceStep: mocks.updateSequenceStep,
}));

const activeDeal = {
  id: "deal-active",
  operating_scope: "active_acquisition",
  phone: "+15551112222",
  property_address: "1 Active Way",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadMessageLogs.mockResolvedValue({ success: true, data: [] });
  mocks.listSequencesByDeal.mockResolvedValue({ success: true, data: [] });
  mocks.createSequenceSteps.mockResolvedValue({ success: true, data: [] });
  mocks.sendOutboundSms.mockResolvedValue({
    success: true,
    data: { mode: "test", status: "test" },
  });
});

describe("research-only communication controls", () => {
  it.each(["research_only", "unsupported_scope"])(
    "fails closed in the UI for %s deals",
    async (operatingScope) => {
      const deal = { ...activeDeal, id: `deal-${operatingScope}`, operating_scope: operatingScope };
      render(
        <>
          <MessageCenter deal={deal} />
          <SequenceEngine deal={deal} />
        </>
      );

      await waitFor(() => {
        expect(mocks.loadMessageLogs).toHaveBeenCalledTimes(1);
        expect(mocks.listSequencesByDeal).toHaveBeenCalledTimes(1);
      });

      expect(
        screen.getByText("Seller communication is disabled while this deal is research only.")
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Send SMS" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Generate Sequence" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Cash Offer" })).toBeDisabled();
      expect(screen.getByPlaceholderText("Enter phone number")).toBeDisabled();
      expect(screen.getAllByRole("textbox")).toHaveLength(2);
      screen.getAllByRole("textbox").forEach((input) => expect(input).toBeDisabled());

      fireEvent.click(screen.getByRole("button", { name: "Send SMS" }));
      fireEvent.click(screen.getByRole("button", { name: "Generate Sequence" }));
      expect(mocks.sendOutboundSms).not.toHaveBeenCalled();
      expect(mocks.createSequenceSteps).not.toHaveBeenCalled();
    }
  );

  it("preserves active-acquisition SMS and sequence behavior", async () => {
    render(
      <>
        <MessageCenter deal={activeDeal} />
        <SequenceEngine deal={activeDeal} />
      </>
    );

    await waitFor(() => expect(mocks.loadMessageLogs).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Send SMS" }));
    await waitFor(() =>
      expect(mocks.sendOutboundSms).toHaveBeenCalledWith({
        to: "+15551112222",
        message: "Initial message",
        dealId: "deal-active",
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate Sequence" }));
    await waitFor(() => expect(mocks.createSequenceSteps).toHaveBeenCalledTimes(1));
    expect(mocks.createSequenceSteps.mock.calls[0][0]).toHaveLength(5);
    expect(mocks.createSequenceSteps.mock.calls[0][0][0]).toMatchObject({
      deal_id: "deal-active",
      action_type: "Call",
      step_day: 0,
    });
  });
});
