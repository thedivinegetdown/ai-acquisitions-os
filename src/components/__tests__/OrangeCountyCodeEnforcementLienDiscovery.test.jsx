import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
  CODE_ENFORCEMENT_LIEN_FIELDS,
  CODE_ENFORCEMENT_LIEN_LAYER_URL,
  fetchOrangeCountyCodeEnforcementLienPage,
  normalizeCodeEnforcementLienFeature,
} = require("../../../netlify/functions/_shared/orange-county-code-enforcement-lien.cjs");
const {
  enrichCandidatesWithOcpa,
  enrichTaxSaleCandidatesWithOcpa,
} = require("../../../netlify/functions/_shared/orange-county-property-appraiser.cjs");
const {
  normalizeCodeEnforcementFeature,
} = require("../../../netlify/functions/_shared/orange-county-code-enforcement.cjs");
const {
  normalizeTaxSaleFeature,
} = require("../../../netlify/functions/_shared/orange-county-tax-sale.cjs");
const {
  createHandler,
} = require("../../../netlify/functions/orange-county-code-enforcement-lien.js");
const {
  FUNCTION_AUTHORIZATION_MATRIX,
} = require("../../../netlify/functions/_shared/function-inventory.cjs");

const { fetchCandidates } = vi.hoisted(() => ({
  fetchCandidates: vi.fn(),
}));

vi.mock("../../services/leadDiscovery/orangeCountyCodeEnforcementLienSource", () => ({
  ORANGE_COUNTY_CODE_ENFORCEMENT_LIEN_SOURCE:
    "orange-county-code-enforcement-lien",
  fetchOrangeCountyCodeEnforcementLienCandidates: fetchCandidates,
}));

import OrangeCountyCodeEnforcementLienDiscovery from "../OrangeCountyCodeEnforcementLienDiscovery";

const retrievedAt = "2026-09-26T20:00:00.000Z";

function feature(objectId, crmId, permitId, parcel, balance, overrides = {}) {
  return {
    attributes: {
      ObjectID: objectId,
      Permits_Pl: permitId,
      CRM_SR_: crmId,
      ADDRESS: "123 LIEN ST",
      PARCEL_NO: parcel,
      BALANCE: balance,
      ...overrides,
    },
  };
}

function ocpaFeature(objectId, parcel, owner = "EVIDENCED OWNER") {
  return {
    attributes: {
      OBJECTID: objectId,
      PARCEL: parcel,
      NAME1: owner,
      SITUS: "123 LIEN ST",
      SITUS_CITY: "Orlando",
      SITUS_ZIP: "32801",
      DOR_CODE: "0100",
      BEDS: 3,
      BATH: 2,
      LIVING_AREA: 1400,
      AYB: 1999,
      ACREAGE: 0.2,
      ZONING_CODE: "R-1",
      TOTAL_MKT: 300000,
      TOTAL_ASSD: 240000,
    },
  };
}

