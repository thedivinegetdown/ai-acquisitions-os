import { uniqueStrings } from "../../../utils/text";
import {
  ASSET_STRATEGY_CRITICALITIES,
  ASSET_STRATEGY_REQUIREMENT_SCOPES,
  ASSET_STRATEGY_STATUSES,
  ASSET_TYPES,
  normalizeAssetStrategyContract,
  validateAssetStrategyContract,
} from "../assetStrategyContracts";
import {
  DECISION_SOURCE_MODES,
  normalizeDecisionTimestamp,
} from "../../decision-intelligence/decisionContracts";

// Distinct responsibility: define the versioned Residential Acquisition
// Strategy policy and serializable outputs without reading a deal or calculating.
export const RESIDENTIAL_STRATEGY_ID = "residential-acquisition";
export const RESIDENTIAL_STRATEGY_VERSION = "residential-strategy-v1";
export const RESIDENTIAL_UNDERWRITING_POLICY_VERSION =
  "residential-underwriting-policy-v1";
export const RESIDENTIAL_PURSUIT_PROFILE_ID =
  "residential-pursuit-profile-v1";
export const RESIDENTIAL_PURSUIT_RULESET_VERSION =
  "residential-pursuit-ruleset-v1";
export const RESIDENTIAL_STRATEGY_READ_MODEL_VERSION =
  "residential-strategy-read-model-v1";
export const RESIDENTIAL_UNDERWRITING_RESULT_VERSION =
  "residential-underwriting-result-v1";

export const RESIDENTIAL_CAPABILITY_STATES = Object.freeze({
  IMPLEMENTED: "implemented",
  COMPATIBILITY_ONLY: "compatibility-only",
  REVIEW_ONLY: "review-only",
  INPUT_READY: "input-ready",
  UNAVAILABLE: "unavailable",
});

export const RESIDENTIAL_CAPABILITY_SUPPORT = Object.freeze({
  factAdaptation: RESIDENTIAL_CAPABILITY_STATES.IMPLEMENTED,
  underwriting: RESIDENTIAL_CAPABILITY_STATES.IMPLEMENTED,
  riskSignals: RESIDENTIAL_CAPABILITY_STATES.IMPLEMENTED,
  pursuitScoring: RESIDENTIAL_CAPABILITY_STATES.IMPLEMENTED,
  exitCandidateReview: RESIDENTIAL_CAPABILITY_STATES.IMPLEMENTED,
  strategyPresentation: RESIDENTIAL_CAPABILITY_STATES.IMPLEMENTED,
  offerReadiness: RESIDENTIAL_CAPABILITY_STATES.IMPLEMENTED,
  buyerMatching: RESIDENTIAL_CAPABILITY_STATES.COMPATIBILITY_ONLY,
  negotiationTools: RESIDENTIAL_CAPABILITY_STATES.COMPATIBILITY_ONLY,
  buyerMatchingInput: RESIDENTIAL_CAPABILITY_STATES.INPUT_READY,
  offerRangePreparation: RESIDENTIAL_CAPABILITY_STATES.REVIEW_ONLY,
  sellerFinanceExploration: RESIDENTIAL_CAPABILITY_STATES.REVIEW_ONLY,
  subjectToExploration: RESIDENTIAL_CAPABILITY_STATES.REVIEW_ONLY,
  autonomousOfferGeneration: RESIDENTIAL_CAPABILITY_STATES.UNAVAILABLE,
  autonomousNegotiation: RESIDENTIAL_CAPABILITY_STATES.UNAVAILABLE,
  automaticPurchaseRecommendation: RESIDENTIAL_CAPABILITY_STATES.UNAVAILABLE,
  financialResilience: RESIDENTIAL_CAPABILITY_STATES.UNAVAILABLE,
  aggregateRiskLevel: RESIDENTIAL_CAPABILITY_STATES.UNAVAILABLE,
  dataReliability: RESIDENTIAL_CAPABILITY_STATES.UNAVAILABLE,
});

