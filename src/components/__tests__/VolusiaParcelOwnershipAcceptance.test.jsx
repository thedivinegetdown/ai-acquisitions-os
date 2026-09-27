import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
  VOLUSIA_PARCEL_OWNERSHIP_SOURCE,
  fetchVolusiaParcelOwnership,
  normalizeVerifiedParcelId,
  normalizeVolusiaParcelFeature,
} = require("../../../netlify/functions/_shared/volusia-parcel-ownership.cjs");
const {
  VOLUSIA_CIRCUIT_FORECLOSURE_INDEX_URL,
  buildExternalIdentity,
  fetchVolusiaCircuitForeclosurePreview,
} = require("../../../netlify/functions/_shared/volusia-circuit-foreclosure.cjs");
const {
  createHandler,
} = require("../../../netlify/functions/volusia-parcel-ownership.js");
const {
  FUNCTION_AUTHORIZATION_MATRIX,
} = require("../../../netlify/functions/_shared/function-inventory.cjs");
const {
  normalizeOcpaFeature,
} = require("../../../netlify/functions/_shared/orange-county-property-appraiser.cjs");
const {
  normalizeTaxSaleFeature,
} = require("../../../netlify/functions/_shared/orange-county-tax-sale.cjs");
const {
  normalizeCodeEnforcementFeature,
} = require("../../../netlify/functions/_shared/orange-county-code-enforcement.cjs");
const {
  normalizeCodeEnforcementLienFeature,
} = require("../../../netlify/functions/_shared/orange-county-code-enforcement-lien.cjs");
const {
  normalizeCondemnationFeature,
} = require("../../../netlify/functions/_shared/orange-county-condemnation.cjs");
const {
  normalizeWaterCaseFeature,
} = require("../../../netlify/functions/_shared/orange-county-water-case.cjs");

const { fetchCandidates, fetchParcel } = vi.hoisted(() => ({
  fetchCandidates: vi.fn(),
  fetchParcel: vi.fn(),
}));

vi.mock("../../services/leadDiscovery/volusiaCircuitForeclosureSource", () => ({
  VOLUSIA_CIRCUIT_FORECLOSURE_SOURCE: "volusia-circuit-foreclosure",
  fetchVolusiaCircuitForeclosureCandidates: fetchCandidates,
}));
vi.mock("../../services/leadDiscovery/volusiaParcelOwnershipSource", () => ({
  VOLUSIA_PARCEL_OWNERSHIP_SOURCE: "volusia-parcel-ownership",
  fetchVolusiaParcelOwnership: fetchParcel,
}));

import VolusiaCircuitForeclosureDiscovery from "../VolusiaCircuitForeclosureDiscovery";

const retrievedAt = "2026-09-26T18:00:00.000Z";
const attributes = {
  PARID: "2000007",
  PID: "371300000020",
  DORPID: "27131300000020",
  ADDRFULL: " 100 VERIFIED AVE ",
  CITYNAME: "DELAND",
  STATECODE: "FL",
  ZIP1: "32720",
  OWNER1: "OWNER ONE",
  OWNER2: "OWNER TWO",
  MAILADDR1: "PO BOX 100",
  MAILADDR2: null,
  MAILADDR3: null,
  MAILCITY: "DELAND",
  MAILSTATE: "FL",
  MAILZIP: "32721",
  PC: "0100",
  PC_DESC: "SINGLE FAMILY",
  RES_BEDROOM: 3,
  RES_BATHROOM: 2,
  RES_TOTAL_SFLA: 1450,
  CALCACRES: 0.25,
  LANDACRES: 0.24,
  LANDJUST: 50000,
  IMPRJUST: 150000,
  TOTJUST: 200000,
  LASTSALEDT: Date.parse("2021-01-02T00:00:00.000Z"),
  LASTSALEPRICE: 175000,
};

function jsonResponse(features, extra = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ features, ...extra }),
  };
}

