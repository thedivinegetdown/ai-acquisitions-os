import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ rows: new Map(), writes: [], fail: false, nextId: 1 }));
const fetchCandidates = vi.hoisted(() => vi.fn());

vi.mock("../../services/leadDiscovery/orangeCountyTaxSaleSource", () => ({
  ORANGE_COUNTY_TAX_SALE_SOURCE: "orange-county-tax-sale",
  fetchOrangeCountyTaxSaleCandidates: fetchCandidates,
}));
vi.mock("../../supabaseClient", () => ({
  supabase: { from: (table) => {
    if (table !== "deals") throw new Error(`Unexpected table ${table}`);
    const query = { payload: null, organizationId: null };
    query.insert = (payload) => { query.payload = structuredClone(payload); db.writes.push(query.payload); return query; };
    query.select = () => query;
    query.eq = (key, value) => { if (key === "organization_id") query.organizationId = value; return query; };
    query.order = () => query;
    query.limit = async () => {
      if (db.fail) return { data: null, error: { code: "XX000", message: "synthetic insert failure" } };
      const key = `${query.payload.organization_id}:${query.payload.import_id}`;
      if (db.rows.has(key)) return { data: null, error: { code: "23505", message: "duplicate" } };
      const row = { id: `saved-${db.nextId++}`, ...structuredClone(query.payload) };
      db.rows.set(key, row);
      return { data: [structuredClone(row)], error: null };
    };
    query.range = async (start, end) => ({
      data: [...db.rows.values()].filter((row) => row.organization_id === query.organizationId).slice(start, end + 1).map((row) => structuredClone(row)),
      error: null,
    });
    return query;
  } },
}));
vi.mock("../../services/organizations", () => ({
  requireActiveOrganizationContext: async () => ({ organizationId: "org-1" }),
  stripOrganizationOwnership: (payload = {}) => Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "organization_id")),
}));
vi.mock("../../services/repositories/operationalDiagnosticRepository", () => ({
  recordOperationalFailure: async () => ({ success: true }),
}));
vi.mock("../../services/repositories", async () => ({
  persistImportedDeals: (await vi.importActual("../../services/repositories/dealRepository")).persistImportedDeals,
}));

import LeadImporter from "../LeadImporter";
import { analyzeManualLead, analyzeOrangeCountyTaxSaleCandidate, confirmLeadImport, parseCsvLeadText } from "../../services/leadIntake";
import { listDeals } from "../../services/repositories/dealRepository";
import { getDealRoute } from "../../navigation/workspaces";

const retrievedAt = "2026-09-27T04:58:13.174Z";
function candidate(status = "matched", tda = "2024-16897") {
  return {
    source: "orange-county-tax-sale", externalId: `orange-county-tax-sale:${tda}`,
    sourceRecordId: 55, externalTaxDeedNumber: tda, parcelNumber: "30-24-30-2665-07-203",
    saleDate: "11/05/2026", deedStatus: "Active Sale", retrievedAt,
    enrichment: {
      status, source: "orange-county-property-appraiser", retrievedAt,
      parcelId: "302430266507203", sourceRecordId: 91,
      address: "13414 FAIRWAY GLEN DR UNIT 203", city: "Orlando", zip: "32824",
      owner: "RECORD OWNER", propertyUse: { dorCode: "0400", parcelCategory: "CONDO" },
      facts: { beds: 2, baths: 2, livingArea: 1013, yearBuilt: 1997, acreage: 0.1, zoning: null },
      assessment: { marketValue: 170500, assessedValue: 170500 },
      recentSale: { date: "2021-09-15T04:00:00.000Z", adjustedValue: 163000 },
    },
  };
}

beforeEach(() => {
  db.rows.clear(); db.writes = []; db.fail = false; db.nextId = 1;
  fetchCandidates.mockReset();
  fetchCandidates.mockResolvedValue({ success: true, data: {
    status: "available", retrievedAt,
    candidates: [candidate(), candidate("unmatched", "2024-15068"), candidate("ambiguous", "2024-18274")],
    rejected: [], page: { hasMore: false },
  } });
});

