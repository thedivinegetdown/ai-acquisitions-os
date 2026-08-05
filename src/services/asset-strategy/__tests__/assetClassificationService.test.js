import { describe, expect, it } from "vitest";
import {
  ASSET_CLASSIFICATION_COMPATIBILITY_RULESET_VERSION,
  ASSET_CLASSIFICATION_REASON_CODES,
  ASSET_CLASSIFICATION_RESOLUTIONS,
  ASSET_CLASSIFICATION_SOURCE_KINDS,
  ASSET_CLASSIFICATION_STATES,
  ASSET_TYPES,
  classifyOpportunityAsset,
  resolveAssetTypeAlias,
} from "../index";

describe("asset classification compatibility service", () => {
  it("classifies an explicit canonical asset field and preserves supplied context", () => {
    const result = classifyOpportunityAsset(
      {
        id: "deal-1",
        asset_type: ASSET_TYPES.RESIDENTIAL_HOME,
        organization_id: "org-1",
        tenant_id: "tenant-1",
      },
      {
        evidenceReferenceIds: ["evidence-1", "evidence-1"],
        classifiedTimestamp: "2026-08-05T12:00:00Z",
      }
    );

    expect(result).toMatchObject({
      opportunityId: "deal-1",
      organizationId: "org-1",
      tenantId: "tenant-1",
      state: ASSET_CLASSIFICATION_STATES.CLASSIFIED,
      assetType: ASSET_TYPES.RESIDENTIAL_HOME,
      sourceKind: ASSET_CLASSIFICATION_SOURCE_KINDS.CANONICAL_FIELD,
      reasonCode: ASSET_CLASSIFICATION_REASON_CODES.MATCHED_CANONICAL_FIELD,
      requiresHumanReview: false,
      rulesetVersion: ASSET_CLASSIFICATION_COMPATIBILITY_RULESET_VERSION,
      classifiedTimestamp: "2026-08-05T12:00:00.000Z",
    });
    expect(result.evidenceReferenceIds).toEqual(["evidence-1"]);
  });

  it("maps an explicit vacant-land legacy value without treating it as a house", () => {
    const result = classifyOpportunityAsset({
      deal_id: "land-1",
      property_type: "Vacant land",
    });

    expect(result).toMatchObject({
      opportunityId: "land-1",
      state: ASSET_CLASSIFICATION_STATES.CLASSIFIED,
      assetType: ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
      sourceKind: ASSET_CLASSIFICATION_SOURCE_KINDS.LEGACY_PROPERTY_TYPE,
      reasonCode:
        ASSET_CLASSIFICATION_REASON_CODES.MATCHED_LEGACY_PROPERTY_TYPE,
    });
  });

  it("detects conflicts between canonical and legacy asset fields", () => {
    const result = classifyOpportunityAsset({
      asset_type: ASSET_TYPES.RESIDENTIAL_HOME,
      property_type: "Vacant land",
    });

    expect(result.state).toBe(ASSET_CLASSIFICATION_STATES.AMBIGUOUS);
    expect(result.assetType).toBeNull();
    expect(result.candidateAssetTypes).toEqual([
      ASSET_TYPES.RESIDENTIAL_HOME,
      ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
    ]);
    expect(result.reasonCode).toBe(
      ASSET_CLASSIFICATION_REASON_CODES.CONFLICTING_ASSET_TYPES
    );
    expect(result.requiresHumanReview).toBe(true);
  });

  it("requires review for broad labels that do not distinguish land from houses", () => {
    const residential = classifyOpportunityAsset({
      property_type: "Residential",
    });
    const multifamily = classifyOpportunityAsset({
      property_type: "Multifamily",
    });

    expect(residential.state).toBe(ASSET_CLASSIFICATION_STATES.AMBIGUOUS);
    expect(multifamily.state).toBe(ASSET_CLASSIFICATION_STATES.AMBIGUOUS);
    expect(residential.assetType).toBeNull();
    expect(multifamily.assetType).toBeNull();
  });

  it("keeps unsupported values truthful instead of forcing a strategy", () => {
    const result = classifyOpportunityAsset({
      asset_type: "Agricultural acreage",
    });

    expect(result).toMatchObject({
      state: ASSET_CLASSIFICATION_STATES.UNSUPPORTED,
      assetType: null,
      sourceKind: ASSET_CLASSIFICATION_SOURCE_KINDS.CANONICAL_FIELD,
      reasonCode: ASSET_CLASSIFICATION_REASON_CODES.UNSUPPORTED_ASSET_TYPE,
      requiresHumanReview: true,
    });
  });

  it("handles missing, unknown, and malformed records as unclassified", () => {
    expect(classifyOpportunityAsset(null).state).toBe(
      ASSET_CLASSIFICATION_STATES.UNCLASSIFIED
    );
    expect(
      classifyOpportunityAsset({ property_type: "Unknown" }).state
    ).toBe(ASSET_CLASSIFICATION_STATES.UNCLASSIFIED);
    expect(
      classifyOpportunityAsset({
        property_address: "123 Main Street",
        arv: 250000,
        repairs: 30000,
      }).state
    ).toBe(ASSET_CLASSIFICATION_STATES.UNCLASSIFIED);
  });

  it("does not use a generic type field as an asset classification", () => {
    const result = classifyOpportunityAsset({ type: "Vacant land" });

    expect(result.state).toBe(ASSET_CLASSIFICATION_STATES.UNCLASSIFIED);
    expect(result.sourceValues).toEqual([]);
  });

  it("classifies future and deferred asset types without activating strategies", () => {
    expect(
      classifyOpportunityAsset({ property_type: "Manufactured home" }).assetType
    ).toBe(ASSET_TYPES.MANUFACTURED_HOME);
    expect(
      classifyOpportunityAsset({ property_type: "Commercial" }).assetType
    ).toBe(ASSET_TYPES.COMMERCIAL);
  });

  it("retains a valid canonical classification when only a legacy label is unknown", () => {
    const result = classifyOpportunityAsset({
      asset_type: ASSET_TYPES.RESIDENTIAL_HOME,
      property_type: "Ranch style",
    });

    expect(result.state).toBe(ASSET_CLASSIFICATION_STATES.CLASSIFIED);
    expect(result.assetType).toBe(ASSET_TYPES.RESIDENTIAL_HOME);
    expect(result.partialDataWarnings).toContain(
      "A legacy property type was not recognized; the canonical asset type was retained."
    );
  });

  it("does not let a legacy match override an ambiguous canonical value", () => {
    const result = classifyOpportunityAsset({
      asset_type: "Residential",
      property_type: "Single family",
    });

    expect(result.state).toBe(ASSET_CLASSIFICATION_STATES.AMBIGUOUS);
    expect(result.assetType).toBeNull();
    expect(result.candidateAssetTypes).toEqual([
      ASSET_TYPES.RESIDENTIAL_HOME,
    ]);
  });

  it("exposes deterministic alias resolution without scores or confidence", () => {
    expect(resolveAssetTypeAlias("2-4 Unit")).toMatchObject({
      assetType: ASSET_TYPES.SMALL_MULTIFAMILY,
      resolution: ASSET_CLASSIFICATION_RESOLUTIONS.MATCHED,
    });
    expect(resolveAssetTypeAlias("Land")).toMatchObject({
      assetType: null,
      resolution: ASSET_CLASSIFICATION_RESOLUTIONS.AMBIGUOUS,
    });
    expect(resolveAssetTypeAlias("Castle")).toMatchObject({
      assetType: null,
      resolution: ASSET_CLASSIFICATION_RESOLUTIONS.UNSUPPORTED,
    });
  });
});
