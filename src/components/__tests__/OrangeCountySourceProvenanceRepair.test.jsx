import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const XLSX = require("@e965/xlsx");
const {
  CODE_ENFORCEMENT_JURISDICTION_EVIDENCE_URL,
  CODE_ENFORCEMENT_SOURCE_URL,
  fetchOrangeCountyCodeEnforcementPage,
} = require("../../../netlify/functions/_shared/orange-county-code-enforcement.cjs");
const {
  CODE_ENFORCEMENT_LIEN_UNAVAILABLE_REASON,
  fetchOrangeCountyCodeEnforcementLienPage,
} = require("../../../netlify/functions/_shared/orange-county-code-enforcement-lien.cjs");
const {
  CONDEMNATION_UNAVAILABLE_REASON,
  fetchOrangeCountyCondemnationPage,
} = require("../../../netlify/functions/_shared/orange-county-condemnation.cjs");
const {
  WATER_CASE_UNAVAILABLE_REASON,
  fetchOrangeCountyWaterCasePage,
} = require("../../../netlify/functions/_shared/orange-county-water-case.cjs");
const {
  OCPA_LAYER_URL,
} = require("../../../netlify/functions/_shared/orange-county-property-appraiser.cjs");
const {
  TAX_SALE_LAYER_URL,
  normalizeTaxSaleFeature,
} = require("../../../netlify/functions/_shared/orange-county-tax-sale.cjs");
const {
  VOLUSIA_CONNECTLIVE_TRANSACTION_URL,
} = require("../../../netlify/functions/_shared/volusia-code-compliance.cjs");
const {
  VOLUSIA_TAX_DEED_SERVICE_URL,
} = require("../../../netlify/functions/_shared/volusia-tax-deed-sale.cjs");
const {
  createHandler: createLienHandler,
} = require("../../../netlify/functions/orange-county-code-enforcement-lien.js");
const {
  createHandler: createCondemnationHandler,
} = require("../../../netlify/functions/orange-county-condemnation.js");
const {
  createHandler: createWaterHandler,
} = require("../../../netlify/functions/orange-county-water-case.js");

const retrievedAt = "2026-09-26T16:00:00.000Z";

function officialWorkbookBuffer() {
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["", "", "", "Open Active Code Enforcement Cases"],
    ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "Violation Recorded Date"],
    [
      "Incident ID",
      "",
      "",
      "",
      "Parcel ID",
      "",
      "",
      "Incident Address",
      "",
      "Incident Type",
      "",
      "Incident Status",
    ],
    [30, "", "", "", "272228000000030", "", "", "30 ORANGE BLOSSOM TRL", "", "Housing", "", "Enforcement", "", "", "09/26/2026"],
    [10, "", "", "", "282234729401710", "", "", "10 GOLDLEAF STREET", "", "Lot Cleaning", "", "Assigned", "", "", "09/24/2026"],
    [20, "", "", "", "292310742802120", "", "", "20 AUBURNDALE AVENUE", "", "Zoning", "", "Lien", "", "", "09/25/2026"],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  return XLSX.write(workbook, { type: "buffer", bookType: "xls" });
}

function ocpaFeature(parcel) {
  return {
    attributes: {
      OBJECTID: 1,
      PARCEL: parcel,
      NAME1: "ORANGE COUNTY OWNER",
      SITUS: "ORLANDO ADDRESS",
      SITUS_CITY: "Orlando",
      SITUS_ZIP: "32801",
    },
  };
}

function authenticatedHandlerEvent() {
  return {
    httpMethod: "POST",
    body: JSON.stringify({ cursor: 0, pageSize: 10 }),
    headers: {},
  };
}

