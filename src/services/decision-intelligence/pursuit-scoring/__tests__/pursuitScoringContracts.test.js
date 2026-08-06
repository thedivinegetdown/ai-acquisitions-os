import { describe, expect, it } from "vitest";
import { ASSET_TYPES } from "../../../asset-strategy/assetStrategyContracts";
import {
  PURSUIT_SCORE_OPERATOR_DISCLAIMER,
  PURSUIT_SCORE_SCALE,
  PURSUIT_SCORING_CATEGORY_REGISTRY,
  PURSUIT_SCORING_CONTRACT_VERSION,
  PURSUIT_SCORING_EVALUATION_STATES,
  PURSUIT_SCORING_LIMITS,
  PURSUIT_SCORING_PARTIAL_POLICIES,
  PURSUIT_SCORING_PRINCIPLES,
  PURSUIT_SCORING_PROFILE_STATUSES,
  normalizePursuitScoreResult,
  normalizePursuitScoringCategory,
  normalizePursuitScoringCategoryResult,
  normalizePursuitScoringFactorDefinition,
  normalizePursuitScoringObservation,
  normalizePursuitScoringProfile,
  validatePursuitScoringProfile,
  validatePursuitScoringProfileHook,
} from "../pursuitScoringContracts";
import {
  createResidentialScoringProfile,
  createScoringStrategyContract,
  FIXTURE_EVALUATED_AT,
} from "./fixtures/pursuitScoringFixtures";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

describe("Pursuit Scoring contracts", () => {
  it("publishes the canonical contract, scale, states, principles, and categories", () => {
    expect(PURSUIT_SCORING_CONTRACT_VERSION).toBe(
      "pursuit-scoring-contract-v1"
    );
    expect(PURSUIT_SCORE_SCALE).toEqual(
      expect.objectContaining({ minimum: 0, maximum: 100 })
    );
    expect(Object.values(PURSUIT_SCORING_EVALUATION_STATES)).toEqual(
      expect.arrayContaining(["not-evaluated", "unavailable", "evaluated", "expired", "superseded", "blocked", "partial"])
    );
    expect(PURSUIT_SCORING_CATEGORY_REGISTRY.map((entry) => entry.id)).toEqual([
      "economics",
      "seller-situation",
      "timing",
      "asset-feasibility",
      "market-and-exit-fit",
      "execution-complexity",
      "risk",
      "evidence-coverage",
    ]);
    expect(PURSUIT_SCORING_PRINCIPLES).toContain(
      "No asset strategy, no score."
    );
    expect(PURSUIT_SCORE_OPERATOR_DISCLAIMER).toMatch(
      /not an instruction to purchase/i
    );
  });

  it("normalizes profile, category, and factor contracts without implicit defaults", () => {
    const profile = normalizePursuitScoringProfile(
      createResidentialScoringProfile()
    );
    expect(profile.contractVersion).toBe(PURSUIT_SCORING_CONTRACT_VERSION);
    expect(profile.categoryWeights.economics).toBe(35);
    expect(profile.factorDefinitions[0]).toEqual(
      expect.objectContaining({
        factorId: "res-acquisition-spread",
        minimumEvidenceCount: 1,
        applicableAssetType: ASSET_TYPES.RESIDENTIAL_HOME,
      })
    );

    expect(normalizePursuitScoringProfile(null)).toEqual(
      expect.objectContaining({
        profileId: null,
        strategyId: null,
        assetType: null,
        status: null,
      })
    );
    expect(normalizePursuitScoringCategory(null).categoryId).toBeNull();
    expect(normalizePursuitScoringFactorDefinition(null).factorId).toBeNull();
  });

  it("normalizes observations without fabricating source timestamps or tenant context", () => {
    const observation = normalizePursuitScoringObservation({
      observationId: "observation-1",
      factorId: "factor-1",
      strategyId: "strategy-1",
      assetType: ASSET_TYPES.RESIDENTIAL_HOME,
      evaluationState: "evaluated",
      normalizedScore: 75,
      evaluatedTimestamp: FIXTURE_EVALUATED_AT,
    });
    const result = normalizePursuitScoreResult({
      evaluationState: "blocked",
      score: 0,
    });

    expect(observation.sourceTimestamp).toBeNull();
    expect(observation.evaluatedTimestamp).toBe(FIXTURE_EVALUATED_AT);
    expect(result.organizationId).toBeNull();
    expect(result.tenantId).toBeNull();
    expect(result.score).toBeNull();
    expect(result.displayValue).toBeNull();
  });

  it("normalizes category and score results with bounded nested collections", () => {
    const factorResults = Array.from(
      { length: PURSUIT_SCORING_LIMITS.FACTORS + 10 },
      (_, index) => ({ factorId: `factor-${index}` })
    );
    const category = normalizePursuitScoringCategoryResult({
      categoryId: "economics",
      factorResults,
    });
    const result = normalizePursuitScoreResult({
      evaluationState: "evaluated",
      score: 80,
      categoryResults: Array.from(
        { length: PURSUIT_SCORING_LIMITS.CATEGORIES + 5 },
        (_, index) => ({ categoryId: `category-${index}` })
      ),
      factorResults,
    });

    expect(category.factorResults).toHaveLength(
      PURSUIT_SCORING_LIMITS.FACTORS
    );
    expect(result.categoryResults).toHaveLength(
      PURSUIT_SCORING_LIMITS.CATEGORIES
    );
    expect(result.factorResults).toHaveLength(PURSUIT_SCORING_LIMITS.FACTORS);
    expect(result.operatorDisclaimer).toBe(PURSUIT_SCORE_OPERATOR_DISCLAIMER);
  });
});

