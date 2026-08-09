import { describe, expect, it } from "vitest";
import { buildAssetStrategyContext } from "../../assetStrategyContextService";
import { INFORMATION_STATES } from "../../../research-intelligence";
import {
  adaptResidentialFacts,
  getResidentialFact,
  normalizeResidentialTimeline,
} from "../residentialFactAdapter";
import { RESIDENTIAL_FACT_IDS } from "../residentialStrategyContracts";

const NOW = "2026-08-05T15:00:00.000Z";

function deal(overrides = {}) {
  return {
    id: "deal-residential-1",
    organization_id: "org-1",
    tenant_id: "tenant-1",
    asset_type: "residential-home",
    property_address: "123 Main Street",
    asking_price: 120000,
    arv: 210000,
    repairs_needed: 25000,
    motivation_score: 8,
    seller_timeline: "within 30 days",
    occupancy_status: "Vacant",
    mortgage_balance: 90000,
    rent: 1800,
    ...overrides,
  };
}

function adapt(record, options = {}) {
  return adaptResidentialFacts({
    assetStrategyContext: buildAssetStrategyContext(record),
    deal: record,
    evaluatedTimestamp: NOW,
    ...options,
  });
}

describe("Residential fact adapter", () => {
  it("uses approved aliases and preserves tenant context", () => {
    const result = adapt(deal());

    expect(result).toMatchObject({
      dealId: "deal-residential-1",
      organizationId: "org-1",
      tenantId: "tenant-1",
      assetType: "residential-home",
    });
    expect(getResidentialFact(result, RESIDENTIAL_FACT_IDS.ASKING_PRICE)).toMatchObject({
      value: 120000,
      sourceField: "asking_price",
      state: INFORMATION_STATES.PRESENT,
    });
    expect(getResidentialFact(result, RESIDENTIAL_FACT_IDS.SELLER_MOTIVATION).value).toBe(8);
  });

  it("does not fabricate field timestamps or independent verification", () => {
    const result = adapt(deal());
    const askingEvidence = result.evidenceReferences.find(
      (entry) => entry.relatedCanonicalField === "deal.askingPrice"
    );

    expect(askingEvidence).toMatchObject({
      sourceField: "asking_price",
      sourceTimestamp: null,
      verificationState: "unknown",
      reliabilityLabel: "Compatibility Record",
    });
  });

  it("preserves a real record timestamp and labels its scope", () => {
    const result = adapt(deal({ updated_at: "2026-08-04T10:30:00Z" }));
    const askingEvidence = result.evidenceReferences.find(
      (entry) => entry.relatedCanonicalField === "deal.askingPrice"
    );

    expect(askingEvidence.sourceTimestamp).toBe("2026-08-04T10:30:00.000Z");
    expect(askingEvidence.provenanceDetails.sourceTimestampScope).toBe("record");
  });

  it.each([
    [11, INFORMATION_STATES.UNKNOWN],
    ["highly motivated", INFORMATION_STATES.UNKNOWN],
    [0, INFORMATION_STATES.PRESENT],
    [10, INFORMATION_STATES.PRESENT],
  ])("evaluates motivation %s without converting legacy text or scores", (value, state) => {
    const result = adapt(deal({ motivation_score: value }));
    expect(getResidentialFact(result, RESIDENTIAL_FACT_IDS.SELLER_MOTIVATION).state).toBe(state);
  });

  it("does not assume missing or unverified zero repairs are present", () => {
    const missing = adapt(deal({ repairs_needed: undefined }));
    const zero = adapt(deal({ repairs_needed: 0 }));
    const explicitNone = adapt(deal({ repairs_needed: "No repairs" }));

    expect(getResidentialFact(missing, RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE).state).toBe(
      INFORMATION_STATES.MISSING
    );
    expect(getResidentialFact(zero, RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE).state).toBe(
      INFORMATION_STATES.UNKNOWN
    );
    expect(getResidentialFact(explicitNone, RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE).state).toBe(
      INFORMATION_STATES.UNKNOWN
    );
  });

  it("accepts zero repairs only with explicit verified Evidence", () => {
    const result = adapt(deal({ repairs_needed: "No repairs" }), {
      evidenceReferences: [
        {
          evidenceId: "evidence:verified-no-repairs",
          sourceType: "manual-record",
          sourceSystem: "Deal record",
          sourceRecordId: "deal-residential-1",
          sourceField: "repairs_needed",
          relatedCanonicalField: "property.repairs",
          verificationState: "verified",
          valueSummary: "No repairs",
        },
      ],
    });

    expect(getResidentialFact(result, RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE)).toMatchObject({
      state: INFORMATION_STATES.PRESENT,
      value: 0,
    });
  });

  it("links provider-neutral comparable-sale Evidence to market-value facts", () => {
    const result = adapt(deal(), {
      evidenceReferences: [
        {
          evidenceId: "evidence:comparable-1",
          sourceType: "comparable-sale",
          sourceSystem: "Manual comp record",
          sourceRecordId: "comp-1",
          verificationState: "unknown",
          valueSummary: "Comparable sale record",
        },
      ],
    });

    expect(
      getResidentialFact(result, RESIDENTIAL_FACT_IDS.COMPARABLE_SALE_EVIDENCE)
        .evidenceReferenceIds
    ).toContain("evidence:comparable-1");
  });

  it.each([
    [30, 30, "numeric-days"],
    ["ASAP", 0, "narrow-text-mapping"],
    ["2026-09-04", 30, "target-date"],
  ])("normalizes timeline %s deterministically", (value, days, method) => {
    expect(normalizeResidentialTimeline(value, NOW)).toMatchObject({
      state: INFORMATION_STATES.PRESENT,
      days,
      method,
    });
  });

  it("leaves ambiguous timeline text unevaluated", () => {
    expect(normalizeResidentialTimeline("sometime soon", NOW)).toMatchObject({
      state: INFORMATION_STATES.UNKNOWN,
      days: null,
      method: "ambiguous-text",
    });
  });

  it("propagates supplied explicit conflicts without inventing conflict rules", () => {
    const result = adapt(deal(), {
      conflicts: [
        {
          conflictId: "conflict:asking",
          relatedCanonicalField: "deal.askingPrice",
          state: "unresolved",
        },
      ],
    });
    const asking = getResidentialFact(result, RESIDENTIAL_FACT_IDS.ASKING_PRICE);

    expect(asking.state).toBe(INFORMATION_STATES.CONFLICTING);
    expect(asking.conflictIds).toEqual(["conflict:asking"]);
  });

  it("handles malformed fields as bounded partial output", () => {
    const record = deal();
    Object.defineProperty(record, "arv", {
      get() {
        throw new Error("unsafe source detail");
      },
    });
    const result = adapt(record);

    expect(result.facts.length).toBeLessThanOrEqual(40);
    expect(result.evidenceReferences.length).toBeLessThanOrEqual(100);
    expect(result.partialDataWarnings.join(" ")).not.toContain("unsafe source detail");
  });
});
