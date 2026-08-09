import { uniqueStrings } from "../../../utils/text";
import {
  ASSET_CLASSIFICATION_STATES,
  ASSET_TYPES,
} from "../assetStrategyContracts";
import {
  ASSET_STRATEGY_SUPPORT_STATES,
  buildAssetStrategyContext,
} from "../assetStrategyContextService";
import {
  DECISION_SOURCE_MODES,
  normalizeDecisionTimestamp,
} from "../../decision-intelligence/decisionContracts";
import {
  PURSUIT_SCORING_EVALUATION_STATES,
  PURSUIT_SCORING_EXECUTION_MODES,
  PURSUIT_SCORING_INFORMATION_STATES,
  evaluatePursuitScore,
  normalizePursuitScoringObservation,
} from "../../decision-intelligence/pursuit-scoring";
import {
  INFORMATION_STATES,
  evaluateMissingInformation,
} from "../../research-intelligence";
import {
  adaptResidentialFacts,
  getResidentialFact,
  isExplicitNoMortgage,
} from "./residentialFactAdapter";
import {
  RESIDENTIAL_ACQUISITION_STRATEGY,
  RESIDENTIAL_CAPABILITY_SUPPORT,
  RESIDENTIAL_EXIT_CANDIDATE_STATES,
  RESIDENTIAL_FACT_IDS,
  RESIDENTIAL_FLIP_EXCLUDED_COSTS_DISCLOSURE,
  RESIDENTIAL_PURSUIT_PROFILE_ID,
  RESIDENTIAL_PURSUIT_RULESET_VERSION,
  RESIDENTIAL_REQUIREMENT_IDS,
  RESIDENTIAL_RISK_SIGNAL_SEVERITIES,
  RESIDENTIAL_STRATEGY_ID,
  RESIDENTIAL_STRATEGY_READ_MODEL_VERSION,
  RESIDENTIAL_STRATEGY_REVIEW_STATES,
  RESIDENTIAL_STRATEGY_VERSION,
  normalizeResidentialExitCandidate,
  normalizeResidentialRiskSignal,
  validateResidentialStrategyContract,
} from "./residentialStrategyContracts";
import {
  RESIDENTIAL_PURSUIT_FACTOR_IDS,
  RESIDENTIAL_PURSUIT_SCORING_PROFILE,
  validateResidentialPursuitProfile,
} from "./residentialPursuitProfile";
import { evaluateResidentialUnderwriting } from "./residentialUnderwritingService";
import { scoreStrategyTimelineDays } from "../strategyTimeline";

// Distinct responsibility: orchestrate pure residential facts, underwriting,
// signals, candidates, observations, and scoring into one strategy read model.
export const RESIDENTIAL_RISK_RULESET_VERSION =
  "residential-risk-signals-v1";
export const RESIDENTIAL_EXIT_RULESET_VERSION =
  "residential-exit-candidates-v1";

const COMP_EVIDENCE_TYPES = new Set([
  "comparable-sale",
  "property-comp",
  "residential-comparable-sale",
]);

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

function factValue(readModel, factId) {
  const fact = getResidentialFact(readModel, factId);
  return fact?.state === INFORMATION_STATES.PRESENT ? fact.value : null;
}

function evidenceForFacts(readModel, factIds) {
  return uniqueStrings(
    factIds.flatMap(
      (factId) =>
        getResidentialFact(readModel, factId)?.evidenceReferenceIds || []
    )
  ).slice(0, 80);
}

function conflictsForFacts(readModel, factIds) {
  return uniqueStrings(
    factIds.flatMap(
      (factId) => getResidentialFact(readModel, factId)?.conflictIds || []
    )
  ).slice(0, 40);
}

function sourceStateForFacts(readModel, factIds) {
  const facts = factIds.map((factId) => getResidentialFact(readModel, factId));
  if (facts.some((fact) => fact?.state === INFORMATION_STATES.CONFLICTING)) {
    return PURSUIT_SCORING_INFORMATION_STATES.CONFLICTING;
  }
  if (facts.some((fact) => fact?.state === INFORMATION_STATES.STALE)) {
    return PURSUIT_SCORING_INFORMATION_STATES.STALE;
  }
  if (facts.some((fact) => fact?.state === INFORMATION_STATES.UNVERIFIED)) {
    return PURSUIT_SCORING_INFORMATION_STATES.UNVERIFIED;
  }
  if (facts.some((fact) => fact?.state === INFORMATION_STATES.UNKNOWN)) {
    return PURSUIT_SCORING_INFORMATION_STATES.UNKNOWN;
  }
  if (facts.some((fact) => fact?.state === INFORMATION_STATES.MISSING)) {
    return PURSUIT_SCORING_INFORMATION_STATES.MISSING;
  }
  return PURSUIT_SCORING_INFORMATION_STATES.PRESENT;
}

function verificationForFacts(readModel, factIds) {
  const states = factIds
    .map((factId) => getResidentialFact(readModel, factId)?.verificationState)
    .filter(Boolean);
  if (states.includes("unverified")) return "unverified";
  if (states.length && states.every((state) => state === "verified")) {
    return "verified";
  }
  return "unknown";
}

function freshnessForFacts(readModel, factIds) {
  const states = factIds
    .map((factId) => getResidentialFact(readModel, factId)?.freshnessState)
    .filter(Boolean);
  if (states.includes("stale")) return "stale";
  if (states.some((state) => ["fresh", "current"].includes(state))) {
    return "current";
  }
  return "unknown";
}

function sourceModeForFacts(readModel, factIds) {
  return factIds.some(
    (factId) =>
      getResidentialFact(readModel, factId)?.sourceMode ===
      DECISION_SOURCE_MODES.DETERMINISTIC_COMPATIBILITY
  )
    ? DECISION_SOURCE_MODES.DETERMINISTIC_COMPATIBILITY
    : DECISION_SOURCE_MODES.DETERMINISTIC;
}

function sourceTimestampForFacts(readModel, factIds) {
  return (
    factIds
      .map((factId) => getResidentialFact(readModel, factId)?.sourceTimestamp)
      .filter(Boolean)
      .sort()
      .at(-1) || null
  );
}

