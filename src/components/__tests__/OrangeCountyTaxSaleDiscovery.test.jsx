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

describe("Orange County Tax Sale lead discovery acceptance", () => {
  beforeEach(() => {
    fetchCandidates.mockReset();
  });

  it("fetches deterministic bounded pages and returns unique normalized candidates", async () => {
    const fetchImpl = vi.fn(async (url) => {
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

    for (const call of fetchImpl.mock.calls) {
      const query = new URL(call[0]).searchParams;
      expect(query.get("orderByFields")).toBe("ObjectID ASC");
      expect(query.get("returnGeometry")).toBe("false");
      expect(Number(query.get("resultRecordCount"))).toBeLessThanOrEqual(200);
    }
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
    expect(screen.queryByRole("button", { name: /create|import|pipeline|enrich/i })).not.toBeInTheDocument();
  });

  it("contains no deal, RentCast, OCPA, messaging, or task side-effect path", () => {
    const implementation = [
      readFileSync("src/components/OrangeCountyTaxSaleDiscovery.jsx", "utf8"),
      readFileSync("src/services/leadDiscovery/orangeCountyTaxSaleSource.js", "utf8"),
      readFileSync("netlify/functions/orange-county-tax-sale.js", "utf8"),
      readFileSync("netlify/functions/_shared/orange-county-tax-sale.cjs", "utf8"),
    ].join("\n").toLowerCase();

    expect(implementation).not.toMatch(
      /persistimporteddeals|createdeal|rentcast|ocpa|send-sms|send-email|seller_tasks/
    );
  });
});
