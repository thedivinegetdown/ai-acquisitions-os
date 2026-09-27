import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
  VOLUSIA_TAX_DEED_INQUIRY_URL,
  VOLUSIA_TAX_DEED_SALE_SOURCE,
  VOLUSIA_TAX_DEED_SERVICE_URL,
  buildExternalIdentity,
  fetchVolusiaTaxDeedSalePreview,
  normalizeTaxDeedParcelNumber,
  parseTaxDeedSoap,
} = require("../../../netlify/functions/_shared/volusia-tax-deed-sale.cjs");
const {
  normalizeVolusiaParcelFeature,
} = require("../../../netlify/functions/_shared/volusia-parcel-ownership.cjs");
const {
  buildExternalIdentity: buildForeclosureIdentity,
} = require("../../../netlify/functions/_shared/volusia-circuit-foreclosure.cjs");
const {
  createHandler,
} = require("../../../netlify/functions/volusia-tax-deed-sale.js");
const {
  FUNCTION_AUTHORIZATION_MATRIX,
} = require("../../../netlify/functions/_shared/function-inventory.cjs");

const { fetchCandidates } = vi.hoisted(() => ({ fetchCandidates: vi.fn() }));

vi.mock("../../services/leadDiscovery/volusiaTaxDeedSaleSource", () => ({
  VOLUSIA_TAX_DEED_SALE_SOURCE: "volusia-tax-deed-sale",
  fetchVolusiaTaxDeedSaleCandidates: fetchCandidates,
}));

import VolusiaTaxDeedSaleDiscovery from "../VolusiaTaxDeedSaleDiscovery";

const retrievedAt = "2026-09-26T18:00:00.000Z";
const inquiryHtml = `
  <html><select id="ctl00_Content1_saleDates_tx">
    <option value=" 10/13/2026">10/13/2026</option>
    <option value=" 09/15/2026">09/15/2026</option>
    <option value=" 09/01/2026">09/01/2026</option>
  </select></html>`;

function row({ certNum, parcel, status = "SOLD", openBid = "$  1061.49" }) {
  return `<taxDeeds><certNum>${certNum}</certNum><saleDate>09/15/2026</saleDate><parcel>${parcel}</parcel><status>${status}</status><statusDate>09/15/2026</statusDate><openBid>${openBid}</openBid><highBid></highBid><surplus /></taxDeeds>`;
}

function soap(rows) {
  const fields = ["certNum", "saleDate", "parcel", "status", "statusDate", "openBid", "highBid", "surplus"]
    .map((name) => `<xs:element name="${name}" type="xs:string" minOccurs="0" />`)
    .join("");
  return `<?xml version="1.0"?><soap:Envelope><soap:Body><get_taxDeedtableResponse><get_taxDeedtableResult><xs:schema>${fields}</xs:schema><diffgr:diffgram><DocumentElement>${rows.join("")}</DocumentElement></diffgr:diffgram></get_taxDeedtableResult></get_taxDeedtableResponse></soap:Body></soap:Envelope>`;
}