function missingItemsForRequirements(readModel, requirementIds) {
  return (Array.isArray(readModel?.openItems) ? readModel.openItems : [])
    .filter((item) => requirementIds.includes(item.requirementId))
    .map((item) => item.itemId || item.requirementId)
    .filter(Boolean);
}

function observation({
  evaluatedTimestamp,
  explanation,
  factIds,
  factorId,
  informationState,
  missingInformationReadModel,
  normalizedScore,
  normalizedValue,
  rawValue,
  requirementIds = [],
  warnings = [],
  factReadModel,
}) {
  const score = finiteNumber(normalizedScore);
  const state = informationState || sourceStateForFacts(factReadModel, factIds);
  const evaluated =
    score !== null && state === PURSUIT_SCORING_INFORMATION_STATES.PRESENT;
  return normalizePursuitScoringObservation({
    observationId: factReadModel?.dealId
      ? `residential-score-observation:${encodeURIComponent(
          factReadModel.dealId
        )}:${factorId}`
      : null,
    factorId,
    strategyId: RESIDENTIAL_STRATEGY_ID,
    assetType: ASSET_TYPES.RESIDENTIAL_HOME,
    evaluationState: evaluated
      ? PURSUIT_SCORING_EVALUATION_STATES.EVALUATED
      : PURSUIT_SCORING_EVALUATION_STATES.NOT_EVALUATED,
    informationState: state,
    rawValue,
    normalizedValue,
    normalizedScore: score,
    applicable: true,
    evidenceReferenceIds: evidenceForFacts(factReadModel, factIds),
    missingInformationItemIds: missingItemsForRequirements(
      missingInformationReadModel,
      requirementIds
    ),
    conflictIds: conflictsForFacts(factReadModel, factIds),
    verificationState: verificationForFacts(factReadModel, factIds),
    freshnessState: freshnessForFacts(factReadModel, factIds),
    sourceMode: sourceModeForFacts(factReadModel, factIds),
    explanation,
    evaluatedTimestamp,
    sourceTimestamp: sourceTimestampForFacts(factReadModel, factIds),
    partialDataWarnings: uniqueStrings([
      ...warnings,
      ...factIds.flatMap(
        (factId) =>
          getResidentialFact(factReadModel, factId)?.partialDataWarnings || []
      ),
    ]).slice(0, 16),
  });
}

export function scoreResidentialCeilingSpreadRatio(value) {
  const ratio = finiteNumber(value);
  if (ratio === null) return null;
  if (ratio >= 0.1) return 100;
  if (ratio >= 0.05) return 80;
  if (ratio >= 0) return 60;
  if (ratio >= -0.05) return 30;
  return 0;
}

export function scoreResidentialFlipMarginRatio(value) {
  const ratio = finiteNumber(value);
  if (ratio === null) return null;
  if (ratio >= 0.2) return 100;
  if (ratio >= 0.15) return 85;
  if (ratio >= 0.1) return 70;
  if (ratio >= 0.05) return 50;
  if (ratio >= 0) return 25;
  return 0;
}

export function scoreResidentialMortgageRatio(value) {
  const ratio = finiteNumber(value);
  if (ratio === null) return null;
  if (ratio <= 0.5) return 100;
  if (ratio <= 0.75) return 85;
  if (ratio <= 1) return 65;
  if (ratio <= 1.15) return 40;
  return 15;
}

export function scoreResidentialTimelineDays(value) {
  return scoreStrategyTimelineDays(value);
}

export function scoreResidentialRepairBurden(value) {
  const ratio = finiteNumber(value);
  if (ratio === null || ratio < 0) return null;
  if (ratio <= 0.05) return 100;
  if (ratio <= 0.1) return 85;
  if (ratio <= 0.2) return 65;
  if (ratio <= 0.3) return 40;
  return 15;
}

function occupancyScore(value) {
  if (value === "vacant") return 100;
  if (value === "owner-occupied") return 75;
  if (value === "tenant-occupied") return 50;
  if (value === "occupied-other") return 60;
  return null;
}

function persistedComparableEvidence(evidenceReferences) {
  const records = new Set();
  (Array.isArray(evidenceReferences) ? evidenceReferences : []).forEach(
    (entry) => {
      if (
        COMP_EVIDENCE_TYPES.has(entry?.sourceType) ||
        entry?.relatedCanonicalField === "property.comparableSales"
      ) {
        if (entry.sourceRecordId) records.add(entry.sourceRecordId);
      }
    }
  );
  return records.size;
}

function marketValueSupportScore(factReadModel) {
  const arvFact = getResidentialFact(
    factReadModel,
    RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE
  );
  if (arvFact?.state !== INFORMATION_STATES.PRESENT) return null;
  const compCount = persistedComparableEvidence(
    factReadModel?.evidenceReferences
  );
  if (compCount >= 3) return 100;
  if (compCount === 2) return 85;
  if (compCount === 1) return 70;
  return arvFact.evidenceReferenceIds.length ? 50 : null;
}

function exitOptionScore(exitCandidates) {
  const stateById = new Map(
    (Array.isArray(exitCandidates) ? exitCandidates : []).map((candidate) => [
      candidate.candidateId,
      candidate.state,
    ])
  );
  const wholesale =
    stateById.get("wholesale") === RESIDENTIAL_EXIT_CANDIDATE_STATES.CANDIDATE;
  const flip =
    stateById.get("fix-and-flip") ===
    RESIDENTIAL_EXIT_CANDIDATE_STATES.CANDIDATE;
  const hold =
    stateById.get("buy-and-hold-review") ===
    RESIDENTIAL_EXIT_CANDIDATE_STATES.REVIEWABLE;
  if (wholesale && flip) return 100;
  if (wholesale || flip) return 70;
  if (hold) return 40;
  return 10;
}

