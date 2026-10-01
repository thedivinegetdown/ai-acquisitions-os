import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { beforeEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
  fetchOrangeCountyTaxSalePage,
  normalizeTaxSalePage,
} = require("../../../netlify/functions/_shared/orange-county-tax-sale.cjs");
const {
  enrichTaxSaleCandidatesWithOcpa,
  normalizeParcelId,
} = require("../../../netlify/functions/_shared/orange-county-property-appraiser.cjs");
const { createHandler } = require("../../../netlify/functions/orange-county-tax-sale.js");

const { fetchCandidates } = vi.hoisted(() => ({
  fetchCandidates: vi.fn(),
}));

vi.mock("../../services/leadDiscovery/orangeCountyTaxSaleSource", () => ({
  ORANGE_COUNTY_TAX_SALE_SOURCE: "orange-county-tax-sale",
  fetchOrangeCountyTaxSaleCandidates: fetchCandidates,
}));

import OrangeCountyTaxSaleDiscovery from "../OrangeCountyTaxSaleDiscovery";

const retrievedAt = "2026-09-26T14:00:00.000Z";

function feature(objectId, tda, parcel, saleDate = "10/15/2026", status = "Scheduled") {
  return {
    attributes: {
      ObjectID: objectId,
      USER_TDA_NUM: tda,
      USER_PARCEL: parcel,
      USER_Sale_Date: saleDate,
      USER_Deed_Status: status,
    },
  };
}

function responseBody(response) {
  return JSON.parse(response.body);
}

function ocpaFeature(objectId, parcel, overrides = {}) {
  return {
    attributes: {
      OBJECTID: objectId,
      PARCEL: parcel,
      NAME1: "OWNER ONE",
      NAME2: "OWNER TWO",
      PROP_NAME: "EXAMPLE PROPERTY",
      DOR_CODE: "0100",
      PARCEL_CATEGORY: "R",
      BLDG_DOR_CODE: "0100",
      SITUS: "123 EXAMPLE ST",
      SITUS_CITY: "Orlando",
      SITUS_ZIP: "32801",
      STYS: 1,
      BATH: 2,
      BEDS: 3,
      LIVING_AREA: 1450,
      POOL: "N",
      AYB: 1998,
      ACREAGE: 0.21,
      ZONING_CODE: "R-1",
      TOTAL_MKT: 310000,
      TOTAL_ASSD: 250000,
      TAXABLE: 225000,
      TAXES: 3200,
      SALE_DATE: 1704067200000,
      SALE_ADJ_VALUE: 275000,
      QUAL_CODE: "Q",
      ...overrides,
    },
  };
}

