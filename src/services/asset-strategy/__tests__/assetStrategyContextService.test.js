import { describe, expect, it } from "vitest";
import {
  ASSET_CAPABILITY_IDS,
  ASSET_CAPABILITY_REASON_CODES,
  ASSET_CLASSIFICATION_STATES,
  ASSET_STRATEGY_STATUSES,
  ASSET_STRATEGY_SUPPORT_STATES,
  ASSET_TYPES,
  buildAssetStrategyContext,
  canRunAssetCapability,
} from "../index";

function deal(overrides = {}) {
  return {
    id: "deal-1",
    organization_id: "org-1",
    tenant_id: "tenant-1",
    property_address: "123 Main Street",
    owner_name: "Sam Seller",
    ...overrides,
  };
}

describe("asset strategy runtime context", () => {
  it("marks classified residential homes as compatibility-only", () => {
    const context = buildAssetStrategyContext(
      deal({ asset_type: ASSET_TYPES.RESIDENTIAL_HOME })
    );

    expect(context).toMatchObject({
      dealId: "deal-1",
      organizationId: "org-1",
      tenantId: "tenant-1",
      assetType: ASSET_TYPES.RESIDENTIAL_HOME,
      assetTypeLabel: "Residential home",
      classificationState: ASSET_CLASSIFICATION_STATES.CLASSIFIED,
      selectedStrategyId: "residential-acquisition",
      strategySupportState: ASSET_STRATEGY_SUPPORT_STATES.COMPATIBILITY_ONLY,
      strategySupportLabel: "Compatibility Analysis",
      compatibilityAnalysisEligibility: true,
      strategyLifecycleStatus: null,
    });
    expect(context.strategyAnalysisGate.allowed).toBe(false);
    expect(context.compatibilityWarning).toContain("not the completed");
  });

  it("reports the scoring framework without activating a concrete profile", () => {
    const context = buildAssetStrategyContext(
      deal({ asset_type: ASSET_TYPES.RESIDENTIAL_HOME })
    );

    expect(context.pursuitScoring).toEqual(
      expect.objectContaining({
        frameworkAvailable: true,
        strategyHookContractAvailable: true,
        concreteProfileAvailable: false,
        productionProfileAvailable: false,
        evaluationState: "not-evaluated",
      })
    );
    expect(context.decisionIntegrationFields.pursuitScoring).toEqual(
      context.pursuitScoring
    );
  });

  it.each([
    [
      "vacant land",
      ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
      "vacant-land-acquisition",
    ],
    [
      "small multifamily",
      ASSET_TYPES.SMALL_MULTIFAMILY,
      "small-multifamily-acquisition",
    ],
  ])(
    "marks %s as contract-ready without implementing its strategy",
    (_, assetType, strategyId) => {
      const context = buildAssetStrategyContext(deal({ asset_type: assetType }));

      expect(context).toMatchObject({
        assetType,
        selectedStrategyId: strategyId,
        strategySupportState: ASSET_STRATEGY_SUPPORT_STATES.CONTRACT_READY,
        strategySupportLabel: "Strategy Not Yet Implemented",
        compatibilityAnalysisEligibility: false,
        strategyLifecycleStatus: null,
      });
    }
  );

  it.each([
    ["manufactured home", ASSET_TYPES.MANUFACTURED_HOME],
    ["commercial", ASSET_TYPES.COMMERCIAL],
  ])("marks %s support as deferred", (_, assetType) => {
    const context = buildAssetStrategyContext(deal({ asset_type: assetType }));

    expect(context).toMatchObject({
      assetType,
      strategySupportState: ASSET_STRATEGY_SUPPORT_STATES.DEFERRED,
      strategySupportLabel: "Deferred",
      strategyLifecycleStatus: ASSET_STRATEGY_STATUSES.DEFERRED,
      compatibilityAnalysisEligibility: false,
    });
  });

  it("keeps an unknown asset unassigned without a residential fallback", () => {
    const context = buildAssetStrategyContext(
      deal({ arv: 250000, repairs: 30000, property_condition: "Good" })
    );

    expect(context).toMatchObject({
      assetType: null,
      assetTypeLabel: "Asset type unknown",
      classificationState: ASSET_CLASSIFICATION_STATES.UNCLASSIFIED,
      selectedStrategyId: null,
      strategySupportState: ASSET_STRATEGY_SUPPORT_STATES.UNASSIGNED,
      compatibilityAnalysisEligibility: false,
      manualReviewRequired: true,
    });
  });

  it("keeps an unsupported stored asset blocked and reviewable", () => {
    const context = buildAssetStrategyContext(
      deal({ asset_type: "special-purpose" })
    );
    const gate = canRunAssetCapability(
      context,
      ASSET_CAPABILITY_IDS.RESIDENTIAL_UNDERWRITING
    );

    expect(context).toMatchObject({
      assetType: null,
      classificationState: ASSET_CLASSIFICATION_STATES.UNSUPPORTED,
      strategySupportState: ASSET_STRATEGY_SUPPORT_STATES.UNSUPPORTED,
      compatibilityAnalysisEligibility: false,
      manualReviewRequired: true,
    });
    expect(gate).toMatchObject({
      allowed: false,
      reasonCode: ASSET_CAPABILITY_REASON_CODES.ASSET_UNSUPPORTED,
    });
    expect(context.classificationEvidence).toHaveLength(1);
  });

  it("keeps conflicting explicit fields unassigned and evidence-backed", () => {
    const context = buildAssetStrategyContext(
      deal({
        asset_type: ASSET_TYPES.RESIDENTIAL_HOME,
        property_type: "Vacant land",
      })
    );

    expect(context.classificationState).toBe(
      ASSET_CLASSIFICATION_STATES.AMBIGUOUS
    );
    expect(context.assetType).toBeNull();
    expect(context.selectedStrategyId).toBeNull();
    expect(context.strategySupportState).toBe(
      ASSET_STRATEGY_SUPPORT_STATES.UNASSIGNED
    );
    expect(context.manualReviewRequired).toBe(true);
    expect(context.classificationEvidence).toHaveLength(2);
    expect(context.classificationConflicts).toHaveLength(1);
    expect(context.classificationConflicts[0].evidenceReferenceIds).toHaveLength(
      2
    );
  });

  it("allows generic CRM capabilities regardless of classification", () => {
    const unknown = buildAssetStrategyContext(deal());
    const land = buildAssetStrategyContext(
      deal({ asset_type: ASSET_TYPES.VACANT_RESIDENTIAL_LAND })
    );

    for (const context of [unknown, land]) {
      expect(
        canRunAssetCapability(context, ASSET_CAPABILITY_IDS.COMMUNICATION)
      ).toMatchObject({
        allowed: true,
        reasonCode: ASSET_CAPABILITY_REASON_CODES.GENERIC_AVAILABLE,
        compatibilityOnly: false,
      });
      expect(
        canRunAssetCapability(
          context,
          ASSET_CAPABILITY_IDS.GENERIC_CLOSEOUT_RECORDS
        ).allowed
      ).toBe(true);
    }
  });

  it("allows residential capabilities only for classified residential homes", () => {
    const residential = buildAssetStrategyContext(
      deal({ property_type: "Single family" })
    );
    const unknown = buildAssetStrategyContext(deal());

    expect(
      canRunAssetCapability(
        residential,
        ASSET_CAPABILITY_IDS.RESIDENTIAL_OFFER_READINESS
      )
    ).toMatchObject({
      allowed: true,
      reasonCode:
        ASSET_CAPABILITY_REASON_CODES.RESIDENTIAL_COMPATIBILITY_AVAILABLE,
      compatibilityOnly: true,
    });
    expect(
      canRunAssetCapability(
        unknown,
        ASSET_CAPABILITY_IDS.RESIDENTIAL_OFFER_READINESS
      )
    ).toMatchObject({
      allowed: false,
      reasonCode: ASSET_CAPABILITY_REASON_CODES.CLASSIFICATION_REQUIRED,
      assetType: null,
    });
  });

  it("does not trust a standalone compatibility eligibility flag", () => {
    const gate = canRunAssetCapability(
      {
        compatibilityAnalysisEligibility: true,
        classificationState: ASSET_CLASSIFICATION_STATES.UNCLASSIFIED,
        assetType: null,
      },
      ASSET_CAPABILITY_IDS.RESIDENTIAL_UNDERWRITING
    );

    expect(gate).toMatchObject({
      allowed: false,
      reasonCode: ASSET_CAPABILITY_REASON_CODES.CLASSIFICATION_REQUIRED,
      assetType: null,
    });
  });

  it("blocks every residential capability for vacant land", () => {
    const context = buildAssetStrategyContext(
      deal({ property_type: "Vacant land" })
    );
    const gate = canRunAssetCapability(
      context,
      ASSET_CAPABILITY_IDS.RESIDENTIAL_UNDERWRITING
    );

    expect(gate).toMatchObject({
      allowed: false,
      reasonCode: ASSET_CAPABILITY_REASON_CODES.STRATEGY_NOT_IMPLEMENTED,
      assetType: ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
      compatibilityOnly: true,
    });
    expect(gate.explanation).toContain("cannot use residential underwriting");
    expect(context.blockedCapabilities).toContain(
      ASSET_CAPABILITY_IDS.RESIDENTIAL_OFFER_GENERATION
    );
  });

  it("adapts each stored classification field into truthful DI evidence", () => {
    const context = buildAssetStrategyContext(
      deal({
        asset_type: ASSET_TYPES.RESIDENTIAL_HOME,
        updated_at: "2026-08-04T10:30:00Z",
      })
    );
    const evidence = context.classificationEvidence[0];

    expect(evidence).toMatchObject({
      sourceType: "crm-asset-classification",
      sourceSystem: "Deal record",
      sourceRecordId: "deal-1",
      sourceField: "asset_type",
      sourceTimestamp: "2026-08-04T10:30:00.000Z",
      extractionMethod: "explicit-field-compatibility-mapping",
      verificationState: "unknown",
      trustLevel: "unknown",
      organizationId: "org-1",
      tenantId: "tenant-1",
    });
    expect(evidence.valueSummary).toContain("residential-home");
    expect(evidence.provenanceDetails).toMatchObject({
      storedValue: ASSET_TYPES.RESIDENTIAL_HOME,
      mappedCanonicalAssetType: ASSET_TYPES.RESIDENTIAL_HOME,
      sourceTimestampScope: "record",
    });
    expect(context.sourceWarnings).toContain(
      "Stored asset classification is compatibility evidence and has not been independently verified."
    );
  });

  it("does not fabricate classification timestamps", () => {
    const context = buildAssetStrategyContext(
      deal({ property_type: "Vacant land" })
    );

    expect(context.classification.classifiedTimestamp).toBeNull();
    expect(context.classificationEvidence[0].sourceTimestamp).toBeNull();
    expect(
      context.classificationEvidence[0].provenanceDetails.sourceTimestampScope
    ).toBe("unavailable");
  });

  it("returns an unassigned safe context when classification fields throw", () => {
    const malformed = deal();
    Object.defineProperty(malformed, "asset_type", {
      get() {
        throw new Error("classification read failed");
      },
    });
    const context = buildAssetStrategyContext(malformed);

    expect(context.classificationState).toBe(
      ASSET_CLASSIFICATION_STATES.UNCLASSIFIED
    );
    expect(context.compatibilityAnalysisEligibility).toBe(false);
    expect(context.sourceWarnings).toContain(
      "Asset classification could not be read from the current CRM record."
    );
  });
});