export function evaluateResidentialExitCandidates({
  factReadModel,
  underwriting,
} = {}) {
  const evaluated = underwriting?.evaluationState === "evaluated";
  const commonEvidence = underwriting?.inputEvidenceIds || [];
  const askingPrice = factValue(
    factReadModel,
    RESIDENTIAL_FACT_IDS.ASKING_PRICE
  );
  const rentEstimate = factValue(
    factReadModel,
    RESIDENTIAL_FACT_IDS.RENT_ESTIMATE
  );
  return [
    normalizeResidentialExitCandidate({
      candidateId: "wholesale",
      label: "Wholesale",
      state: !evaluated
        ? RESIDENTIAL_EXIT_CANDIDATE_STATES.NOT_EVALUATED
        : underwriting.ceilingSpread > 0
          ? RESIDENTIAL_EXIT_CANDIDATE_STATES.CANDIDATE
          : RESIDENTIAL_EXIT_CANDIDATE_STATES.BLOCKED,
      explanation: !evaluated
        ? "Required underwriting facts are unavailable."
        : underwriting.ceilingSpread > 0
          ? "The versioned acquisition ceiling exceeds the asking price. Positive spread is not guaranteed assignment profit."
          : "The versioned acquisition ceiling does not exceed the asking price.",
      supportingFormulaIds: [
        "residential-acquisition-ceiling-v1",
        "residential-ceiling-spread-v1",
      ],
      evidenceReferenceIds: commonEvidence,
      missingFactIds: evaluated ? [] : underwriting?.blockingIssueIds,
    }),
    normalizeResidentialExitCandidate({
      candidateId: "fix-and-flip",
      label: "Fix-and-flip",
      state: !evaluated
        ? RESIDENTIAL_EXIT_CANDIDATE_STATES.NOT_EVALUATED
        : underwriting.projectedFlipGrossMargin > 0
          ? RESIDENTIAL_EXIT_CANDIDATE_STATES.CANDIDATE
          : RESIDENTIAL_EXIT_CANDIDATE_STATES.BLOCKED,
      explanation: !evaluated
        ? "Required underwriting facts are unavailable."
        : underwriting.projectedFlipGrossMargin > 0
          ? "Projected flip gross margin is positive before the disclosed excluded costs; it is not net profit."
          : "Projected flip gross margin is not positive under the current assumptions.",
      supportingFormulaIds: [
        "residential-projected-flip-gross-margin-v1",
      ],
      evidenceReferenceIds: commonEvidence,
      missingFactIds: evaluated ? [] : underwriting?.blockingIssueIds,
      excludedCostDisclosure: RESIDENTIAL_FLIP_EXCLUDED_COSTS_DISCLOSURE,
    }),
    normalizeResidentialExitCandidate({
      candidateId: "buy-and-hold-review",
      label: "Buy-and-hold review",
      state:
        Number.isFinite(askingPrice) && Number.isFinite(rentEstimate)
          ? RESIDENTIAL_EXIT_CANDIDATE_STATES.REVIEWABLE
          : RESIDENTIAL_EXIT_CANDIDATE_STATES.NOT_EVALUATED,
      explanation:
        Number.isFinite(askingPrice) && Number.isFinite(rentEstimate)
          ? "Asking price and monthly rent are represented. Full expense and financing inputs are still required before viability can be reviewed."
          : "Asking price and monthly rent are required for this limited review path.",
      evidenceReferenceIds: evidenceForFacts(factReadModel, [
        RESIDENTIAL_FACT_IDS.ASKING_PRICE,
        RESIDENTIAL_FACT_IDS.RENT_ESTIMATE,
      ]),
      missingFactIds: [
        ...(!Number.isFinite(askingPrice)
          ? [RESIDENTIAL_FACT_IDS.ASKING_PRICE]
          : []),
        ...(!Number.isFinite(rentEstimate)
          ? [RESIDENTIAL_FACT_IDS.RENT_ESTIMATE]
          : []),
      ],
      manualReviewRequirements: [
        "Review taxes, insurance, vacancy, maintenance, financing, and management costs.",
      ],
    }),
    normalizeResidentialExitCandidate({
      candidateId: "seller-finance-exploration",
      label: "Seller-finance exploration",
      state: RESIDENTIAL_EXIT_CANDIDATE_STATES.MANUAL_REVIEW_REQUIRED,
      explanation:
        "Seller willingness and complete negotiated terms are required. No down payment, interest rate, payment, term, or balloon is generated.",
      evidenceReferenceIds: evidenceForFacts(factReadModel, [
        RESIDENTIAL_FACT_IDS.SELLER_MOTIVATION,
      ]),
      manualReviewRequirements: [
        "Confirm explicit seller willingness.",
        "Obtain legal and financial review of transaction-specific terms.",
      ],
    }),
    normalizeResidentialExitCandidate({
      candidateId: "subject-to-exploration",
      label: "Subject-to exploration",
      state: RESIDENTIAL_EXIT_CANDIDATE_STATES.MANUAL_REVIEW_REQUIRED,
      explanation:
        "Complete mortgage terms, explicit seller consent, legal review, and transaction-specific approval are required. No terms are generated.",
      evidenceReferenceIds: evidenceForFacts(factReadModel, [
        RESIDENTIAL_FACT_IDS.MORTGAGE_BALANCE,
        RESIDENTIAL_FACT_IDS.MORTGAGE_STATUS,
      ]),
      manualReviewRequirements: [
        "Confirm complete mortgage terms and explicit seller consent.",
        "Obtain legal review and transaction-specific approval.",
      ],
    }),
  ].filter(Boolean);
}