describe("Orange County Active CE Liens focused acceptance", () => {
  it("proves live fetch, normalization, dedupe, pagination, exact OCPA reuse, fail-safe preview, and no mutations", async () => {
    expect(CODE_ENFORCEMENT_LIEN_LAYER_URL).toContain(
      "CodeEnforcementCasesMapService/FeatureServer/3/query"
    );
    expect(CODE_ENFORCEMENT_LIEN_FIELDS).toEqual([
      "ObjectID",
      "Permits_Pl",
      "CRM_SR_",
      "ADDRESS",
      "PARCEL_NO",
      "BALANCE",
    ]);

    const live = await fetchOrangeCountyCodeEnforcementLienPage({
      pageSize: 2,
      parcelFetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ features: [] }),
      }),
    });
    expect(live).toMatchObject({
      status: "available",
      source: "orange-county-code-enforcement-lien",
      page: { cursor: 0, pageSize: 2, sourceRowCount: 2 },
    });
    expect(live.candidates.length).toBeGreaterThan(0);
    expect(live.candidates[0]).toEqual(
      expect.objectContaining({
        lienCaseId: expect.any(String),
        reportedLienBalance: expect.any(Number),
        retrievedAt: expect.any(String),
      })
    );

    const preferred = normalizeCodeEnforcementLienFeature(
      feature(1, " CRM-100 ", "CE-OLD", "30-24-30-2665-07-203", 62010.25),
      retrievedAt
    );
    const evidencedFallback = normalizeCodeEnforcementLienFeature(
      feature(2, "0", " CE19006184-CBS ", "NULL", "malformed", {
        ADDRESS: "  7914   WOODGROVE CIR ",
      }),
      retrievedAt
    );
    const missingIdentity = normalizeCodeEnforcementLienFeature(
      feature(3, "NULL", null, "30-24-30-2665-07-203", 100),
      retrievedAt
    );

    expect(preferred).toMatchObject({
      accepted: true,
      candidate: {
        externalId: "orange-county-code-enforcement-lien:crm:crm-100",
        lienCaseId: "CRM-100",
        caseIdentityField: "CRM_SR_",
        crmServiceRequestId: "CRM-100",
        permitsPlanningCaseId: "CE-OLD",
        address: "123 LIEN ST",
        parcelNumber: "30-24-30-2665-07-203",
        reportedLienBalance: 62010.25,
        source: "orange-county-code-enforcement-lien",
        retrievedAt,
        reviewState: "preview",
      },
    });
    expect(evidencedFallback).toMatchObject({
      accepted: true,
      candidate: {
        externalId: "orange-county-code-enforcement-lien:permit:ce19006184-cbs",
        lienCaseId: "CE19006184-CBS",
        caseIdentityField: "Permits_Pl",
        address: "7914 WOODGROVE CIR",
        parcelNumber: null,
        reportedLienBalance: null,
      },
    });
    expect(missingIdentity).toMatchObject({
      accepted: false,
      rejectionReasons: ["missing stable lien identity"],
      candidate: { externalId: "" },
    });

    const sourceFetch = vi.fn(async (url) => {
      const parsed = new URL(url);
      if (parsed.hostname === "vgispublic.ocpafl.org") {
        const where = parsed.searchParams.get("where");
        const features = [];
        if (where.includes("302430266507203")) {
          features.push(ocpaFeature(1, "302430266507203"));
        }
        if (where.includes("302431486002032")) {
          features.push(
            ocpaFeature(2, "302431486002032", "FIRST POSSIBLE OWNER"),
            ocpaFeature(3, "302431486002032", "SECOND POSSIBLE OWNER")
          );
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ features }),
        };
      }

      const query = parsed.searchParams;
      const cursor = Number(query.get("where").split(">")[1]);
      expect(query.get("orderByFields")).toBe("ObjectID ASC");
      expect(query.get("returnGeometry")).toBe("false");
      expect(query.get("resultRecordCount")).toBe("4");
      return {
        ok: true,
        status: 200,
        json: async () =>
          cursor === 0
            ? {
                exceededTransferLimit: true,
                features: [
                  feature(10, "CRM-100", "CE-100", "30-24-30-2665-07-203", 62010.25),
                  feature(11, " crm-100 ", "CE-DUP", "32-22-30-9000-15-940", 999),
                  feature(12, "0", "CE-200", "NULL", "not-a-number"),
                  feature(13, "NULL", "NULL", "30-24-30-2665-07-203", 100),
                ],
              }
            : {
                exceededTransferLimit: false,
                features: [
                  feature(14, "CRM-300", "CE-300", "30-24-31-4860-02-032", 66),
                  feature(15, "NULL", "CE-400", "32-22-30-9000-15-940", 0),
                ],
              },
      };
    });

    const first = await fetchOrangeCountyCodeEnforcementLienPage({
      cursor: 0,
      pageSize: 4,
      fetchImpl: sourceFetch,
      retrievedAt,
    });
    const repeated = await fetchOrangeCountyCodeEnforcementLienPage({
      cursor: 0,
      pageSize: 4,
      fetchImpl: sourceFetch,
      retrievedAt,
    });
    const second = await fetchOrangeCountyCodeEnforcementLienPage({
      cursor: first.page.nextCursor,
      pageSize: 4,
      fetchImpl: sourceFetch,
      retrievedAt,
    });

    expect(first.page).toMatchObject({ cursor: 0, nextCursor: 13, hasMore: true });
    expect(second.page).toMatchObject({ cursor: 13, nextCursor: null, hasMore: false });
    expect(first.candidates.map((row) => row.externalId)).toEqual(
      repeated.candidates.map((row) => row.externalId)
    );
    expect(first.rejected.map((row) => row.rejectionReasons)).toEqual([
      ["duplicate external identity"],
      ["missing stable lien identity"],
    ]);
    expect(first.candidates.map((row) => row.enrichment.status)).toEqual([
      "matched",
      "unmatched",
    ]);
    expect(second.candidates.map((row) => row.enrichment.status)).toEqual([
      "ambiguous",
      "unmatched",
    ]);
    expect(first.candidates[0].enrichment.owner).toBe("EVIDENCED OWNER");
    expect(first.candidates[1]).toMatchObject({
      parcelNumber: null,
      reportedLienBalance: null,
      enrichment: { status: "unmatched", parcelId: "", matchCount: 0 },
    });
    expect(second.candidates[0].enrichment).not.toHaveProperty("owner");
    expect(second.candidates[1]).toMatchObject({ reportedLienBalance: 0 });
    const allExternalIds = [...first.candidates, ...second.candidates].map(
      (row) => row.externalId
    );
    expect(new Set(allExternalIds).size).toBe(allExternalIds.length);
    expect(enrichCandidatesWithOcpa).toBe(enrichTaxSaleCandidatesWithOcpa);

    const unavailableHandler = createHandler({
      authorize: vi.fn().mockResolvedValue({ context: { organizationId: "org-1" } }),
      sourceRequest: vi.fn().mockRejectedValue(new Error("upstream failed")),
    });
    const unavailable = await unavailableHandler({
      httpMethod: "POST",
      body: JSON.stringify({ cursor: 0, pageSize: 4 }),
      headers: {},
    });
    expect(JSON.parse(unavailable.body)).toMatchObject({
      success: false,
      status: "unavailable",
      candidates: [],
      rejected: [],
    });

    fetchCandidates.mockResolvedValue({
      success: true,
      data: {
        status: "available",
        retrievedAt,
        candidates: [first.candidates[0]],
        rejected: [],
        page: { cursor: 0, nextCursor: null, hasMore: false },
      },
    });
    render(<OrangeCountyCodeEnforcementLienDiscovery />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refresh CE Lien Preview" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refresh CE Lien Preview" }));
    });
    expect(fetchCandidates).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText("CRM-100")).toHaveLength(1);
    expect(screen.getByText(/Address: 123 LIEN ST/)).toHaveTextContent(
      "Parcel: 30-24-30-2665-07-203"
    );
    expect(screen.getByText(/Reported lien balance: \$62,010.25/)).toHaveTextContent(
      "Source: orange-county-code-enforcement-lien"
    );
    expect(screen.getByText(new RegExp(`^Retrieved: ${retrievedAt}`))).toHaveTextContent(
      "OCPA: matched"
    );
    expect(screen.getByText(/Owner: EVIDENCED OWNER/)).toBeInTheDocument();
    expect(screen.getByText(/OCPA market\/assessment: \$300,000.00 \/ \$240,000.00/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create|import|pipeline|enrich|message|task/i })).not.toBeInTheDocument();

    expect(
      normalizeTaxSaleFeature(
        { attributes: { ObjectID: 1, USER_TDA_NUM: "TDA-UNCHANGED", USER_PARCEL: "PARCEL-1" } },
        retrievedAt
      ).candidate.externalId
    ).toBe("orange-county-tax-sale:tda-unchanged");
    expect(
      normalizeCodeEnforcementFeature(
        { attributes: { ObjectID: 1, CRM_SR_: "CRM-UNCHANGED" } },
        retrievedAt
      ).candidate.externalId
    ).toBe("orange-county-code-enforcement:crm-unchanged");
    expect(FUNCTION_AUTHORIZATION_MATRIX["orange-county-tax-sale"].mutation).toBe(false);
    expect(FUNCTION_AUTHORIZATION_MATRIX["orange-county-code-enforcement"].mutation).toBe(false);
    expect(FUNCTION_AUTHORIZATION_MATRIX["orange-county-code-enforcement-lien"]).toMatchObject({
      classification: "user-authenticated-api",
      tenant: true,
      mutation: false,
    });

    const implementation = [
      "src/components/OrangeCountyCodeEnforcementLienDiscovery.jsx",
      "src/services/leadDiscovery/orangeCountyCodeEnforcementLienSource.js",
      "netlify/functions/orange-county-code-enforcement-lien.js",
      "netlify/functions/_shared/orange-county-code-enforcement-lien.cjs",
    ]
      .map((path) => readFileSync(path, "utf8"))
      .join("\n")
      .toLowerCase();
    expect(implementation).not.toMatch(
      /persistimporteddeals|createdeal|rentcast|send-sms|send-email|seller_tasks|from\(["']deals|from\(["']seller_tasks/
    );
  }, 20000);
});
