import { describe, expect, it } from "vitest";
import { ASSET_CLASSIFICATION_STATES, ASSET_TYPES } from "../../../asset-strategy/assetStrategyContracts";
import { classifyOpportunityAsset } from "../../../asset-strategy/assetClassificationService";
import {
  CONFLICT_COMPARISON_TYPES,
  CONFLICT_CONTRACT_VERSION,
  CONFLICT_CRITICALITIES,
  CONFLICT_RULESET_VERSION,
  CONFLICT_STATES,
  CONFLICT_TYPES,
  evaluateConflictingData,
  normalizeConflictCandidate,
  normalizeConflictComparableValue,
  normalizeConflictRecord,
  normalizeConflictResolutionReference,
} from "..";

const NOW = "2026-08-10T12:00:00.000Z";

function context(assetType = ASSET_TYPES.RESIDENTIAL_HOME) {
  return {
    dealId: "deal-1",
    organizationId: "org-1",
    tenantId: "tenant-1",
    assetType,
    classificationState: ASSET_CLASSIFICATION_STATES.CLASSIFIED,
    strategySupportState: "implemented",
    selectedStrategyId: assetType === ASSET_TYPES.VACANT_RESIDENTIAL_LAND ? "vacant-land-acquisition" : "residential-acquisition",
    strategyVersion: assetType === ASSET_TYPES.VACANT_RESIDENTIAL_LAND ? "vacant-land-strategy-v1" : "residential-strategy-v1",
  };
}

function evaluate(deal, options = {}) {
  return evaluateConflictingData({
    assetStrategyContext: options.assetStrategyContext || context(),
    deal: { id: "deal-1", organization_id: "org-1", tenant_id: "tenant-1", asset_type: ASSET_TYPES.RESIDENTIAL_HOME, ...deal },
    evaluatedTimestamp: NOW,
    ...options,
  });
}

function evidence(overrides = {}) {
  return {
    evidenceId: "evidence-1",
    sourceType: "manual-research",
    sourceSystem: "Stored research",
    sourceRecordId: "research-1",
    sourceField: "after_repair_value",
    relatedCanonicalField: "property.afterRepairValue",
    organizationId: "org-1",
    tenantId: "tenant-1",
    provenanceDetails: { storedValue: 200000 },
    ...overrides,
  };
}

describe("conflict contracts and comparison policies", () => {
  it("normalizes bounded versioned contracts without fabricating timestamps or tenant context", () => {
    const candidate = normalizeConflictCandidate({ candidateId: "candidate-1", canonicalField: "deal.askingPrice", normalizedComparableValue: 100000 });
    const conflict = normalizeConflictRecord({ conflictId: "conflict-1", canonicalField: "deal.askingPrice", candidateValues: [candidate] });
    expect(conflict).toMatchObject({ contractVersion: CONFLICT_CONTRACT_VERSION, rulesetVersion: CONFLICT_RULESET_VERSION, organizationId: null, evaluatedTimestamp: null });
    expect(conflict.candidateValues[0].sourceTimestamp).toBeNull();
    expect(Object.values(CONFLICT_STATES)).toContain("review-required");
    expect(Object.values(CONFLICT_TYPES)).toContain("duplicate-equivalent");
    expect(Object.values(CONFLICT_CRITICALITIES)).toEqual(["blocking", "advisory"]);
    expect(normalizeConflictCandidate({})).toBeNull();
    expect(normalizeConflictRecord({})).toBeNull();
  });

  it("bounds candidate and warning collections while retaining primitive comparable values", () => {
    const candidates = Array.from({ length: 20 }, (_, index) => ({
      candidateId: `candidate-${index}`,
      canonicalField: "deal.askingPrice",
      normalizedComparableValue: index,
    }));
    const conflict = normalizeConflictRecord({
      conflictId: "conflict-1",
      canonicalField: "deal.askingPrice",
      candidateValues: candidates,
      warnings: Array.from({ length: 30 }, (_, index) => `warning-${index}`),
    });
    expect(conflict.candidateValues).toHaveLength(12);
    expect(conflict.distinctNormalizedValues).toEqual(Array.from({ length: 12 }, (_, index) => index));
    expect(conflict.warnings).toHaveLength(16);
  });

  it("preserves only explicitly supplied resolution metadata", () => {
    expect(normalizeConflictResolutionReference({ resolutionId: "resolution-1", conflictId: "conflict-1", status: "resolved", selectedCandidateId: "candidate-1" })).toEqual(expect.objectContaining({ status: "resolved", selectedCandidateId: "candidate-1", actorReference: null, reason: null, approvalReference: null, decidedTimestamp: null }));
    expect(normalizeConflictResolutionReference({})).toBeNull();
  });

  it("normalizes equivalent text, money, dates, booleans, statuses, parcel IDs, and asset types", () => {
    expect(normalizeConflictComparableValue(CONFLICT_COMPARISON_TYPES.TEXT, "  Main   ST. ")).toBe("main st");
    expect(normalizeConflictComparableValue(CONFLICT_COMPARISON_TYPES.MONEY, "$100,000")).toBe(100000);
    expect(normalizeConflictComparableValue(CONFLICT_COMPARISON_TYPES.NUMBER, "100,000")).toBe(100000);
    expect(normalizeConflictComparableValue(CONFLICT_COMPARISON_TYPES.DATE, "2026-08-10T04:00:00Z")).toBe("2026-08-10");
    expect(normalizeConflictComparableValue(CONFLICT_COMPARISON_TYPES.BOOLEAN, false)).toBe(false);
    expect(normalizeConflictComparableValue(CONFLICT_COMPARISON_TYPES.KNOWN_STATUS, "YES", { statusMappings: { yes: "documented" } })).toBe("documented");
    expect(normalizeConflictComparableValue(CONFLICT_COMPARISON_TYPES.PARCEL_IDENTIFIER, " apn-12 ")).toBe("APN-12");
    expect(normalizeConflictComparableValue(CONFLICT_COMPARISON_TYPES.ASSET_TYPE, "SFR")).toBe(ASSET_TYPES.RESIDENTIAL_HOME);
  });

  it("keeps missing and unknown values outside conflict comparison", () => {
    for (const value of [null, undefined, "", "unknown", "not sure", "TBD", "unavailable"]) {
      expect(normalizeConflictComparableValue(CONFLICT_COMPARISON_TYPES.TEXT, value)).toBeNull();
    }
  });
});

