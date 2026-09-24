import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RentCastPropertyEvidencePanel from "../RentCastPropertyEvidencePanel";
import { getRentCastPropertyDataStatus, refreshRentCastPropertyData } from "../../../services/propertyData";
import { saveResearchCommand } from "../../../services/repositories/researchRepository";

vi.mock("../../../services/propertyData", () => ({
  getRentCastPropertyDataStatus: vi.fn(),
  refreshRentCastPropertyData: vi.fn(),
}));
vi.mock("../../../services/repositories/researchRepository", () => ({ saveResearchCommand: vi.fn() }));
vi.mock("../../../supabaseClient", () => ({ supabase: {} }));

const retrievedAt = "2026-09-24T15:00:00.000Z";
const provider = { id: "rentcast", enabled: true, configured: true, monthlyRequestCap: 10 };
const evidence = {
  id: "evidence-1", provider: "rentcast", providerRecordId: "record-1",
  retrievedAt, cacheState: "fresh",
  data: {
    property: { propertyType: "Single Family", beds: 3, baths: 2, squareFeet: 1500, lotSize: 7200, assessorId: "APN-1", zoning: "R-1", county: "Hillsborough" },
    tax: { taxYear: 2025, assessedValue: 210000, annualTaxes: 3200 },
    saleHistory: [{ date: "2021-01-02T00:00:00.000Z", price: 180000 }],
    valuation: { estimatedValue: 255000, arvEstimate: null },
    comps: [{ address: "125 Main St", listingPrice: 250000 }],
    limitations: ["The AVM is not automatically treated as canonical ARV or underwriting."],
  },
};
const residential = { id: "deal-1", organization_id: "org-1", asset_type: "residential-home", property_address: "123 Main St", arv: 200000, research_revision: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  getRentCastPropertyDataStatus.mockResolvedValue({ success: true, data: { provider, evidence: null } });
  refreshRentCastPropertyData.mockResolvedValue({ success: true, data: { provider, evidence, cacheHit: false } });
  saveResearchCommand.mockResolvedValue({ success: true, data: { ...residential, research_revision: 1 } });
});

describe("RentCastPropertyEvidencePanel", () => {
  it("loads status without refreshing, shows explicit disagreement, and records through research", async () => {
    const onSaved = vi.fn();
    render(<RentCastPropertyEvidencePanel deal={residential} onSaved={onSaved} />);
    expect(await screen.findByText("Available")).toBeInTheDocument();
    expect(refreshRentCastPropertyData).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Refresh Property Data" }));
    expect(await screen.findByRole("list", { name: "RentCast normalized findings" })).toHaveTextContent("Differs from current fact (200000)");
    expect(screen.getByText(/Tax\/assessment context:/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Record AVM as ARV evidence" }));
    await waitFor(() => expect(saveResearchCommand).toHaveBeenCalledWith(residential, expect.objectContaining({
      type: "record", field: "property.afterRepairValue", value: "255000",
      providerEvidence: expect.objectContaining({ provider: "rentcast", evidenceId: "evidence-1", providerField: "valuation.estimatedValue" }),
    })));
    expect(onSaved).toHaveBeenCalled();
  });

  it("keeps the manual workflow usable when disabled and offers land-specific acceptance", async () => {
    getRentCastPropertyDataStatus.mockResolvedValueOnce({ success: true, data: { provider: { ...provider, enabled: false }, evidence: null } });
    const view = render(<RentCastPropertyEvidencePanel deal={{ ...residential, asset_type: "vacant-residential-land" }} onSaved={vi.fn()} />);
    expect(await screen.findByText("Disabled")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh Property Data" })).toBeDisabled();
    view.unmount();

    getRentCastPropertyDataStatus.mockResolvedValueOnce({ success: true, data: { provider, evidence } });
    render(<RentCastPropertyEvidencePanel deal={{ ...residential, asset_type: "vacant-residential-land", zoning: "AG" }} onSaved={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Record zoning evidence" }));
    await waitFor(() => expect(saveResearchCommand).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ field: "property.zoning", value: "R-1" })));
  });
});
