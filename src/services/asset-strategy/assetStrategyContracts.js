import {
  DECISION_CONTRACT_VERSION,
  DECISION_METRIC_REGISTRY,
  normalizeDecisionTimestamp,
} from "../decision-intelligence/decisionContracts";
import { compactText, uniqueStrings } from "../../utils/text";

// Distinct responsibility: define the serializable, provider-neutral contract
// every asset strategy must satisfy without implementing a concrete strategy.
export const ASSET_STRATEGY_CONTRACT_VERSION = "asset-strategy-contract-v1";

export const ASSET_TYPES = Object.freeze({
  RESIDENTIAL_HOME: "residential-home",
  VACANT_RESIDENTIAL_LAND: "vacant-residential-land",
  SMALL_MULTIFAMILY: "small-multifamily",
  MANUFACTURED_HOME: "manufactured-home",
  COMMERCIAL: "commercial",
});

export const ASSET_TYPE_ROADMAP_STATES = Object.freeze({
  PRIORITY: "priority",
  LATER: "later",
  DEFERRED: "deferred",
});

export const ASSET_TYPE_REGISTRY = Object.freeze(
  [
    {
      id: ASSET_TYPES.RESIDENTIAL_HOME,
      label: "Residential home",
      strategyId: "residential-acquisition",
      priority: 1,
      roadmapState: ASSET_TYPE_ROADMAP_STATES.PRIORITY,
    },
    {
      id: ASSET_TYPES.VACANT_RESIDENTIAL_LAND,
      label: "Vacant residential land",
      strategyId: "vacant-land-acquisition",
      priority: 2,
      roadmapState: ASSET_TYPE_ROADMAP_STATES.PRIORITY,
    },
    {
      id: ASSET_TYPES.SMALL_MULTIFAMILY,
      label: "Small multifamily",
      strategyId: "small-multifamily-acquisition",
      priority: 3,
      roadmapState: ASSET_TYPE_ROADMAP_STATES.PRIORITY,
    },
    {
      id: ASSET_TYPES.MANUFACTURED_HOME,
      label: "Manufactured home",
      strategyId: "manufactured-home-acquisition",
      priority: 4,
      roadmapState: ASSET_TYPE_ROADMAP_STATES.LATER,
    },
    {
      id: ASSET_TYPES.COMMERCIAL,
      label: "Commercial",
      strategyId: "commercial-acquisition",
      priority: 5,
      roadmapState: ASSET_TYPE_ROADMAP_STATES.DEFERRED,
    },
  ].map(Object.freeze)
);

export const ASSET_CLASSIFICATION_STATES = Object.freeze({
  UNCLASSIFIED: "unclassified",
  CLASSIFIED: "classified",
  AMBIGUOUS: "ambiguous",
  UNSUPPORTED: "unsupported",
});

export const ASSET_CLASSIFICATION_SOURCE_KINDS = Object.freeze({
  UNKNOWN: "unknown",
  CANONICAL_FIELD: "canonical-field",
  LEGACY_PROPERTY_TYPE: "legacy-property-type",
  MANUAL: "manual",
  IMPORT: "import",
  DETERMINISTIC_COMPATIBILITY: "deterministic-compatibility",
});

export const ASSET_STRATEGY_STATUSES = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  DEFERRED: "deferred",
  RETIRED: "retired",
});

export const ASSET_STRATEGY_CRITICALITIES = Object.freeze({
  BLOCKING: "blocking",
  ADVISORY: "advisory",
  INFORMATIONAL: "informational",
});

export const ASSET_STRATEGY_REQUIREMENT_SCOPES = Object.freeze({
  IDENTIFICATION: "identification",
  COMPLETENESS: "completeness",
  UNDERWRITING: "underwriting",
  RISK: "risk",
  PURSUIT_SCORING: "pursuit-scoring",
  READINESS: "readiness",
  OFFER: "offer",
  EXIT_STRATEGY: "exit-strategy",
  BUYER_MATCHING: "buyer-matching",
  VERIFICATION: "verification",
});