export function evaluateResidentialRiskSignals({
  factReadModel,
  underwriting,
} = {}) {
  const signals = [];
  const add = (value) => {
    const signal = normalizeResidentialRiskSignal(value);
    if (signal && !signals.some((entry) => entry.signalId === signal.signalId)) {
      signals.push(signal);
    }
  };
  const commonEvidence = underwriting?.inputEvidenceIds || [];
  if (underwriting?.evaluationState === "evaluated") {
    if (underwriting.ceilingSpread < 0) {
      add({
        signalId: "negative-ceiling-spread",
        label: "Acquisition ceiling is below asking price",
        explanation:
          "The versioned acquisition ceiling is lower than the stored asking price.",
        severity: RESIDENTIAL_RISK_SIGNAL_SEVERITIES.SIGNIFICANT,
        relatedFactIds: [
          RESIDENTIAL_FACT_IDS.ASKING_PRICE,
          RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
          RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE,
        ],
        evidenceReferenceIds: commonEvidence,
      });
    }
    if (underwriting.projectedFlipGrossMargin < 0) {
      add({
        signalId: "negative-projected-flip-gross-margin",
        label: "Projected flip gross margin is negative",
        explanation:
          "The current inputs produce a negative projected gross margin before other excluded costs.",
        severity: RESIDENTIAL_RISK_SIGNAL_SEVERITIES.SIGNIFICANT,
        relatedFactIds: [
          RESIDENTIAL_FACT_IDS.ASKING_PRICE,
          RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
          RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE,
        ],
        evidenceReferenceIds: commonEvidence,
      });
    }
    if (underwriting.repairToArvRatio > 0.3) {
      add({
        signalId: "repair-burden-above-thirty-percent",
        label: "Repair burden exceeds 30% of ARV",
        explanation:
          "The stored repair estimate exceeds 30% of the stored after-repair value.",
        severity: RESIDENTIAL_RISK_SIGNAL_SEVERITIES.SIGNIFICANT,
        relatedFactIds: [
          RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE,
          RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
        ],
        evidenceReferenceIds: evidenceForFacts(factReadModel, [
          RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE,
          RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
        ]),
      });
    }
    if (underwriting.mortgageToCeilingRatio > 1) {
      add({
        signalId: "mortgage-above-acquisition-ceiling",
        label: "Mortgage balance exceeds acquisition ceiling",
        explanation:
          "The stored mortgage balance exceeds the calculated acquisition ceiling.",
        severity: RESIDENTIAL_RISK_SIGNAL_SEVERITIES.SIGNIFICANT,
        relatedFactIds: [
          RESIDENTIAL_FACT_IDS.MORTGAGE_BALANCE,
          RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
          RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE,
        ],
        evidenceReferenceIds: evidenceForFacts(factReadModel, [
          RESIDENTIAL_FACT_IDS.MORTGAGE_BALANCE,
          RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
          RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE,
        ]),
      });
    }
  }
  if (
    factValue(factReadModel, RESIDENTIAL_FACT_IDS.OCCUPANCY_STATUS) ===
    "tenant-occupied"
  ) {
    add({
      signalId: "tenant-occupied",
      label: "Property is tenant occupied",
      explanation:
        "The stored occupancy status indicates tenant occupancy and requires execution review.",
      severity: RESIDENTIAL_RISK_SIGNAL_SEVERITIES.ATTENTION,
      relatedFactIds: [RESIDENTIAL_FACT_IDS.OCCUPANCY_STATUS],
      evidenceReferenceIds: evidenceForFacts(factReadModel, [
        RESIDENTIAL_FACT_IDS.OCCUPANCY_STATUS,
      ]),
      relatedSection: "property",
    });
  }
  const comparableCount = persistedComparableEvidence(
    factReadModel?.evidenceReferences
  );
  if (comparableCount === 0) {
    add({
      signalId: "missing-comparable-value-support",
      label: "Comparable-value support is limited",
      explanation:
        "No persisted comparable-sale record is linked; current ARV may rely only on compatibility Evidence.",
      severity: RESIDENTIAL_RISK_SIGNAL_SEVERITIES.ATTENTION,
      relatedFactIds: [
        RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
        RESIDENTIAL_FACT_IDS.COMPARABLE_SALE_EVIDENCE,
      ],
      evidenceReferenceIds: evidenceForFacts(factReadModel, [
        RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
      ]),
      relatedSection: "property",
    });
  }
  const compatibilityEvidence = (factReadModel?.evidenceReferences || []).filter(
    (entry) => entry.reliabilityLabel === "Compatibility Record"
  );
  if (compatibilityEvidence.length) {
    add({
      signalId: "compatibility-evidence-used",
      label: "Compatibility Evidence is in use",
      explanation:
        "One or more current CRM fields lack independent field-level verification. This signal is not a Data Reliability grade.",
      severity: RESIDENTIAL_RISK_SIGNAL_SEVERITIES.ATTENTION,
      relatedFactIds: [],
      evidenceReferenceIds: compatibilityEvidence.map(
        (entry) => entry.evidenceId
      ),
      relatedSection: "decision",
    });
  }
  const optionalFacts = [
    RESIDENTIAL_FACT_IDS.OCCUPANCY_STATUS,
    RESIDENTIAL_FACT_IDS.MORTGAGE_STATUS,
  ];
  const missingOptional = optionalFacts.filter(
    (factId) =>
      getResidentialFact(factReadModel, factId)?.state !==
      INFORMATION_STATES.PRESENT
  );
  if (missingOptional.length) {
    add({
      signalId: "missing-optional-execution-facts",
      label: "Optional execution facts are incomplete",
      explanation:
        "Occupancy or mortgage context is not fully represented; required underwriting can continue, but execution review is partial.",
      severity: RESIDENTIAL_RISK_SIGNAL_SEVERITIES.ATTENTION,
      relatedFactIds: missingOptional,
      evidenceReferenceIds: evidenceForFacts(factReadModel, missingOptional),
      relatedSection: "property",
    });
  }
  (factReadModel?.facts || []).forEach((fact) => {
    if (fact.state === INFORMATION_STATES.CONFLICTING) {
      add({
        signalId: `explicit-conflict:${fact.factId}`,
        label: `Explicit conflict: ${fact.factId}`,
        explanation:
          "A supplied explicit conflict affects this Residential Strategy fact and requires human review.",
        severity: RESIDENTIAL_RISK_SIGNAL_SEVERITIES.BLOCKING,
        relatedFactIds: [fact.factId],
        evidenceReferenceIds: fact.evidenceReferenceIds,
        relatedSection: "decision",
      });
    } else if (fact.state === INFORMATION_STATES.STALE) {
      add({
        signalId: `explicit-stale:${fact.factId}`,
        label: `Explicit stale state: ${fact.factId}`,
        explanation:
          "Supplied Evidence explicitly marks this fact stale; no freshness calculation was performed.",
        severity: RESIDENTIAL_RISK_SIGNAL_SEVERITIES.ATTENTION,
        relatedFactIds: [fact.factId],
        evidenceReferenceIds: fact.evidenceReferenceIds,
        relatedSection: "decision",
      });
    } else if (fact.state === INFORMATION_STATES.UNVERIFIED) {
      add({
        signalId: `explicit-unverified:${fact.factId}`,
        label: `Explicit unverified state: ${fact.factId}`,
        explanation:
          "Supplied Evidence explicitly marks this fact unverified; no reliability grade was calculated.",
        severity: RESIDENTIAL_RISK_SIGNAL_SEVERITIES.ATTENTION,
        relatedFactIds: [fact.factId],
        evidenceReferenceIds: fact.evidenceReferenceIds,
        relatedSection: "decision",
      });
    }
  });
  return signals.slice(0, 40);
}

