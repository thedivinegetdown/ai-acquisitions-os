import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
  VOLUSIA_CODE_COMPLIANCE_SOURCE,
  VOLUSIA_CONNECTLIVE_APP_URL,
  VOLUSIA_CONNECTLIVE_PAGE_CONFIGURATION_URL,
  VOLUSIA_CONNECTLIVE_PUBLIC_TOKEN_URL,
  VOLUSIA_CONNECTLIVE_TRANSACTION_URL,
  buildExternalIdentity,
  fetchVolusiaCodeCompliancePreview,
  requireBoundedResultCount,
} = require("../../../netlify/functions/_shared/volusia-code-compliance.cjs");
const {
  createHandler,
} = require("../../../netlify/functions/volusia-code-compliance.js");
const {
  FUNCTION_AUTHORIZATION_MATRIX,
} = require("../../../netlify/functions/_shared/function-inventory.cjs");

const { checkAvailability, fetchCandidates } = vi.hoisted(() => ({
  checkAvailability: vi.fn(),
  fetchCandidates: vi.fn(),
}));

vi.mock("../../services/leadDiscovery/volusiaCodeComplianceSource", () => ({
  VOLUSIA_CODE_COMPLIANCE_SOURCE: "volusia-code-compliance",
  checkVolusiaCodeComplianceAvailability: checkAvailability,
  fetchVolusiaCodeComplianceCandidates: fetchCandidates,
}));

import VolusiaCodeComplianceDiscovery from "../VolusiaCodeComplianceDiscovery";

const retrievedAt = "2026-09-26T18:00:00.000Z";
const transactionCode = "bounded-public-search-transaction";
const columnNames = [
  "File Number",
  "FolderRSN",
  "Type",
  "Date",
  "Description",
  "Name",
  "Status",
  "Property",
  "Actions",
  "_id",
];

function response(body, { status = 200, headers = {} } = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => normalizedHeaders[name.toLowerCase()] || null },
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}

function columns(rows) {
  return columnNames.map((columnName) => ({
    columnName,
    columnValues: rows.map((row) => row[columnName] ?? ""),
  }));
}

