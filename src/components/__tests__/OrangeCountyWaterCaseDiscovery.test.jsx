import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
  WATER_CASE_FIELDS,
  WATER_CASE_LAYER_URL,
  fetchOrangeCountyWaterCasePage,
  normalizeWaterCaseFeature,
} = require("../../../netlify/functions/_shared/orange-county-water-case.cjs");
const {
  enrichCandidatesWithOcpa,
  enrichTaxSaleCandidatesWithOcpa,
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
  createHandler,
} = require("../../../netlify/functions/orange-county-water-case.js");
const {
  FUNCTION_AUTHORIZATION_MATRIX,
} = require("../../../netlify/functions/_shared/function-inventory.cjs");

const { fetchCandidates } = vi.hoisted(() => ({
  fetchCandidates: vi.fn(),
}));

vi.mock("../../services/leadDiscovery/orangeCountyWaterCaseSource", () => ({
  ORANGE_COUNTY_WATER_CASE_SOURCE: "orange-county-water-case",
  fetchOrangeCountyWaterCaseCandidates: fetchCandidates,
}));

import OrangeCountyWaterCaseDiscovery from "../OrangeCountyWaterCaseDiscovery";

const retrievedAt = "2026-09-26T23:00:00.000Z";

function feature(
  objectId,
  crmReference,
  permitReference,
  parcelNumber,
  dueDate = "10/15/2026",
  status = "OPEN"
) {
  return {
    attributes: {
      ObjectID: objectId,
      CRM_SR: crmReference,
      Permits_Pl: permitReference,
      ADDRESS: `${objectId} WATER ST`,
      ZIP_CODE: "32801",
      PARCEL_NO_NO: parcelNumber,
      DUE_DATE: dueDate,
      STATUS: status,
    },
  };
}