export function buildResidentialBuyerMatchingInput({
  exitCandidates,
  factReadModel,
  underwriting,
} = {}) {
  return {
    contractVersion: "residential-buyer-matching-input-v1",
    assetType: ASSET_TYPES.RESIDENTIAL_HOME,
    propertyLocation: factValue(
      factReadModel,
      RESIDENTIAL_FACT_IDS.PROPERTY_IDENTITY
    ),
    askingPrice: underwriting?.askingPrice ?? null,
    acquisitionCeiling: underwriting?.acquisitionCeiling ?? null,
    afterRepairValue: underwriting?.afterRepairValue ?? null,
    repairEstimate: underwriting?.repairEstimate ?? null,
    propertyCondition: factValue(
      factReadModel,
      RESIDENTIAL_FACT_IDS.PROPERTY_CONDITION
    ),
    occupancy: factValue(
      factReadModel,
      RESIDENTIAL_FACT_IDS.OCCUPANCY_STATUS
    ),
    bedrooms: factValue(factReadModel, RESIDENTIAL_FACT_IDS.BEDROOMS),
    bathrooms: factValue(factReadModel, RESIDENTIAL_FACT_IDS.BATHROOMS),
    squareFootage: factValue(
      factReadModel,
      RESIDENTIAL_FACT_IDS.SQUARE_FOOTAGE
    ),
    strategyCandidateIds: (exitCandidates || [])
      .filter((candidate) =>
        [
          RESIDENTIAL_EXIT_CANDIDATE_STATES.CANDIDATE,
          RESIDENTIAL_EXIT_CANDIDATE_STATES.REVIEWABLE,
        ].includes(candidate.state)
      )
      .map((candidate) => candidate.candidateId),
    priceBandContext:
      underwriting?.evaluationState === "evaluated"
        ? {
            askingPrice: underwriting.askingPrice,
            acquisitionCeiling: underwriting.acquisitionCeiling,
          }
        : null,
    evidenceReferenceIds: uniqueStrings([
      ...(underwriting?.inputEvidenceIds || []),
      ...evidenceForFacts(factReadModel, [
        RESIDENTIAL_FACT_IDS.PROPERTY_IDENTITY,
        RESIDENTIAL_FACT_IDS.PROPERTY_CONDITION,
        RESIDENTIAL_FACT_IDS.OCCUPANCY_STATUS,
        RESIDENTIAL_FACT_IDS.BEDROOMS,
        RESIDENTIAL_FACT_IDS.BATHROOMS,
        RESIDENTIAL_FACT_IDS.SQUARE_FOOTAGE,
      ]),
    ]).slice(0, 80),
    partialDataWarnings: factReadModel?.partialDataWarnings || [],
  };
}

