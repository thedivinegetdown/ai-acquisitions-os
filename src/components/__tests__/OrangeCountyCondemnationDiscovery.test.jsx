import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
  CONDEMNATION_FIELDS,
  CONDEMNATION_LAYER_URL,
  fetchOrangeCountyCondemnationPage,
  normalizeCondemnationFeature,
} = require("../../../netlify/functions/_shared/orange-county-condemnation.cjs");
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
  createHandler,
} = require("../../../netlify/functions/orange-county-condemnation.js");
const {
  FUNCTION_AUTHORIZATION_MATRIX,
} = require("../../../netlify/functions/_shared/function-inventory.cjs");

const { fetchCandidates } = vi.hoisted(() => ({
  fetchCandidates: vi.fn(),
}));

vi.mock("../../services/leadDiscovery/orangeCountyCondemnationSource", () => ({
  ORANGE_COUNTY_CONDEMNATION_SOURCE: "orange-county-condemnation",
  fetchOrangeCountyCondemnationCandidates: fetchCandidates,
}));

import OrangeCountyCondemnationDiscovery from "../OrangeCountyCondemnationDiscovery";

const retrievedAt = "2026-09-26T22:00:00.000Z";

function feature(objectId, caseId, folio, status = "Active", address = "123 CASE ST") {
  return {
    attributes: {
      ObjectID: objectId,
      CASE_: caseId,
      DATA_STATUS: status,
      FOLIO: folio,
      ADDRESS: address,
    },
  };
}

function ocpaFeature(objectId, parcel, owner = "EVIDENCED OWNER") {
  return {
    attributes: {
      OBJECTID: objectId,
      PARCEL: parcel,
      NAME1: owner,
      SITUS: "123 CASE ST",
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

describe("Orange County Active Condemnations focused acceptance", () => {
  it("proves live discovery, stable normalization and pagination, exact OCPA safety, read-only preview, and Sources 1-4 compatibility", async () => {
    expect(CONDEMNATION_LAYER_URL).toContain(
      "CodeEnforcementCasesMapService/FeatureServer/1/query"
    );
    expect(CONDEMNATION_FIELDS).toEqual([
      "ObjectID",
      "CASE_",
      "DATA_STATUS",
      "FOLIO",
      "ADDRESS",
    ]);

    const live = await fetchOrangeCountyCondemnationPage({
      pageSize: 2,
      parcelFetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ features: [] }),
      }),
    });
    expect(live).toMatchObject({
      status: "available",
      source: "orange-county-condemnation",
      page: { cursor: 0, pageSize: 2, sourceRowCount: 2 },
    });
    expect(live.candidates[0]).toEqual(
      expect.objectContaining({
        externalId: expect.stringMatching(/^orange-county-condemnation:c\d{2}-\d+$/),
        condemnationCaseId: expect.any(String),
        address: expect.any(String),
        condemnationStatus: expect.any(String),
        retrievedAt: expect.any(String),
      })
    );

    expect(
      normalizeCondemnationFeature(feature(1, " C24-0042 ", 302430266507203), retrievedAt)
    ).toMatchObject({
      accepted: true,
      candidate: {
        externalId: "orange-county-condemnation:c24-0042",
        sourceCursor: 1,
        condemnationCaseId: "C24-0042",
        caseIdentityField: "CASE_",
        folioNumber: "302430266507203",
        parcelNumber: "302430266507203",
        source: "orange-county-condemnation",
        retrievedAt,
        reviewState: "preview",
      },
    });
    expect(normalizeCondemnationFeature(feature(2, "NULL", 50767), retrievedAt)).toMatchObject({
      accepted: false,
      rejectionReasons: ["missing stable condemnation identity"],
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
                  feature(10, "C24-0100", 302430266507203),
                  feature(11, " c24-0100 ", 322230900015940),
                  feature(12, "C24-0200", null),
                  feature(13, null, 302430266507203),
                ],
              }
            : {
                exceededTransferLimit: false,
                features: [
                  feature(14, "C24-0300", 302431486002032),
                  feature(15, "C24-0400", 322230900015940),
                ],
              },
      };
    });

    const first = await fetchOrangeCountyCondemnationPage({
      cursor: 0,
      pageSize: 4,
      fetchImpl: sourceFetch,
      retrievedAt,
    });
    const repeated = await fetchOrangeCountyCondemnationPage({
      cursor: 0,
      pageSize: 4,
      fetchImpl: sourceFetch,
      retrievedAt,
    });
    const second = await fetchOrangeCountyCondemnationPage({
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
      ["missing stable condemnation identity"],
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
      folioNumber: null,
      enrichment: { status: "unmatched", parcelId: "", matchCount: 0 },
    });
    expect(second.candidates[0].enrichment).not.toHaveProperty("owner");
    expect(new Set([...first.candidates, ...second.candidates].map((row) => row.externalId)).size).toBe(4);
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
      source: "orange-county-condemnation",
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
    render(<OrangeCountyCondemnationDiscovery />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refresh Condemnation Preview" }));
    });
    expect(screen.getByText("C24-0100")).toBeInTheDocument();
    expect(screen.getByText(/Address: 123 CASE ST/)).toHaveTextContent(
      "Folio: 302430266507203"
    );
    expect(screen.getByText(/Status: Active/)).toHaveTextContent(
      "Source: orange-county-condemnation"
    );
    expect(screen.getByText("OCPA: matched")).toBeInTheDocument();
    expect(screen.getByText(/Owner: EVIDENCED OWNER/)).toBeInTheDocument();
    expect(screen.getByText(/OCPA market\/assessment: \$300,000 \/ \$240,000/)).toBeInTheDocument();
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
    expect(
      normalizeCodeEnforcementLienFeature(
        { attributes: { ObjectID: 1, CRM_SR_: "CRM-LIEN-UNCHANGED" } },
        retrievedAt
      ).candidate.externalId
    ).toBe("orange-county-code-enforcement-lien:crm:crm-lien-unchanged");
    expect(FUNCTION_AUTHORIZATION_MATRIX["orange-county-condemnation"]).toMatchObject({
      classification: "user-authenticated-api",
      tenant: true,
      mutation: false,
    });

    const implementation = [
      "src/components/OrangeCountyCondemnationDiscovery.jsx",
      "src/services/leadDiscovery/orangeCountyCondemnationSource.js",
      "netlify/functions/orange-county-condemnation.js",
      "netlify/functions/_shared/orange-county-condemnation.cjs",
    ]
      .map((path) => readFileSync(path, "utf8"))
      .join("\n")
      .toLowerCase();
    expect(implementation).not.toMatch(
      /persistimporteddeals|createdeal|rentcast|send-sms|send-email|seller_tasks|from\(["']deals|from\(["']seller_tasks/
    );
  }, 20000);
});