export const ASSET_STRATEGY_CAPABILITY_KEYS = Object.freeze([
  "requiredFacts",
  "dataCompletenessRules",
  "underwritingHooks",
  "riskRules",
  "pursuitScoringHooks",
  "readinessGates",
  "offerLogic",
  "exitStrategies",
  "buyerMatchingRules",
  "verificationRequirements",
]);

export const ASSET_STRATEGY_ANALYSIS_GATE_REASONS = Object.freeze({
  READY: "ready",
  ASSET_UNCLASSIFIED: "asset-unclassified",
  ASSET_CLASSIFICATION_REVIEW_REQUIRED:
    "asset-classification-review-required",
  STRATEGY_INVALID: "strategy-invalid",
  STRATEGY_INACTIVE: "strategy-inactive",
  ASSET_STRATEGY_MISMATCH: "asset-strategy-mismatch",
});

export const ASSET_STRATEGY_SECTION_LIMIT = 100;
export const ASSET_STRATEGY_REFERENCE_LIMIT = 50;
export const ASSET_STRATEGY_WARNING_LIMIT = 10;

const ASSET_TYPE_BY_ID = new Map(
  ASSET_TYPE_REGISTRY.map((definition) => [definition.id, definition])
);
const ASSET_TYPE_IDS = new Set(ASSET_TYPE_BY_ID.keys());
const CLASSIFICATION_STATES = new Set(
  Object.values(ASSET_CLASSIFICATION_STATES)
);
const CLASSIFICATION_SOURCE_KINDS = new Set(
  Object.values(ASSET_CLASSIFICATION_SOURCE_KINDS)
);
const STRATEGY_STATUSES = new Set(Object.values(ASSET_STRATEGY_STATUSES));
const CRITICALITIES = new Set(
  Object.values(ASSET_STRATEGY_CRITICALITIES)
);
const REQUIREMENT_SCOPES = new Set(
  Object.values(ASSET_STRATEGY_REQUIREMENT_SCOPES)
);
const DECISION_METRIC_IDS = new Set(
  DECISION_METRIC_REGISTRY.map((metric) => metric.id)
);

const SECTION_IDENTIFIERS = Object.freeze({
  requiredFacts: "factId",
  dataCompletenessRules: "ruleId",
  underwritingHooks: "hookId",
  riskRules: "ruleId",
  pursuitScoringHooks: "hookId",
  readinessGates: "gateId",
  offerLogic: "ruleId",
  exitStrategies: "exitStrategyId",
  buyerMatchingRules: "ruleId",
  verificationRequirements: "verificationRequirementId",
});

const SECTION_METRIC_TARGETS = Object.freeze({
  dataCompletenessRules: "data-completeness",
  riskRules: "risk-level",
  pursuitScoringHooks: "pursuit-score",
  readinessGates: "offer-readiness",
});

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function safeText(value, maximum = 240) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const text = compactText(String(value));
  if (text.length <= maximum) return text;
  return `${text.slice(0, maximum - 3).trimEnd()}...`;
}

function nullableText(value, maximum) {
  return safeText(value, maximum) || null;
}

function nullableBoolean(value) {
  return typeof value === "boolean" ? value : null;
}

function normalizeStringList(values, limit = ASSET_STRATEGY_REFERENCE_LIMIT) {
  const source = Array.isArray(values) ? values : values ? [values] : [];
  return uniqueStrings(source.map((value) => safeText(value))).slice(0, limit);
}

function normalizeWarnings(values) {
  return normalizeStringList(values, ASSET_STRATEGY_WARNING_LIMIT);
}

function normalizeDefinitionBase(value, identifierKey) {
  const source = safeObject(value);
  const identifier = nullableText(source[identifierKey] || source.id, 160);
  const label = nullableText(source.label, 200);
  if (!identifier || !label) return null;

  return {
    source,
    definition: {
      [identifierKey]: identifier,
      label,
      description: nullableText(source.description, 480),
    },
  };
}

