import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
  CODE_ENFORCEMENT_FIELDS,
  fetchOrangeCountyCodeEnforcementPage,
  normalizeCodeEnforcementFeature,
} = require("../../../netlify/functions/_shared/orange-county-code-enforcement.cjs");
const {
  enrichCandidatesWithOcpa,
  enrichTaxSaleCandidatesWithOcpa,
} = require("../../../netlify/functions/_shared/orange-county-property-appraiser.cjs");
const {
  normalizeTaxSalePage,
} = require("../../../netlify/functions/_shared/orange-county-tax-sale.cjs");
const { createHandler } = require("../../../netlify/functions/orange-county-code-enforcement.js");
const {
  FUNCTION_AUTHORIZATION_MATRIX,
} = require("../../../netlify/functions/_shared/function-inventory.cjs");

const { fetchCandidates } = vi.hoisted(() => ({
  fetchCandidates: vi.fn(),
}));

vi.mock("../../services/leadDiscovery/orangeCountyCodeEnforcementSource", () => ({
  ORANGE_COUNTY_CODE_ENFORCEMENT_SOURCE: "orange-county-code-enforcement",
  fetchOrangeCountyCodeEnforcementCandidates: fetchCandidates,
}));

import OrangeCountyCodeEnforcementDiscovery from "../OrangeCountyCodeEnforcementDiscovery";

const retrievedAt = "2026-09-26T16:00:00.000Z";

function feature(objectId, crmId, permitId, parcel, overrides = {}) {
  return {
    attributes: {
      ObjectID: objectId,
      CRM_SR_: crmId,
      ADDRESS: "123 CODE CASE ST",
      ZIP_CODE: "32801",
      PARCEL_NO_NO: parcel,
      DUE_DATE: "10/31/2026",
      STATUS: "Open",
      Permits_Pl: permitId,
      ...overrides,
    },
  };
}

function ocpaFeature(objectId, parcel) {
  return {
    attributes: {
      OBJECTID: objectId,
      PARCEL: parcel,
      NAME1: "EVIDENCED OWNER",
      SITUS: "123 CODE CASE ST",
      SITUS_CITY: "Orlando",
      SITUS_ZIP: "32801",
    },
  };
}