export function buildResidentialScoringObservations({
  evaluatedTimestamp,
  exitCandidates,
  factReadModel,
  missingInformationReadModel,
  underwriting,
} = {}) {
  const economicsFacts = [
    RESIDENTIAL_FACT_IDS.ASKING_PRICE,
    RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
    RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE,
  ];
  const arv = underwriting?.afterRepairValue;
  const ceilingSpreadRatio =
    underwriting?.evaluationState === "evaluated" && arv > 0
      ? underwriting.ceilingSpread / arv
      : null;
  const motivation = finiteNumber(
    factValue(factReadModel, RESIDENTIAL_FACT_IDS.SELLER_MOTIVATION)
  );
  const timelineDays = finiteNumber(
    factValue(factReadModel, RESIDENTIAL_FACT_IDS.SELLER_TIMELINE)
  );
  const mortgageFacts = [
    RESIDENTIAL_FACT_IDS.MORTGAGE_BALANCE,
    RESIDENTIAL_FACT_IDS.MORTGAGE_STATUS,
    ...economicsFacts,
  ];
  const noMortgage = isExplicitNoMortgage(factReadModel);
  const mortgageScore = noMortgage
    ? 100
    : scoreResidentialMortgageRatio(underwriting?.mortgageToCeilingRatio);
  const occupancy = factValue(
    factReadModel,
    RESIDENTIAL_FACT_IDS.OCCUPANCY_STATUS
  );
  const marketScore = marketValueSupportScore(factReadModel);
  const exitScore = exitOptionScore(exitCandidates);
  const sharedEconomicsRequirements = [
    RESIDENTIAL_REQUIREMENT_IDS.ASKING_PRICE,
    RESIDENTIAL_REQUIREMENT_IDS.AFTER_REPAIR_VALUE,
    RESIDENTIAL_REQUIREMENT_IDS.REPAIR_ESTIMATE,
  ];
  return [
    observation({
      factReadModel,
      missingInformationReadModel,
      factorId:
        RESIDENTIAL_PURSUIT_FACTOR_IDS.ACQUISITION_CEILING_SPREAD,
      factIds: economicsFacts,
      requirementIds: sharedEconomicsRequirements,
      rawValue: ceilingSpreadRatio,
      normalizedValue: ceilingSpreadRatio,
      normalizedScore: scoreResidentialCeilingSpreadRatio(ceilingSpreadRatio),
      evaluatedTimestamp,
      explanation:
        ceilingSpreadRatio === null
          ? "Acquisition ceiling spread cannot be evaluated without complete underwriting inputs."
          : `Acquisition ceiling spread is ${(ceilingSpreadRatio * 100).toFixed(1)}% of ARV under the versioned policy.`,
    }),
    observation({
      factReadModel,
      missingInformationReadModel,
      factorId:
        RESIDENTIAL_PURSUIT_FACTOR_IDS.PROJECTED_FLIP_GROSS_MARGIN,
      factIds: economicsFacts,
      requirementIds: sharedEconomicsRequirements,
      rawValue: underwriting?.projectedFlipGrossMarginRatio,
      normalizedValue: underwriting?.projectedFlipGrossMarginRatio,
      normalizedScore: scoreResidentialFlipMarginRatio(
        underwriting?.projectedFlipGrossMarginRatio
      ),
      evaluatedTimestamp,
      explanation:
        underwriting?.projectedFlipGrossMarginRatio === null ||
        underwriting?.projectedFlipGrossMarginRatio === undefined
          ? "Projected flip gross-margin ratio cannot be evaluated without complete underwriting inputs."
          : `Projected flip gross margin is ${(underwriting.projectedFlipGrossMarginRatio * 100).toFixed(1)}% of ARV before disclosed excluded costs.`,
      warnings: [RESIDENTIAL_FLIP_EXCLUDED_COSTS_DISCLOSURE],
    }),
    observation({
      factReadModel,
      missingInformationReadModel,
      factorId: RESIDENTIAL_PURSUIT_FACTOR_IDS.SELLER_MOTIVATION,
      factIds: [RESIDENTIAL_FACT_IDS.SELLER_MOTIVATION],
      requirementIds: [RESIDENTIAL_REQUIREMENT_IDS.SELLER_MOTIVATION],
      rawValue: motivation,
      normalizedValue: motivation,
      normalizedScore:
        motivation !== null && motivation >= 0 && motivation <= 10
          ? Math.max(0, Math.min(100, motivation * 10))
          : null,
      evaluatedTimestamp,
      explanation:
        motivation !== null && motivation >= 0 && motivation <= 10
          ? `Seller motivation is explicitly stored as ${motivation} on the documented 0-10 scale.`
          : "Seller motivation requires a finite numeric value on the documented 0-10 scale; text and legacy lead scores are not converted.",
    }),
    observation({
      factReadModel,
      missingInformationReadModel,
      factorId: RESIDENTIAL_PURSUIT_FACTOR_IDS.MORTGAGE_FLEXIBILITY,
      factIds: mortgageFacts,
      requirementIds: [],
      rawValue: noMortgage ? 0 : underwriting?.mortgageToCeilingRatio,
      normalizedValue: noMortgage
        ? "explicit-no-mortgage"
        : underwriting?.mortgageToCeilingRatio,
      normalizedScore: mortgageScore,
      informationState:
        mortgageScore === null
          ? PURSUIT_SCORING_INFORMATION_STATES.MISSING
          : PURSUIT_SCORING_INFORMATION_STATES.PRESENT,
      evaluatedTimestamp,
      explanation: noMortgage
        ? "The stored mortgage status explicitly indicates no mortgage."
        : mortgageScore === null
          ? "Mortgage flexibility is optional and was omitted because a valid mortgage-to-ceiling ratio is unavailable."
          : `Mortgage balance is ${(underwriting.mortgageToCeilingRatio * 100).toFixed(1)}% of the acquisition ceiling.`,
    }),
    observation({
      factReadModel,
      missingInformationReadModel,
      factorId: RESIDENTIAL_PURSUIT_FACTOR_IDS.SELLER_TIMELINE,
      factIds: [RESIDENTIAL_FACT_IDS.SELLER_TIMELINE],
      requirementIds: [RESIDENTIAL_REQUIREMENT_IDS.SELLER_TIMELINE],
      rawValue: timelineDays,
      normalizedValue: timelineDays,
      normalizedScore: scoreResidentialTimelineDays(timelineDays),
      evaluatedTimestamp,
      explanation:
        timelineDays === null
          ? "Seller timeline is absent or ambiguous and was not guessed."
          : `Seller timeline deterministically maps to ${timelineDays} day${timelineDays === 1 ? "" : "s"} from the supplied evaluation timestamp.`,
    }),
    observation({
      factReadModel,
      missingInformationReadModel,
      factorId: RESIDENTIAL_PURSUIT_FACTOR_IDS.REPAIR_BURDEN,
      factIds: [
        RESIDENTIAL_FACT_IDS.REPAIR_ESTIMATE,
        RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
      ],
      requirementIds: [
        RESIDENTIAL_REQUIREMENT_IDS.REPAIR_ESTIMATE,
        RESIDENTIAL_REQUIREMENT_IDS.AFTER_REPAIR_VALUE,
      ],
      rawValue: underwriting?.repairToArvRatio,
      normalizedValue: underwriting?.repairToArvRatio,
      normalizedScore: scoreResidentialRepairBurden(
        underwriting?.repairToArvRatio
      ),
      evaluatedTimestamp,
      explanation:
        underwriting?.repairToArvRatio === null ||
        underwriting?.repairToArvRatio === undefined
          ? "Repair burden cannot be evaluated without a valid repair estimate and ARV."
          : `Repair estimate is ${(underwriting.repairToArvRatio * 100).toFixed(1)}% of ARV.`,
    }),
    observation({
      factReadModel,
      missingInformationReadModel,
      factorId: RESIDENTIAL_PURSUIT_FACTOR_IDS.MARKET_VALUE_SUPPORT,
      factIds: [
        RESIDENTIAL_FACT_IDS.AFTER_REPAIR_VALUE,
        RESIDENTIAL_FACT_IDS.COMPARABLE_SALE_EVIDENCE,
      ],
      requirementIds: [
        RESIDENTIAL_REQUIREMENT_IDS.AFTER_REPAIR_VALUE,
        RESIDENTIAL_REQUIREMENT_IDS.MARKET_VALUE_SUPPORT,
      ],
      rawValue: persistedComparableEvidence(
        factReadModel?.evidenceReferences
      ),
      normalizedValue: marketScore,
      normalizedScore: marketScore,
      informationState:
        marketScore === null
          ? PURSUIT_SCORING_INFORMATION_STATES.MISSING
          : PURSUIT_SCORING_INFORMATION_STATES.PRESENT,
      evaluatedTimestamp,
      explanation:
        marketScore === null
          ? "Market-value support lacks the Evidence required by the profile."
          : `${persistedComparableEvidence(
              factReadModel?.evidenceReferences
            )} persisted comparable-sale record(s) support the current value context; compatibility-only ARV Evidence scores 50.`,
    }),
    observation({
      factReadModel,
      missingInformationReadModel,
      factorId: RESIDENTIAL_PURSUIT_FACTOR_IDS.EXIT_OPTION_FIT,
      factIds: [
        ...economicsFacts,
        RESIDENTIAL_FACT_IDS.RENT_ESTIMATE,
      ],
      requirementIds: sharedEconomicsRequirements,
      rawValue: (exitCandidates || []).filter((candidate) =>
        [
          RESIDENTIAL_EXIT_CANDIDATE_STATES.CANDIDATE,
          RESIDENTIAL_EXIT_CANDIDATE_STATES.REVIEWABLE,
        ].includes(candidate.state)
      ).length,
      normalizedValue: exitScore,
      normalizedScore: exitScore,
      informationState:
        underwriting?.evaluationState === "evaluated"
          ? PURSUIT_SCORING_INFORMATION_STATES.PRESENT
          : PURSUIT_SCORING_INFORMATION_STATES.MISSING,
      evaluatedTimestamp,
      explanation:
        "Exit-option fit measures the number and type of review paths supported by current facts; it does not select an exit or direct a transaction.",
    }),
    observation({
      factReadModel,
      missingInformationReadModel,
      factorId: RESIDENTIAL_PURSUIT_FACTOR_IDS.OCCUPANCY_COMPLEXITY,
      factIds: [RESIDENTIAL_FACT_IDS.OCCUPANCY_STATUS],
      requirementIds: [],
      rawValue: occupancy,
      normalizedValue: occupancy,
      normalizedScore: occupancyScore(occupancy),
      informationState:
        occupancyScore(occupancy) === null
          ? PURSUIT_SCORING_INFORMATION_STATES.UNKNOWN
          : PURSUIT_SCORING_INFORMATION_STATES.PRESENT,
      evaluatedTimestamp,
      explanation:
        occupancyScore(occupancy) === null
          ? "Occupancy complexity is optional and was omitted because the stored status is unknown or ambiguous."
          : `Occupancy complexity uses the explicit stored status "${occupancy}".`,
    }),
  ];
}