export const RESIDENTIAL_FACT_IDS = Object.freeze({
  ASSET_CLASSIFICATION: "residential-asset-classification",
  PROPERTY_IDENTITY: "property-identity",
  ASKING_PRICE: "asking-price",
  AFTER_REPAIR_VALUE: "after-repair-value",
  REPAIR_ESTIMATE: "repair-estimate",
  SELLER_MOTIVATION: "seller-motivation",
  SELLER_TIMELINE: "seller-timeline",
  PROPERTY_CONDITION: "property-condition",
  OCCUPANCY_STATUS: "occupancy-status",
  MORTGAGE_BALANCE: "mortgage-balance",
  MORTGAGE_STATUS: "mortgage-status",
  RENT_ESTIMATE: "rent-estimate",
  OWNER_OCCUPIED_STATUS: "owner-occupied-status",
  TENANT_OCCUPIED_STATUS: "tenant-occupied-status",
  BEDROOMS: "bedrooms",
  BATHROOMS: "bathrooms",
  SQUARE_FOOTAGE: "square-footage",
  COMPARABLE_SALE_EVIDENCE: "comparable-sale-evidence",
  BUYER_MATCH_EVIDENCE: "current-buyer-match-evidence",
  TITLE_AUTHORITY_WARNING: "title-or-authority-warning",
  APPROVAL_CONTEXT: "existing-approval-context",
});

export const RESIDENTIAL_REQUIREMENT_IDS = Object.freeze({
  ASKING_PRICE: "residential-strategy-asking-price",
  AFTER_REPAIR_VALUE: "residential-strategy-after-repair-value",
  REPAIR_ESTIMATE: "residential-strategy-repair-estimate",
  SELLER_MOTIVATION: "residential-strategy-seller-motivation",
  SELLER_TIMELINE: "residential-strategy-seller-timeline",
  PROPERTY_CONDITION: "residential-strategy-property-condition",
  MORTGAGE_STATUS: "residential-strategy-mortgage-status",
  OCCUPANCY_STATUS: "residential-strategy-occupancy-status",
  MARKET_VALUE_SUPPORT: "residential-strategy-market-value-support",
});

export const RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS = Object.freeze({
  CURRENT_RECORD: "residential-current-record-evidence",
  MARKET_VALUE: "residential-market-value-evidence",
  SELLER_CONTEXT: "residential-seller-context-evidence",
});

const REQUIRED_ANALYSIS_FACTS = Object.freeze([
  RESIDENTIAL_FACT_IDS.ASSET_CLASSIFICATION,
  RESIDENTIAL_FACT_IDS.PROPERTY_IDENTITY,
  RESIDENTIAL_FACT_IDS.ASKING_PRICE,
  RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
  RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE,
  RESIDENTIAL_FACT_IDS.SELLER_MOTIVATION,
  RESIDENTIAL_FACT_IDS.SELLER_TIMELINE,
]);

