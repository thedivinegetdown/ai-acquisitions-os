import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { reviewExternalLandCandidate, confirmExternalLandCandidate, appendExternalLandEvidence, LAND_RESEARCH_NEXT_ACTION } from "../externalLandIntakeService";
import { buildTodayReadModel } from "../../today/todayService";
import { buildCompatibilityDecisionReadModel } from "../../decision-intelligence/compatibilityDecisionService";
import { buildPipelineReadModel } from "../../pipeline";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), list: vi.fn(), persist: vi.fn(), append: vi.fn(), context: { organizationId: "org-a", userId: "owner-a", role: "owner" } }));
vi.mock("../../leadDiscovery/volusiaParcelOwnershipSource", () => ({ fetchVolusiaParcelOwnership: mocks.fetch }));
vi.mock("../../repositories/dealRepository", () => ({ listDeals: mocks.list, persistImportedDeals: mocks.persist }));
vi.mock("../../repositories/researchRepository", () => ({ saveSupportingEvidenceBatchCommand: mocks.append }));
vi.mock("../../organizations", () => ({ requireActiveOrganizationContext: async () => mocks.context }));
vi.mock("../../../supabaseClient", () => ({ supabase: {} }));

const require = createRequire(import.meta.url);
const { fetchVolusiaParcelOwnership } = require("../../../../netlify/functions/_shared/volusia-parcel-ownership.cjs");
const retrievedAt = "2026-10-24T12:00:00.000Z";
const cases = [
  ["2123541", "603302000030", "195 Lake Molly Ave", 3.3958, 120000],
  ["5844315", "69440100038K", "1964 South Farm Rd", 2.5, 145000],
  ["8010197", "700600000482", "1043 Hazen Rd", 1.1863, 199900],
];
const inputFor = ([parid, originalParcel, location, , listingPrice]) => ({ parid, originalParcel, location, listingPrice, listingName: "Synthetic external listing", listingUrl: "https://example.com/land", listingRetrievedAt: retrievedAt });
const verified = ([parid, , location, acreage]) => ({ success: true, data: {
  status: "matched", source: "volusia-parcel-ownership", propertyVerificationState: "PARCEL_VERIFIED", verifiedParcelId: parid, retrievedAt,
  parcel: { parcelId: parid, retrievedAt, situsAddress: { addressLine: location, city: "DeLand" }, propertyUse: { code: "0000", description: "VACANT RES" }, acreage: { calculated: acreage }, ownerNames: ["Synthetic record owner"], justValueContext: { total: 10000 } },
} });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.context = { organizationId: "org-a", userId: "owner-a", role: "owner" };
  mocks.fetch.mockResolvedValue(verified(cases[0]));
  mocks.list.mockResolvedValue({ success: true, data: [], metadata: { complete: true } });
  mocks.persist.mockImplementation(async ([record]) => ({ success: true, data: { results: [{ status: "imported", deal: { ...record.payload, id: "saved", organization_id: "org-a", property_jurisdiction: record.verifiedPropertyIdentity.jurisdiction, authoritative_parcel_id: record.verifiedPropertyIdentity.authoritativeParcelId } }] } }));
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unapproved HTTP/provider request"); }));
});
afterEach(() => { expect(globalThis.fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });

describe("external vacant-land research intake", () => {
  it.each(cases)("saves historical fixture PARID %s truthfully with atomic evidence", async (...fixture) => {
    mocks.fetch.mockResolvedValue(verified(fixture));
    const review = await reviewExternalLandCandidate(inputFor(fixture));
    expect(mocks.persist).not.toHaveBeenCalled();
    const saved = await confirmExternalLandCandidate(review);
    expect(mocks.persist).toHaveBeenCalledTimes(1);
    const [{ payload, verifiedPropertyIdentity }] = mocks.persist.mock.calls[0][0];
    expect(verifiedPropertyIdentity).toMatchObject({ jurisdiction: "us-fl-volusia-county", authoritativeParcelId: fixture[0], verificationSource: "volusia-parcel-ownership" });
    expect(payload).toMatchObject({ operating_scope: "research_only", asset_type: "vacant-residential-land", stage: "New Lead", status: "Unqualified property research", owner_name: null, phone: null, email: null, asking_price: null, arv: null, repairs: null, next_action: LAND_RESEARCH_NEXT_ACTION });
    expect(payload).not.toHaveProperty("next_action_due_date");
    expect(payload).not.toHaveProperty("zoning");
    expect(payload.import_id).toMatch(new RegExp(`^external-land:us-fl-volusia-county:${fixture[0]}:`));
    const evidence = payload.research_evidence.map((entry) => entry.supportingEvidence);
    expect(evidence.find((entry) => entry.fact.includes("asking price"))).toMatchObject({ status: "INDICATIVE", resolutionState: "SUPPORTING", source: { url: "https://example.com/land", retrievedAt } });
    expect(evidence.find((entry) => entry.fact.includes("Public-record owner"))).toMatchObject({ category: "ownership_title", status: "VERIFIED", linkage: { ownerPartyName: "Synthetic record owner" } });
    expect(evidence.find((entry) => entry.fact.includes("acreage"))).toMatchObject({ status: "VERIFIED", source: { name: "Volusia County Parcel Ownership", retrievedAt } });
    const decision = buildCompatibilityDecisionReadModel({ deal: saved.deal, now: retrievedAt }).data;
    expect(decision.missingInformationReadModel.allItems.find((item) => item.requirementId === "seller-identity")).toMatchObject({ state: "missing" });
    expect(decision.availableActions.filter((action) => ["prepare-offer", "follow-up", "view-conversation"].includes(action.id)).every((action) => !action.enabled)).toBe(true);
    const today = buildTodayReadModel({ deals: [saved.deal], now: Date.parse(retrievedAt), businessTimeZone: "America/New_York" });
    expect(today.items.every((item) => !/call|text|email|bid|offer|closing/i.test(item.recommendedNextAction))).toBe(true);
    expect(buildPipelineReadModel({ deals: [saved.deal], organizationId: "org-a", now: Date.parse(retrievedAt) }).items).toEqual(expect.arrayContaining([expect.objectContaining({ dealId: "saved", currentStage: "New Lead" })]));
    // Optional local DB proof handoff: exact service-produced payload, never production.
    if (process.env.EXTERNAL_LAND_LOCAL_FIXTURE_FILE && fixture[0] === "2123541") {
      writeFileSync(process.env.EXTERNAL_LAND_LOCAL_FIXTURE_FILE, JSON.stringify(mocks.persist.mock.calls[0][0][0]));
    }
  });

  it.each(["unmatched", "ambiguous", "unavailable"])("fails closed for %s without persistence", async (status) => {
    mocks.fetch.mockResolvedValue({ success: status !== "unavailable", data: { status, propertyVerificationState: "UNVERIFIED" } });
    await expect(reviewExternalLandCandidate(inputFor(cases[0]))).rejects.toThrow("One exact official");
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it("rejects mismatched authoritative identity, nonland classification, PID substitution, and incomplete duplicates", async () => {
    mocks.fetch.mockResolvedValue(verified(cases[1]));
    await expect(reviewExternalLandCandidate(inputFor(cases[0]))).rejects.toThrow("One exact official");
    const nonland = verified(cases[0]);
    nonland.data.parcel.propertyUse.description = "SINGLE FAMILY";
    mocks.fetch.mockResolvedValue(nonland);
    await expect(reviewExternalLandCandidate(inputFor(cases[0]))).rejects.toThrow("vacant residential");
    await expect(reviewExternalLandCandidate({ ...inputFor(cases[0]), parid: cases[0][1] })).rejects.toThrow();
    mocks.fetch.mockResolvedValue(verified(cases[0]));
    mocks.list.mockResolvedValue({ success: false });
    await expect(reviewExternalLandCandidate(inputFor(cases[0]))).rejects.toThrow("duplicate check");
  });

  it("preserves candidate B county A-4 / listing A-3 as separately sourced unresolved conflicts", async () => {
    mocks.fetch.mockResolvedValue(verified(cases[1]));
    const review = await reviewExternalLandCandidate({ ...inputFor(cases[1]), countyZoning: "A-4", countyZoningUrl: "https://www.volusia.org/zoning", countyZoningRetrievedAt: retrievedAt, listingZoning: "A-3" });
    await confirmExternalLandCandidate(review);
    const entries = mocks.persist.mock.calls[0][0][0].payload.research_evidence.filter((entry) => entry.conflictState === "conflicting");
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.supportingEvidence)).toEqual(expect.arrayContaining([
      expect.objectContaining({ fact: "County zoning: A-4", status: "VERIFIED", resolutionState: "CONFLICTING", source: expect.objectContaining({ url: "https://www.volusia.org/zoning" }) }),
      expect.objectContaining({ fact: "Listing zoning claim: A-3", status: "INDICATIVE", resolutionState: "CONFLICTING", source: expect.objectContaining({ url: "https://example.com/land" }) }),
    ]));
  });

  it("returns an existing authorized deal and appends evidence only on separate confirmation", async () => {
    const existing = { id: "existing", organization_id: "org-a", property_jurisdiction: "us-fl-volusia-county", authoritative_parcel_id: "2123541", stage: "New Lead", operating_scope: "active_acquisition" };
    mocks.list.mockResolvedValue({ success: true, data: [existing, { ...existing, organization_id: "org-b" }], metadata: { complete: true } });
    const review = await reviewExternalLandCandidate(inputFor(cases[0]));
    expect(review.existingDeal).toEqual(existing);
    mocks.persist.mockResolvedValue({ success: true, data: { results: [{ status: "existing", deal: existing }] } });
    const saved = await confirmExternalLandCandidate(review);
    expect(saved.deal).toEqual(existing);
    expect(mocks.append).not.toHaveBeenCalled();
    await appendExternalLandEvidence(review, saved.deal);
    expect(mocks.append).toHaveBeenCalledWith(existing, review.commands);
    await expect(appendExternalLandEvidence(review, { ...existing, organization_id: "org-b" })).rejects.toThrow("organization and parcel");
    expect(mocks.append).toHaveBeenCalledTimes(1);
  });

  it("fails safely on tenant change, changed county record, invalid evidence, or failed admission; no fallback", async () => {
    const review = await reviewExternalLandCandidate(inputFor(cases[0]));
    mocks.context.organizationId = "org-b";
    await expect(confirmExternalLandCandidate(review)).rejects.toThrow("organization changed");
    mocks.context.organizationId = "org-a";
    const changed = verified(cases[0]); changed.data.parcel.ownerNames = ["Changed owner"];
    mocks.fetch.mockResolvedValue(changed);
    await expect(confirmExternalLandCandidate(review)).rejects.toThrow("record changed");
    mocks.fetch.mockResolvedValue(verified(cases[0]));
    await expect(confirmExternalLandCandidate({ ...review, commands: [...review.commands, { fact: "Invalid" }] })).rejects.toThrow("evidence category");
    expect(mocks.persist).not.toHaveBeenCalled();
    mocks.persist.mockResolvedValue({ success: true, data: { results: [{ status: "failed" }] } });
    await expect(confirmExternalLandCandidate(review)).rejects.toThrow("not confirmed as saved");
    expect(mocks.persist).toHaveBeenCalledTimes(1);
  });

  it("requires owner review and source dates without requesting contacts or providers", async () => {
    await expect(reviewExternalLandCandidate({ ...inputFor(cases[0]), listingRetrievedAt: "" })).rejects.toThrow("retrieval date");
    mocks.context.role = "viewer";
    await expect(reviewExternalLandCandidate(inputFor(cases[0]))).rejects.toThrow("Only an organization owner");
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it("reuses the exact official lookup, rejecting zero/multiple/mismatched responses with synthetic county HTTP", async () => {
    for (const [features, expected] of [[[], "unmatched"], [[{}, {}], "ambiguous"], [[{ attributes: { PARID: "2123541", PC_DESC: "VACANT RES" } }], "matched"]]) {
      const fetchImpl = vi.fn(async (url) => {
        expect(new URL(url).searchParams.get("where")).toBe("PARID = '2123541'");
        return { ok: true, json: async () => ({ features }) };
      });
      expect((await fetchVolusiaParcelOwnership({ verifiedParcelId: "2123541", fetchImpl })).status).toBe(expected);
    }
    await expect(fetchVolusiaParcelOwnership({ verifiedParcelId: "2123541", fetchImpl: async () => ({ ok: true, json: async () => ({ features: [{ attributes: { PARID: "5844315" } }] }) }) })).rejects.toThrow("did not match");
  });
});