function relevantUnderwritingBlockers(readModel) {
  const requirementIds = new Set([
    RESIDENTIAL_REQUIREMENT_IDS.ASKING_PRICE,
    RESIDENTIAL_REQUIREMENT_IDS.AFTER_REPAIR_VALUE,
    RESIDENTIAL_REQUIREMENT_IDS.REPAIR_ESTIMATE,
  ]);
  return (readModel?.blockingItems || [])
    .filter((item) => requirementIds.has(item.requirementId))
    .map((item) => item.itemId || item.requirementId);
}

function buildReviewGuidance({
  exitCandidates,
  missingInformationReadModel,
  pursuitScoreResult,
  riskSignals,
  underwriting,
}) {
  const blocking = (missingInformationReadModel?.blockingItems || []).filter(
    (item) => item.state !== INFORMATION_STATES.PRESENT
  );
  if (blocking.length) {
    return {
      state: RESIDENTIAL_STRATEGY_REVIEW_STATES.VERIFY_CRITICAL_INFORMATION,
      label: "Verify decision-critical residential information",
      explanation:
        "Resolve the highest-priority blocking information item before relying on strategy scoring or underwriting.",
      missingInformationItemIds: blocking.map(
        (item) => item.itemId || item.requirementId
      ),
      riskSignalIds: [],
      exitCandidateIds: [],
    };
  }
  if (underwriting?.evaluationState !== "evaluated") {
    return {
      state: RESIDENTIAL_STRATEGY_REVIEW_STATES.UNAVAILABLE,
      label: "Review residential underwriting inputs",
      explanation:
        "Required underwriting facts are not currently available for deterministic review.",
      missingInformationItemIds: underwriting?.blockingIssueIds || [],
      riskSignalIds: [],
      exitCandidateIds: [],
    };
  }
  const blockingSignals = (riskSignals || []).filter(
    (signal) =>
      signal.severity === RESIDENTIAL_RISK_SIGNAL_SEVERITIES.BLOCKING
  );
  if (blockingSignals.length) {
    return {
      state: RESIDENTIAL_STRATEGY_REVIEW_STATES.MANUAL_REVIEW_REQUIRED,
      label: "Review explicit residential conflicts",
      explanation:
        "One or more explicit conflicts require human review before stronger strategy conclusions.",
      missingInformationItemIds: [],
      riskSignalIds: blockingSignals.map((signal) => signal.signalId),
      exitCandidateIds: [],
    };
  }
  const availableExits = (exitCandidates || []).filter((candidate) =>
    [
      RESIDENTIAL_EXIT_CANDIDATE_STATES.CANDIDATE,
      RESIDENTIAL_EXIT_CANDIDATE_STATES.REVIEWABLE,
    ].includes(candidate.state)
  );
  return {
    state: availableExits.length
      ? RESIDENTIAL_STRATEGY_REVIEW_STATES.REVIEW_EXIT_OPTIONS
      : RESIDENTIAL_STRATEGY_REVIEW_STATES.REVIEW_UNDERWRITING,
    label: availableExits.length
      ? "Review supported residential exit paths"
      : "Review the residential underwriting basis",
    explanation:
      pursuitScoreResult?.evaluationState ===
      PURSUIT_SCORING_EVALUATION_STATES.PARTIAL
        ? "Continue human review with the disclosed partial factors, underwriting assumptions, and individual risk signals."
        : "Continue human review using the versioned underwriting assumptions, scoring factors, and individual risk signals.",
    missingInformationItemIds: [],
    riskSignalIds: (riskSignals || []).map((signal) => signal.signalId),
    exitCandidateIds: availableExits.map((candidate) => candidate.candidateId),
  };
}

function unavailableStrategyResult(context, evaluatedTimestamp, explanation) {
  return {
    contractVersion: RESIDENTIAL_STRATEGY_READ_MODEL_VERSION,
    strategyId: RESIDENTIAL_STRATEGY_ID,
    strategyVersion: RESIDENTIAL_STRATEGY_VERSION,
    assetType: context.assetType || null,
    evaluationState: "unavailable",
    eligible: false,
    explanation,
    factReadModel: null,
    missingInformationReadModel: null,
    underwriting: null,
    riskSignals: [],
    exitCandidates: [],
    buyerMatchingInput: null,
    scoringObservations: [],
    pursuitScoreResult: null,
    reviewGuidance: {
      state: RESIDENTIAL_STRATEGY_REVIEW_STATES.UNAVAILABLE,
      label: "Residential Strategy unavailable",
      explanation,
      missingInformationItemIds: [],
      riskSignalIds: [],
      exitCandidateIds: [],
    },
    evidenceReferences: [],
    capabilitySupport: RESIDENTIAL_CAPABILITY_SUPPORT,
    evaluatedTimestamp: normalizeDecisionTimestamp(evaluatedTimestamp),
    partialDataWarnings: [],
  };
}