describe("Orange County Active Code Enforcement focused acceptance", () => {
  it("proves the complete read-only Source #3 contract without changing Sources #1 or #2", async () => {
    expect(CODE_ENFORCEMENT_FIELDS).toEqual([
      "ObjectID",
      "CRM_SR_",
      "ADDRESS",
      "ZIP_CODE",
      "PARCEL_NO_NO",
      "DUE_DATE",
      "STATUS",
      "Permits_Pl",
    ]);

    const preferred = normalizeCodeEnforcementFeature(
      feature(1, " CRM-100 ", "CE-OLD", "30-24-30-2665-07-203"),
      retrievedAt
    );
    const evidencedFallback = normalizeCodeEnforcementFeature(
      feature(2, "NULL", " CE03003081 ", "NULL", {
        ADDRESS: "  7320   MT VERNON RD ",
        ZIP_CODE: "NULL",
        DUE_DATE: "NULL",
      }),
      retrievedAt
    );
    const missingIdentity = normalizeCodeEnforcementFeature(
      feature(3, "NULL", null, "30-24-30-2665-07-203"),
      retrievedAt
    );

    expect(preferred).toMatchObject({
      accepted: true,
      candidate: {
        externalId: "orange-county-code-enforcement:crm-100",
        codeEnforcementCaseId: "CRM-100",
        caseIdentityField: "CRM_SR_",
        address: "123 CODE CASE ST",
        zipCode: "32801",
        parcelNumber: "30-24-30-2665-07-203",
        dueDate: "10/31/2026",
        caseStatus: "Open",
        source: "orange-county-code-enforcement",
        retrievedAt,
      },
    });
    expect(evidencedFallback).toMatchObject({
      accepted: true,
      candidate: {
        externalId: "orange-county-code-enforcement:ce03003081",
        codeEnforcementCaseId: "CE03003081",
        caseIdentityField: "Permits_Pl",
        address: "7320 MT VERNON RD",
        zipCode: null,
        parcelNumber: null,
        dueDate: null,
      },
    });
    expect(missingIdentity).toMatchObject({
      accepted: false,
      rejectionReasons: ["missing stable case identity"],
      candidate: { externalId: "" },
    });

    const sourceFetch = vi.fn(async (url) => {
      const parsed = new URL(url);
      if (parsed.hostname === "vgispublic.ocpafl.org") {
        const where = parsed.searchParams.get("where");
        if (where.includes("302430266507203")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              features: [
                ocpaFeature(1, "302430266507203"),
                ocpaFeature(2, "302431486002032"),
                ocpaFeature(3, "302431486002032"),
              ],
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({ features: [] }) };
      }

      const cursor = Number(parsed.searchParams.get("where").split(">")[1]);
      expect(parsed.searchParams.get("orderByFields")).toBe("ObjectID ASC");
      expect(parsed.searchParams.get("returnGeometry")).toBe("false");
      expect(parsed.searchParams.get("resultRecordCount")).toBe("4");
      return {
        ok: true,
        status: 200,
        json: async () =>
          cursor === 0
            ? {
                exceededTransferLimit: true,
                features: [
                  feature(10, "CRM-100", "CE-100", "30-24-30-2665-07-203"),
                  feature(11, "crm-100", "CE-DUP", "32-22-30-9000-15-940"),
                  feature(12, "CRM-200", "CE-200", "30-24-31-4860-02-032"),
                  feature(13, "NULL", "CE-300", "NULL"),
                ],
              }
            : {
                exceededTransferLimit: false,
                features: [
                  feature(14, "NULL", "NULL", "30-24-30-2665-07-203"),
                  feature(15, "CRM-400", "CE-400", "32-22-30-9000-15-940"),
                ],
              },
      };
    });

    const first = await fetchOrangeCountyCodeEnforcementPage({
      cursor: 0,
      pageSize: 4,
      fetchImpl: sourceFetch,
      retrievedAt,
    });
    const repeated = await fetchOrangeCountyCodeEnforcementPage({
      cursor: 0,
      pageSize: 4,
      fetchImpl: sourceFetch,
      retrievedAt,
    });
    const second = await fetchOrangeCountyCodeEnforcementPage({
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
    expect(first.rejected.map((row) => row.rejectionReasons)).toContainEqual([
      "duplicate external identity",
    ]);
    expect(second.rejected.map((row) => row.rejectionReasons)).toContainEqual([
      "missing stable case identity",
    ]);
    expect(first.candidates.map((row) => row.enrichment.status)).toEqual([
      "matched",
      "ambiguous",
      "unmatched",
    ]);
    expect(first.candidates[0].enrichment.owner).toBe("EVIDENCED OWNER");
    expect(first.candidates[1].enrichment).not.toHaveProperty("owner");
    expect(first.candidates[2]).toMatchObject({
      parcelNumber: null,
      enrichment: { status: "unmatched", parcelId: "", matchCount: 0 },
    });
    expect(first.candidates[2].enrichment).not.toHaveProperty("owner");
    expect(second.candidates[0].enrichment).toMatchObject({ status: "unmatched" });

    const allCandidates = [...first.candidates, ...second.candidates];
    expect(new Set(allCandidates.map((row) => row.externalId)).size).toBe(allCandidates.length);
    expect(new Set(allCandidates.map((row) => row.sourceRecordId)).size).toBe(allCandidates.length);

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
    render(<OrangeCountyCodeEnforcementDiscovery />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refresh Code Enforcement Preview" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refresh Code Enforcement Preview" }));
    });
    expect(fetchCandidates).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText("CRM-100")).toHaveLength(1);
    expect(screen.getByText(/Address: 123 CODE CASE ST/)).toHaveTextContent(
      "ZIP: 32801 | Parcel: 30-24-30-2665-07-203"
    );
    expect(screen.getByText(/Due: 10\/31\/2026/)).toHaveTextContent(
      "Status: Open | Source: orange-county-code-enforcement"
    );
    expect(screen.getByText(new RegExp(`Retrieved: ${retrievedAt}`))).toHaveTextContent(
      "OCPA: matched"
    );
    expect(screen.queryByRole("button", { name: /create|import|pipeline|enrich|message|task/i })).not.toBeInTheDocument();

    expect(enrichCandidatesWithOcpa).toBe(enrichTaxSaleCandidatesWithOcpa);
    expect(
      normalizeTaxSalePage(
        [
          {
            attributes: {
              ObjectID: 1,
              USER_TDA_NUM: "TDA-UNCHANGED",
              USER_PARCEL: "30-24-30-2665-07-203",
              USER_Sale_Date: "10/15/2026",
              USER_Deed_Status: "Scheduled",
            },
          },
        ],
        retrievedAt
      ).candidates[0]
    ).toMatchObject({
      externalId: "orange-county-tax-sale:tda-unchanged",
      parcelNumber: "30-24-30-2665-07-203",
    });
    expect(FUNCTION_AUTHORIZATION_MATRIX["orange-county-tax-sale"].mutation).toBe(false);
    expect(FUNCTION_AUTHORIZATION_MATRIX["orange-county-code-enforcement"]).toMatchObject({
      classification: "user-authenticated-api",
      tenant: true,
      mutation: false,
    });

    const implementation = [
      "src/components/OrangeCountyCodeEnforcementDiscovery.jsx",
      "src/services/leadDiscovery/orangeCountyCodeEnforcementSource.js",
      "netlify/functions/orange-county-code-enforcement.js",
      "netlify/functions/_shared/orange-county-code-enforcement.cjs",
    ]
      .map((path) => readFileSync(path, "utf8"))
      .join("\n")
      .toLowerCase();
    expect(implementation).not.toMatch(
      /persistimporteddeals|createdeal|rentcast|send-sms|send-email|seller_tasks|from\(["']deals|from\(["']seller_tasks/
    );
  });
});