describe("Pursuit Scoring profile validation", () => {
  it("accepts a complete test-only profile and its registered strategy hook", () => {
    const profile = createResidentialScoringProfile();
    const profileValidation = validatePursuitScoringProfile(profile);
    const hookValidation = validatePursuitScoringProfileHook({
      profile,
      strategyContract: createScoringStrategyContract(profile),
    });

    expect(profileValidation.valid).toBe(true);
    expect(profileValidation.profile.status).toBe(
      PURSUIT_SCORING_PROFILE_STATUSES.TEST_ONLY
    );
    expect(hookValidation.valid).toBe(true);
    expect(hookValidation.hook.outputMetricIds).toEqual(["pursuit-score"]);
  });

  it.each([
    ["missing profile ID", (profile) => { profile.profileId = ""; }, /profile ID/i],
    ["invalid asset type", (profile) => { profile.assetType = "spaceship"; }, /asset type/i],
    ["missing strategy ID", (profile) => { profile.strategyId = ""; }, /strategy ID/i],
    ["invalid partial policy", (profile) => { profile.partialEvaluationPolicy = "sometimes"; }, /partial-evaluation/i],
    ["negative category weight", (profile) => { profile.categoryDefinitions[0].weight = -1; }, /invalid weight/i],
    ["category weights below 100", (profile) => { profile.categoryDefinitions[0].weight = 34; }, /total 100/i],
    ["category weights above 100", (profile) => { profile.categoryDefinitions[0].weight = 36; }, /total 100/i],
    ["unknown factor reference", (profile) => { profile.categoryDefinitions[0].factorIds.push("missing-factor"); }, /unknown factor/i],
    ["factor assigned to unknown category", (profile) => { profile.factorDefinitions[0].categoryId = "unknown"; }, /unknown category/i],
    ["missing Evidence requirement", (profile) => { profile.factorDefinitions[0].evidenceRequirementIds = []; }, /Evidence requirement ID/i],
    ["cross-asset factor", (profile) => { profile.factorDefinitions[0].applicableAssetType = ASSET_TYPES.VACANT_RESIDENTIAL_LAND; }, /does not match profile asset type/i],
  ])("rejects %s", (_name, mutate, expectedError) => {
    const profile = clone(createResidentialScoringProfile());
    mutate(profile);
    const validation = validatePursuitScoringProfile(profile);
    expect(validation.valid).toBe(false);
    expect(validation.errors.join(" ")).toMatch(expectedError);
  });

  it("rejects duplicate categories, factors, and category factor references", () => {
    const duplicateCategory = clone(createResidentialScoringProfile());
    duplicateCategory.categoryDefinitions.push(
      clone(duplicateCategory.categoryDefinitions[0])
    );
    expect(
      validatePursuitScoringProfile(duplicateCategory).errors.join(" ")
    ).toMatch(/category IDs must be unique/i);

    const duplicateFactor = clone(createResidentialScoringProfile());
    duplicateFactor.factorDefinitions.push(
      clone(duplicateFactor.factorDefinitions[0])
    );
    expect(
      validatePursuitScoringProfile(duplicateFactor).errors.join(" ")
    ).toMatch(/factor IDs must be unique/i);

    const duplicateReference = clone(createResidentialScoringProfile());
    duplicateReference.categoryDefinitions[0].factorIds.push(
      duplicateReference.categoryDefinitions[0].factorIds[0]
    );
    expect(
      validatePursuitScoringProfile(duplicateReference).errors.join(" ")
    ).toMatch(/duplicate factor references/i);
  });

  it("rejects factor weights that do not total 100 within a category", () => {
    const profile = clone(createResidentialScoringProfile());
    profile.factorDefinitions[0].weightWithinCategory = 50;
    profile.factorDefinitions[0].maximumContribution = 50;
    const validation = validatePursuitScoringProfile(profile);
    expect(validation.errors.join(" ")).toMatch(
      /Factor weights in category economics must total 100/i
    );
  });

  it("accepts active status without creating an implicit production registry", () => {
    const active = validatePursuitScoringProfile(
      createResidentialScoringProfile({
        status: PURSUIT_SCORING_PROFILE_STATUSES.ACTIVE,
      })
    );
    const missing = validatePursuitScoringProfile(null);

    expect(active.valid).toBe(true);
    expect(active.profile.status).toBe("active");
    expect(missing.valid).toBe(false);
    expect(missing.profile.profileId).toBeNull();
  });

  it("rejects a profile whose strategy hook is absent or cross-asset", () => {
    const profile = createResidentialScoringProfile();
    const absent = validatePursuitScoringProfileHook({
      profile,
      strategyContract: createScoringStrategyContract(profile, {
        capabilities: { pursuitScoringHooks: [] },
      }),
    });
    const crossAsset = validatePursuitScoringProfileHook({
      profile,
      strategyContract: createScoringStrategyContract(profile, {
        assetType: ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
      }),
    });

    expect(absent.valid).toBe(false);
    expect(absent.errors.join(" ")).toMatch(/registered pursuit-scoring hook/i);
    expect(crossAsset.valid).toBe(false);
    expect(crossAsset.errors.join(" ")).toMatch(/asset type does not match/i);
  });

  it("preserves a valid explicit partial policy", () => {
    const validation = validatePursuitScoringProfile(
      createResidentialScoringProfile({
        partialEvaluationPolicy:
          PURSUIT_SCORING_PARTIAL_POLICIES.ALLOW_OPTIONAL_OMISSIONS,
      })
    );
    expect(validation.valid).toBe(true);
  });
});