function parcelAttributes({ pid, parid, address }) {
  return {
    PARID: parid,
    PID: pid,
    DORPID: `00${pid}`,
    ADDRFULL: address,
    CITYNAME: "DELAND",
    STATECODE: "FL",
    ZIP1: "32720",
    OWNER1: "PRIVATE OWNER EXCLUDED",
    OWNER2: null,
    MAILADDR1: "PRIVATE MAILING EXCLUDED",
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
}

describe("Volusia Code Compliance focused acceptance", () => {
  it("proves the internal-only bounded ConnectLive flow, identity, privacy, parcel reuse, tenant denial, and zero side effects", async () => {
    if (process.env.VOLUSIA_CODE_COMPLIANCE_LIVE_SMOKE === "1") {
      const live = await fetchVolusiaCodeCompliancePreview({ windowDays: 1 });
      expect(live).toMatchObject({
        status: "available",
        access: "internal-only",
        source: VOLUSIA_CODE_COMPLIANCE_SOURCE,
        dateWindow: { windowDays: 1 },
      });
      expect(live.rowCount).toBeLessThan(250);
    }
    expect(() => requireBoundedResultCount(250, 7500)).toThrow(
      "choose a narrower date window"
    );

    const sourceRows = [
      {
        "File Number": "20260925043",
        FolderRSN: "1293394",
        Type: "CODE",
        Date: "2026-09-25",
        Description: "COMPLAINT NARRATIVE MUST NOT LEAVE SERVER",
        Name: "469 N SAMSULA Drive",
        Status: "Open",
        Property: "721201040044",
        Actions: "Detail",
        _id: "opaque-one",
      },
      {
        "File Number": " 20260925043 ",
        FolderRSN: "1293394",
        Type: "CODE",
        Date: "2026-09-25",
        Description: "SECOND PRIVATE NARRATIVE",
        Name: "469 N SAMSULA Drive",
        Status: "Open",
        Property: "721201040044",
        Actions: "Detail",
        _id: "opaque-two",
      },
      {
        "File Number": "20260925044",
        FolderRSN: "1293395",
        Type: "CODE",
        Date: "2026-09-25",
        Description: "PRIVATE ALLEGATION",
        Name: "Daniel Person Name",
        Status: "Violation",
        Property: "721201040045",
        Actions: "Detail",
        _id: "opaque-three",
      },
      {
        "File Number": "20260925045",
        FolderRSN: "1293396",
        Type: "CODE",
        Date: "2026-09-25",
        Description: "PRIVATE ALLEGATION TWO",
        Name: "100 TEST Road",
        Status: "Open",
        Property: "721201040046",
        Actions: "Detail",
        _id: "opaque-four",
      },
    ];
    const requests = [];
    const sourceFetch = vi.fn(async (url, options = {}) => {
      requests.push({ url: String(url), options });
      if (url === VOLUSIA_CONNECTLIVE_APP_URL) {
        expect(options.method).toBe("GET");
        return {
          ok: true,
          status: 200,
          headers: { get: (name) => name.toLowerCase() === "set-cookie" ? "JSESSIONID=ephemeral; Path=/citizenportal; Secure; HttpOnly" : null },
          text: async () => "<html></html>",
        };
      }
      if (url === VOLUSIA_CONNECTLIVE_PUBLIC_TOKEN_URL) {
        expect(options.headers).not.toHaveProperty("Authorization");
        expect(options.headers).toHaveProperty("Cookie", "JSESSIONID=ephemeral");
        return response(
          { status: "success", message: null },
          { headers: { "x-auth-token": "token-one" } }
        );
      }
      if (url === VOLUSIA_CONNECTLIVE_PAGE_CONFIGURATION_URL) {
        expect(options.headers).toMatchObject({
          Authorization: "Bearer token-one",
          Cookie: "JSESSIONID=ephemeral",
        });
        return response(
          {
            openfolders: {
              dataTable: {
                limit: 25,
                totalRowLimit: 7500,
                dataLoad: {
                  service: "executeCustomTransaction",
                  parameters: { transactionCode },
                },
              },
            },
          },
          { headers: { "x-auth-token": "token-two" } }
        );
      }
      if (url === VOLUSIA_CONNECTLIVE_TRANSACTION_URL) {
        expect(options.headers).toMatchObject({
          Authorization: "Bearer token-two",
          Cookie: "JSESSIONID=ephemeral",
        });
        expect(JSON.parse(options.body)).toEqual({
          transactionCode,
          transactionParameters: [
            { fieldName: "folderType", fieldValue: "C" },
            { fieldName: "district", fieldValue: "A" },
            { fieldName: "inDateFrom", fieldValue: "2026-08-28" },
            { fieldName: "inDateTo", fieldValue: "2026-09-26" },
          ],
        });
        return response(columns(sourceRows), { headers: { "x-auth-token": "token-three" } });
      }

      const parsed = new URL(url);
      expect(parsed.hostname).toBe("maps5.vcgov.org");
      expect(parsed.searchParams.get("where")).toBe(
        "PID IN ('721201040044','721201040045','721201040046')"
      );
      expect(parsed.searchParams.get("returnGeometry")).toBe("false");
      return response({
        features: [
          { attributes: parcelAttributes({ pid: "721201040044", parid: "3328540", address: "469 N SAMSULA DR" }) },
          { attributes: parcelAttributes({ pid: "721201040046", parid: "3328541", address: "100 TEST RD" }) },
          { attributes: parcelAttributes({ pid: "721201040046", parid: "3328542", address: "100 TEST RD" }) },
        ],
      });
    });

    const preview = await fetchVolusiaCodeCompliancePreview({
      windowDays: 30,
      fetchImpl: sourceFetch,
      retrievedAt,
    });
    expect(requests).toHaveLength(5);
    expect(preview).toMatchObject({
      status: "available",
      access: "internal-only",
      source: VOLUSIA_CODE_COMPLIANCE_SOURCE,
      retrievedAt,
      dateWindow: { startDate: "2026-08-28", endDate: "2026-09-26", windowDays: 30 },
      rowCount: 4,
      candidates: [
        {
          externalId: "volusia-code-compliance:20260925043",
          fileNumber: "20260925043",
          folderRsn: "1293394",
          propertyPid: "721201040044",
          propertyAddress: "469 N SAMSULA Drive",
          reviewState: "unreviewed",
          propertyVerificationState: "PARCEL_VERIFIED",
          parcelEnrichment: { status: "matched", verifiedParcelId: "3328540" },
        },
        {
          externalId: "volusia-code-compliance:20260925044",
          propertyAddress: null,
          propertyVerificationState: "UNVERIFIED",
          parcelEnrichment: { status: "unmatched", parcel: null },
        },
        {
          externalId: "volusia-code-compliance:20260925045",
          propertyVerificationState: "AMBIGUOUS",
          parcelEnrichment: { status: "ambiguous", parcel: null },
        },
      ],
    });
    expect(preview.candidates).toHaveLength(3);
    expect(buildExternalIdentity(" 20260925043 ")).toBe(
      "volusia-code-compliance:20260925043"
    );

    const serializedPreview = JSON.stringify(preview);
    expect(serializedPreview).not.toMatch(
      /COMPLAINT NARRATIVE|PRIVATE ALLEGATION|Daniel Person|PRIVATE OWNER|PRIVATE MAILING|opaque-|token-|JSESSIONID|ownerNames|mailingAddress|justValue|latestSale/i
    );
    expect(Object.keys(preview.candidates[0])).toEqual([
      "source",
      "externalId",
      "fileNumber",
      "folderRsn",
      "complianceType",
      "date",
      "status",
      "propertyPid",
      "propertyAddress",
      "retrievedAt",
      "reviewState",
      "propertyVerificationState",
      "parcelEnrichment",
    ]);

    const internalSourceRequest = vi.fn(async () => preview);
    const internalHandler = createHandler({
      env: { INTERNAL_OWNER_ORGANIZATION_ID: "internal-org" },
      authorize: vi.fn(async () => ({
        context: { organizationId: "internal-org", role: "owner" },
      })),
      sourceRequest: internalSourceRequest,
      clock: () => retrievedAt,
      nowMs: () => 10000,
      claimWindow: () => true,
    });
    const availabilityResponse = await internalHandler({
      httpMethod: "POST",
      headers: {},
      body: JSON.stringify({ action: "availability" }),
    });
    expect(availabilityResponse.statusCode).toBe(200);
    expect(internalSourceRequest).not.toHaveBeenCalled();

    const discoveryResponse = await internalHandler({
      httpMethod: "POST",
      headers: {},
      body: JSON.stringify({ action: "discover", windowDays: 30 }),
    });
    expect(discoveryResponse.statusCode).toBe(200);
    expect(internalSourceRequest).toHaveBeenCalledWith({ windowDays: 30, retrievedAt });

    const externalSourceRequest = vi.fn();
    const externalHandler = createHandler({
      env: { INTERNAL_OWNER_ORGANIZATION_ID: "internal-org" },
      authorize: vi.fn(async () => ({
        context: { organizationId: "pilot-customer-org", role: "owner" },
      })),
      sourceRequest: externalSourceRequest,
      claimWindow: () => true,
    });
    const deniedResponse = await externalHandler({
      httpMethod: "POST",
      headers: {},
      body: JSON.stringify({ action: "discover", windowDays: 30 }),
    });
    expect(deniedResponse.statusCode).toBe(403);
    expect(externalSourceRequest).not.toHaveBeenCalled();
    expect(FUNCTION_AUTHORIZATION_MATRIX["volusia-code-compliance"]).toEqual({
      classification: "internal-owner-api",
      tenant: true,
      mutation: false,
    });

    checkAvailability.mockResolvedValue({
      success: true,
      data: { available: true, access: "internal-only" },
    });
    fetchCandidates.mockResolvedValue({ success: true, data: preview });
    render(<VolusiaCodeComplianceDiscovery />);
    await waitFor(() => {
      expect(screen.getByText("INTERNAL CODE COMPLIANCE SOURCE")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refresh Internal Preview" }));
    });
    expect(screen.queryByText(/File Number/i)).not.toBeInTheDocument();
    expect(screen.getByText("20260925043")).toBeInTheDocument();
    expect(screen.getByText(/Verified PARID: 3328540/)).toBeInTheDocument();
    expect(screen.getByText(/AMBIGUOUS \(ambiguous\)/)).toBeInTheDocument();
    expect(screen.queryByText(/COMPLAINT NARRATIVE|Daniel Person|PRIVATE OWNER/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create|import|deal/i })).not.toBeInTheDocument();

    cleanup();
    checkAvailability.mockResolvedValueOnce({
      success: false,
      error: { message: "Internal owner source access denied." },
    });
    render(<VolusiaCodeComplianceDiscovery />);
    await waitFor(() => expect(checkAvailability).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("INTERNAL CODE COMPLIANCE SOURCE")).not.toBeInTheDocument();

    const implementation = [
      "netlify/functions/_shared/volusia-code-compliance.cjs",
      "netlify/functions/volusia-code-compliance.js",
      "src/services/leadDiscovery/volusiaCodeComplianceSource.js",
      "src/components/VolusiaCodeComplianceDiscovery.jsx",
    ].map((path) => readFileSync(path, "utf8")).join("\n").toLowerCase();
    expect(implementation).not.toMatch(
      /persistimporteddeals|createdeal|rentcast|send-sms|send-email|from\(["']deals|from\(["']seller_tasks|probate/
    );
  }, 30000);
});
