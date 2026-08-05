import { describe, expect, it } from "vitest";
import {
  ASSET_CLASSIFICATION_STATES,
  ASSET_STRATEGY_ANALYSIS_GATE_REASONS,
  ASSET_STRATEGY_CAPABILITY_KEYS,
  ASSET_STRATEGY_CONTRACT_VERSION,
  ASSET_STRATEGY_CRITICALITIES,
  ASSET_STRATEGY_REQUIREMENT_SCOPES,
  ASSET_STRATEGY_STATUSES,
  ASSET_TYPES,
  ASSET_TYPE_REGISTRY,
  ASSET_TYPE_ROADMAP_STATES,
  evaluateAssetStrategyAnalysisGate,
  normalizeAssetClassification,
  normalizeAssetStrategyContract,
  validateAssetStrategyContract,
} from "../index";
import { DECISION_CONTRACT_VERSION } from "../../decision-intelligence";

function createContractReviewFixture(assetType, prefix, status = ASSET_STRATEGY_STATUSES.DRAFT) {
  const factId = `${prefix}-identity`;
  const verificationRequirementId = `${prefix}-identity-verification`;

  return {
    strategyId: `${prefix}-acquisition`,
    strategyVersion: "contract-review-v1",
    label: `${prefix} acquisition contract review`,
    assetType,
    status,
    capabilities: {
      requiredFacts: [
        {
          factId,
          label: `${prefix} identity`,
          canonicalField: `property.${prefix}Identity`,
          criticality: ASSET_STRATEGY_CRITICALITIES.BLOCKING,
          requiredFor: [
            ASSET_STRATEGY_REQUIREMENT_SCOPES.IDENTIFICATION,
            ASSET_STRATEGY_REQUIREMENT_SCOPES.UNDERWRITING,
          ],
          verificationRequirementIds: [verificationRequirementId],
          evidenceRequired: true,
        },
      ],
      dataCompletenessRules: [
        {
          ruleId: `${prefix}-completeness`,
          label: `${prefix} completeness review`,
          requiredFactIds: [factId],
          blockingFactIds: [factId],
          evidenceRequirementIds: [verificationRequirementId],
          outputMetricIds: ["data-completeness"],
        },
      ],
      underwritingHooks: [
        {
          hookId: `${prefix}-underwriting`,
          label: `${prefix} underwriting hook`,
          inputFactIds: [factId],
          outputKeys: [`${prefix}-underwriting-result`],
          evidenceRequirementIds: [verificationRequirementId],
        },
      ],
      riskRules: [
        {
          ruleId: `${prefix}-risk`,
          label: `${prefix} risk rule`,
          requiredFactIds: [factId],
          evidenceRequirementIds: [verificationRequirementId],
          outputMetricIds: ["risk-level"],
        },
      ],
      pursuitScoringHooks: [
        {
          hookId: `${prefix}-pursuit`,
          label: `${prefix} pursuit hook`,
          inputFactIds: [factId],
          evidenceRequirementIds: [verificationRequirementId],
          outputMetricIds: ["pursuit-score"],
        },
      ],
      readinessGates: [
        {
          gateId: `${prefix}-readiness`,
          label: `${prefix} readiness gate`,
          requiredFactIds: [factId],
          blockingFactIds: [factId],
          evidenceRequirementIds: [verificationRequirementId],
          outputMetricIds: ["offer-readiness"],
        },
      ],
      offerLogic: [
        {
          ruleId: `${prefix}-offer`,
          label: `${prefix} offer rule`,
          requiredFactIds: [factId],
          evidenceRequirementIds: [verificationRequirementId],
          actionCodes: ["prepare-offer-review"],
        },
      ],
      exitStrategies: [
        {
          exitStrategyId: `${prefix}-manual-review`,
          label: `${prefix} manual exit review`,
          requiredFactIds: [factId],
          evidenceRequirementIds: [verificationRequirementId],
        },
      ],
      buyerMatchingRules: [
        {
          ruleId: `${prefix}-buyer-fit`,
          label: `${prefix} buyer fit rule`,
          requiredFactIds: [factId],
          evidenceRequirementIds: [verificationRequirementId],
        },
      ],
      verificationRequirements: [
        {
          verificationRequirementId,
          label: `Verify ${prefix} identity`,
          requiredFactIds: [factId],
          criticality: ASSET_STRATEGY_CRITICALITIES.BLOCKING,
          acceptableSourceTypes: ["manual-record"],
          humanReviewRequired: true,
        },
      ],
    },
  };
}

