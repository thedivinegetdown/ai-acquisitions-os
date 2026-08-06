import { describe, expect, it } from "vitest";
import {
  ASSET_CLASSIFICATION_STATES,
  ASSET_TYPES,
} from "../../../asset-strategy/assetStrategyContracts";
import { ASSET_STRATEGY_SUPPORT_STATES } from "../../../asset-strategy/assetStrategyContextService";
import {
  PURSUIT_SCORING_EVALUATION_STATES,
  PURSUIT_SCORING_INFORMATION_STATES,
  PURSUIT_SCORING_PARTIAL_POLICIES,
  PURSUIT_SCORING_PROFILE_STATUSES,
} from "../pursuitScoringContracts";
import {
  evaluatePursuitScore,
  roundAndClampPursuitScore,
} from "../pursuitScoringEngine";
import {
  createLandScoringProfile,
  createResidentialScoringProfile,
  createScoringEvidence,
  createScoringInput,
  createScoringObservations,
  FIXTURE_EVALUATED_AT,
} from "./fixtures/pursuitScoringFixtures";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

describe("deterministic Pursuit Scoring engine", () => {
  it("returns not evaluated when no concrete scoring profile is supplied", () => {
    const result = evaluatePursuitScore({
      assetStrategyContext: {},
      evaluatedTimestamp: FIXTURE_EVALUATED_AT,
    });
    expect(result.evaluationState).toBe("not-evaluated");
    expect(result.score).toBeNull();
    expect(result.displayValue).toBeNull();
  });

  it("produces the same deterministic residential result from the same observations", () => {
    const profile = createResidentialScoringProfile();
    const input = createScoringInput(profile);
    const first = evaluatePursuitScore(input);
    const second = evaluatePursuitScore(clone(input));

    expect(first.evaluationState).toBe("evaluated");
    expect(first.score).toBe(75);
    expect(second).toEqual(first);
    expect(first.categoryResults).toHaveLength(5);
    expect(first.factorResults).toHaveLength(7);
    expect(first.evidenceReferenceIds).toHaveLength(7);
    expect(first.categoryResults[0]).toEqual(
      expect.objectContaining({
        categoryId: "economics",
        rawCategoryScore: 72,
        weightedContribution: 25.2,
      })
    );
  });

  it("produces a separate deterministic vacant-land fixture result", () => {
    const profile = createLandScoringProfile();
    const result = evaluatePursuitScore(createScoringInput(profile));
    const fixtureText = JSON.stringify(profile).toLowerCase();

    expect(result.evaluationState).toBe("evaluated");
    expect(result.score).toBe(72);
    expect(result.assetType).toBe(ASSET_TYPES.VACANT_RESIDENTIAL_LAND);
    expect(fixtureText).not.toMatch(/\barv\b|house mao|house repair|\brent\b/);
  });

  it("keeps residential fixture assumptions separate from land buildability", () => {
    const residential = createResidentialScoringProfile();
    const fixtureText = JSON.stringify(residential).toLowerCase();
    expect(fixtureText).not.toMatch(/wetlands|legal access|buildability/);
  });

  it("does not accept residential observations for a vacant-land profile", () => {
    const land = createLandScoringProfile();
    const residential = createResidentialScoringProfile();
    const result = evaluatePursuitScore({
      ...createScoringInput(land),
      factorObservations: createScoringObservations(residential),
      evidenceReferences: createScoringEvidence(residential),
    });
    expect(result.evaluationState).toBe("blocked");
    expect(result.score).toBeNull();
  });

  it("does not accept land observations for a residential profile", () => {
    const residential = createResidentialScoringProfile();
    const land = createLandScoringProfile();
    const result = evaluatePursuitScore({
      ...createScoringInput(residential),
      factorObservations: createScoringObservations(land),
      evidenceReferences: createScoringEvidence(land),
    });
    expect(result.evaluationState).toBe("blocked");
    expect(result.score).toBeNull();
  });

  it("blocks a profile-defined Missing Information requirement without substituting zero", () => {
    const profile = createResidentialScoringProfile();
    const result = evaluatePursuitScore({
      ...createScoringInput(profile),
      missingInformationReadModel: {
        limitations: [],
        openItems: [
          {
            itemId: "missing-arv",
            requirementId: "residential-property-arvorcomps",
            label: "ARV or comps",
            state: "missing",
          },
        ],
      },
    });
    expect(result.evaluationState).toBe("blocked");
    expect(result.score).toBeNull();
    expect(result.blockingIssueIds).toContain("missing-arv");
  });

  it("does not let an unrelated advisory item block scoring", () => {
    const profile = createResidentialScoringProfile();
    const result = evaluatePursuitScore({
      ...createScoringInput(profile),
      missingInformationReadModel: {
        limitations: [],
        openItems: [
          {
            itemId: "advisory-note",
            requirementId: "seller-timeline-note",
            label: "Optional note",
            state: "missing",
            criticality: "advisory",
          },
        ],
      },
    });
    expect(result.evaluationState).toBe("evaluated");
    expect(result.score).toBe(75);
  });

  it("blocks missing and unknown required factor observations", () => {
    const profile = createResidentialScoringProfile();
    const input = createScoringInput(profile);
    const missing = evaluatePursuitScore({
      ...input,
      factorObservations: input.factorObservations.filter(
        (entry) => entry.factorId !== "res-acquisition-spread"
      ),
    });
    const unknownObservations = clone(input.factorObservations);
    const unknown = unknownObservations.find(
      (entry) => entry.factorId === "res-acquisition-spread"
    );
    unknown.informationState = PURSUIT_SCORING_INFORMATION_STATES.UNKNOWN;
    unknown.evaluationState = PURSUIT_SCORING_EVALUATION_STATES.UNAVAILABLE;
    unknown.normalizedScore = null;
    const unknownResult = evaluatePursuitScore({
      ...input,
      factorObservations: unknownObservations,
    });

    expect(missing.evaluationState).toBe("blocked");
    expect(missing.score).toBeNull();
    expect(unknownResult.evaluationState).toBe("blocked");
    expect(unknownResult.score).toBeNull();
  });

  it("allows explicit optional omissions only under the profile partial policy", () => {
    const profile = createResidentialScoringProfile();
    const input = createScoringInput(profile);
    const observations = input.factorObservations.filter(
      (entry) => entry.factorId !== "res-rent-potential"
    );
    const partial = evaluatePursuitScore({ ...input, factorObservations: observations });
    const deniedProfile = createResidentialScoringProfile({
      partialEvaluationPolicy: PURSUIT_SCORING_PARTIAL_POLICIES.DENY,
    });
    const denied = evaluatePursuitScore({
      ...createScoringInput(deniedProfile),
      factorObservations: createScoringObservations(deniedProfile).filter(
        (entry) => entry.factorId !== "res-rent-potential"
      ),
    });

    expect(partial.evaluationState).toBe("partial");
    expect(partial.score).toBeTypeOf("number");
    expect(partial.omittedFactorWeight).toBeGreaterThan(0);
    expect(partial.explanation).toMatch(/not treated as zero/i);
    expect(denied.evaluationState).toBe("blocked");
    expect(denied.score).toBeNull();
  });

  it("handles an explicitly not-applicable optional factor without a zero contribution", () => {
    const profile = createResidentialScoringProfile();
    const input = createScoringInput(profile);
    const observations = clone(input.factorObservations);
    const rent = observations.find(
      (entry) => entry.factorId === "res-rent-potential"
    );
    rent.applicable = false;
    rent.informationState =
      PURSUIT_SCORING_INFORMATION_STATES.NOT_APPLICABLE;
    rent.normalizedScore = null;
    rent.evaluationState = PURSUIT_SCORING_EVALUATION_STATES.NOT_EVALUATED;
    const result = evaluatePursuitScore({ ...input, factorObservations: observations });
    const factor = result.factorResults.find(
      (entry) => entry.factorId === "res-rent-potential"
    );

    expect(result.score).toBeTypeOf("number");
    expect(factor.informationState).toBe("not-applicable");
    expect(factor.categoryPointContribution).toBeNull();
  });

  it("discloses omitted category weight for optional vacant-land factors", () => {
    const profile = createLandScoringProfile();
    const input = createScoringInput(profile);
    const result = evaluatePursuitScore({
      ...input,
      factorObservations: input.factorObservations.filter(
        (entry) =>
          !["land-builder-demand", "land-utility-complexity"].includes(
            entry.factorId
          )
      ),
    });
    expect(result.evaluationState).toBe("partial");
    expect(result.omittedCategoryWeight).toBe(20);
    expect(result.partialDataWarnings.join(" ")).toMatch(/omitted/i);
  });

  it("suppresses duplicate observations and Evidence IDs", () => {
    const profile = createResidentialScoringProfile();
    const input = createScoringInput(profile);
    const result = evaluatePursuitScore({
      ...input,
      factorObservations: [
        ...input.factorObservations,
        clone(input.factorObservations[0]),
        {
          ...clone(input.factorObservations[0]),
          observationId: "second-observation-same-factor",
        },
      ],
      evidenceReferences: [
        ...input.evidenceReferences,
        clone(input.evidenceReferences[0]),
      ],
    });
    expect(result.score).toBe(75);
    expect(new Set(result.evidenceReferenceIds).size).toBe(
      result.evidenceReferenceIds.length
    );
    expect(result.partialDataWarnings.join(" ")).toMatch(/duplicate/i);
  });

  it("requires retained Evidence and follows explicit compatibility-Evidence policy", () => {
    const profile = createResidentialScoringProfile();
    const input = createScoringInput(profile);
    const noEvidence = evaluatePursuitScore({
      ...input,
      evidenceReferences: [],
    });
    const compatibility = evaluatePursuitScore({
      ...input,
      factorObservations: createScoringObservations(profile, {
        compatibility: true,
      }),
      evidenceReferences: createScoringEvidence(profile, {
        compatibility: true,
      }),
    });
    const disallowedProfile = clone(profile);
    disallowedProfile.evidenceAndProvenanceRequirements.allowCompatibilityEvidence = false;
    const disallowed = evaluatePursuitScore({
      ...createScoringInput(disallowedProfile),
      factorObservations: createScoringObservations(disallowedProfile, {
        compatibility: true,
      }),
      evidenceReferences: createScoringEvidence(disallowedProfile, {
        compatibility: true,
      }),
    });

    expect(noEvidence.evaluationState).toBe("blocked");
    expect(noEvidence.score).toBeNull();
    expect(compatibility.score).toBe(75);
    expect(compatibility.partialDataWarnings.join(" ")).toMatch(
      /compatibility Evidence/i
    );
    expect(disallowed.evaluationState).toBe("blocked");
  });

  it.each([
    ["unknown classification", { classificationState: ASSET_CLASSIFICATION_STATES.UNCLASSIFIED }, /classification/i],
    ["classification conflict", { classificationState: ASSET_CLASSIFICATION_STATES.AMBIGUOUS, conflicts: [{ conflictId: "asset-conflict" }] }, /classification/i],
    ["strategy mismatch", { selectedStrategyId: "other-strategy" }, /does not match/i],
    ["asset mismatch", { assetType: ASSET_TYPES.VACANT_RESIDENTIAL_LAND }, /does not match/i],
    ["deferred strategy", { strategySupportState: ASSET_STRATEGY_SUPPORT_STATES.DEFERRED }, /not implemented/i],
  ])("blocks %s", (_name, contextOverrides, explanation) => {
    const profile = createResidentialScoringProfile();
    const input = createScoringInput(profile);
    const result = evaluatePursuitScore({
      ...input,
      assetStrategyContext: {
        ...input.assetStrategyContext,
        ...contextOverrides,
      },
    });
    expect(result.evaluationState).toBe("blocked");
    expect(result.score).toBeNull();
    expect(result.explanation).toMatch(explanation);
  });

  it("blocks an invalid profile and a strategy-not-implemented limitation", () => {
    const profile = createResidentialScoringProfile();
    const invalid = clone(profile);
    invalid.categoryDefinitions[0].weight = 10;
    const invalidResult = evaluatePursuitScore({
      ...createScoringInput(invalid),
      scoringProfile: invalid,
    });
    const limitationResult = evaluatePursuitScore({
      ...createScoringInput(profile),
      missingInformationReadModel: {
        openItems: [],
        limitations: [
          {
            limitationId: "strategy-not-ready",
            type: "strategy-not-implemented",
          },
        ],
      },
    });
    expect(invalidResult.evaluationState).toBe("blocked");
    expect(limitationResult.evaluationState).toBe("blocked");
    expect(limitationResult.blockingIssueIds).toContain("strategy-not-ready");
  });

  it("requires explicit test execution for test-only profiles", () => {
    const profile = createResidentialScoringProfile();
    const input = createScoringInput(profile);
    const result = evaluatePursuitScore({
      ...input,
      executionMode: "production",
    });
    expect(result.evaluationState).toBe("not-evaluated");
    expect(result.score).toBeNull();
  });

  it("returns an expired null result when the supplied profile has expired", () => {
    const profile = createResidentialScoringProfile({
      expirationTimestamp: "2026-07-01T00:00:00.000Z",
    });
    const result = evaluatePursuitScore(createScoringInput(profile));
    expect(result.evaluationState).toBe("expired");
    expect(result.score).toBeNull();
    expect(result.displayValue).toBeNull();
  });

  it("allows an active profile only through explicit production evaluation", () => {
    const profile = createResidentialScoringProfile({
      status: PURSUIT_SCORING_PROFILE_STATUSES.ACTIVE,
    });
    const result = evaluatePursuitScore({
      ...createScoringInput(profile),
      executionMode: "production",
    });
    expect(result.evaluationState).toBe("evaluated");
    expect(result.productionEligible).toBe(true);
  });

  it("applies documented rounding and clamps only the final output", () => {
    expect(roundAndClampPursuitScore(74.9, "nearest-integer")).toBe(75);
    expect(roundAndClampPursuitScore(74.94, "one-decimal")).toBe(74.9);
    expect(roundAndClampPursuitScore(140, "nearest-integer")).toBe(100);
    expect(roundAndClampPursuitScore(-12, "nearest-integer")).toBe(0);
  });

  it("does not produce Recommendation Confidence, Data Reliability, or other metrics", () => {
    const profile = createResidentialScoringProfile();
    const result = evaluatePursuitScore(createScoringInput(profile));
    expect(result).not.toHaveProperty("recommendationConfidence");
    expect(result).not.toHaveProperty("dataReliability");
    expect(result).not.toHaveProperty("riskLevel");
    expect(result).not.toHaveProperty("costOfDelay");
    expect(result).not.toHaveProperty("leadScore");
  });
});
