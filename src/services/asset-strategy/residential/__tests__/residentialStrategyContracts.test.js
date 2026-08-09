import { describe, expect, it } from "vitest";
import { ASSET_TYPES } from "../../assetStrategyContracts";
import {
  RESIDENTIAL_ACQUISITION_STRATEGY,
  RESIDENTIAL_CAPABILITY_STATES,
  RESIDENTIAL_CAPABILITY_SUPPORT,
  RESIDENTIAL_FACT_IDS,
  RESIDENTIAL_PURSUIT_PROFILE_ID,
  RESIDENTIAL_PURSUIT_RULESET_VERSION,
  RESIDENTIAL_STRATEGY_ID,
  RESIDENTIAL_STRATEGY_VERSION,
  RESIDENTIAL_UNDERWRITING_POLICY,
  RESIDENTIAL_UNDERWRITING_POLICY_VERSION,
  validateResidentialStrategyContract,
} from "../residentialStrategyContracts";
import {
  RESIDENTIAL_OPTIONAL_PURSUIT_FACTOR_IDS,
  RESIDENTIAL_PURSUIT_SCORING_PROFILE,
  RESIDENTIAL_REQUIRED_PURSUIT_FACTOR_IDS,
  validateResidentialPursuitProfile,
} from "../residentialPursuitProfile";

describe("Residential Strategy contracts", () => {
  it("registers one active residential-home strategy with explicit capability states", () => {
    const validation = validateResidentialStrategyContract();

    expect(validation.valid).toBe(true);
    expect(RESIDENTIAL_ACQUISITION_STRATEGY).toMatchObject({
      strategyId: RESIDENTIAL_STRATEGY_ID,
      strategyVersion: RESIDENTIAL_STRATEGY_VERSION,
      assetType: ASSET_TYPES.RESIDENTIAL_HOME,
      status: "active",
    });
    expect(RESIDENTIAL_CAPABILITY_SUPPORT).toMatchObject({
      underwriting: RESIDENTIAL_CAPABILITY_STATES.IMPLEMENTED,
      pursuitScoring: RESIDENTIAL_CAPABILITY_STATES.IMPLEMENTED,
      riskSignals: RESIDENTIAL_CAPABILITY_STATES.IMPLEMENTED,
      exitCandidateReview: RESIDENTIAL_CAPABILITY_STATES.IMPLEMENTED,
      offerReadiness: RESIDENTIAL_CAPABILITY_STATES.COMPATIBILITY_ONLY,
      offerRangePreparation: RESIDENTIAL_CAPABILITY_STATES.REVIEW_ONLY,
      autonomousOfferGeneration: RESIDENTIAL_CAPABILITY_STATES.UNAVAILABLE,
    });
  });

  it("centralizes the exact versioned underwriting assumptions", () => {
    expect(RESIDENTIAL_UNDERWRITING_POLICY).toMatchObject({
      policyVersion: RESIDENTIAL_UNDERWRITING_POLICY_VERSION,
      acquisitionCeilingFactor: 0.7,
      sellingCostReserve: 0.08,
      targetWholesaleFee: 10000,
    });
    expect(RESIDENTIAL_UNDERWRITING_POLICY.assumptionDisclosure).toContain(
      "not guarantees"
    );
  });

  it("declares the required residential facts without land contamination", () => {
    const serialized = JSON.stringify(RESIDENTIAL_ACQUISITION_STRATEGY).toLowerCase();

    expect(Object.values(RESIDENTIAL_FACT_IDS)).toEqual(
      expect.arrayContaining([
        "asking-price",
        "after-repair-value",
        "repair-estimate",
        "seller-motivation",
        "seller-timeline",
      ])
    );
    expect(serialized).not.toMatch(/wetlands|legal-access|buildability/);
  });

  it("validates the active production profile and exact category weights", () => {
    const validation = validateResidentialPursuitProfile();
    const weights = Object.fromEntries(
      RESIDENTIAL_PURSUIT_SCORING_PROFILE.categoryDefinitions.map((category) => [
        category.categoryId,
        category.weight,
      ])
    );

    expect(validation.valid).toBe(true);
    expect(RESIDENTIAL_PURSUIT_SCORING_PROFILE).toMatchObject({
      profileId: RESIDENTIAL_PURSUIT_PROFILE_ID,
      profileVersion: RESIDENTIAL_PURSUIT_PROFILE_ID,
      rulesetVersion: RESIDENTIAL_PURSUIT_RULESET_VERSION,
      strategyId: RESIDENTIAL_STRATEGY_ID,
      strategyVersion: RESIDENTIAL_STRATEGY_VERSION,
      assetType: ASSET_TYPES.RESIDENTIAL_HOME,
      status: "active",
      partialEvaluationPolicy: "allow-optional-omissions",
      roundingPolicy: "nearest-integer",
    });
    expect(weights).toEqual({
      economics: 40,
      "seller-situation": 20,
      timing: 10,
      "asset-feasibility": 15,
      "market-and-exit-fit": 10,
      "execution-complexity": 5,
    });
    expect(Object.values(weights).reduce((sum, value) => sum + value, 0)).toBe(100);
  });

  it("separates required and optional factors and excludes legacy or AI inputs", () => {
    const serialized = JSON.stringify(RESIDENTIAL_PURSUIT_SCORING_PROFILE).toLowerCase();

    expect(RESIDENTIAL_REQUIRED_PURSUIT_FACTOR_IDS).toHaveLength(7);
    expect(RESIDENTIAL_OPTIONAL_PURSUIT_FACTOR_IDS).toEqual([
      "residential-mortgage-flexibility",
      "residential-occupancy-complexity",
    ]);
    expect(serialized).not.toMatch(/lead_score|wetlands|legal-access|buildability|ai-/);
  });

  it("rejects a strategy/profile asset mismatch", () => {
    const validation = validateResidentialPursuitProfile({
      ...RESIDENTIAL_PURSUIT_SCORING_PROFILE,
      assetType: ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors.join(" ")).toMatch(/asset|Residential Pursuit profile/i);
  });
});
