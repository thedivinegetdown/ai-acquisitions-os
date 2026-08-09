import { uniqueStrings } from "../../../utils/text";
import { DECISION_SOURCE_MODES } from "../../decision-intelligence/decisionContracts";
import { INFORMATION_STATES } from "../../research-intelligence/missingInformationContracts";
import { getResidentialFact } from "./residentialFactAdapter";
import {
  RESIDENTIAL_FACT_IDS,
  RESIDENTIAL_FLIP_EXCLUDED_COSTS_DISCLOSURE,
  RESIDENTIAL_UNDERWRITING_POLICY,
  normalizeResidentialUnderwritingResult,
} from "./residentialStrategyContracts";

// Distinct responsibility: provide the one versioned deterministic source for
// Residential Strategy underwriting formulas and assumption disclosures.
export const RESIDENTIAL_UNDERWRITING_FORMULA_IDS = Object.freeze({
  ACQUISITION_CEILING: "residential-acquisition-ceiling-v1",
  CEILING_SPREAD: "residential-ceiling-spread-v1",
  WHOLESALE_TARGET: "residential-wholesale-target-v1",
  PROJECTED_FLIP_GROSS_MARGIN: "residential-projected-flip-gross-margin-v1",
  PROJECTED_FLIP_GROSS_MARGIN_RATIO:
    "residential-projected-flip-gross-margin-ratio-v1",
  REPAIR_TO_ARV_RATIO: "residential-repair-to-arv-ratio-v1",
  RENT_TO_PRICE_RATIO: "residential-rent-to-price-ratio-v1",
  MORTGAGE_TO_CEILING_RATIO: "residential-mortgage-to-ceiling-ratio-v1",
});

const REQUIRED_FACT_IDS = Object.freeze([
  RESIDENTIAL_FACT_IDS.ASKING_PRICE,
  RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
  RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE,
]);

function factNumber(readModel, factId, { positive = false } = {}) {
  const fact = getResidentialFact(readModel, factId);
  if (fact?.state !== INFORMATION_STATES.PRESENT) return null;
  const value = Number(fact.value);
  if (!Number.isFinite(value)) return null;
  if (positive && value <= 0) return null;
  return value;
}

function evidenceForFacts(readModel, factIds) {
  return uniqueStrings(
    factIds.flatMap(
      (factId) =>
        getResidentialFact(readModel, factId)?.evidenceReferenceIds || []
    )
  ).slice(0, 80);
}

function formula(formulaId, expression, inputs, output) {
  return { formulaId, expression, inputs, output };
}