export function evaluateResidentialStrategy({
  assetStrategyContext: suppliedContext,
  compEvidence = [],
  conflicts = [],
  deal,
  evaluatedTimestamp,
  evidenceReferences = [],
  factReadModel: suppliedFactReadModel,
  missingInformationReadModel: suppliedMissingInformation,
} = {}) {
  const safeDeal = safeObject(deal);
  const context = suppliedContext || buildAssetStrategyContext(safeDeal);
  const normalizedTimestamp = normalizeDecisionTimestamp(evaluatedTimestamp);
  const eligible = Boolean(
    context.classificationState === ASSET_CLASSIFICATION_STATES.CLASSIFIED &&
      context.assetType === ASSET_TYPES.RESIDENTIAL_HOME &&
      context.selectedStrategyId === RESIDENTIAL_STRATEGY_ID &&
      context.strategySupportState === ASSET_STRATEGY_SUPPORT_STATES.IMPLEMENTED &&
      context.manualReviewRequired !== true &&
      !(context.classificationConflicts || []).length
  );
  if (!eligible) {
    return unavailableStrategyResult(
      context,
      normalizedTimestamp,
      "Residential Acquisition Strategy v1 requires an explicit, non-conflicting residential-home classification and never runs as a fallback for another asset type."
    );
  }
  const strategyValidation = validateResidentialStrategyContract();
  const profileValidation = validateResidentialPursuitProfile();
  if (!strategyValidation.valid || !profileValidation.valid) {
    return unavailableStrategyResult(
      context,
      normalizedTimestamp,
      "Residential Strategy configuration is invalid and cannot be evaluated safely."
    );
  }
  const factReadModel =
    suppliedFactReadModel ||
    adaptResidentialFacts({
      assetStrategyContext: context,
      conflicts,
      deal: safeDeal,
      evaluatedTimestamp: normalizedTimestamp,
      evidenceReferences: [...evidenceReferences, ...compEvidence],
    });
  const missingInformationReadModel =
    suppliedMissingInformation ||
    evaluateMissingInformation({
      assetStrategyContext: context,
      conflicts,
      deal: safeDeal,
      evaluatedTimestamp: normalizedTimestamp,
      evidenceReferences: factReadModel.evidenceReferences,
      freshnessStates: factReadModel.explicitFreshnessStates,
      informationStates: factReadModel.informationStates,
      verificationStates: factReadModel.explicitVerificationStates,
    });
  const underwriting = evaluateResidentialUnderwriting({
    blockingIssueIds: relevantUnderwritingBlockers(
      missingInformationReadModel
    ),
    evaluatedTimestamp: normalizedTimestamp,
    factReadModel,
  });
  const exitCandidates = evaluateResidentialExitCandidates({
    factReadModel,
    underwriting,
  });
  const riskSignals = evaluateResidentialRiskSignals({
    factReadModel,
    underwriting,
  });
  const scoringObservations = buildResidentialScoringObservations({
    evaluatedTimestamp: normalizedTimestamp,
    exitCandidates,
    factReadModel,
    missingInformationReadModel,
    underwriting,
  });
  const pursuitScoreResult = evaluatePursuitScore({
    assetStrategyContext: context,
    assetStrategyContract: RESIDENTIAL_ACQUISITION_STRATEGY,
    scoringProfile: RESIDENTIAL_PURSUIT_SCORING_PROFILE,
    factorObservations: scoringObservations,
    missingInformationReadModel,
    evidenceReferences: factReadModel.evidenceReferences,
    evaluatedTimestamp: normalizedTimestamp,
    executionMode: PURSUIT_SCORING_EXECUTION_MODES.PRODUCTION,
  });
  const buyerMatchingInput = buildResidentialBuyerMatchingInput({
    exitCandidates,
    factReadModel,
    underwriting,
  });
  const reviewGuidance = buildReviewGuidance({
    exitCandidates,
    missingInformationReadModel,
    pursuitScoreResult,
    riskSignals,
    underwriting,
  });
  const warnings = uniqueStrings([
    ...factReadModel.partialDataWarnings,
    ...underwriting.partialDataWarnings,
    ...pursuitScoreResult.partialDataWarnings,
    ...(!normalizedTimestamp
      ? ["A supplied evaluation timestamp is required for reproducible strategy scoring."]
      : []),
  ]).slice(0, 20);

  return {
    contractVersion: RESIDENTIAL_STRATEGY_READ_MODEL_VERSION,
    strategyId: RESIDENTIAL_STRATEGY_ID,
    strategyVersion: RESIDENTIAL_STRATEGY_VERSION,
    assetType: ASSET_TYPES.RESIDENTIAL_HOME,
    scoringProfileId: RESIDENTIAL_PURSUIT_PROFILE_ID,
    scoringRulesetVersion: RESIDENTIAL_PURSUIT_RULESET_VERSION,
    evaluationState: [
      PURSUIT_SCORING_EVALUATION_STATES.BLOCKED,
      PURSUIT_SCORING_EVALUATION_STATES.PARTIAL,
    ].includes(pursuitScoreResult.evaluationState)
      ? "partial"
      : "evaluated",
    eligible: true,
    explanation:
      "Residential Acquisition Strategy v1 evaluated current stored facts through deterministic, versioned rules.",
    factReadModel,
    missingInformationReadModel,
    underwriting,
    riskSignals,
    exitCandidates,
    buyerMatchingInput,
    scoringObservations,
    pursuitScoreResult,
    reviewGuidance,
    evidenceReferences: factReadModel.evidenceReferences,
    capabilitySupport: RESIDENTIAL_CAPABILITY_SUPPORT,
    evaluatedTimestamp: normalizedTimestamp,
    partialDataWarnings: warnings,
  };
}

export function evaluateResidentialStrategyPreview({
  deal,
  evaluatedTimestamp,
  evidenceReferences = [],
} = {}) {
  return evaluateResidentialStrategy({
    deal,
    evaluatedTimestamp,
    evidenceReferences,
  });
}