describe("Orange County Tax Sale lead discovery acceptance", () => {
  beforeEach(() => {
    fetchCandidates.mockReset();
  });

  it("fetches deterministic bounded pages and returns unique normalized candidates", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.includes("DynamicForJs/PARCEL")) {
        const where = new URL(url).searchParams.get("where");
        const parcels = [...where.matchAll(/'([^']+)'/g)].map((match) => match[1]);
        return {
          ok: true,
          status: 200,
          json: async () => ({ features: parcels.map((parcel, index) => ocpaFeature(index + 1, parcel)) }),
        };
      }
      const cursor = Number(new URL(url).searchParams.get("where").split(">")[1]);
      return {
        ok: true,
        status: 200,
        json: async () =>
          cursor === 0
            ? {
                exceededTransferLimit: true,
                features: [
                  feature(1, "TDA-100", "PARCEL-100"),
                  feature(2, "TDA-100", "PARCEL-OTHER"),
                  feature(3, "TDA-300", ""),
                ],
              }
            : { exceededTransferLimit: false, features: [feature(4, "TDA-400", "PARCEL-400")] },
      };
    });

    const first = await fetchOrangeCountyTaxSalePage({
      cursor: 0,
      pageSize: 3,
      fetchImpl,
      retrievedAt,
    });
    const second = await fetchOrangeCountyTaxSalePage({
      cursor: first.page.nextCursor,
      pageSize: 3,
      fetchImpl,
      retrievedAt,
    });

    expect(first.candidates).toEqual([
      expect.objectContaining({
        source: "orange-county-tax-sale",
        externalId: "orange-county-tax-sale:tda-100",
        externalTaxDeedNumber: "TDA-100",
        parcelNumber: "PARCEL-100",
        saleDate: "10/15/2026",
        deedStatus: "Scheduled",
        retrievedAt,
        reviewState: "preview",
      }),
    ]);
    expect(first.rejected.map((row) => row.rejectionReasons)).toEqual([
      ["duplicate external identity"],
      ["missing parcel identity"],
    ]);
    expect(first.page).toMatchObject({ cursor: 0, nextCursor: 3, hasMore: true });
    expect(second.page).toMatchObject({ cursor: 3, nextCursor: null, hasMore: false });
    expect(new Set([...first.candidates, ...second.candidates].map((row) => row.externalId)).size).toBe(2);

    for (const call of fetchImpl.mock.calls.filter(([url]) => url.includes("Tax_Sale_Data"))) {
      const query = new URL(call[0]).searchParams;
      expect(query.get("orderByFields")).toBe("ObjectID ASC");
      expect(query.get("returnGeometry")).toBe("false");
      expect(Number(query.get("resultRecordCount"))).toBeLessThanOrEqual(200);
    }
  });

  it("enriches only one exact normalized parcel match and fails closed for zero or multiple matches", async () => {
    const candidates = [
      { externalId: "orange-county-tax-sale:tda-1", parcelNumber: "30-24-30-2665-07-203" },
      { externalId: "orange-county-tax-sale:tda-2", parcelNumber: "32-22-30-9000-15-940" },
      { externalId: "orange-county-tax-sale:tda-3", parcelNumber: "30-24-31-4860-02-032" },
    ];
    const fetchImpl = vi.fn(async (url) => {
      const query = new URL(url).searchParams;
      expect(query.get("where")).toBe(
        "PARCEL IN ('302430266507203','322230900015940','302431486002032')"
      );
      expect(query.get("returnGeometry")).toBe("false");
      return {
        ok: true,
        status: 200,
        json: async () => ({
          features: [
            ocpaFeature(1, "302430266507203"),
            ocpaFeature(2, "302431486002032", { NAME1: "FIRST POSSIBLE OWNER" }),
            ocpaFeature(3, "302431486002032", { NAME1: "SECOND POSSIBLE OWNER" }),
            ocpaFeature(4, "999999999999999", { NAME1: "UNRELATED OWNER" }),
          ],
        }),
      };
    });

    const enriched = await enrichTaxSaleCandidatesWithOcpa(candidates, {
      fetchImpl,
      retrievedAt,
    });

    expect(normalizeParcelId(candidates[0].parcelNumber)).toBe("302430266507203");
    expect(enriched.map((candidate) => candidate.enrichment.status)).toEqual([
      "matched",
      "unmatched",
      "ambiguous",
    ]);
    expect(enriched[0].enrichment).toMatchObject({
      source: "orange-county-property-appraiser",
      retrievedAt,
      parcelId: "302430266507203",
      owner: "OWNER ONE / OWNER TWO",
      address: "123 EXAMPLE ST",
      city: "Orlando",
      zip: "32801",
      propertyUse: { dorCode: "0100", parcelCategory: "R", buildingDorCode: "0100" },
      facts: { beds: 3, baths: 2, livingArea: 1450, yearBuilt: 1998, acreage: 0.21, zoning: "R-1" },
      assessment: { marketValue: 310000, assessedValue: 250000 },
      recentSale: { date: "2024-01-01T00:00:00.000Z", adjustedValue: 275000, qualificationCode: "Q" },
    });
    expect(enriched[1].enrichment).not.toHaveProperty("owner");
    expect(enriched[2].enrichment).toMatchObject({ matchCount: 2 });
    expect(enriched[2].enrichment).not.toHaveProperty("owner");
  });

  it("rejects every incomplete identity row instead of inventing identity", () => {
    const normalized = normalizeTaxSalePage(
      [feature(10, "", "PARCEL-10"), feature(11, "TDA-11", "")],
      retrievedAt
    );

    expect(normalized.candidates).toEqual([]);
    expect(normalized.rejected).toHaveLength(2);
    expect(normalized.rejected[0].candidate.externalId).toBe("");
    expect(normalized.rejected[0].rejectionReasons).toContain("missing TDA identity");
    expect(normalized.rejected[1].rejectionReasons).toContain("missing parcel identity");
  });

  it("fails closed with an unavailable state and no partial candidates", async () => {
    const authorize = vi.fn().mockResolvedValue({
      context: { organizationId: "org-1", role: "owner" },
      clients: { adminClient: {} },
    });
    const handler = createHandler({
      authorize,
      sourceRequest: vi.fn().mockRejectedValue(new Error("upstream failed")),
      clock: () => retrievedAt,
    });

    const response = await handler({
      httpMethod: "POST",
      body: JSON.stringify({ cursor: 0, pageSize: 100 }),
      headers: {},
    });

    expect(response.statusCode).toBe(502);
    expect(responseBody(response)).toMatchObject({
      success: false,
      status: "unavailable",
      source: "orange-county-tax-sale",
      candidates: [],
      rejected: [],
    });
  });

  it("requires tenant membership before the server adapter can fetch", async () => {
    const sourceRequest = vi.fn();
    const handler = createHandler({
      authorize: vi.fn().mockResolvedValue({
        response: {
          statusCode: 403,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ success: false, error: "Organization access denied." }),
        },
      }),
      sourceRequest,
    });

    const response = await handler({
      httpMethod: "POST",
      body: JSON.stringify({ cursor: 0, pageSize: 100 }),
      headers: {},
    });

    expect(response.statusCode).toBe(403);
    expect(sourceRequest).not.toHaveBeenCalled();
  });

  it("shows review fields, replaces repeated refreshes, and exposes no deal action", async () => {
    const page = {
      success: true,
      data: {
        status: "available",
        source: "orange-county-tax-sale",
        retrievedAt,
        candidates: [
          {
            source: "orange-county-tax-sale",
            externalId: "orange-county-tax-sale:tda-100",
            externalTaxDeedNumber: "TDA-100",
            parcelNumber: "PARCEL-100",
            saleDate: "10/15/2026",
            deedStatus: "Scheduled",
            retrievedAt,
            reviewState: "preview",
            enrichment: {
              status: "matched",
              source: "orange-county-property-appraiser",
              retrievedAt,
              parcelId: "PARCEL100",
              owner: "OWNER ONE",
              address: "123 EXAMPLE ST",
              city: "Orlando",
              zip: "32801",
              propertyUse: { dorCode: "0100" },
              facts: { beds: 3, baths: 2, livingArea: 1450, yearBuilt: 1998, acreage: 0.21, zoning: "R-1" },
              assessment: { marketValue: 310000, assessedValue: 250000 },
              recentSale: { date: "2024-01-01T00:00:00.000Z", adjustedValue: 275000 },
            },
          },
        ],
        rejected: [],
        page: { cursor: 0, nextCursor: null, hasMore: false },
      },
    };
    fetchCandidates.mockResolvedValue(page);
    render(<OrangeCountyTaxSaleDiscovery />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refresh Tax Sale Preview" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refresh Tax Sale Preview" }));
    });

    expect(fetchCandidates).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText("TDA-100")).toHaveLength(1);
    expect(screen.getByText(/Source: orange-county-tax-sale/)).toHaveTextContent(
      "Parcel: PARCEL-100 | Sale date: 10/15/2026 | Status: Scheduled"
    );
    expect(screen.getByText(/preview does not create deals/i)).toBeInTheDocument();
    expect(screen.getByText("OCPA: matched")).toBeInTheDocument();
    expect(screen.getByText(/Address: 123 EXAMPLE ST/)).toBeInTheDocument();
    expect(screen.getByText(/Owner: OWNER ONE/)).toBeInTheDocument();
    expect(screen.getByText(/OCPA market\/assessment: \$310,000 \/ \$250,000/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Enrichment source: orange-county-property-appraiser \\| Retrieved: ${retrievedAt}`))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create|import|pipeline|enrich/i })).not.toBeInTheDocument();
  });

  it("cannot write a county candidate without explicit confirmation", () => {
    const implementation = [
      readFileSync("src/components/OrangeCountyTaxSaleDiscovery.jsx", "utf8"),
      readFileSync("src/services/leadDiscovery/orangeCountyTaxSaleSource.js", "utf8"),
      readFileSync("netlify/functions/orange-county-tax-sale.js", "utf8"),
      readFileSync("netlify/functions/_shared/orange-county-tax-sale.cjs", "utf8"),
      readFileSync("netlify/functions/_shared/orange-county-property-appraiser.cjs", "utf8"),
    ].join("\n").toLowerCase();

    expect(implementation).not.toMatch(/persistimporteddeals|createdeal|rentcast|send-sms|send-email|seller_tasks/);
  });
});