const parcelAttributes = {
  PARID: "2077336",
  PID: "793601000420",
  DORPID: "29173601000420",
  ADDRFULL: "100 VERIFIED AVE",
  CITYNAME: "DELAND",
  STATECODE: "FL",
  ZIP1: "32720",
  OWNER1: "OWNER ONE",
  OWNER2: null,
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

function textResponse(value) {
  return { ok: true, status: 200, text: async () => value };
}

function jsonResponse(value) {
  return { ok: true, status: 200, json: async () => value };
}

describe("Volusia Tax Deed Sales focused acceptance", () => {
  it("proves bounded Clerk retrieval, stable identity, exact Source #8 reuse, safe mismatch, preview-only labeling, and zero side effects", async () => {
    const sourceRows = [
      row({ certNum: "411-24", parcel: "793601000420" }),
      row({ certNum: "1188-24", parcel: "BAD-PARCEL", status: "REDEEMED", openBid: "$   8811.45" }),
      row({ certNum: "", parcel: "700803020150", status: "REDEEMED", openBid: "$  12102.45" }),
    ];
    const requests = [];
    const sourceFetch = vi.fn(async (url, options = {}) => {
      requests.push({ url: String(url), options });
      if (url === VOLUSIA_TAX_DEED_INQUIRY_URL) return textResponse(inquiryHtml);
      if (url === `${VOLUSIA_TAX_DEED_SERVICE_URL}/getCount_taxDeedTable`) {
        expect(JSON.parse(options.body)).toEqual({ cert: "", parcel: "", sale: "09/15/2026" });
        return jsonResponse({ d: 3 });
      }
      if (url === VOLUSIA_TAX_DEED_SERVICE_URL) {
        expect(options.headers.SOAPAction).toContain("get_taxDeedtable");
        expect(options.body).toContain("<sale>09/15/2026</sale>");
        expect(options.body).toContain("<maxRows>3</maxRows>");
        expect(options.body).toContain("<startRows>0</startRows>");
        return textResponse(soap(sourceRows));
      }
      const parsed = new URL(url);
      expect(parsed.hostname).toBe("maps5.vcgov.org");
      expect(parsed.searchParams.get("where")).toBe("PID IN ('793601000420')");
      expect(parsed.searchParams.get("returnGeometry")).toBe("false");
      return jsonResponse({ features: [{ attributes: parcelAttributes }] });
    });

    const preview = await fetchVolusiaTaxDeedSalePreview({
      saleDateLimit: 1,
      fetchImpl: sourceFetch,
      retrievedAt,
    });
    expect(preview).toMatchObject({
      status: "available",
      source: VOLUSIA_TAX_DEED_SALE_SOURCE,
      retrievedAt,
      previewLimit: 50,
      saleWindow: [{ saleDate: "2026-09-15", recordCount: 3 }],
    });
    expect(preview.candidates).toHaveLength(2);
    expect(preview.rejected).toHaveLength(1);
    expect(preview.rejected[0].rejectionReasons).toContain("missing or malformed certificate number");
    expect(preview.candidates.map((candidate) => candidate.externalId)).toEqual([
      "volusia-tax-deed-sale:1188-24",
      "volusia-tax-deed-sale:411-24",
    ]);

    const exact = preview.candidates.find((candidate) => candidate.certificateNumber === "411-24");
    expect(exact).toMatchObject({
      parcelNumber: "793601000420",
      saleDate: "2026-09-15",
      status: "SOLD",
      openingBid: 1061.49,
      opportunityType: "TAX DEED SALE / AUCTION OPPORTUNITY",
      propertyVerificationState: "PARCEL_VERIFIED",
      parcelEnrichment: {
        status: "matched",
        source: "volusia-parcel-ownership",
        verifiedParcelId: "2077336",
        parcel: { parcelId: "2077336", situsAddress: { addressLine: "100 VERIFIED AVE" } },
      },
    });
    const malformed = preview.candidates.find((candidate) => candidate.certificateNumber === "1188-24");
    expect(malformed).toMatchObject({
      propertyVerificationState: "UNVERIFIED",
      parcelEnrichment: { status: "invalid", parcel: null },
    });
    expect(normalizeTaxDeedParcelNumber("793601000420")).toBe("793601000420");
    expect(normalizeTaxDeedParcelNumber("7936-010-00420")).toBeNull();
    expect(normalizeVolusiaParcelFeature({ attributes: parcelAttributes }, retrievedAt).parcelId).toBe("2077336");

    const repeated = parseTaxDeedSoap(soap(sourceRows), { retrievedAt });
    expect(repeated.candidates.map((candidate) => candidate.externalId).sort()).toEqual(
      preview.candidates.map((candidate) => candidate.externalId).sort()
    );
    expect(buildExternalIdentity(" 411-24 ")).toBe("volusia-tax-deed-sale:411-24");
    expect(buildForeclosureIdentity("2026 10001 CIDL")).toBe("volusia-circuit-foreclosure:202610001cidl");
    expect(() => parseTaxDeedSoap(soap(sourceRows).replace("<openBid>", "<changedBid>"), { retrievedAt }))
      .toThrow("response structure changed");
    expect(requests.some(({ url }) => /rentcast/i.test(url))).toBe(false);

    const authorize = vi.fn(async () => ({ context: { organizationId: "org-1" } }));
    const sourceRequest = vi.fn(async () => preview);
    const handler = createHandler({ authorize, sourceRequest, clock: () => retrievedAt });
    const response = await handler({ httpMethod: "POST", headers: {}, body: "{}" });
    expect(response.statusCode).toBe(200);
    expect(sourceRequest).toHaveBeenCalledWith({ saleDateLimit: 1, retrievedAt });
    expect(FUNCTION_AUTHORIZATION_MATRIX["volusia-tax-deed-sale"]).toEqual({
      classification: "user-authenticated-api",
      tenant: true,
      mutation: false,
    });

    fetchCandidates.mockResolvedValue({ success: true, data: preview });
    render(<VolusiaTaxDeedSaleDiscovery />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refresh Tax Deed Preview" }));
    });
    expect(screen.getAllByText("TAX DEED SALE / AUCTION OPPORTUNITY")).toHaveLength(2);
    expect(screen.getByText(/not a direct seller-motivation lead/i)).toBeInTheDocument();
    expect(screen.getByText(/Source #8 PARID: 2077336/)).toBeInTheDocument();
    expect(screen.getByText(/Parcel verification: UNVERIFIED \(invalid\)/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create|import|deal/i })).not.toBeInTheDocument();

    const implementation = [
      "netlify/functions/_shared/volusia-tax-deed-sale.cjs",
      "netlify/functions/volusia-tax-deed-sale.js",
      "src/services/leadDiscovery/volusiaTaxDeedSaleSource.js",
      "src/components/VolusiaTaxDeedSaleDiscovery.jsx",
    ].map((path) => readFileSync(path, "utf8")).join("\n").toLowerCase();
    expect(implementation).not.toMatch(
      /persistimporteddeals|createdeal|rentcast|send-sms|send-email|from\(["']deals|from\(["']seller_tasks/
    );
  });
});