function normalizeRequiredFact(value) {
  const base = normalizeDefinitionBase(value, "factId");
  if (!base) return null;
  const { source, definition } = base;

  return {
    ...definition,
    canonicalField: nullableText(source.canonicalField, 160),
    criticality: CRITICALITIES.has(source.criticality)
      ? source.criticality
      : null,
    requiredFor: normalizeStringList(source.requiredFor).filter((scope) =>
      REQUIREMENT_SCOPES.has(scope)
    ),
    verificationRequirementIds: normalizeStringList(
      source.verificationRequirementIds
    ),
    evidenceRequired: nullableBoolean(source.evidenceRequired),
  };
}

function normalizeRuleDefinition(value, identifierKey) {
  const base = normalizeDefinitionBase(value, identifierKey);
  if (!base) return null;
  const { source, definition } = base;

  return {
    ...definition,
    requiredFactIds: normalizeStringList(source.requiredFactIds),
    blockingFactIds: normalizeStringList(source.blockingFactIds),
    evidenceRequirementIds: normalizeStringList(
      source.evidenceRequirementIds
    ),
    outputMetricIds: normalizeStringList(source.outputMetricIds),
    actionCodes: normalizeStringList(source.actionCodes),
  };
}

function normalizeUnderwritingHook(value) {
  const base = normalizeDefinitionBase(value, "hookId");
  if (!base) return null;
  const { source, definition } = base;

  return {
    ...definition,
    inputFactIds: normalizeStringList(
      source.inputFactIds || source.requiredFactIds
    ),
    outputKeys: normalizeStringList(source.outputKeys),
    evidenceRequirementIds: normalizeStringList(
      source.evidenceRequirementIds
    ),
  };
}

function normalizePursuitScoringHook(value) {
  const base = normalizeDefinitionBase(value, "hookId");
  if (!base) return null;
  const { source, definition } = base;

  return {
    ...definition,
    inputFactIds: normalizeStringList(
      source.inputFactIds || source.requiredFactIds
    ),
    evidenceRequirementIds: normalizeStringList(
      source.evidenceRequirementIds
    ),
    outputMetricIds: normalizeStringList(source.outputMetricIds),
  };
}

function normalizeExitStrategy(value) {
  const base = normalizeDefinitionBase(value, "exitStrategyId");
  if (!base) return null;
  const { source, definition } = base;

  return {
    ...definition,
    requiredFactIds: normalizeStringList(source.requiredFactIds),
    evidenceRequirementIds: normalizeStringList(
      source.evidenceRequirementIds
    ),
  };
}

function normalizeVerificationRequirement(value) {
  const base = normalizeDefinitionBase(value, "verificationRequirementId");
  if (!base) return null;
  const { source, definition } = base;

  return {
    ...definition,
    requiredFactIds: normalizeStringList(source.requiredFactIds),
    criticality: CRITICALITIES.has(source.criticality)
      ? source.criticality
      : null,
    acceptableSourceTypes: normalizeStringList(source.acceptableSourceTypes),
    freshnessPolicyId: nullableText(source.freshnessPolicyId, 160),
    humanReviewRequired: nullableBoolean(source.humanReviewRequired),
  };
}

function normalizeCapabilityList(values, normalizer) {
  return (Array.isArray(values) ? values : [])
    .map(normalizer)
    .filter(Boolean)
    .slice(0, ASSET_STRATEGY_SECTION_LIMIT);
}