const FACT_DEFINITIONS = [
  [RESIDENTIAL_FACT_IDS.ASSET_CLASSIFICATION, "Residential asset classification", "property.assetType", true],
  [RESIDENTIAL_FACT_IDS.PROPERTY_IDENTITY, "Property identity", "property.identity", true],
  [RESIDENTIAL_FACT_IDS.ASKING_PRICE, "Asking price", "deal.askingPrice", true],
  [RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE, "After-repair value", "property.afterRepairValue", true],
  [RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE, "Repair estimate", "property.repairs", true],
  [RESIDENTIAL_FACT_IDS.SELLER_MOTIVATION, "Seller motivation", "seller.motivation", true],
  [RESIDENTIAL_FACT_IDS.SELLER_TIMELINE, "Seller timeline", "seller.timeline", true],
  [RESIDENTIAL_FACT_IDS.PROPERTY_CONDITION, "Property condition", "property.condition", false],
  [RESIDENTIAL_FACT_IDS.OCCUPANCY_STATUS, "Occupancy status", "property.occupancy", false],
  [RESIDENTIAL_FACT_IDS.MORTGAGE_BALANCE, "Mortgage balance", "property.mortgageBalance", false],
  [RESIDENTIAL_FACT_IDS.MORTGAGE_STATUS, "Mortgage status", "property.mortgageStatus", false],
  [RESIDENTIAL_FACT_IDS.RENT_ESTIMATE, "Rent estimate", "property.rentEstimate", false],
  [RESIDENTIAL_FACT_IDS.OWNER_OCCUPIED_STATUS, "Owner-occupied status", "property.ownerOccupied", false],
  [RESIDENTIAL_FACT_IDS.TENANT_OCCUPIED_STATUS, "Tenant-occupied status", "property.tenantOccupied", false],
  [RESIDENTIAL_FACT_IDS.BEDROOMS, "Bedrooms", "property.bedrooms", false],
  [RESIDENTIAL_FACT_IDS.BATHROOMS, "Bathrooms", "property.bathrooms", false],
  [RESIDENTIAL_FACT_IDS.SQUARE_FOOTAGE, "Square footage", "property.squareFootage", false],
  [RESIDENTIAL_FACT_IDS.COMPARABLE_SALE_EVIDENCE, "Comparable-sale evidence", "property.comparableSales", false],
  [RESIDENTIAL_FACT_IDS.BUYER_MATCH_EVIDENCE, "Current buyer-match evidence", "closing.buyerMatches", false],
  [RESIDENTIAL_FACT_IDS.TITLE_AUTHORITY_WARNING, "Title or authority warning", "closing.titleAuthorityWarning", false],
  [RESIDENTIAL_FACT_IDS.APPROVAL_CONTEXT, "Existing approval context", "decision.approvalContext", false],
].map(([factId, label, canonicalField, required]) => ({
  factId,
  label,
  description: required
    ? `${label} is required for Residential Strategy analysis.`
    : `${label} is optional strategy or execution context.`,
  canonicalField,
  criticality: required
    ? ASSET_STRATEGY_CRITICALITIES.BLOCKING
    : ASSET_STRATEGY_CRITICALITIES.ADVISORY,
  requiredFor: required
    ? [
        ASSET_STRATEGY_REQUIREMENT_SCOPES.UNDERWRITING,
        ASSET_STRATEGY_REQUIREMENT_SCOPES.PURSUIT_SCORING,
      ]
    : [ASSET_STRATEGY_REQUIREMENT_SCOPES.RISK],
  verificationRequirementIds: [
    factId === RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE ||
    factId === RESIDENTIAL_FACT_IDS.COMPARABLE_SALE_EVIDENCE
      ? RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.MARKET_VALUE
      : [RESIDENTIAL_FACT_IDS.SELLER_MOTIVATION, RESIDENTIAL_FACT_IDS.SELLER_TIMELINE].includes(factId)
        ? RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.SELLER_CONTEXT
        : RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.CURRENT_RECORD,
  ],
  evidenceRequired: required,
}));

export const RESIDENTIAL_UNDERWRITING_POLICY = Object.freeze({
  policyVersion: RESIDENTIAL_UNDERWRITING_POLICY_VERSION,
  acquisitionCeilingFactor: 0.7,
  sellingCostReserve: 0.08,
  targetWholesaleFee: 10000,
  assumptionDisclosure:
    "The 70% acquisition ceiling, 8% selling-cost reserve, and $10,000 target wholesale fee are internal default estimates. They are not guarantees, do not replace local market review, and are not instructions to offer the calculated amount.",
  futureConfigurationNotice:
    "A future approved organization policy may supersede these defaults; no organization-specific setting is applied in v1.",
});

export const RESIDENTIAL_UNDERWRITING_OPERATOR_DISCLAIMER =
  "Residential underwriting estimates support human review. They are not an instruction to purchase or make an offer.";

export const RESIDENTIAL_FLIP_EXCLUDED_COSTS_DISCLOSURE =
  "Projected flip gross margin excludes financing, holding costs, taxes, insurance, utilities, permits, inspections, commissions beyond the stated selling-cost reserve, legal costs, unexpected repairs, and other transaction-specific expenses.";

