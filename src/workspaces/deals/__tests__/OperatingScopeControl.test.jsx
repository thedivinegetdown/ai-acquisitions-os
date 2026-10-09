import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import OperatingScopeControl from "../OperatingScopeControl";
import { requireActiveOrganizationContext } from "../../../services/organizations";
import { saveDealOperatingScope } from "../../../services/repositories/dealRepository";
import OfferReadinessSummary from "../OfferReadinessSummary";
import { getOperatingScopePolicy } from "../../../services/deals/operatingScopePolicy";
import MissingInformationAutopilot from "../MissingInformationAutopilot";
import { evaluateMissingInformation } from "../../../services/research-intelligence";
vi.mock("../../../services/organizations", () => ({ requireActiveOrganizationContext: vi.fn() }));
vi.mock("../../../services/repositories/dealRepository", () => ({ saveDealOperatingScope: vi.fn() }));
vi.mock("../../../supabaseClient", () => ({ supabase: {} }));
const fetch = vi.fn(() => { throw new Error("Provider calls are forbidden in UI tests."); });
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });

const deal = { id: "deal-1", organization_id: "org-1", updated_at: "2026-10-09T15:00:00Z", stage: "New Lead", next_action: "Review existing evidence" };
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", fetch); requireActiveOrganizationContext.mockResolvedValue({ organizationId: "org-1", role: "owner" }); });

describe("Decision Room owner operating scope control", () => {
  it("shows missing seller facts while disabling seller context CTAs and suppressing outreach copy controls", () => {
    const readModel = evaluateMissingInformation({ deal: { ...deal, asset_type: "residential-home", operating_scope: "research_only" } });
    render(<MissingInformationAutopilot readModel={readModel} onNavigateSection={vi.fn()} />);
    expect(screen.getAllByText("Seller identity").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Open Seller" }).every((button) => button.disabled)).toBe(true);
    expect(screen.queryByRole("button", { name: "Copy Seller Question" })).not.toBeInTheDocument();
  });
  it("retains factual readiness but replaces transaction guidance with read-only review", () => {
    render(<OfferReadinessSummary operatingPolicy={getOperatingScopePolicy({ operating_scope: "research_only" })} result={{
      readinessState: "ready-for-offer-preparation", displayLabel: "Ready for Offer Preparation",
      explanation: "All evaluated blocking gates passed.", gateResults: [],
      recommendedNextAction: { label: "Prepare an offer", enabled: true, targetSection: "numbers" },
    }} />);
    expect(screen.getByText("Ready for Offer Preparation")).toBeInTheDocument();
    expect(screen.getByText("Continue research-only readiness review.")).toBeInTheDocument();
    expect(screen.queryByText("Prepare an offer")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open numbers" })).not.toBeInTheDocument();
  });
  it("saves an explicit selection and reproduces scope after reload", async () => {
    const onSaved = vi.fn();
    const saved = { ...deal, operating_scope: "research_only" };
    saveDealOperatingScope.mockResolvedValue({ success: true, data: saved });
    const view = render(<OperatingScopeControl deal={deal} onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByLabelText("Operating scope")).toBeEnabled());
    expect(screen.getByLabelText("Operating scope")).toHaveValue("active_acquisition");
    fireEvent.change(screen.getByLabelText("Operating scope"), { target: { value: "research_only" } });
    fireEvent.click(screen.getByRole("button", { name: "Save operating scope" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(saveDealOperatingScope).toHaveBeenCalledWith(deal, "research_only");
    view.unmount();
    render(<OperatingScopeControl deal={saved} onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByLabelText("Operating scope")).toBeEnabled());
    expect(screen.getByLabelText("Operating scope")).toHaveValue("research_only");
    expect(screen.getByText(/Research and evidence remain available/)).toBeInTheDocument();
  });

  it.each([{ role: "analyst", organizationId: "org-1" }, { role: "owner", organizationId: "other-org" }])("keeps the control read-only for %j", async (context) => {
    requireActiveOrganizationContext.mockResolvedValue(context);
    render(<OperatingScopeControl deal={deal} onSaved={vi.fn()} />);
    await screen.findByText("Only an organization owner can change operating scope.");
    expect(screen.getByRole("button", { name: "Save operating scope" })).toBeDisabled();
    expect(saveDealOperatingScope).not.toHaveBeenCalled();
  });
});