function normalizeCapabilities(value) {
  const source = safeObject(value);
  return {
    requiredFacts: normalizeCapabilityList(
      source.requiredFacts,
      normalizeRequiredFact
    ),
    dataCompletenessRules: normalizeCapabilityList(
      source.dataCompletenessRules || source.completenessRules,
      (entry) => normalizeRuleDefinition(entry, "ruleId")
    ),
    underwritingHooks: normalizeCapabilityList(
      source.underwritingHooks,
      normalizeUnderwritingHook
    ),
    riskRules: normalizeCapabilityList(source.riskRules, (entry) =>
      normalizeRuleDefinition(entry, "ruleId")
    ),
    pursuitScoringHooks: normalizeCapabilityList(
      source.pursuitScoringHooks,
      normalizePursuitScoringHook
    ),
    readinessGates: normalizeCapabilityList(source.readinessGates, (entry) =>
      normalizeRuleDefinition(entry, "gateId")
    ),
    offerLogic: normalizeCapabilityList(source.offerLogic, (entry) =>
      normalizeRuleDefinition(entry, "ruleId")
    ),
    exitStrategies: normalizeCapabilityList(
      source.exitStrategies,
      normalizeExitStrategy
    ),
    buyerMatchingRules: normalizeCapabilityList(
      source.buyerMatchingRules,
      (entry) => normalizeRuleDefinition(entry, "ruleId")
    ),
    verificationRequirements: normalizeCapabilityList(
      source.verificationRequirements,
      normalizeVerificationRequirement
    ),
  };
}

export function normalizeAssetType(value) {
  const assetType = safeText(value, 120).toLowerCase();
  return ASSET_TYPE_IDS.has(assetType) ? assetType : null;
}

export function getAssetTypeDefinition(value) {
  return ASSET_TYPE_BY_ID.get(normalizeAssetType(value)) || null;
}

function normalizeClassificationSourceValues(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => {
      const source = safeObject(value);
      const field = nullableText(source.field, 120);
      const rawValue = nullableText(source.rawValue ?? source.value, 200);
      if (!field || !rawValue) return null;
      return {
        field,
        rawValue,
        mappedAssetType: normalizeAssetType(source.mappedAssetType),
        resolution: nullableText(source.resolution, 80),
      };
    })
    .filter(Boolean)
    .slice(0, 8);
}

export function normalizeAssetClassification(value) {
  const source = safeObject(value);
  const assetType = normalizeAssetType(source.assetType);
  const requestedState = CLASSIFICATION_STATES.has(source.state)
    ? source.state
    : assetType
      ? ASSET_CLASSIFICATION_STATES.CLASSIFIED
      : ASSET_CLASSIFICATION_STATES.UNCLASSIFIED;
  const state =
    requestedState === ASSET_CLASSIFICATION_STATES.CLASSIFIED && !assetType
      ? ASSET_CLASSIFICATION_STATES.UNCLASSIFIED
      : requestedState;

  return {
    classificationId: nullableText(source.classificationId || source.id, 200),
    contractVersion: ASSET_STRATEGY_CONTRACT_VERSION,
    organizationId: nullableText(source.organizationId, 160),
    tenantId: nullableText(source.tenantId, 160),
    opportunityId: nullableText(
      source.opportunityId || source.dealId || source.propertyId,
      160
    ),
    state,
    assetType:
      state === ASSET_CLASSIFICATION_STATES.CLASSIFIED ? assetType : null,
    candidateAssetTypes: normalizeStringList(source.candidateAssetTypes).filter(
      (candidate) => ASSET_TYPE_IDS.has(candidate)
    ),
    sourceKind: CLASSIFICATION_SOURCE_KINDS.has(source.sourceKind)
      ? source.sourceKind
      : ASSET_CLASSIFICATION_SOURCE_KINDS.UNKNOWN,
    sourceValues: normalizeClassificationSourceValues(source.sourceValues),
    evidenceReferenceIds: normalizeStringList(source.evidenceReferenceIds),
    reasonCode: nullableText(source.reasonCode, 120),
    requiresHumanReview:
      state === ASSET_CLASSIFICATION_STATES.CLASSIFIED
        ? source.requiresHumanReview === true
        : true,
    rulesetVersion: nullableText(source.rulesetVersion, 80),
    classifiedTimestamp: normalizeDecisionTimestamp(source.classifiedTimestamp),
    partialDataWarnings: normalizeWarnings(source.partialDataWarnings),
  };
}