describe("Volusia Parcel Ownership focused acceptance", () => {
  it("proves exact live lookup, normalization, safe failures, manual Source #7 verification, and zero side effects", async () => {
    const live = await fetchVolusiaParcelOwnership({ verifiedParcelId: "2000007" });
    expect(live).toMatchObject({
      status: "matched",
      source: "volusia-parcel-ownership",
      verifiedParcelId: "2000007",
      propertyVerificationState: "PARCEL_VERIFIED",
      parcel: { parcelId: "2000007", source: "volusia-parcel-ownership" },
    });
    expect(live.parcel.situsAddress.addressLine).toBeTruthy();

    expect(normalizeVerifiedParcelId(" 2000007 ")).toBe("2000007");
    expect(normalizeVerifiedParcelId("20-00-007")).toBeNull();
    expect(normalizeVerifiedParcelId("party report address")).toBeNull();

    const normalized = normalizeVolusiaParcelFeature({ attributes }, retrievedAt);
    expect(normalized).toEqual({
      source: VOLUSIA_PARCEL_OWNERSHIP_SOURCE,
      retrievedAt,
      parcelId: "2000007",
      situsAddress: {
        addressLine: "100 VERIFIED AVE",
        city: "DELAND",
        state: "FL",
        postalCode: "32720",
      },
      ownerNames: ["OWNER ONE", "OWNER TWO"],
      ownerMailingAddress: {
        addressLines: ["PO BOX 100"],
        city: "DELAND",
        state: "FL",
        postalCode: "32721",
      },
      propertyUse: { code: "0100", description: "SINGLE FAMILY" },
      beds: 3,
      baths: 2,
      livingAreaSquareFeet: 1450,
      acreage: { calculated: 0.25, land: 0.24 },
      justValueContext: { land: 50000, improvement: 150000, total: 200000 },
      latestSale: { date: "2021-01-02T00:00:00.000Z", price: 175000 },
    });

    const exactFetch = vi.fn(async (url) => {
      const parsed = new URL(url);
      expect(parsed.searchParams.get("where")).toBe("PARID = '2000007'");
      expect(parsed.searchParams.get("returnGeometry")).toBe("false");
      expect(parsed.searchParams.get("resultRecordCount")).toBe("2");
      return jsonResponse([{ attributes }]);
    });
    await expect(
      fetchVolusiaParcelOwnership({
        verifiedParcelId: "2000007",
        fetchImpl: exactFetch,
        retrievedAt,
      })
    ).resolves.toMatchObject({ status: "matched", parcel: normalized });
    expect(exactFetch).toHaveBeenCalledTimes(1);

    const noLookup = vi.fn();
    await expect(fetchVolusiaParcelOwnership({ fetchImpl: noLookup })).rejects.toMatchObject({
      status: 400,
    });
    expect(noLookup).not.toHaveBeenCalled();

    await expect(
      fetchVolusiaParcelOwnership({
        verifiedParcelId: "2000007",
        fetchImpl: vi.fn(async () => jsonResponse([])),
        retrievedAt,
      })
    ).resolves.toMatchObject({
      status: "unmatched",
      propertyVerificationState: "UNVERIFIED",
      parcel: null,
    });
    await expect(
      fetchVolusiaParcelOwnership({
        verifiedParcelId: "2000007",
        fetchImpl: vi.fn(async () =>
          jsonResponse([{ attributes }, { attributes: { ...attributes, OWNER1: "OTHER" } }])
        ),
        retrievedAt,
      })
    ).resolves.toMatchObject({
      status: "ambiguous",
      propertyVerificationState: "UNVERIFIED",
      parcel: null,
    });

    const handlerLookup = vi.fn();
    const handlerAuthorize = vi.fn();
    const handler = createHandler({
      authorize: handlerAuthorize,
      sourceRequest: handlerLookup,
    });
    const invalid = await handler({
      httpMethod: "POST",
      headers: {},
      body: JSON.stringify({ partyReportAddress: "10 PARTY LANE DELAND FL 32720" }),
    });
    expect(invalid.statusCode).toBe(400);
    expect(handlerLookup).not.toHaveBeenCalled();
    expect(handlerAuthorize).not.toHaveBeenCalled();

    const candidate = {
      source: "volusia-circuit-foreclosure",
      externalId: buildExternalIdentity("2026 10001 CIDL"),
      caseNumber: "2026 10001 CIDL",
      filingDate: "2026-09-15",
      plaintiff: "PLAINTIFF LLC",
      defendant: "DEFENDANT PERSON",
      partyReportAddress: "10 PARTY LANE DELAND FL 32720",
      propertyVerificationState: "UNVERIFIED",
      reportWeekEnding: "2026-09-19",
      retrievedAt,
    };
    expect(candidate.externalId).toBe("volusia-circuit-foreclosure:202610001cidl");
    expect(buildExternalIdentity(" 2026 10001 cidl ")).toBe(candidate.externalId);
    const foreclosureFetch = vi.fn(async (url) => {
      if (url === VOLUSIA_CIRCUIT_FORECLOSURE_INDEX_URL) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            "<table>" +
            "<tr><td>Week Ending: 19 September 2026</td><td><a href='/cm_rpt/circuit/CI_2026_09_19.html'>View</a></td></tr>" +
            "<tr><td>Week Ending: 12 September 2026</td><td><a href='/cm_rpt/circuit/CI_2026_09_12.html'>View</a></td></tr>" +
            "</table>",
        };
      }
      const isLatest = url.endsWith("CI_2026_09_19.html");
      return {
        ok: true,
        status: 200,
        text: async () =>
          `<h2>Weekly Circuit Civil Foreclosures Report<br>for Week of Sunday, ${isLatest ? "09/13/2026" : "09/06/2026"}, to Saturday, ${isLatest ? "09/19/2026" : "09/12/2026"}</h2>` +
          "<table><tr><td>Case Number</td><td>Plaintiff</td><td>Defendant</td><td>Judge</td><td>Filing Date</td></tr>" +
          "<tr><td>2026 10001 CIDL</td><td>PLAINTIFF LLC</td><td>DEFENDANT PERSON<br>10 PARTY LANE</td><td>Judge</td><td>09/10/2026</td></tr></table>",
      };
    });
    const unchangedForeclosure = await fetchVolusiaCircuitForeclosurePreview({
      reportLimit: 2,
      fetchImpl: foreclosureFetch,
      retrievedAt,
    });
    expect(unchangedForeclosure.candidates).toHaveLength(1);
    expect(unchangedForeclosure.candidates[0]).toMatchObject({
      externalId: candidate.externalId,
      propertyVerificationState: "UNVERIFIED",
      partyReportAddress: "10 PARTY LANE",
    });
    expect(unchangedForeclosure.rejected).toHaveLength(1);
    expect(unchangedForeclosure.rejected[0].rejectionReasons).toEqual([
      "duplicate external identity across report window",
    ]);

    fetchCandidates.mockResolvedValue({
      success: true,
      data: {
        status: "available",
        candidates: [candidate],
        rejected: [],
        reports: [{ reportWeekEnding: "2026-09-19" }],
        retrievedAt,
      },
    });
    fetchParcel.mockResolvedValue({
      success: true,
      data: {
        status: "matched",
        source: VOLUSIA_PARCEL_OWNERSHIP_SOURCE,
        verifiedParcelId: "2000007",
        propertyVerificationState: "PARCEL_VERIFIED",
        parcel: normalized,
        retrievedAt,
      },
    });

    render(<VolusiaCircuitForeclosureDiscovery />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refresh Foreclosure Preview" }));
    });
    expect(fetchParcel).not.toHaveBeenCalled();
    expect(screen.getByText(/Party\/report address \(NOT VERIFIED PROPERTY ADDRESS\):/)).toHaveTextContent(
      "10 PARTY LANE DELAND FL 32720"
    );
    fireEvent.change(screen.getByLabelText("Independently verified Volusia PARID"), {
      target: { value: "10 PARTY" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Attach Verified Parcel ID" }));
    expect(fetchParcel).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("independently verified");

    fireEvent.change(screen.getByLabelText("Independently verified Volusia PARID"), {
      target: { value: "2000007" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Attach Verified Parcel ID" }));
    });
    expect(fetchParcel).toHaveBeenCalledOnce();
    expect(fetchParcel).toHaveBeenCalledWith("2000007");
    expect(screen.getByText(/Property verification state: PARCEL_VERIFIED/)).toBeInTheDocument();
    expect(screen.getByText(/Verified situs address:/)).toHaveTextContent(
      "100 VERIFIED AVE, DELAND FL 32720"
    );
    expect(screen.getByText(/Party\/report address/)).not.toHaveTextContent("100 VERIFIED AVE");
    expect(screen.getByText(/Just-value context \(not ARV\):/)).toBeInTheDocument();
    expect(screen.getByText(/Latest recorded sale \(not current value\):/)).toBeInTheDocument();
    expect(screen.getByText(/Source: volusia-parcel-ownership/)).toHaveTextContent(
      `Retrieved: ${retrievedAt}`
    );

    expect(FUNCTION_AUTHORIZATION_MATRIX["volusia-parcel-ownership"]).toMatchObject({
      classification: "user-authenticated-api",
      tenant: true,
      mutation: false,
    });
    expect(
      normalizeOcpaFeature({ attributes: { OBJECTID: 1, PARCEL: "302430266507203" } }, retrievedAt).source
    ).toBe("orange-county-property-appraiser");
    expect(normalizeTaxSaleFeature({ attributes: { ObjectID: 1, USER_TDA_NUM: "TDA-UNCHANGED" } }, retrievedAt).candidate.externalId).toBe("orange-county-tax-sale:tda-unchanged");
    expect(normalizeCodeEnforcementFeature({ attributes: { ObjectID: 1, CRM_SR_: "CRM-UNCHANGED" } }, retrievedAt).candidate.externalId).toBe("orange-county-code-enforcement:crm-unchanged");
    expect(normalizeCodeEnforcementLienFeature({ attributes: { ObjectID: 1, CRM_SR_: "LIEN-UNCHANGED" } }, retrievedAt).candidate.externalId).toBe("orange-county-code-enforcement-lien:crm:lien-unchanged");
    expect(normalizeCondemnationFeature({ attributes: { ObjectID: 1, CASE_: "C-UNCHANGED" } }, retrievedAt).candidate.externalId).toBe("orange-county-condemnation:c-unchanged");
    expect(normalizeWaterCaseFeature({ attributes: { ObjectID: 1, CRM_SR: "WATER-UNCHANGED" } }, retrievedAt).candidate.externalId).toBe("orange-county-water-case:water-unchanged");

    const implementation = [
      "src/components/VolusiaCircuitForeclosureDiscovery.jsx",
      "src/services/leadDiscovery/volusiaParcelOwnershipSource.js",
      "netlify/functions/volusia-parcel-ownership.js",
      "netlify/functions/_shared/volusia-parcel-ownership.cjs",
    ]
      .map((path) => readFileSync(path, "utf8"))
      .join("\n")
      .toLowerCase();
    expect(implementation).not.toMatch(
      /persistimporteddeals|createdeal|rentcast|send-sms|send-email|seller_tasks|from\(["']deals|from\(["']seller_tasks/
    );
  }, 40000);
});
