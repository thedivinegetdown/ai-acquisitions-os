import { describe, expect, it } from "vitest";
import { buildAssetStrategyContext } from "../../assetStrategyContextService";
import {
  adaptVacantLandComparables,
  adaptVacantLandFacts,
  evaluateVacantLandStrategy,
  evaluateVacantLandValuation,
  scoreLandAccess,
  scoreLandComparableSupport,
  scoreLandDiscount,
  scoreLandFloodWetlands,
  scoreLandServices,
  scoreLandZoningUse,
  validateVacantLandPursuitProfile,
  validateVacantLandStrategyContract,
} from "../index";

const NOW = "2026-08-09T12:00:00.000Z";
const completeLand = (overrides = {}) => ({
  id: "land-1", organization_id: "org-1", tenant_id: "tenant-1",
  asset_type: "vacant-residential-land", parcel_number: "APN-100",
  property_address: "Lot 12 County Road", owner_name: "Lee Seller",
  phone: "5551112222", stage: "Contacted", asking_price: 50000,
  motivation_score: 8, seller_timeline: "within 30 days",
  legal_access: "documented", zoning: "R-1",
  permitted_use: "single family dwelling", flood_status: "no",
  wetlands_status: "no", taxes_and_liens: "current",
  comparable_land_value: 100000, acreage: 5, utilities: "available",
  water_sewer_septic: "available", road_frontage: "positive",
  builder_demand: "high", ...overrides,
});

describe("Vacant Land Acquisition Strategy v1", () => {
  it("registers a valid active land-only strategy and profile", () => {
    expect(validateVacantLandStrategyContract().errors).toEqual([]);
    expect(validateVacantLandPursuitProfile().errors).toEqual([]);
  });

  it("adapts explicit facts and converts stored square feet deterministically", () => {
    const deal = completeLand({ acreage: undefined, lot_square_feet: 87120 });
    const facts = adaptVacantLandFacts({ assetStrategyContext: buildAssetStrategyContext(deal), deal, evaluatedTimestamp: NOW });
    expect(facts.facts.find((item) => item.factId === "parcel-size-acres")?.value).toBe(2);
    expect(facts.evidenceReferences.length).toBeGreaterThan(0);
    expect(facts.evidenceReferences.every((item) => item.sourceTimestamp !== NOW)).toBe(true);
  });

  it("accepts explicit land comparables and rejects residential comparables", () => {
    const deal = completeLand();
    const facts = adaptVacantLandFacts({ factReadModel: null, deal, assetStrategyContext: buildAssetStrategyContext(deal), evaluatedTimestamp: NOW });
    const result = adaptVacantLandComparables({ factReadModel: facts, comparables: [
      { id: "land-comp", asset_type: "vacant-residential-land", sale_price: 80000, acreage: 4 },
      { id: "house-comp", asset_type: "residential-home", sale_price: 250000, acreage: 1 },
    ] });
    expect(result.validComparables).toHaveLength(1);
    expect(result.validComparables[0].pricePerAcre).toBe(20000);
  });

  it("derives median price per acre and never produces a land MAO", () => {
    const deal = completeLand({ comparable_land_value: undefined });
    const facts = adaptVacantLandFacts({ deal, assetStrategyContext: buildAssetStrategyContext(deal), evaluatedTimestamp: NOW });
    const valuation = evaluateVacantLandValuation({ factReadModel: facts, evaluatedTimestamp: NOW, comparables: [
      { id: "c1", asset_type: "land", sale_price: 60000, acreage: 3 },
      { id: "c2", asset_type: "land", sale_price: 100000, acreage: 4 },
      { id: "c3", asset_type: "land", sale_price: 90000, acreage: 3 },
    ] });
    expect(valuation.medianComparablePricePerAcre).toBe(25000);
    expect(valuation.indicatedLandValue).toBe(125000);
    expect(valuation.grossLandSpread).toBe(75000);
    expect(JSON.stringify(valuation).toLowerCase()).not.toContain("mao");
  });

  it("implements exact land scoring thresholds", () => {
    expect([0.4, 0.3, 0.2, 0.1, 0, -0.1, -0.11].map(scoreLandDiscount)).toEqual([100, 90, 80, 65, 45, 20, 0]);
    expect(scoreLandAccess("documented")).toBe(100);
    expect(scoreLandAccess("none")).toBe(0);
    expect(scoreLandZoningUse("R-1", "residential")).toBe(100);
    expect(scoreLandFloodWetlands("constraint-present", "no-known-constraint")).toBe(50);
    expect(scoreLandServices("available", "partial")).toBe(70);
    expect(scoreLandComparableSupport({ comparableCount: 3 })).toBe(100);
  });

  it("evaluates a score only for explicit complete land", () => {
    const result = evaluateVacantLandStrategy({ deal: completeLand(), evaluatedTimestamp: NOW });
    expect(result.eligible).toBe(true);
    expect(result.pursuitScoreResult.evaluationState).toMatch(/evaluated|partial/);
    expect(result.pursuitScoreResult.score).toEqual(expect.any(Number));
    expect(JSON.stringify(result).toLowerCase()).not.toMatch(/after-repair|repair-to-arv|house mao|rental cash flow|lead_score/);
  });

  it("blocks scoring when legal access is unknown", () => {
    const result = evaluateVacantLandStrategy({ deal: completeLand({ legal_access: undefined }), evaluatedTimestamp: NOW });
    expect(result.pursuitScoreResult.score).toBeNull();
    expect(result.pursuitScoreResult.evaluationState).toBe("blocked");
    expect(result.feasibilitySignals.some((item) => item.signalId === "land-signal:access-unknown")).toBe(true);
  });

  it("never activates for residential, unknown, or conflicting records", () => {
    expect(evaluateVacantLandStrategy({ deal: completeLand({ asset_type: "residential-home" }), evaluatedTimestamp: NOW }).eligible).toBe(false);
    expect(evaluateVacantLandStrategy({ deal: completeLand({ asset_type: undefined }), evaluatedTimestamp: NOW }).eligible).toBe(false);
    expect(evaluateVacantLandStrategy({ deal: completeLand({ property_type: "single family" }), evaluatedTimestamp: NOW }).eligible).toBe(false);
  });
});