export function normalizeAssetStrategyContract(value) {
  const source = safeObject(value);
  const capabilities = normalizeCapabilities(source.capabilities || source);

  return {
    contractVersion: ASSET_STRATEGY_CONTRACT_VERSION,
    decisionContractVersion: DECISION_CONTRACT_VERSION,
    strategyId: nullableText(source.strategyId || source.id, 160),
    strategyVersion: nullableText(source.strategyVersion || source.version, 80),
    label: nullableText(source.label, 200),
    description: nullableText(source.description, 480),
    assetType: normalizeAssetType(source.assetType),
    status: STRATEGY_STATUSES.has(source.status)
      ? source.status
      : ASSET_STRATEGY_STATUSES.DRAFT,
    organizationId: nullableText(source.organizationId, 160),
    tenantId: nullableText(source.tenantId, 160),
    capabilities,
    evidenceReferenceIds: normalizeStringList(source.evidenceReferenceIds),
    effectiveTimestamp: normalizeDecisionTimestamp(source.effectiveTimestamp),
    supersedesStrategyVersion: nullableText(
      source.supersedesStrategyVersion,
      80
    ),
    partialDataWarnings: normalizeWarnings(source.partialDataWarnings),
  };
}

function validateUniqueIdentifiers(capabilities, errors) {
  ASSET_STRATEGY_CAPABILITY_KEYS.forEach((sectionKey) => {
    const identifierKey = SECTION_IDENTIFIERS[sectionKey];
    const identifiers = capabilities[sectionKey].map(
      (definition) => definition[identifierKey]
    );
    if (new Set(identifiers).size !== identifiers.length) {
      errors.push(`${sectionKey} must use unique ${identifierKey} values.`);
    }
  });
}

function validateReferences(capabilities, errors) {
  const factIds = new Set(
    capabilities.requiredFacts.map((definition) => definition.factId)
  );
  const verificationIds = new Set(
    capabilities.verificationRequirements.map(
      (definition) => definition.verificationRequirementId
    )
  );

  ASSET_STRATEGY_CAPABILITY_KEYS.forEach((sectionKey) => {
    capabilities[sectionKey].forEach((definition) => {
      [
        ...(definition.requiredFactIds || []),
        ...(definition.inputFactIds || []),
        ...(definition.blockingFactIds || []),
      ].forEach((factId) => {
        if (!factIds.has(factId)) {
          errors.push(`${sectionKey} references unknown fact ${factId}.`);
        }
      });

      (definition.evidenceRequirementIds || []).forEach((requirementId) => {
        if (!verificationIds.has(requirementId)) {
          errors.push(
            `${sectionKey} references unknown verification requirement ${requirementId}.`
          );
        }
      });
    });
  });

  capabilities.requiredFacts.forEach((fact) => {
    fact.verificationRequirementIds.forEach((requirementId) => {
      if (!verificationIds.has(requirementId)) {
        errors.push(
          `requiredFacts references unknown verification requirement ${requirementId}.`
        );
      }
    });
  });
}

function validateMetricTargets(capabilities, errors) {
  Object.entries(SECTION_METRIC_TARGETS).forEach(
    ([sectionKey, requiredMetricId]) => {
      capabilities[sectionKey].forEach((definition) => {
        definition.outputMetricIds.forEach((metricId) => {
          if (!DECISION_METRIC_IDS.has(metricId)) {
            errors.push(`${sectionKey} references unknown decision metric ${metricId}.`);
          }
        });
        if (!definition.outputMetricIds.includes(requiredMetricId)) {
          errors.push(`${sectionKey} must target ${requiredMetricId}.`);
        }
      });
    }
  );
}