export const RESIDENTIAL_ACQUISITION_STRATEGY = Object.freeze(
  normalizeAssetStrategyContract({
    strategyId: RESIDENTIAL_STRATEGY_ID,
    strategyVersion: RESIDENTIAL_STRATEGY_VERSION,
    label: "Residential Acquisition Strategy v1",
    description:
      "Deterministic, evidence-linked residential acquisition review for explicitly classified residential homes.",
    assetType: ASSET_TYPES.RESIDENTIAL_HOME,
    status: ASSET_STRATEGY_STATUSES.ACTIVE,
    effectiveTimestamp: "2026-08-05T00:00:00.000Z",
    capabilities: {
      requiredFacts: FACT_DEFINITIONS,
      dataCompletenessRules: [
        {
          ruleId: "residential-strategy-requirements-v1",
          label: "Residential Strategy requirement contract",
          description:
            "Declares required facts without calculating a completeness percentage.",
          requiredFactIds: REQUIRED_ANALYSIS_FACTS,
          blockingFactIds: REQUIRED_ANALYSIS_FACTS,
          outputMetricIds: ["data-completeness"],
        },
      ],
      underwritingHooks: [
        {
          hookId: "residential-underwriting-v1",
          label: "Residential deterministic underwriting",
          inputFactIds: [
            RESIDENTIAL_FACT_IDS.ASKING_PRICE,
            RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
            RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE,
          ],
          outputKeys: [
            "acquisitionCeiling",
            "ceilingSpread",
            "wholesaleTarget",
            "projectedFlipGrossMargin",
            "projectedFlipGrossMarginRatio",
            "repairToArvRatio",
          ],
          evidenceRequirementIds: [
            RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.CURRENT_RECORD,
            RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.MARKET_VALUE,
          ],
        },
      ],
      riskRules: [
        {
          ruleId: "residential-risk-signals-v1",
          label: "Residential risk signals",
          description:
            "Produces individual explainable signals only; the risk-level metric remains unevaluated.",
          requiredFactIds: REQUIRED_ANALYSIS_FACTS,
          blockingFactIds: [],
          outputMetricIds: ["risk-level"],
        },
      ],
      pursuitScoringHooks: [
        {
          hookId: "residential-pursuit-scoring-v1",
          label: "Residential Pursuit Scoring v1",
          inputFactIds: Object.values(RESIDENTIAL_FACT_IDS),
          evidenceRequirementIds: Object.values(
            RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS
          ),
          outputMetricIds: ["pursuit-score"],
        },
      ],
      readinessGates: [
        {
          gateId: "residential-offer-readiness-v1",
          label: "Residential offer-readiness gate",
          description:
            "Uses the DI-04 Residential Strategy v1 readiness ruleset without a numeric percentage.",
          requiredFactIds: REQUIRED_ANALYSIS_FACTS,
          blockingFactIds: REQUIRED_ANALYSIS_FACTS,
          outputMetricIds: ["offer-readiness"],
        },
      ],
      offerLogic: [
        {
          ruleId: "residential-offer-review-v1",
          label: "Residential offer review",
          description:
            "Prepares review-only ranges; it cannot submit or approve an offer.",
          requiredFactIds: [
            RESIDENTIAL_FACT_IDS.ASKING_PRICE,
            RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
            RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE,
          ],
          blockingFactIds: REQUIRED_ANALYSIS_FACTS,
          actionCodes: ["prepare-offer-range", "manual-review"],
        },
      ],
      exitStrategies: [
        {
          exitStrategyId: "wholesale",
          label: "Wholesale review",
          requiredFactIds: [
            RESIDENTIAL_FACT_IDS.ASKING_PRICE,
            RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
            RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE,
          ],
          evidenceRequirementIds: [
            RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.CURRENT_RECORD,
            RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.MARKET_VALUE,
          ],
        },
        {
          exitStrategyId: "fix-and-flip",
          label: "Fix-and-flip review",
          requiredFactIds: [
            RESIDENTIAL_FACT_IDS.ASKING_PRICE,
            RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
            RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE,
          ],
          evidenceRequirementIds: [
            RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.CURRENT_RECORD,
            RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.MARKET_VALUE,
          ],
        },
        {
          exitStrategyId: "buy-and-hold-review",
          label: "Buy-and-hold review",
          requiredFactIds: [
            RESIDENTIAL_FACT_IDS.ASKING_PRICE,
            RESIDENTIAL_FACT_IDS.RENT_ESTIMATE,
          ],
          evidenceRequirementIds: [
            RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.CURRENT_RECORD,
          ],
        },
        {
          exitStrategyId: "seller-finance-exploration",
          label: "Seller-finance exploration",
          requiredFactIds: [RESIDENTIAL_FACT_IDS.SELLER_MOTIVATION],
          evidenceRequirementIds: [
            RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.SELLER_CONTEXT,
          ],
        },
        {
          exitStrategyId: "subject-to-exploration",
          label: "Subject-to exploration",
          requiredFactIds: [
            RESIDENTIAL_FACT_IDS.MORTGAGE_BALANCE,
            RESIDENTIAL_FACT_IDS.MORTGAGE_STATUS,
          ],
          evidenceRequirementIds: [
            RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.CURRENT_RECORD,
          ],
        },
      ],
      buyerMatchingRules: [
        {
          ruleId: "residential-buyer-input-v1",
          label: "Residential buyer-matching input",
          description:
            "Normalizes inputs for existing compatibility matching without implementing a new algorithm.",
          requiredFactIds: [
            RESIDENTIAL_FACT_IDS.PROPERTY_IDENTITY,
            RESIDENTIAL_FACT_IDS.ASKING_PRICE,
          ],
          blockingFactIds: [],
          actionCodes: ["prepare-buyer-match-context"],
        },
      ],
      verificationRequirements: [
        {
          verificationRequirementId:
            RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.CURRENT_RECORD,
          label: "Current residential record Evidence",
          requiredFactIds: Object.values(RESIDENTIAL_FACT_IDS),
          criticality: ASSET_STRATEGY_CRITICALITIES.ADVISORY,
          acceptableSourceTypes: [
            "crm-residential-fact",
            "crm-current-state",
            "manual-record",
          ],
          humanReviewRequired: true,
        },
        {
          verificationRequirementId:
            RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.MARKET_VALUE,
          label: "Market-value Evidence",
          requiredFactIds: [
            RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
            RESIDENTIAL_FACT_IDS.COMPARABLE_SALE_EVIDENCE,
          ],
          criticality: ASSET_STRATEGY_CRITICALITIES.BLOCKING,
          acceptableSourceTypes: [
            "crm-residential-fact",
            "comparable-sale",
            "property-comp",
          ],
          humanReviewRequired: true,
        },
        {
          verificationRequirementId:
            RESIDENTIAL_EVIDENCE_REQUIREMENT_IDS.SELLER_CONTEXT,
          label: "Seller-context Evidence",
          requiredFactIds: [
            RESIDENTIAL_FACT_IDS.SELLER_MOTIVATION,
            RESIDENTIAL_FACT_IDS.SELLER_TIMELINE,
          ],
          criticality: ASSET_STRATEGY_CRITICALITIES.BLOCKING,
          acceptableSourceTypes: [
            "crm-residential-fact",
            "conversation-summary",
            "manual-record",
          ],
          humanReviewRequired: true,
        },
      ],
    },
  })
);

