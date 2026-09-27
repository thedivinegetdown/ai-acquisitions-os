import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
  VOLUSIA_CIRCUIT_FORECLOSURE_INDEX_URL,
  buildExternalIdentity,
  discoverRecentReports,
  fetchVolusiaCircuitForeclosurePreview,
  parseWeeklyReport,
} = require("../../../netlify/functions/_shared/volusia-circuit-foreclosure.cjs");
const {
  createHandler,
} = require("../../../netlify/functions/volusia-circuit-foreclosure.js");
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

const { fetchCandidates } = vi.hoisted(() => ({
  fetchCandidates: vi.fn(),
}));

vi.mock("../../services/leadDiscovery/volusiaCircuitForeclosureSource", () => ({
  VOLUSIA_CIRCUIT_FORECLOSURE_SOURCE: "volusia-circuit-foreclosure",
  fetchVolusiaCircuitForeclosureCandidates: fetchCandidates,
}));

import VolusiaCircuitForeclosureDiscovery from "../VolusiaCircuitForeclosureDiscovery";

const retrievedAt = "2026-09-26T18:00:00.000Z";
const reportDescriptors = [
  ["2026-09-19", "19 September 2026", "09/13/2026", "09/19/2026"],
  ["2026-09-12", "12 September 2026", "09/06/2026", "09/12/2026"],
  ["2026-09-05", "05 September 2026", "08/30/2026", "09/05/2026"],
  ["2026-08-29", "29 August 2026", "08/23/2026", "08/29/2026"],
  ["2026-08-22", "22 August 2026", "08/16/2026", "08/22/2026"],
];

function reportPath(isoDate) {
  return `/cm_rpt/circuit/CI_${isoDate.replaceAll("-", "_")}.html`;
}

function reportIndexHtml(descriptors = reportDescriptors) {
  return `<html><body><table>${descriptors
    .map(
      ([isoDate, label]) =>
        `<tr><td>Week Ending: &nbsp;${label}</td><td><a href='${reportPath(isoDate)}' target='_blank'>View</a></td></tr>`
    )
    .join("")}</table></body></html>`;
}

function reportRow({
  caseNumber,
  plaintiff = "PLAINTIFF LLC",
  defendant = "DEFENDANT PERSON",
  partyReportAddress = "10 PARTY LANE DELAND FL 32720",
  judge = "Example Judge (01)",
  filingDate = "09/15/2026",
}) {
  const addressLine = partyReportAddress ? `<BR>${partyReportAddress}` : "";
  return `<TR><TD>${caseNumber || ""}</TD><TD>${plaintiff}<BR>PLAINTIFF MAILING LINE<BR>Attorney: COUNSEL NAME</TD><TD>${defendant}${addressLine}</TD><TD>${judge}</TD><TD>${filingDate}</TD></TR>`;
}

function weeklyReportHtml(descriptor, rows) {
  const [, , startDate, endDate] = descriptor;
  return `<HTML><BODY><H2>Weekly Circuit Civil Foreclosures Report<BR>for Week of Sunday, ${startDate}, to Saturday, ${endDate}</H2><TABLE><TR><TD>Case Number</TD><TD>Plaintiff</TD><TD>Defendant</TD><TD>Judge</TD><TD>Filing Date</TD></TR>${rows.join("")}</TABLE></BODY></HTML>`;
}