describe("deterministic conflict detection", () => {
  it("does not conflict for one value or formatting-equivalent aliases", () => {
    expect(evaluate({ asking_price: 100000 }).counts.open).toBe(0);
    expect(evaluate({ asking_price: 100000, askingPrice: "$100,000" }).counts.open).toBe(0);
    expect(evaluate({ asking_price: null, askingPrice: 100000 }).counts.open).toBe(0);
    expect(evaluate({ asking_price: "unknown", askingPrice: 100000 }).counts.open).toBe(0);
  });

  it("does not treat multiple seller contact methods as competing canonical values", () => {
    expect(evaluate({ phone: "5551112222", email: "seller@example.com" }).counts.open).toBe(0);
  });

  it("creates one stable blocking conflict for two or three distinct aliases", () => {
    const two = evaluate({ asking_price: 100000, askingPrice: 110000 });
    const three = evaluate({ price: 90000, asking_price: 100000, askingPrice: 110000 });
    expect(two.highestPriorityConflict).toMatchObject({ canonicalField: "deal.askingPrice", blocking: true });
    expect(two.highestPriorityConflict.conflictId).toBe("conflict:deal:deal-1:field:deal.askingPrice");
    expect(three.conflicts.filter((entry) => entry.canonicalField === "deal.askingPrice")).toHaveLength(1);
    expect(three.conflicts.find((entry) => entry.canonicalField === "deal.askingPrice").distinctNormalizedValues).toHaveLength(3);
    expect(evaluate({ asking_price: 100000, askingPrice: 110000 })).toEqual(two);
  });

  it("deduplicates Evidence sources, detects distinct Evidence, and ignores generic summaries", () => {
    const result = evaluate({ arv: 180000 }, { evidenceReferences: [evidence(), evidence(), evidence({ evidenceId: "generic", provenanceDetails: {}, valueSummary: "Recorded value" })] });
    const conflict = result.conflicts.find((entry) => entry.canonicalField === "property.afterRepairValue");
    expect(conflict.candidateValues.filter((entry) => entry.evidenceId === "evidence-1")).toHaveLength(1);
    expect(conflict.evidenceIds).toContain("evidence-1");
    expect(conflict.evidenceIds).not.toContain("generic");
  });

  it("rejects cross-tenant Evidence", () => {
    const result = evaluate({ arv: 180000 }, { evidenceReferences: [evidence({ tenantId: "tenant-2" })] });
    expect(result.conflicts.find((entry) => entry.canonicalField === "property.afterRepairValue")).toBeUndefined();
  });

  it("preserves explicit unresolved and resolved conflicts without selecting or mutating", () => {
    const deal = { asking_price: 100000 };
    const unresolved = evaluate(deal, { explicitConflictReferences: [{ conflictId: "existing-conflict", relatedCanonicalField: "deal.askingPrice", summary: "Explicit review", state: "unresolved" }] });
    expect(unresolved.highestPriorityConflict).toMatchObject({ conflictId: "existing-conflict", state: "review-required", conflictType: "explicit-conflict" });
    const resolved = evaluate({ asking_price: 100000, askingPrice: 110000 }, {
      explicitConflictReferences: [{ conflictId: "existing-conflict", relatedCanonicalField: "deal.askingPrice", state: "unresolved" }],
      explicitResolutionReferences: [{ resolutionId: "resolution-1", conflictId: "existing-conflict", status: "resolved", selectedCandidateId: "candidate-1", actorReference: "user-1", reason: "Reviewed source documents", approvalReference: "approval-1", decidedTimestamp: NOW }],
    });
    expect(resolved.resolvedConflicts[0].explicitResolutionReference).toMatchObject({ actorReference: "user-1", reason: "Reviewed source documents", approvalReference: "approval-1", decidedTimestamp: NOW });
    expect(resolved.resolvedConflicts[0].warnings[0]).toContain("No field was rewritten");
    expect(deal).toEqual({ asking_price: 100000 });
  });

  it("returns partial results when one alias getter throws", () => {
    const deal = { id: "deal-1", organization_id: "org-1", tenant_id: "tenant-1", asset_type: ASSET_TYPES.RESIDENTIAL_HOME, asking_price: 100000, askingPrice: 110000 };
    Object.defineProperty(deal, "price", { get() { throw new Error("private"); } });
    const result = evaluateConflictingData({ assetStrategyContext: context(), deal, evaluatedTimestamp: NOW });
    expect(result.counts.open).toBeGreaterThan(0);
    expect(result.partialDataWarnings.join(" ")).toContain("price field");
    expect(JSON.stringify(result)).not.toContain("private");
  });
});

