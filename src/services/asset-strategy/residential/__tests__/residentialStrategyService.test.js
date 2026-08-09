import { describe, expect, it } from "vitest";
import { buildAssetStrategyContext } from "../../assetStrategyContextService";
import {
  RESIDENTIAL_FLIP_EXCLUDED_COSTS_DISCLOSURE,
  RESIDENTIAL_UNDERWRITING_POLICY,
} from "../residentialStrategyContracts";
import {
  evaluateResidentialStrategy,
  scoreResidentialCeilingSpreadRatio,
  scoreResidentialFlipMarginRatio,
  scoreResidentialMortgageRatio,
  scoreResidentialRepairBurden,
  scoreResidentialTimelineDays,
} from "../residentialStrategyService";

const NOW = "2026-08-05T15:00:00.000Z";

function deal(overrides = {}) {
  return {
    id: "deal-residential-1",
    organization_id: "org-1",
    tenant_id: "tenant-1",
    asset_type: "residential-home",
    property_address: "123 Main Street",
    owner_name: "Sam Seller",
    phone: "5551112222",
    stage: "Contacted",
    asking_price: 120000,
    arv: 210000,
    repairs_needed: 25000,
    motivation_score: 8,
    seller_timeline: "within 30 days",
    mortgage_balance: 90000,
    mortgage_status: "Current",
    occupancy_status: "Vacant",
    rent: 1800,
    ...overrides,
  };
}

function evaluate(record = deal(), options = {}) {
  return evaluateResidentialStrategy({
    assetStrategyContext: buildAssetStrategyContext(record),
    deal: record,
    evaluatedTimestamp: NOW,
    ...options,
  });
}