function ocpaFeature(objectId, parcel, owner = "EVIDENCED OWNER") {
  return {
    attributes: {
      OBJECTID: objectId,
      PARCEL: parcel,
      NAME1: owner,
      SITUS: "10 WATER ST",
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

describe("Orange County Active Water Cases focused acceptance", () => {
  it("proves the live source, stable normalization and pagination, exact OCPA safety, read-only preview, and unchanged earlier sources", async () => {
    expect(WATER_CASE_LAYER_URL).toContain(
      "CodeEnforcementCasesMapService/FeatureServer/2/query"
    );
    expect(WATER_CASE_FIELDS).toEqual([
      "ObjectID",
      "Permits_Pl",
      "CRM_SR",
      "ADDRESS",
      "ZIP_CODE",
      "PARCEL_NO_NO",
      "DUE_DATE",
      "STATUS",
    ]);

    const live = await fetchOrangeCountyWaterCasePage({ pageSize: 2 });
    expect(live).toMatchObject({
      status: "available",
      source: "orange-county-water-case",
      page: { cursor: 0, pageSize: 2 },
    });
    expect(live.candidates).toEqual([]);

    expect(
      normalizeWaterCaseFeature(
        feature(1, " CRM-100 ", " WATER-55 ", "30-24-30-2665-07-203"),
        retrievedAt
      )
    ).toMatchObject({
      accepted: true,
      candidate: {
        source: "orange-county-water-case",
        externalId: "orange-county-water-case:crm-100",
        sourceCursor: 1,
        caseIdentityField: "CRM_SR",
        crmReference: "CRM-100",
        permitReference: "WATER-55",
        address: "1 WATER ST",
        zip: "32801",
        parcelNumber: "30-24-30-2665-07-203",
        dueDate: "10/15/2026",
        status: "OPEN",
        retrievedAt,
        reviewState: "preview",
      },
    });
    expect(
      normalizeWaterCaseFeature(
        feature(2, "N / A", "PERMIT-CANNOT-BE-FALLBACK", null),
        retrievedAt
      )
    ).toMatchObject({
      accepted: false,
      rejectionReasons: ["missing stable CRM water-case identity"],
      candidate: {
        externalId: "",
        crmReference: null,
        permitReference: "PERMIT-CANNOT-BE-FALLBACK",
      },
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
        return { ok: true, status: 200, json: async () => ({ features }) };
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
                  feature(10, "CRM-100", "WATER-100", "302430266507203"),
                  feature(11, " crm-100 ", "WATER-DUP", "322230900015940"),
                  feature(12, "CRM-200", "WATER-200", null, "11/01/2026", "PENDING"),
                  feature(13, null, "WATER-NO-STABLE-ID", "302430266507203"),
                ],
              }
            : {
                exceededTransferLimit: false,
                features: [
                  feature(14, "CRM-300", "WATER-300", "302431486002032"),
                  feature(15, "CRM-400", null, "MALFORMED-PARCEL", null, "ACTIVE"),
                ],
              },
      };
    });

    const first = await fetchOrangeCountyWaterCasePage({
      cursor: 0,
      pageSize: 4,
      fetchImpl: sourceFetch,
      retrievedAt,
    });
    const repeated = await fetchOrangeCountyWaterCasePage({
      cursor: 0,
      pageSize: 4,
      fetchImpl: sourceFetch,
      retrievedAt,
    });
    const second = await fetchOrangeCountyWaterCasePage({
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
      ["missing stable CRM water-case identity"],
    ]);
    expect(first.candidates.map((row) => row.enrichment.status)).toEqual([
      "matched",
      "unmatched",
    ]);
    expect(second.candidates.map((row) => row.enrichment.status)).toEqual([
      "ambiguous",
      "unmatched",
    ]);
    expect(first.candidates[0]).toMatchObject({
      dueDate: "10/15/2026",
      status: "OPEN",
      enrichment: { owner: "EVIDENCED OWNER" },
    });
    expect(first.candidates[1]).toMatchObject({
      parcelNumber: null,
      dueDate: "11/01/2026",
      status: "PENDING",
      enrichment: { status: "unmatched", parcelId: "", matchCount: 0 },
    });
    expect(second.candidates[0].enrichment).not.toHaveProperty("owner");
    expect(second.candidates[1]).toMatchObject({
      parcelNumber: "MALFORMED-PARCEL",
      dueDate: null,
      status: "ACTIVE",
      enrichment: { status: "unmatched", parcelId: "", matchCount: 0 },
    });
    expect(
      new Set([...first.candidates, ...second.candidates].map((row) => row.externalId)).size
    ).toBe(4);
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
      source: "orange-county-water-case",
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
    render(<OrangeCountyWaterCaseDiscovery />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refresh Water Case Preview" }));
    });
    expect(screen.getByText("CRM-100")).toBeInTheDocument();
    expect(screen.getByText(/Permit\/reference: WATER-100/)).toBeInTheDocument();
    expect(screen.getByText(/Address: 10 WATER ST/)).toHaveTextContent(
      "ZIP: 32801 | Parcel: 302430266507203"
    );
    expect(screen.getByText(/Due date: 10\/15\/2026/)).toHaveTextContent("Status: OPEN");
    expect(screen.getByText(/Source: orange-county-water-case/)).toHaveTextContent(
      `Retrieved: ${retrievedAt}`
    );
    expect(screen.getByText("OCPA: matched")).toBeInTheDocument();
    expect(screen.getByText(/Owner: EVIDENCED OWNER/)).toBeInTheDocument();
    expect(screen.getByText(/OCPA market\/assessment: \$300,000 \/ \$240,000/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /create|import|pipeline|enrich|message|task/i })
    ).not.toBeInTheDocument();

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
    expect(
      normalizeCodeEnforcementLienFeature(
        { attributes: { ObjectID: 1, CRM_SR_: "CRM-LIEN-UNCHANGED" } },
        retrievedAt
      ).candidate.externalId
    ).toBe("orange-county-code-enforcement-lien:crm:crm-lien-unchanged");
    expect(
      normalizeCondemnationFeature(
        { attributes: { ObjectID: 1, CASE_: "C24-UNCHANGED" } },
        retrievedAt
      ).candidate.externalId
    ).toBe("orange-county-condemnation:c24-unchanged");
    expect(FUNCTION_AUTHORIZATION_MATRIX["orange-county-water-case"]).toMatchObject({
      classification: "user-authenticated-api",
      tenant: true,
      mutation: false,
    });

    const implementation = [
      "src/components/OrangeCountyWaterCaseDiscovery.jsx",
      "src/services/leadDiscovery/orangeCountyWaterCaseSource.js",
      "netlify/functions/orange-county-water-case.js",
      "netlify/functions/_shared/orange-county-water-case.cjs",
    ]
      .map((path) => readFileSync(path, "utf8"))
      .join("\n")
      .toLowerCase();
    expect(implementation).not.toMatch(
      /persistimporteddeals|createdeal|rentcast|send-sms|send-email|seller_tasks|from\(["']deals|from\(["']seller_tasks/
    );
  }, 20000);
});