export const RESIDENTIAL_RISK_SIGNAL_SEVERITIES = Object.freeze({
  ATTENTION: "attention",
  SIGNIFICANT: "significant",
  BLOCKING: "blocking",
});

export const RESIDENTIAL_EXIT_CANDIDATE_STATES = Object.freeze({
  CANDIDATE: "candidate",
  REVIEWABLE: "reviewable",
  NOT_EVALUATED: "not-evaluated",
  BLOCKED: "blocked",
  MANUAL_REVIEW_REQUIRED: "manual-review-required",
});

export const RESIDENTIAL_STRATEGY_REVIEW_STATES = Object.freeze({
  VERIFY_CRITICAL_INFORMATION: "verify-critical-information",
  CONTINUE_RESIDENTIAL_REVIEW: "continue-residential-review",
  REVIEW_UNDERWRITING: "review-underwriting",
  REVIEW_EXIT_OPTIONS: "review-exit-options",
  MANUAL_REVIEW_REQUIRED: "manual-review-required",
  UNAVAILABLE: "unavailable",
});

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function safeStrings(values, limit = 40) {
  return uniqueStrings(
    (Array.isArray(values) ? values : []).map((value) => String(value || ""))
  ).slice(0, limit);
}

export function normalizeResidentialUnderwritingResult(value) {
  const source = safeObject(value);
  return {
    contractVersion: RESIDENTIAL_UNDERWRITING_RESULT_VERSION,
    strategyId: RESIDENTIAL_STRATEGY_ID,
    strategyVersion: RESIDENTIAL_STRATEGY_VERSION,
    policyVersion: RESIDENTIAL_UNDERWRITING_POLICY_VERSION,
    evaluationState: source.evaluationState || "not-evaluated",
    askingPrice: finiteNumber(source.askingPrice),
    afterRepairValue: finiteNumber(source.afterRepairValue),
    repairEstimate: finiteNumber(source.repairEstimate),
    acquisitionCeiling: finiteNumber(source.acquisitionCeiling),
    ceilingSpread: finiteNumber(source.ceilingSpread),
    wholesaleTarget: finiteNumber(source.wholesaleTarget),
    projectedFlipGrossMargin: finiteNumber(source.projectedFlipGrossMargin),
    projectedFlipGrossMarginRatio: finiteNumber(
      source.projectedFlipGrossMarginRatio
    ),
    repairToArvRatio: finiteNumber(source.repairToArvRatio),
    rentToPriceRatio: finiteNumber(source.rentToPriceRatio),
    mortgageToCeilingRatio: finiteNumber(source.mortgageToCeilingRatio),
    inputEvidenceIds: safeStrings(source.inputEvidenceIds, 80),
    blockingIssueIds: safeStrings(source.blockingIssueIds),
    formulas: Array.isArray(source.formulas) ? source.formulas.slice(0, 12) : [],
    partialDataWarnings: safeStrings(source.partialDataWarnings, 16),
    assumptionDisclosure: RESIDENTIAL_UNDERWRITING_POLICY.assumptionDisclosure,
    excludedCostDisclosure: RESIDENTIAL_FLIP_EXCLUDED_COSTS_DISCLOSURE,
    evaluatedTimestamp: normalizeDecisionTimestamp(source.evaluatedTimestamp),
    sourceMode: source.sourceMode || DECISION_SOURCE_MODES.DETERMINISTIC,
    explanation: source.explanation || null,
    operatorDisclaimer: RESIDENTIAL_UNDERWRITING_OPERATOR_DISCLAIMER,
  };
}