describe("Volusia weekly circuit foreclosure focused acceptance", () => {
  it("proves live discovery, strict normalization, case dedupe, address safety, read-only preview, and unchanged Orange sources", async () => {
    const live = await fetchVolusiaCircuitForeclosurePreview({ reportLimit: 1 });
    expect(live).toMatchObject({
      status: "available",
      source: "volusia-circuit-foreclosure",
      reportWindow: { limit: 1, reportCount: 1 },
    });
    expect(live.reports).toHaveLength(1);
    expect(live.candidates.length).toBeGreaterThan(0);
    expect(live.candidates[0]).toMatchObject({
      source: "volusia-circuit-foreclosure",
      propertyVerificationState: "UNVERIFIED",
      reportWeekEnding: live.reports[0].reportWeekEnding,
    });
    expect(live.candidates[0]).toHaveProperty("partyReportAddress");
    expect(live.candidates[0]).not.toHaveProperty("propertyAddress");
    expect(live.candidates[0]).not.toHaveProperty("parcelNumber");

    const discovered = discoverRecentReports(reportIndexHtml());
    expect(discovered.map((report) => report.reportWeekEnding)).toEqual(
      reportDescriptors.map(([isoDate]) => isoDate)
    );
    expect(discovered[0].url).toBe(
      "https://app02.clerk.org/cm_rpt/circuit/CI_2026_09_19.html"
    );

    const reportBodies = new Map([
      [
        "2026-09-19",
        weeklyReportHtml(reportDescriptors[0], [
          reportRow({ caseNumber: "2026 10001 CIDL" }),
          reportRow({
            caseNumber: "2026 10002 CICI",
            defendant: "NO ADDRESS DEFENDANT",
            partyReportAddress: null,
          }),
          "<TR><TD>2026 99999 CIDL</TD><TD>TOO</TD><TD>FEW</TD><TD>CELLS</TD></TR>",
          reportRow({ caseNumber: "" }),
        ]),
      ],
      [
        "2026-09-12",
        weeklyReportHtml(reportDescriptors[1], [
          reportRow({
            caseNumber: " 2026   10001   cidl ",
            partyReportAddress: "99 CHANGED REPORT ADDRESS",
          }),
        ]),
      ],
      [
        "2026-09-05",
        weeklyReportHtml(reportDescriptors[2], [
          reportRow({ caseNumber: "2026 10003 CICI", filingDate: "09/01/2026" }),
        ]),
      ],
      [
        "2026-08-29",
        weeklyReportHtml(reportDescriptors[3], [
          reportRow({ caseNumber: "2026 10004 CIDL", filingDate: "08/25/2026" }),
        ]),
      ],
    ]);
    const requestedUrls = [];
    const sourceFetch = vi.fn(async (url) => {
      requestedUrls.push(url);
      if (url === VOLUSIA_CIRCUIT_FORECLOSURE_INDEX_URL) {
        return { ok: true, status: 200, text: async () => reportIndexHtml() };
      }
      const report = reportDescriptors.find(([isoDate]) => url.endsWith(reportPath(isoDate)));
      const body = report ? reportBodies.get(report[0]) : null;
      return { ok: Boolean(body), status: body ? 200 : 404, text: async () => body || "" };
    });

    const preview = await fetchVolusiaCircuitForeclosurePreview({
      fetchImpl: sourceFetch,
      retrievedAt,
    });
    expect(preview.reports.map((report) => report.reportWeekEnding)).toEqual([
      "2026-09-19",
      "2026-09-12",
      "2026-09-05",
      "2026-08-29",
    ]);
    expect(requestedUrls).toHaveLength(5);
    expect(requestedUrls.some((url) => url.endsWith("CI_2026_08_22.html"))).toBe(false);
    expect(preview.candidates.map((candidate) => candidate.externalId)).toEqual([
      "volusia-circuit-foreclosure:202610001cidl",
      "volusia-circuit-foreclosure:202610002cici",
      "volusia-circuit-foreclosure:202610003cici",
      "volusia-circuit-foreclosure:202610004cidl",
    ]);
    expect(new Set(preview.candidates.map((candidate) => candidate.externalId)).size).toBe(4);
    expect(buildExternalIdentity(" 2026  10001 cidl ")).toBe(
      "volusia-circuit-foreclosure:202610001cidl"
    );
    expect(preview.candidates[0]).toMatchObject({
      caseNumber: "2026 10001 CIDL",
      filingDate: "2026-09-15",
      plaintiff: "PLAINTIFF LLC",
      defendant: "DEFENDANT PERSON",
      judge: "Example Judge (01)",
      partyReportAddress: "10 PARTY LANE DELAND FL 32720",
      partyReportAddressRole: "defendant",
      reportWeekEnding: "2026-09-19",
      retrievedAt,
      propertyVerificationState: "UNVERIFIED",
      reviewState: "preview",
    });
    expect(preview.candidates[1]).toMatchObject({
      caseNumber: "2026 10002 CICI",
      partyReportAddress: null,
      propertyVerificationState: "UNVERIFIED",
    });
    expect(preview.rejected.map((row) => row.rejectionReasons)).toEqual([
      ["malformed report row"],
      ["missing court case number"],
      ["duplicate external identity across report window"],
    ]);

    expect(() =>
      parseWeeklyReport(
        weeklyReportHtml(reportDescriptors[0], [reportRow({ caseNumber: "2026 10001 CIDL" })]).replace(
          "<TD>Defendant</TD>",
          "<TD>Property Address</TD>"
        ),
        { expectedReportWeekEnding: "2026-09-19", retrievedAt }
      )
    ).toThrow("column structure changed");

    const unavailableHandler = createHandler({
      authorize: vi.fn().mockResolvedValue({ context: { organizationId: "org-1" } }),
      sourceRequest: vi.fn().mockRejectedValue(new Error("upstream failed")),
    });
    const unavailable = await unavailableHandler({
      httpMethod: "POST",
      body: JSON.stringify({ reportLimit: 4 }),
      headers: {},
    });
    expect(JSON.parse(unavailable.body)).toMatchObject({
      success: false,
      status: "unavailable",
      source: "volusia-circuit-foreclosure",
      candidates: [],
      rejected: [],
      reports: [],
    });

    fetchCandidates.mockResolvedValue({
      success: true,
      data: {
        status: "available",
        candidates: [preview.candidates[0]],
        rejected: [],
        reports: preview.reports,
        retrievedAt,
      },
    });
    render(<VolusiaCircuitForeclosureDiscovery />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refresh Foreclosure Preview" }));
    });
    expect(screen.getByText("2026 10001 CIDL")).toBeInTheDocument();
    expect(screen.getByText(/Party\/report address \(NOT VERIFIED PROPERTY ADDRESS\):/)).toHaveTextContent(
      "10 PARTY LANE DELAND FL 32720"
    );
    expect(screen.getByText(/Property verification state: UNVERIFIED/)).toBeInTheDocument();
    expect(screen.getByText(/Source: volusia-circuit-foreclosure/)).toHaveTextContent(
      `Retrieved: ${retrievedAt}`
    );
    expect(
      screen.queryByRole("button", { name: /create|import|pipeline|enrich|message|task|rentcast/i })
    ).not.toBeInTheDocument();

    expect(
      normalizeOcpaFeature(
        { attributes: { OBJECTID: 1, PARCEL: "302430266507203" } },
        retrievedAt
      ).source
    ).toBe("orange-county-property-appraiser");
    expect(
      normalizeTaxSaleFeature(
        { attributes: { ObjectID: 1, USER_TDA_NUM: "TDA-UNCHANGED", USER_PARCEL: "P-1" } },
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
        { attributes: { ObjectID: 1, CRM_SR_: "LIEN-UNCHANGED" } },
        retrievedAt
      ).candidate.externalId
    ).toBe("orange-county-code-enforcement-lien:crm:lien-unchanged");
    expect(
      normalizeCondemnationFeature(
        { attributes: { ObjectID: 1, CASE_: "C-UNCHANGED" } },
        retrievedAt
      ).candidate.externalId
    ).toBe("orange-county-condemnation:c-unchanged");
    expect(
      normalizeWaterCaseFeature(
        { attributes: { ObjectID: 1, CRM_SR: "WATER-UNCHANGED" } },
        retrievedAt
      ).candidate.externalId
    ).toBe("orange-county-water-case:water-unchanged");
    expect(FUNCTION_AUTHORIZATION_MATRIX["volusia-circuit-foreclosure"]).toMatchObject({
      classification: "user-authenticated-api",
      tenant: true,
      mutation: false,
    });

    const implementation = [
      "src/components/VolusiaCircuitForeclosureDiscovery.jsx",
      "src/services/leadDiscovery/volusiaCircuitForeclosureSource.js",
      "netlify/functions/volusia-circuit-foreclosure.js",
      "netlify/functions/_shared/volusia-circuit-foreclosure.cjs",
    ]
      .map((path) => readFileSync(path, "utf8"))
      .join("\n")
      .toLowerCase();
    expect(implementation).not.toMatch(
      /persistimporteddeals|createdeal|rentcast|skip.?trac|send-sms|send-email|seller_tasks|from\(["']deals|from\(["']seller_tasks/
    );
  }, 40000);
});
