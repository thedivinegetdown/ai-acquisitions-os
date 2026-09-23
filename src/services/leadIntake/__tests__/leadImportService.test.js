import { beforeEach, describe, expect, it, vi } from "vitest";

const persistImportedDeals = vi.fn();

vi.mock("../../repositories", () => ({
  persistImportedDeals,
}));

import {
  analyzeLeadRows,
  confirmLeadImport,
  parseCsvLeadText,
} from "../leadImportService";
import { toDealImportPayload } from "../leadNormalizationService";
import { buildPipelineReadModel } from "../../pipeline";

const validRow = {
  "seller name": "alex seller",
  phone: "(555) 123-4567",
  email: "ALEX@EXAMPLE.COM",
  "property address": "123 Main St",
  "lead source": "Direct mail",
  market: "Tampa",
};

describe("durable lead intake", () => {
  beforeEach(() => {
    persistImportedDeals.mockReset();
  });

  it("keeps preview non-mutating while preserving normalization", () => {
    const analysis = analyzeLeadRows({ rows: [validRow] });

    expect(persistImportedDeals).not.toHaveBeenCalled();
    expect(analysis.validLeads[0]).toMatchObject({
      sellerName: "Alex Seller",
      email: "alex@example.com",
      phone: "5551234567",
      stage: "New Lead",
    });
  });

  it("persists only accepted records after explicit confirmation and reports every outcome", async () => {
    const analysis = analyzeLeadRows({
      rows: [validRow, { ...validRow, phone: "", email: "bad" }],
    });
    persistImportedDeals.mockResolvedValue({
      success: true,
      data: {
        results: [
          { rowNumber: 1, status: "imported" },
          { rowNumber: 3, status: "duplicate" },
          { rowNumber: 4, status: "failed", error: "insert failed" },
        ],
        importedCount: 1,
        duplicateCount: 1,
        failedCount: 1,
      },
    });

    const result = await confirmLeadImport(analysis);

    expect(result.success).toBe(true);
    expect(persistImportedDeals).toHaveBeenCalledTimes(1);
    expect(persistImportedDeals.mock.calls[0][0]).toHaveLength(1);
    expect(persistImportedDeals.mock.calls[0][0][0].payload).toMatchObject({
      owner_name: "Alex Seller",
      stage: "New Lead",
      import_id: expect.stringContaining("lead-intake:v1:"),
    });
    expect(result.data.message).toBe("1 imported, 1 duplicate retries skipped, 1 failed.");
    expect(result.data.rejectedCount).toBe(1);
  });

  it("treats repeated identities within one CSV preview as duplicates", () => {
    const analysis = parseCsvLeadText({
      csvText: [
        "seller name,phone,email,property address,lead source,market",
        "Alex Seller,5551234567,alex@example.com,123 Main St,Direct mail,Tampa",
        "Alex Seller,5551234567,other@example.com,456 Oak St,Direct mail,Tampa",
      ].join("\n"),
    });

    expect(analysis.validLeads).toHaveLength(1);
    expect(analysis.duplicateLeads).toHaveLength(1);
  });

  it("produces the canonical deal shape consumed by Pipeline", () => {
    const analysis = analyzeLeadRows({ rows: [validRow] });
    const importedDeal = {
      id: "new-deal",
      organization_id: "org-1",
      ...toDealImportPayload(analysis.validLeads[0]),
    };
    const pipeline = buildPipelineReadModel({
      deals: [importedDeal],
      organizationId: "org-1",
      now: new Date("2026-08-04T12:00:00.000Z").getTime(),
    });

    expect(pipeline.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dealId: "new-deal", currentStage: "New Lead" }),
      ])
    );
  });
});