export function normalizeResidentialRiskSignal(value) {
  const source = safeObject(value);
  if (!source.signalId || !source.label) return null;
  const severity = Object.values(RESIDENTIAL_RISK_SIGNAL_SEVERITIES).includes(
    source.severity
  )
    ? source.severity
    : RESIDENTIAL_RISK_SIGNAL_SEVERITIES.ATTENTION;
  return {
    signalId: String(source.signalId),
    label: String(source.label),
    explanation: source.explanation ? String(source.explanation) : null,
    severity,
    relatedFactIds: safeStrings(source.relatedFactIds),
    evidenceReferenceIds: safeStrings(source.evidenceReferenceIds, 80),
    relatedSection: source.relatedSection || "numbers",
    rulesetVersion: RESIDENTIAL_STRATEGY_VERSION,
  };
}

export function normalizeResidentialExitCandidate(value) {
  const source = safeObject(value);
  if (!source.candidateId || !source.label) return null;
  const state = Object.values(RESIDENTIAL_EXIT_CANDIDATE_STATES).includes(
    source.state
  )
    ? source.state
    : RESIDENTIAL_EXIT_CANDIDATE_STATES.NOT_EVALUATED;
  return {
    candidateId: String(source.candidateId),
    label: String(source.label),
    state,
    explanation: source.explanation ? String(source.explanation) : null,
    supportingFormulaIds: safeStrings(source.supportingFormulaIds),
    evidenceReferenceIds: safeStrings(source.evidenceReferenceIds, 80),
    missingFactIds: safeStrings(source.missingFactIds),
    manualReviewRequirements: safeStrings(source.manualReviewRequirements),
    excludedCostDisclosure: source.excludedCostDisclosure || null,
  };
}

export function validateResidentialStrategyContract(value = RESIDENTIAL_ACQUISITION_STRATEGY) {
  const validation = validateAssetStrategyContract(value);
  const strategy = validation.contract;
  const errors = [...validation.errors];
  if (strategy.strategyId !== RESIDENTIAL_STRATEGY_ID) {
    errors.push("Residential Strategy ID does not match the canonical ID.");
  }
  if (strategy.strategyVersion !== RESIDENTIAL_STRATEGY_VERSION) {
    errors.push("Residential Strategy version does not match v1.");
  }
  if (strategy.status !== ASSET_STRATEGY_STATUSES.ACTIVE) {
    errors.push("Residential Strategy v1 must be active.");
  }
  if (strategy.assetType !== ASSET_TYPES.RESIDENTIAL_HOME) {
    errors.push("Residential Strategy v1 must target residential-home only.");
  }
  const serialized = JSON.stringify(strategy).toLowerCase();
  if (/wetlands|legal-access|buildability|land-comparable/.test(serialized)) {
    errors.push("Residential Strategy must not contain vacant-land requirements.");
  }
  return {
    valid: errors.length === 0,
    errors: uniqueStrings(errors),
    strategy,
  };
}

export { REQUIRED_ANALYSIS_FACTS as RESIDENTIAL_REQUIRED_ANALYSIS_FACT_IDS };