describe("Residential Strategy runtime", () => {
  it("evaluates the exact versioned underwriting formulas", () => {
    const result = evaluate();
    const underwriting = result.underwriting;

    expect(result.eligible).toBe(true);
    expect(underwriting).toMatchObject({
      evaluationState: "evaluated",
      askingPrice: 120000,
      afterRepairValue: 210000,
      repairEstimate: 25000,
      acquisitionCeiling: 122000,
      ceilingSpread: 2000,
      wholesaleTarget: 112000,
      projectedFlipGrossMargin: 48200,
    });
    expect(underwriting.projectedFlipGrossMarginRatio).toBeCloseTo(48200 / 210000);
    expect(underwriting.repairToArvRatio).toBeCloseTo(25000 / 210000);
    expect(underwriting.rentToPriceRatio).toBeCloseTo(1800 / 120000);
    expect(underwriting.mortgageToCeilingRatio).toBeCloseTo(90000 / 122000);
    expect(underwriting.assumptionDisclosure).toBe(
      RESIDENTIAL_UNDERWRITING_POLICY.assumptionDisclosure
    );
    expect(underwriting.excludedCostDisclosure).toBe(
      RESIDENTIAL_FLIP_EXCLUDED_COSTS_DISCLOSURE
    );
    expect(underwriting.evidenceLineage.derivedFromEvidenceIds).toEqual(underwriting.inputEvidenceIds);
  });

  it("retains legitimate negative outputs", () => {
    const underwriting = evaluate(deal({ asking_price: 190000 })).underwriting;

    expect(underwriting.ceilingSpread).toBe(-68000);
    expect(underwriting.projectedFlipGrossMargin).toBe(-21800);
  });

  it.each(["arv", "repairs_needed", "asking_price"])(
    "does not substitute zero when required %s is missing",
    (field) => {
      const result = evaluate(deal({ [field]: undefined }));
      expect(result.underwriting.evaluationState).not.toBe("evaluated");
      expect(result.pursuitScoreResult.score).toBeNull();
      expect(result.pursuitScoreResult.evaluationState).toBe("blocked");
    }
  );

  it("produces a deterministic active production Pursuit Score", () => {
    const first = evaluate();
    const second = evaluate();

    expect(first.pursuitScoreResult).toMatchObject({
      evaluationState: "evaluated",
      score: 81,
      scoringProfileId: "residential-pursuit-profile-v1",
      profileStatus: "active",
      productionEligible: true,
    });
    expect(second.pursuitScoreResult).toEqual(first.pursuitScoreResult);
    expect(first.pursuitScoreResult.operatorDisclaimer).toContain(
      "not an instruction to purchase"
    );
  });

  it("discloses optional mortgage and occupancy omissions as partial", () => {
    const result = evaluate(
      deal({ mortgage_balance: undefined, mortgage_status: undefined, occupancy_status: undefined })
    );

    expect(result.pursuitScoreResult.evaluationState).toBe("partial");
    expect(result.evaluationState).toBe("partial");
    expect(Number.isFinite(result.pursuitScoreResult.score)).toBe(true);
    expect(result.pursuitScoreResult.omittedFactorWeight).toBeGreaterThan(0);
  });

  it.each([
    ["vacant-residential-land", "implemented"],
    ["small-multifamily", "contract-ready"],
    ["manufactured-home", "deferred"],
    ["commercial", "deferred"],
  ])("never applies residential runtime to %s", (assetType, supportState) => {
    const record = deal({ asset_type: assetType });
    const result = evaluateResidentialStrategy({
      assetStrategyContext: buildAssetStrategyContext(record),
      deal: record,
      evaluatedTimestamp: NOW,
    });

    expect(buildAssetStrategyContext(record).strategySupportState).toBe(supportState);
    expect(result).toMatchObject({ eligible: false, evaluationState: "unavailable" });
    expect(result.pursuitScoreResult).toBeNull();
  });

  it("blocks unknown and conflicting classifications", () => {
    const unknown = deal({ asset_type: undefined });
    const conflict = deal({ property_type: "vacant land" });

    expect(evaluate(unknown).eligible).toBe(false);
    expect(evaluate(conflict).eligible).toBe(false);
  });

  it("creates explainable individual signals without an aggregate Risk Level", () => {
    const result = evaluate(
      deal({ asking_price: 190000, mortgage_balance: 150000, occupancy_status: "tenant occupied", repairs_needed: 70000 })
    );
    const ids = result.riskSignals.map((signal) => signal.signalId);

    expect(ids).toEqual(
      expect.arrayContaining([
        "negative-ceiling-spread",
        "negative-projected-flip-gross-margin",
        "repair-burden-above-thirty-percent",
        "mortgage-above-acquisition-ceiling",
        "tenant-occupied",
        "compatibility-evidence-used",
      ])
    );
    expect(result).not.toHaveProperty("riskLevel");
    expect(result).not.toHaveProperty("recommendationConfidence");
    expect(result).not.toHaveProperty("dataReliability");
  });

  it("returns review-only exit candidates without generated creative-finance terms", () => {
    const candidates = evaluate().exitCandidates;
    const wholesale = candidates.find((entry) => entry.candidateId === "wholesale");
    const flip = candidates.find((entry) => entry.candidateId === "fix-and-flip");
    const sellerFinance = candidates.find(
      (entry) => entry.candidateId === "seller-finance-exploration"
    );
    const subjectTo = candidates.find(
      (entry) => entry.candidateId === "subject-to-exploration"
    );

    expect(wholesale.state).toBe("candidate");
    expect(wholesale.explanation).toContain("not guaranteed assignment profit");
    expect(flip.state).toBe("candidate");
    expect(flip.explanation).toContain("not net profit");
    expect(sellerFinance.state).toBe("manual-review-required");
    expect(subjectTo.state).toBe("manual-review-required");
    for (const candidate of [sellerFinance, subjectTo]) {
      expect(candidate).not.toHaveProperty("downPayment");
      expect(candidate).not.toHaveProperty("interestRate");
      expect(candidate).not.toHaveProperty("monthlyPayment");
      expect(candidate).not.toHaveProperty("balloonPayment");
    }
    expect(JSON.stringify([sellerFinance, subjectTo])).not.toMatch(/\$\d|% apr|\/mo/i);
  });

  it("builds compatibility-only buyer matching inputs without matching buyers", () => {
    const input = evaluate().buyerMatchingInput;

    expect(input).toMatchObject({
      contractVersion: "residential-buyer-matching-input-v1",
      assetType: "residential-home",
      propertyLocation: "123 Main Street",
      askingPrice: 120000,
      acquisitionCeiling: 122000,
    });
    expect(input).not.toHaveProperty("matches");
  });

  it.each([
    [scoreResidentialCeilingSpreadRatio, 0.1, 100],
    [scoreResidentialCeilingSpreadRatio, -0.06, 0],
    [scoreResidentialFlipMarginRatio, 0.15, 85],
    [scoreResidentialMortgageRatio, 0.75, 85],
    [scoreResidentialTimelineDays, 90, 70],
    [scoreResidentialRepairBurden, 0.3, 40],
  ])("applies a documented factor threshold", (score, input, expected) => {
    expect(score(input)).toBe(expected);
  });

  it("never reads lead_score or AI output into strategy calculations", () => {
    const baseline = evaluate();
    const contaminated = evaluate(deal({ lead_score: 100, ai_score: 100, confidence: 1 }));

    expect(contaminated.underwriting).toEqual(baseline.underwriting);
    expect(contaminated.pursuitScoreResult.score).toBe(
      baseline.pursuitScoreResult.score
    );
  });
});