describe("asset-aware conflict profiles", () => {
  it("adapts the existing Asset Classification conflict as blocking without a second classifier", () => {
    const deal = { id: "deal-1", organization_id: "org-1", tenant_id: "tenant-1", asset_type: "SFR", property_type: "Vacant land" };
    const classification = classifyOpportunityAsset(deal);
    const result = evaluateConflictingData({ assetStrategyContext: { ...context(), assetType: null, selectedStrategyId: null, strategyVersion: null, classificationState: classification.state }, deal, evaluatedTimestamp: NOW });
    expect(classification.state).toBe(ASSET_CLASSIFICATION_STATES.AMBIGUOUS);
    expect(result.highestPriorityConflict).toMatchObject({ canonicalField: "property.assetType", conflictType: "classification-mismatch", blocking: true });
  });

  it.each([
    ["asking_price", "askingPrice", 100000, 110000, "deal.askingPrice", true],
    ["arv", "after_repair_value", 180000, 200000, "property.afterRepairValue", true],
    ["repairs", "repair_estimate", 20000, 30000, "property.repairs", true],
    ["occupancy", "occupancy_status", "vacant", "tenant occupied", "property.occupancy", true],
    ["mortgage_status", "loan_status", "current", "delinquent", "property.mortgageStatus", true],
    ["rent", "monthly_rent", 1200, 1400, "property.rentEstimate", false],
  ])("detects residential %s disagreement with derived criticality", (first, second, a, b, field, blocking) => {
    const result = evaluate({ [first]: a, [second]: b });
    expect(result.conflicts.find((entry) => entry.canonicalField === field)).toMatchObject({ blocking });
    expect(result.conflicts.some((entry) => entry.canonicalField.includes("legalAccess"))).toBe(false);
  });

  it.each([
    ["parcel_id", "apn", "A-1", "A-2", "property.parcelIdentity", true],
    ["legal_access", "access_status", "yes", "no", "property.legalAccess", true],
    ["zoning", "zoning_code", "R1", "R2", "property.zoning", true],
    ["permitted_use", "allowed_use", "residential", "agriculture", "property.permittedUse", true],
    ["flood_status", "flood_zone", "no", "yes", "property.floodZoneStatus", true],
    ["wetlands", "wetlands_status", "no", "yes", "property.wetlandsStatus", true],
    ["tax_status", "liens", "clear", "issue present", "property.taxesAndLiens", true],
    ["land_value", "indicated_land_value", 50000, 70000, "property.comparableLandValue", true],
    ["utilities", "utility_access", "available", "none", "property.utilities", false],
    ["builder_demand", "land_builder_demand", "high", "low", "property.builderDemand", false],
  ])("detects land %s disagreement without residential contamination", (first, second, a, b, field, blocking) => {
    const assetStrategyContext = context(ASSET_TYPES.VACANT_RESIDENTIAL_LAND);
    const result = evaluate({ asset_type: ASSET_TYPES.VACANT_RESIDENTIAL_LAND, [first]: a, [second]: b }, { assetStrategyContext });
    expect(result.conflicts.find((entry) => entry.canonicalField === field)).toMatchObject({ blocking });
    expect(result.conflicts.some((entry) => /afterRepairValue|repairs|rentEstimate/.test(entry.canonicalField))).toBe(false);
  });
});