describe("Orange County candidate to saved research lead", () => {
  it("reviews without writes, saves and reads structured provenance, and opens the returned deal ID", async () => {
    const navigateToDeal = vi.fn();
    const refresh = vi.fn(async () => listDeals());
    render(<LeadImporter deals={[]} refresh={refresh} navigateToDeal={navigateToDeal} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Refresh Tax Sale Preview" })); });
    expect(screen.getAllByRole("button", { name: "Review Candidate" })).toHaveLength(1);
    expect(analyzeOrangeCountyTaxSaleCandidate({ candidate: candidate("unmatched") })).toBeNull();
    expect(analyzeOrangeCountyTaxSaleCandidate({ candidate: candidate("ambiguous") })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Review Candidate" }));
    expect(db.writes).toHaveLength(0);
    const review = screen.getByRole("region", { name: "County candidate review" });
    expect(within(review).getByText(/seller, contact, motivation, asking price, ARV, and qualification are unknown/i)).toBeInTheDocument();
    fireEvent.click(within(review).getByRole("button", { name: "Cancel Review" }));
    expect(db.writes).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Review Candidate" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Confirm Save Research Lead" })); });
    await screen.findByText("Research lead saved.");
    const readback = await listDeals();
    expect(readback.success).toBe(true);
    expect(readback.data).toHaveLength(1);
    const saved = readback.data[0];
    expect(saved).toMatchObject({
      id: "saved-1", organization_id: "org-1", import_id: "orange-county-tax-sale:2024-16897",
      status: "Unqualified property research", stage: "New Lead", source: "orange-county-tax-sale",
      parcel_number: "30-24-30-2665-07-203", property_address: "13414 FAIRWAY GLEN DR UNIT 203",
      owner_name: null, phone: null, email: null, asking_price: null,
    });
    expect(saved.research_evidence).toHaveLength(3);
    expect(saved.research_evidence[0]).toMatchObject({
      sourceSystem: "orange-county-tax-sale", sourceRecordId: "2024-16897", organizationId: "org-1",
      provenanceDetails: { tdaNumber: "2024-16897", parcelNumber: "30-24-30-2665-07-203", sourceRecordId: 55, retrievedAt },
    });
    expect(saved.research_evidence[1]).toMatchObject({
      sourceSystem: "orange-county-property-appraiser", sourceRecordId: "91",
      provenanceDetails: { address: saved.property_address, recordOwner: "RECORD OWNER", dorCode: "0400", beds: 2 },
    });
    expect(saved.research_evidence[2].provenanceDetails).toMatchObject({ marketValue: 170500, recentSaleAdjustedValue: 163000, retrievedAt });
    expect(saved.research_evidence[0].provenanceDetails.sourceReference).toContain("Tax_Sale_Data");
    expect(saved.research_evidence[2].provenanceDetails.sourceReference).toContain("ocpafl.org");
    expect(screen.getByText("Research lead saved.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Saved Lead" }));
    expect(navigateToDeal).toHaveBeenCalledTimes(1);
    expect(navigateToDeal).toHaveBeenCalledWith(saved.id);
    expect(getDealRoute(saved.id)).toBe("/deals/saved-1");
  });

  it("keeps normal contact rules and makes county retries/concurrent confirmations idempotent", async () => {
    const normal = { sellerName: "Seller", propertyAddress: "123 Main", leadSource: "Direct mail", market: "Orlando" };
    expect(analyzeManualLead({ lead: normal }).validLeads).toHaveLength(0);
    expect(parseCsvLeadText({ csvText: "seller name,property address,lead source,market\nSeller,123 Main,Direct mail,Orlando" }).validLeads).toHaveLength(0);
    const analysis = analyzeOrangeCountyTaxSaleCandidate({ candidate: candidate() });
    expect(analysis.validLeads).toHaveLength(1);
    const [first, retry] = await Promise.all([confirmLeadImport(analysis), confirmLeadImport(analysis)]);
    expect([first.data.importedCount, retry.data.importedCount].sort()).toEqual([0, 1]);
    expect([first.data.duplicateCount, retry.data.duplicateCount].sort()).toEqual([0, 1]);
    expect((await listDeals()).data).toHaveLength(1);
    expect(db.writes.every((payload) => payload.organization_id === "org-1")).toBe(true);
    expect(analyzeOrangeCountyTaxSaleCandidate({ candidate: candidate(), existingDeals: (await listDeals()).data }).duplicateLeads).toHaveLength(1);
  });

  it("leaves review available after failed persistence and gives no false success", async () => {
    db.fail = true;
    render(<LeadImporter deals={[]} refresh={vi.fn()} navigateToDeal={vi.fn()} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Refresh Tax Sale Preview" })); });
    fireEvent.click(screen.getByRole("button", { name: "Review Candidate" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Confirm Save Research Lead" })); });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("not confirmed as saved"));
    expect(screen.getByRole("region", { name: "County candidate review" })).toBeInTheDocument();
    expect(screen.queryByText("Research lead saved.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Saved Lead" })).not.toBeInTheDocument();
    expect((await listDeals()).data).toHaveLength(0);
    db.fail = false;
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Confirm Save Research Lead" })); });
    expect(await screen.findByText("Research lead saved.")).toBeInTheDocument();
  });
});