describe("shared asset strategy contracts", () => {
  it("publishes the approved taxonomy and roadmap order without activating strategies", () => {
    expect(ASSET_STRATEGY_CONTRACT_VERSION).toBe("asset-strategy-contract-v1");
    expect(ASSET_TYPE_REGISTRY.map((definition) => definition.id)).toEqual([
      ASSET_TYPES.RESIDENTIAL_HOME,
      ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
      ASSET_TYPES.SMALL_MULTIFAMILY,
      ASSET_TYPES.MANUFACTURED_HOME,
      ASSET_TYPES.COMMERCIAL,
    ]);
    expect(ASSET_TYPE_REGISTRY.map((definition) => definition.priority)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(ASSET_TYPE_REGISTRY[3].roadmapState).toBe(
      ASSET_TYPE_ROADMAP_STATES.LATER
    );
    expect(ASSET_TYPE_REGISTRY[4].roadmapState).toBe(
      ASSET_TYPE_ROADMAP_STATES.DEFERRED
    );
  });

  it("normalizes every required capability section and links to DI-01", () => {
    const normalized = normalizeAssetStrategyContract(
      createContractReviewFixture(ASSET_TYPES.RESIDENTIAL_HOME, "residential")
    );

    expect(normalized.contractVersion).toBe(ASSET_STRATEGY_CONTRACT_VERSION);
    expect(normalized.decisionContractVersion).toBe(DECISION_CONTRACT_VERSION);
    expect(Object.keys(normalized.capabilities)).toEqual(
      ASSET_STRATEGY_CAPABILITY_KEYS
    );
    expect(
      ASSET_STRATEGY_CAPABILITY_KEYS.every(
        (sectionKey) => normalized.capabilities[sectionKey].length === 1
      )
    ).toBe(true);
  });

  it("accepts residential and land examples as contract-review fixtures only", () => {
    const residential = validateAssetStrategyContract(
      createContractReviewFixture(ASSET_TYPES.RESIDENTIAL_HOME, "residential")
    );
    const land = validateAssetStrategyContract(
      createContractReviewFixture(
        ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
        "parcel"
      )
    );

    expect(residential.valid).toBe(true);
    expect(land.valid).toBe(true);
    expect(residential.contract.status).toBe(ASSET_STRATEGY_STATUSES.DRAFT);
    expect(land.contract.status).toBe(ASSET_STRATEGY_STATUSES.DRAFT);
  });

  it("rejects contracts that omit required capabilities", () => {
    const validation = validateAssetStrategyContract({
      strategyId: "incomplete",
      strategyVersion: "v1",
      label: "Incomplete",
      assetType: ASSET_TYPES.RESIDENTIAL_HOME,
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain(
      "requiredFacts must define at least one entry."
    );
    expect(validation.errors).toContain(
      "verificationRequirements must define at least one entry."
    );
  });

  it("rejects broken fact, verification, and Decision Intelligence references", () => {
    const fixture = createContractReviewFixture(
      ASSET_TYPES.RESIDENTIAL_HOME,
      "residential"
    );
    fixture.capabilities.riskRules[0].requiredFactIds = ["missing-fact"];
    fixture.capabilities.riskRules[0].evidenceRequirementIds = [
      "missing-verification",
    ];
    fixture.capabilities.riskRules[0].outputMetricIds = ["opaque-score"];
    const validation = validateAssetStrategyContract(fixture);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain(
      "riskRules references unknown fact missing-fact."
    );
    expect(validation.errors).toContain(
      "riskRules references unknown verification requirement missing-verification."
    );
    expect(validation.errors).toContain(
      "riskRules references unknown decision metric opaque-score."
    );
    expect(validation.errors).toContain("riskRules must target risk-level.");
  });

  it("keeps runtime callbacks out of the serializable strategy contract", () => {
    const fixture = createContractReviewFixture(
      ASSET_TYPES.RESIDENTIAL_HOME,
      "residential"
    );
    fixture.capabilities.underwritingHooks[0].run = () => "not allowed";
    const normalized = normalizeAssetStrategyContract(fixture);

    expect(normalized.capabilities.underwritingHooks[0]).not.toHaveProperty("run");
    expect(() => JSON.stringify(normalized)).not.toThrow();
  });

  it("blocks analysis until classification is explicit and review-safe", () => {
    const strategy = createContractReviewFixture(
      ASSET_TYPES.RESIDENTIAL_HOME,
      "residential",
      ASSET_STRATEGY_STATUSES.ACTIVE
    );
    const unclassified = evaluateAssetStrategyAnalysisGate({
      classification: {},
      strategy,
    });
    const ambiguous = evaluateAssetStrategyAnalysisGate({
      classification: {
        state: ASSET_CLASSIFICATION_STATES.AMBIGUOUS,
        candidateAssetTypes: [
          ASSET_TYPES.RESIDENTIAL_HOME,
          ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
        ],
      },
      strategy,
    });

    expect(unclassified.reason).toBe(
      ASSET_STRATEGY_ANALYSIS_GATE_REASONS.ASSET_UNCLASSIFIED
    );
    expect(ambiguous.reason).toBe(
      ASSET_STRATEGY_ANALYSIS_GATE_REASONS.ASSET_CLASSIFICATION_REVIEW_REQUIRED
    );
  });

  it("prevents vacant land from running through an active residential strategy", () => {
    const residentialStrategy = createContractReviewFixture(
      ASSET_TYPES.RESIDENTIAL_HOME,
      "residential",
      ASSET_STRATEGY_STATUSES.ACTIVE
    );
    const result = evaluateAssetStrategyAnalysisGate({
      classification: normalizeAssetClassification({
        state: ASSET_CLASSIFICATION_STATES.CLASSIFIED,
        assetType: ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
      }),
      strategy: residentialStrategy,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(
      ASSET_STRATEGY_ANALYSIS_GATE_REASONS.ASSET_STRATEGY_MISMATCH
    );
  });

  it("allows only an active strategy matching the classified asset", () => {
    const draft = createContractReviewFixture(
      ASSET_TYPES.RESIDENTIAL_HOME,
      "residential"
    );
    const classification = {
      state: ASSET_CLASSIFICATION_STATES.CLASSIFIED,
      assetType: ASSET_TYPES.RESIDENTIAL_HOME,
    };
    const inactiveResult = evaluateAssetStrategyAnalysisGate({
      classification,
      strategy: draft,
    });
    const activeResult = evaluateAssetStrategyAnalysisGate({
      classification,
      strategy: {
        ...draft,
        status: ASSET_STRATEGY_STATUSES.ACTIVE,
      },
    });

    expect(inactiveResult.reason).toBe(
      ASSET_STRATEGY_ANALYSIS_GATE_REASONS.STRATEGY_INACTIVE
    );
    expect(activeResult).toMatchObject({
      allowed: true,
      reason: ASSET_STRATEGY_ANALYSIS_GATE_REASONS.READY,
    });
  });
});