export function validateAssetStrategyContract(value) {
  const contract = normalizeAssetStrategyContract(value);
  const errors = [];

  if (!contract.strategyId) errors.push("Strategy ID is required.");
  if (!contract.strategyVersion) errors.push("Strategy version is required.");
  if (!contract.label) errors.push("Strategy label is required.");
  if (!contract.assetType) errors.push("A canonical asset type is required.");

  ASSET_STRATEGY_CAPABILITY_KEYS.forEach((sectionKey) => {
    if (contract.capabilities[sectionKey].length === 0) {
      errors.push(`${sectionKey} must define at least one entry.`);
    }
  });

  contract.capabilities.requiredFacts.forEach((fact) => {
    if (!fact.canonicalField) {
      errors.push(`Required fact ${fact.factId} needs a canonical field.`);
    }
    if (!fact.criticality) {
      errors.push(`Required fact ${fact.factId} needs a criticality.`);
    }
    if (fact.requiredFor.length === 0) {
      errors.push(`Required fact ${fact.factId} needs at least one scope.`);
    }
  });

  contract.capabilities.underwritingHooks.forEach((hook) => {
    if (hook.inputFactIds.length === 0 || hook.outputKeys.length === 0) {
      errors.push(
        `Underwriting hook ${hook.hookId} needs input facts and output keys.`
      );
    }
  });

  contract.capabilities.offerLogic.forEach((rule) => {
    if (rule.actionCodes.length === 0) {
      errors.push(`Offer rule ${rule.ruleId} needs at least one action code.`);
    }
  });

  contract.capabilities.verificationRequirements.forEach((requirement) => {
    if (!requirement.criticality) {
      errors.push(
        `Verification requirement ${requirement.verificationRequirementId} needs a criticality.`
      );
    }
    if (requirement.acceptableSourceTypes.length === 0) {
      errors.push(
        `Verification requirement ${requirement.verificationRequirementId} needs an acceptable source type.`
      );
    }
  });

  validateUniqueIdentifiers(contract.capabilities, errors);
  validateReferences(contract.capabilities, errors);
  validateMetricTargets(contract.capabilities, errors);

  return { valid: errors.length === 0, errors: uniqueStrings(errors), contract };
}

export function evaluateAssetStrategyAnalysisGate({
  classification,
  strategy,
} = {}) {
  const normalizedClassification = normalizeAssetClassification(classification);

  if (
    normalizedClassification.state === ASSET_CLASSIFICATION_STATES.UNCLASSIFIED
  ) {
    return {
      allowed: false,
      reason: ASSET_STRATEGY_ANALYSIS_GATE_REASONS.ASSET_UNCLASSIFIED,
      errors: ["Asset type must be classified before strategy analysis."],
      classification: normalizedClassification,
      strategy: null,
    };
  }

  if (
    normalizedClassification.state !== ASSET_CLASSIFICATION_STATES.CLASSIFIED ||
    normalizedClassification.requiresHumanReview
  ) {
    return {
      allowed: false,
      reason:
        ASSET_STRATEGY_ANALYSIS_GATE_REASONS.ASSET_CLASSIFICATION_REVIEW_REQUIRED,
      errors: ["Asset classification requires review before strategy analysis."],
      classification: normalizedClassification,
      strategy: null,
    };
  }

  const validation = validateAssetStrategyContract(strategy);
  if (!validation.valid) {
    return {
      allowed: false,
      reason: ASSET_STRATEGY_ANALYSIS_GATE_REASONS.STRATEGY_INVALID,
      errors: validation.errors,
      classification: normalizedClassification,
      strategy: validation.contract,
    };
  }

  if (validation.contract.status !== ASSET_STRATEGY_STATUSES.ACTIVE) {
    return {
      allowed: false,
      reason: ASSET_STRATEGY_ANALYSIS_GATE_REASONS.STRATEGY_INACTIVE,
      errors: ["Only an active asset strategy can run analysis."],
      classification: normalizedClassification,
      strategy: validation.contract,
    };
  }

  if (validation.contract.assetType !== normalizedClassification.assetType) {
    return {
      allowed: false,
      reason: ASSET_STRATEGY_ANALYSIS_GATE_REASONS.ASSET_STRATEGY_MISMATCH,
      errors: [
        `Strategy ${validation.contract.strategyId} does not support ${normalizedClassification.assetType}.`,
      ],
      classification: normalizedClassification,
      strategy: validation.contract,
    };
  }

  return {
    allowed: true,
    reason: ASSET_STRATEGY_ANALYSIS_GATE_REASONS.READY,
    errors: [],
    classification: normalizedClassification,
    strategy: validation.contract,
  };
}