export function evaluateResidentialUnderwriting({
  blockingIssueIds = [],
  evaluatedTimestamp,
  factReadModel,
} = {}) {
  const askingPrice = factNumber(
    factReadModel,
    RESIDENTIAL_FACT_IDS.ASKING_PRICE,
    { positive: true }
  );
  const afterRepairValue = factNumber(
    factReadModel,
    RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
    { positive: true }
  );
  const repairEstimate = factNumber(
    factReadModel,
    RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE
  );
  const missingFacts = [
    [RESIDENTIAL_FACT_IDS.ASKING_PRICE, askingPrice],
    [RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE, afterRepairValue],
    [RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE, repairEstimate],
  ]
    .filter(([, value]) => value === null)
    .map(([factId]) => factId);
  const blockers = uniqueStrings([...blockingIssueIds, ...missingFacts]);

  if (missingFacts.length || blockers.length) {
    const inputEvidenceIds = evidenceForFacts(factReadModel, REQUIRED_FACT_IDS);
    return {
      ...normalizeResidentialUnderwritingResult({
      evaluationState: "blocked",
      askingPrice,
      afterRepairValue,
      repairEstimate,
      inputEvidenceIds,
      blockingIssueIds: blockers,
      evaluatedTimestamp,
      sourceMode: DECISION_SOURCE_MODES.DETERMINISTIC,
      explanation:
        "Residential underwriting requires positive asking price and ARV values plus an explicit valid repair estimate. Missing repairs are not treated as zero.",
      partialDataWarnings: factReadModel?.partialDataWarnings || [],
      }),
      evidenceLineage: { derivedFromEvidenceIds: inputEvidenceIds },
    };
  }

  const acquisitionCeiling =
    afterRepairValue * RESIDENTIAL_UNDERWRITING_POLICY.acquisitionCeilingFactor -
    repairEstimate;
  const ceilingSpread = acquisitionCeiling - askingPrice;
  const wholesaleTarget =
    acquisitionCeiling - RESIDENTIAL_UNDERWRITING_POLICY.targetWholesaleFee;
  const projectedFlipGrossMargin =
    afterRepairValue -
    askingPrice -
    repairEstimate -
    afterRepairValue * RESIDENTIAL_UNDERWRITING_POLICY.sellingCostReserve;
  const projectedFlipGrossMarginRatio =
    projectedFlipGrossMargin / afterRepairValue;
  const repairToArvRatio = repairEstimate / afterRepairValue;
  const rentEstimate = factNumber(
    factReadModel,
    RESIDENTIAL_FACT_IDS.RENT_ESTIMATE,
    { positive: true }
  );
  const mortgageBalance = factNumber(
    factReadModel,
    RESIDENTIAL_FACT_IDS.MORTGAGE_BALANCE
  );
  const rentToPriceRatio =
    rentEstimate !== null && askingPrice > 0
      ? rentEstimate / askingPrice
      : null;
  const mortgageToCeilingRatio =
    mortgageBalance !== null && acquisitionCeiling > 0
      ? mortgageBalance / acquisitionCeiling
      : null;
  const formulas = [
    formula(
      RESIDENTIAL_UNDERWRITING_FORMULA_IDS.ACQUISITION_CEILING,
      "ARV x 0.70 - repairs",
      { afterRepairValue, repairEstimate },
      acquisitionCeiling
    ),
    formula(
      RESIDENTIAL_UNDERWRITING_FORMULA_IDS.CEILING_SPREAD,
      "acquisition ceiling - asking price",
      { acquisitionCeiling, askingPrice },
      ceilingSpread
    ),
    formula(
      RESIDENTIAL_UNDERWRITING_FORMULA_IDS.WHOLESALE_TARGET,
      "acquisition ceiling - target wholesale fee",
      {
        acquisitionCeiling,
        targetWholesaleFee: RESIDENTIAL_UNDERWRITING_POLICY.targetWholesaleFee,
      },
      wholesaleTarget
    ),
    formula(
      RESIDENTIAL_UNDERWRITING_FORMULA_IDS.PROJECTED_FLIP_GROSS_MARGIN,
      "ARV - asking price - repairs - (ARV x 0.08)",
      {
        afterRepairValue,
        askingPrice,
        repairEstimate,
        sellingCostReserve:
          RESIDENTIAL_UNDERWRITING_POLICY.sellingCostReserve,
      },
      projectedFlipGrossMargin
    ),
    formula(
      RESIDENTIAL_UNDERWRITING_FORMULA_IDS.PROJECTED_FLIP_GROSS_MARGIN_RATIO,
      "projected flip gross margin / ARV",
      { projectedFlipGrossMargin, afterRepairValue },
      projectedFlipGrossMarginRatio
    ),
    formula(
      RESIDENTIAL_UNDERWRITING_FORMULA_IDS.REPAIR_TO_ARV_RATIO,
      "repairs / ARV",
      { repairEstimate, afterRepairValue },
      repairToArvRatio
    ),
    ...(rentToPriceRatio === null
      ? []
      : [
          formula(
            RESIDENTIAL_UNDERWRITING_FORMULA_IDS.RENT_TO_PRICE_RATIO,
            "monthly rent / asking price",
            { rentEstimate, askingPrice },
            rentToPriceRatio
          ),
        ]),
    ...(mortgageToCeilingRatio === null
      ? []
      : [
          formula(
            RESIDENTIAL_UNDERWRITING_FORMULA_IDS.MORTGAGE_TO_CEILING_RATIO,
            "mortgage balance / acquisition ceiling",
            { mortgageBalance, acquisitionCeiling },
            mortgageToCeilingRatio
          ),
        ]),
  ];

  const inputEvidenceIds = evidenceForFacts(factReadModel, [
    ...REQUIRED_FACT_IDS,
    RESIDENTIAL_FACT_IDS.RENT_ESTIMATE,
    RESIDENTIAL_FACT_IDS.MORTGAGE_BALANCE,
  ]);
  return {
    ...normalizeResidentialUnderwritingResult({
    evaluationState: "evaluated",
    askingPrice,
    afterRepairValue,
    repairEstimate,
    acquisitionCeiling,
    ceilingSpread,
    wholesaleTarget,
    projectedFlipGrossMargin,
    projectedFlipGrossMarginRatio,
    repairToArvRatio,
    rentToPriceRatio,
    mortgageToCeilingRatio,
    inputEvidenceIds,
    blockingIssueIds: [],
    formulas,
    evaluatedTimestamp,
    sourceMode: DECISION_SOURCE_MODES.DETERMINISTIC,
    explanation:
      "Residential underwriting was deterministically evaluated from the versioned policy and stored strategy facts.",
    partialDataWarnings: uniqueStrings([
      ...(factReadModel?.partialDataWarnings || []),
      RESIDENTIAL_FLIP_EXCLUDED_COSTS_DISCLOSURE,
    ]).slice(0, 16),
    }),
    evidenceLineage: { derivedFromEvidenceIds: inputEvidenceIds },
  };
}