describe("Orange County source provenance repair", () => {
  it("uses the official Orange workbook, enriches only exact OCPA parcels, and disables unproven sources", async () => {
    expect(CODE_ENFORCEMENT_SOURCE_URL).toBe(
      "https://apps.ocfl.net/dept/cesrvcs/codeenforcement/ActiveCodeEnforcementCases.xls"
    );
    expect(CODE_ENFORCEMENT_JURISDICTION_EVIDENCE_URL).toContain(
      "www.orangecountyfl.net/"
    );

    const sourceFetch = vi.fn(async (url, options) => {
      expect(url).toBe(CODE_ENFORCEMENT_SOURCE_URL);
      expect(options).toMatchObject({
        method: "GET",
        headers: { Accept: "application/vnd.ms-excel" },
      });
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => officialWorkbookBuffer(),
      };
    });
    const parcelFetch = vi.fn(async (url) => {
      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe(new URL(OCPA_LAYER_URL).origin + new URL(OCPA_LAYER_URL).pathname);
      const where = parsed.searchParams.get("where");
      const parcels = [...where.matchAll(/'(\d{15})'/g)].map((match) => match[1]);
      expect(parcels).toEqual(["282234729401710", "292310742802120"]);
      return {
        ok: true,
        status: 200,
        json: async () => ({ features: parcels.map(ocpaFeature) }),
      };
    });

    const page = await fetchOrangeCountyCodeEnforcementPage({
      cursor: 0,
      pageSize: 2,
      fetchImpl: sourceFetch,
      parcelFetchImpl: parcelFetch,
      retrievedAt,
    });

    expect(page).toMatchObject({
      status: "available",
      source: "orange-county-code-enforcement",
      sourceUrl: CODE_ENFORCEMENT_SOURCE_URL,
      jurisdiction: {
        county: "Orange County",
        state: "Florida",
        country: "US",
        evidenceUrl: CODE_ENFORCEMENT_JURISDICTION_EVIDENCE_URL,
      },
      page: { cursor: 0, nextCursor: 20, pageSize: 2, sourceRowCount: 2, hasMore: true },
    });
    expect(page.candidates).toEqual([
      expect.objectContaining({
        externalId: "orange-county-code-enforcement:10",
        sourceRecordId: 10,
        caseIdentityField: "Incident ID",
        parcelNumber: "282234729401710",
        address: "10 GOLDLEAF STREET",
        reviewState: "preview",
        sourceJurisdiction: expect.objectContaining({ county: "Orange County" }),
        enrichment: expect.objectContaining({
          status: "matched",
          source: "orange-county-property-appraiser",
          parcelId: "282234729401710",
        }),
      }),
      expect.objectContaining({
        externalId: "orange-county-code-enforcement:20",
        sourceRecordId: 20,
        parcelNumber: "292310742802120",
        address: "20 AUBURNDALE AVENUE",
        reviewState: "preview",
        enrichment: expect.objectContaining({ parcelId: "292310742802120" }),
      }),
    ]);
    expect(JSON.stringify(page).toLowerCase()).not.toMatch(
      /hillsborough|services\.arcgis\.com\/aptfc6sumnnfnxuf/
    );
    expect(sourceFetch).toHaveBeenCalledTimes(1);
    expect(parcelFetch).toHaveBeenCalledTimes(1);

    const disabledSources = [
      [fetchOrangeCountyCodeEnforcementLienPage, CODE_ENFORCEMENT_LIEN_UNAVAILABLE_REASON],
      [fetchOrangeCountyCondemnationPage, CONDEMNATION_UNAVAILABLE_REASON],
      [fetchOrangeCountyWaterCasePage, WATER_CASE_UNAVAILABLE_REASON],
    ];
    for (const [fetchSource, reason] of disabledSources) {
      const forbiddenFetch = vi.fn();
      await expect(fetchSource({ fetchImpl: forbiddenFetch })).rejects.toMatchObject({
        status: 503,
        message: reason,
      });
      expect(forbiddenFetch).not.toHaveBeenCalled();
    }

    const authorize = vi.fn().mockResolvedValue({ context: { organizationId: "org-1" } });
    for (const createHandler of [
      createLienHandler,
      createCondemnationHandler,
      createWaterHandler,
    ]) {
      const response = await createHandler({ authorize })(authenticatedHandlerEvent());
      expect(response.statusCode).toBe(503);
      expect(JSON.parse(response.body)).toMatchObject({
        success: false,
        status: "unavailable",
        candidates: [],
        rejected: [],
      });
      expect(JSON.parse(response.body).error).toMatch(/^UNAVAILABLE:/);
    }

    const sourceImplementation = [
      "netlify/functions/_shared/orange-county-code-enforcement.cjs",
      "netlify/functions/_shared/orange-county-code-enforcement-lien.cjs",
      "netlify/functions/_shared/orange-county-condemnation.cjs",
      "netlify/functions/_shared/orange-county-water-case.cjs",
      "netlify/functions/orange-county-code-enforcement.js",
      "netlify/functions/orange-county-code-enforcement-lien.js",
      "netlify/functions/orange-county-condemnation.js",
      "netlify/functions/orange-county-water-case.js",
    ]
      .map((path) => readFileSync(path, "utf8"))
      .join("\n")
      .toLowerCase();
    expect(sourceImplementation).not.toMatch(
      /persistimporteddeals|createdeal|rentcast|send-sms|send-email|seller_tasks|from\(["']deals/
    );

    expect(TAX_SALE_LAYER_URL).toBe(
      "https://services1.arcgis.com/0U8EQ1FrumPeIqDb/ArcGIS/rest/services/Tax_Sale_Data/FeatureServer/0/query"
    );
    expect(
      normalizeTaxSaleFeature(
        { attributes: { ObjectID: 1, USER_TDA_NUM: "TDA-UNCHANGED", USER_PARCEL: "PARCEL-1" } },
        retrievedAt
      ).candidate.externalId
    ).toBe("orange-county-tax-sale:tda-unchanged");
    expect(OCPA_LAYER_URL).toBe(
      "https://vgispublic.ocpafl.org/server/rest/services/DynamicForJs/PARCEL/MapServer/1/query"
    );
    expect(VOLUSIA_CONNECTLIVE_TRANSACTION_URL).toContain(
      "connectlivepermits.org/citizenportal/rest/amandaservice/executeCustomTransaction/"
    );
    expect(VOLUSIA_TAX_DEED_SERVICE_URL).toBe(
      "https://app02.clerk.org/or_td/TaxDeedService.asmx"
    );
  });
});
