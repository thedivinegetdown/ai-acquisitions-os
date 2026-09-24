import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { analyzeManualLead, confirmLeadImport, parseCsvLeadText } = vi.hoisted(() => ({
  analyzeManualLead: vi.fn(),
  confirmLeadImport: vi.fn(),
  parseCsvLeadText: vi.fn(),
}));

vi.mock("../../services/leadIntake", () => ({
  analyzeManualLead,
  confirmLeadImport,
  parseCsvLeadText,
}));

import LeadImporter from "../LeadImporter";

const acceptedLead = {
  rowNumber: 1,
  sellerName: "Alex Seller",
  phone: "+15551234567",
  propertyAddress: "123 Main St",
  leadSource: "Direct mail",
  market: "Tampa",
  valid: true,
  duplicate: false,
  warnings: [],
  duplicateReasons: [],
};

const analysis = {
  parsedLeads: [acceptedLead],
  validLeads: [acceptedLead],
  invalidLeads: [],
  duplicateLeads: [],
  warnings: [],
  summary: "1 lead parsed: 1 clean.",
  recommendedNextAction: "Review and confirm.",
};

describe("LeadImporter durable confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    analyzeManualLead.mockReturnValue(analysis);
    confirmLeadImport.mockResolvedValue({
      success: true,
      data: { importedCount: 1, message: "1 imported, 0 duplicate retries skipped, 0 failed." },
    });
  });

  it("does not write during preview and persists only after explicit confirmation", async () => {
    const refresh = vi.fn().mockResolvedValue();
    render(<LeadImporter deals={[]} refresh={refresh} />);

    fireEvent.click(screen.getByRole("button", { name: "Preview Manual Lead" }));
    expect(analyzeManualLead).toHaveBeenCalledTimes(1);
    expect(confirmLeadImport).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirm Import" }));
    });

    expect(confirmLeadImport).toHaveBeenCalledWith(analysis);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/1 imported, 0 duplicate retries skipped, 0 failed/)).toBeInTheDocument();
  });
});
