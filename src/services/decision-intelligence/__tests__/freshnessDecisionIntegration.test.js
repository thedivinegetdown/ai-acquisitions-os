import { describe, expect, it } from "vitest";
import { ASSET_TYPES } from "../../asset-strategy";
import { buildCompatibilityDecisionReadModel } from "../index";

const NOW = Date.parse("2026-08-10T12:00:00.000Z");

function residentialDeal(overrides = {}) {
  return {
    id: "deal-residential",
    organization_id: "org-1",
    tenant_id: "tenant-1",
    asset_type: ASSET_TYPES.RESIDENTIAL_HOME,
    property_address: "123 Main Street",
    owner_name: "Sam Seller",
    phone: "5551112222",
    stage: "Contacted",
    asking_price: 120000,
    property_condition: "Needs repairs",
    motivation_score: 8,
    seller_timeline: "Within 30 days",
    mortgage_status: "Current",
    repairs_needed: 25000,
    occupancy_status: "Vacant",
    arv: 210000,
    ...overrides,
  };
}

function landDeal(overrides = {}) {
  return {
    id: "deal-land",
    organization_id: "org-1",
    tenant_id: "tenant-1",
    asset_type: ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
    parcel_id: "P-100",
    owner_name: "Lee Seller",
    phone: "5553334444",
    stage: "Contacted",
    asking_price: 50000,
    motivation_score: 7,
    seller_timeline: "Within 60 days",
    legal_access: "yes",
    zoning: "R-1",
    permitted_use: "Residential",
    flood_zone_status: "none",
    wetlands_status: "none",
    taxes_and_liens: "clear",
    comparable_land_value: 80000,
    ...overrides,
  };
}

function fieldEvidence({ dealId, field, sourceTimestamp, value }) {
  return {
    evidenceId: `evidence-${dealId}-${field}`,
    sourceType: "manual-research",
    sourceSystem: "Operator research",
    sourceRecordId: `${dealId}-research-1`,
    sourceField: field,
    sourceTimestamp,
    extractionMethod: "manual-research",
    relatedCanonicalField: field,
    rawValueSummary: String(value),
    normalizedValue: value,
    comparisonType: typeof value === "number" ? "number" : "normalized-text",
    relationship: "supports",
    verificationState: "verified",
    freshnessState: "unknown",
    organizationId: "org-1",
    tenantId: "tenant-1",
  };
}

describe("RDI-04 Decision Intelligence integration", () => {
  it("blocks stale Residential ARV from scoring and routes readiness to verification", () => {
    const result = buildCompatibilityDecisionReadModel({
      now: NOW,
      deal: residentialDeal(),
      evidenceReferences: [fieldEvidence({ dealId: "deal-residential", field: "property.afterRepairValue", sourceTimestamp: "2025-12-01T12:00:00.000Z", value: 210000 })],
    });
    expect(result.success).toBe(true);
    expect(result.data.freshnessReadModel.assessmentsByCanonicalField["property.afterRepairValue"].state).toBe("stale");
    expect(result.data.residentialStrategyResult.factReadModel.factsById["after-repair-value"].state).toBe("stale");
    expect(result.data.readinessResult.readinessState).toBe("needs-verification");
    expect(result.data.freshnessSignals.some((signal) => signal.signalType === "critical-fact-revalidation-required")).toBe(true);
  });

  it("keeps revalidation-due Residential ARV usable but caps canonical reliability freshness", () => {
    const result = buildCompatibilityDecisionReadModel({
      now: NOW,
      deal: residentialDeal(),
      evidenceReferences: [fieldEvidence({ dealId: "deal-residential", field: "property.afterRepairValue", sourceTimestamp: "2026-04-22T12:00:00.000Z", value: 210000 })],
    });
    expect(result.success).toBe(true);
    expect(result.data.freshnessReadModel.assessmentsByCanonicalField["property.afterRepairValue"].state).toBe("revalidation-due");
    expect(result.data.residentialStrategyResult.factReadModel.factsById["after-repair-value"].state).toBe("present");
    const reliabilityFact = [...result.data.dataReliabilityResult.criticalFactResults, ...result.data.dataReliabilityResult.advisoryFactResults].find((fact) => fact.canonicalField === "property.afterRepairValue");
    expect(reliabilityFact?.state).not.toBe("strong");
  });

  it("prevents expired Land zoning from silently supporting land analysis", () => {
    const result = buildCompatibilityDecisionReadModel({
      now: NOW,
      deal: landDeal(),
      evidenceReferences: [fieldEvidence({ dealId: "deal-land", field: "property.zoning", sourceTimestamp: "2024-06-01T12:00:00.000Z", value: "R-1" })],
    });
    expect(result.success).toBe(true);
    expect(result.data.freshnessReadModel.assessmentsByCanonicalField["property.zoning"].state).toBe("expired");
    expect(result.data.vacantLandStrategyResult.factReadModel.factsById.zoning.state).toBe("stale");
    expect(result.data.readinessResult.readinessState).toBe("needs-information");
    expect(result.data.missingInformationReadModel.staleItems.some((item) => item.canonicalField === "property.zoning")).toBe(true);
  });

  it("does not convert freshness into Cost of Delay or lower a direct seller-reply confidence", () => {
    const result = buildCompatibilityDecisionReadModel({
      now: NOW,
      deal: residentialDeal(),
      conversationSignals: [{ compatibilityKey: "phone:5551112222", linkedDealId: "deal-residential", lastMessageDirection: "inbound", lastMessagePreview: "Can we talk today?", lastMessageTimestamp: "2026-08-10T11:00:00.000Z", organizationId: "org-1", tenantId: "tenant-1" }],
      evidenceReferences: [fieldEvidence({ dealId: "deal-residential", field: "property.afterRepairValue", sourceTimestamp: "2025-12-01T12:00:00.000Z", value: 210000 })],
    });
    expect(result.data.recommendationBasis.basisType).toBe("seller-reply");
    expect(result.data.recommendationConfidenceResult.level).toBe("high");
    expect(result.data.costOfDelayResult.level).toBe("high");
    expect(result.data.recommendedActionWindowResult.windowType).toBe("act-now");
  });
});
