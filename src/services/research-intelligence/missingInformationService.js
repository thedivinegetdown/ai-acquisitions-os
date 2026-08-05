import { compactText, uniqueStrings } from "../../utils/text";
import {
  ASSET_CLASSIFICATION_STATES,
  ASSET_TYPES,
} from "../asset-strategy/assetStrategyContracts";
import { buildAssetStrategyContext } from "../asset-strategy/assetStrategyContextService";
import {
  DECISION_SOURCE_MODES,
  normalizeConflictReference,
  normalizeDecisionIssueReference,
  normalizeDecisionTimestamp,
  normalizeEvidenceReference,
  normalizeRulesetDescriptor,
} from "../decision-intelligence/decisionContracts";
import {
  INFORMATION_STATES,
  MISSING_INFORMATION_ACTION_TYPES,
  MISSING_INFORMATION_CONTRACT_VERSION,
  MISSING_INFORMATION_CRITICALITIES,
  MISSING_INFORMATION_LIMITS,
  MISSING_INFORMATION_RULESET_VERSION,
  evaluateValuePresence,
  normalizeMissingInformationAction,
  normalizeMissingInformationItem,
  normalizeMissingInformationProfile,
  validateMissingInformationProfile,
} from "./missingInformationContracts";
import { selectMissingInformationProfiles } from "./missingInformationProfiles";

// Distinct responsibility: evaluate bounded stored facts against selected
// requirement profiles without providers, mutations, scoring, or React state.
export const MISSING_INFORMATION_RULESET_ID =
  "missing-information-autopilot-deterministic";

const OPEN_STATES = new Set([
  INFORMATION_STATES.MISSING,
  INFORMATION_STATES.UNKNOWN,
  INFORMATION_STATES.UNVERIFIED,
  INFORMATION_STATES.CONFLICTING,
  INFORMATION_STATES.STALE,
  INFORMATION_STATES.UNAVAILABLE,
]);
const STATE_ORDER = Object.freeze({
  [INFORMATION_STATES.CONFLICTING]: 0,
  [INFORMATION_STATES.STALE]: 1,
  [INFORMATION_STATES.UNVERIFIED]: 2,
  [INFORMATION_STATES.MISSING]: 3,
  [INFORMATION_STATES.UNKNOWN]: 4,
  [INFORMATION_STATES.UNAVAILABLE]: 5,
  [INFORMATION_STATES.PRESENT]: 6,
  [INFORMATION_STATES.NOT_APPLICABLE]: 7,
});
const CRITICALITY_ORDER = Object.freeze({
  [MISSING_INFORMATION_CRITICALITIES.BLOCKING]: 0,
  [MISSING_INFORMATION_CRITICALITIES.ADVISORY]: 1,
  [MISSING_INFORMATION_CRITICALITIES.INFORMATIONAL]: 2,
});
const PRIORITY_REQUIREMENTS = Object.freeze({
  "asset-classification": 0,
  "opportunity-identity": 0,
  "property-or-parcel-identity": 0,
  "seller-identity": 0,
  "pipeline-stage": 0,
  "land-parcel-identity": 0,
  "seller-contact-method": 1,
  "land-legal-access": 2,
  "land-zoning": 2,
  "land-permitted-use": 2,
  "land-flood-zone-status": 2,
  "land-wetlands-status": 2,
  "land-taxes-and-liens": 2,
  "seller-motivation": 4,
  "seller-timeline": 4,
  "land-comparable-land-sales": 6,
  "land-builder-demand": 6,
});

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function safeText(value, maximum = 320) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const text = compactText(String(value));
  if (text.length <= maximum) return text;
  return `${text.slice(0, maximum - 3).trimEnd()}...`;
}

function identitySegment(value) {
  const text = safeText(value, 160);
  return text ? encodeURIComponent(text) : "unidentified-record";
}

function createItemId(dealId, requirementId) {
  return `missing-information:${identitySegment(dealId)}:${identitySegment(requirementId)}`;
}

function getTenantContext(deal, context) {
  const source = safeObject(deal);
  return {
    organizationId:
      safeText(
        context?.organizationId || source.organization_id || source.organizationId,
        160
      ) || null,
    tenantId:
      safeText(context?.tenantId || source.tenant_id || source.tenantId, 160) ||
      null,
  };
}

function matchesTenantContext(record, context) {
  const source = safeObject(record);
  const organizationId = safeText(source.organizationId || source.organization_id, 160);
  const tenantId = safeText(source.tenantId || source.tenant_id, 160);
  if (context.organizationId && organizationId && context.organizationId !== organizationId) {
    return false;
  }
  return !(context.tenantId && tenantId && context.tenantId !== tenantId);
}

function normalizeEvidence(references, context) {
  return (Array.isArray(references) ? references : [])
    .filter((reference) => matchesTenantContext(reference, context))
    .map(normalizeEvidenceReference)
    .filter(Boolean)
    .slice(0, MISSING_INFORMATION_LIMITS.REFERENCES);
}

function normalizeConflicts(references, context) {
  return (Array.isArray(references) ? references : [])
    .filter((reference) => matchesTenantContext(reference, context))
    .map(normalizeConflictReference)
    .filter(Boolean)
    .slice(0, MISSING_INFORMATION_LIMITS.REFERENCES);
}

function readAliases(record, aliases) {
  let firstRepresented = null;
  const warnings = [];
  for (const field of aliases) {
    try {
      const value = record?.[field];
      if (value !== null && value !== undefined && value !== "") {
        return { field, value, available: true, warnings };
      }
      if (!firstRepresented && value !== undefined) {
        firstRepresented = { field, value };
      }
    } catch {
      warnings.push(`The stored ${field} field could not be read.`);
    }
  }
  if (firstRepresented) {
    return { ...firstRepresented, available: true, warnings };
  }
  return {
    field: null,
    value: undefined,
    available: warnings.length === 0,
    warnings,
  };
}

function summarizeValue(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return `${value.length} recorded item${value.length === 1 ? "" : "s"}`;
  if (typeof value === "object") return "Recorded value";
  return safeText(value, 160) || null;
}

function evidenceForRequirement(evidence, requirement) {
  const aliases = new Set(requirement.acceptedFieldAliases);
  return evidence.filter(
    (entry) =>
      entry.relatedCanonicalField === requirement.canonicalField ||
      (entry.sourceField && aliases.has(entry.sourceField))
  );
}

function conflictsForRequirement(conflicts, requirement) {
  return conflicts.filter(
    (entry) =>
      entry.relatedCanonicalField === requirement.canonicalField &&
      entry.state !== "resolved"
  );
}

function explicitStateForRequirement({
  conflicts,
  evidence,
  freshnessStates,
  informationStates,
  requirement,
  verificationStates,
}) {
  const suppliedInformationState = safeText(
    informationStates?.[requirement.canonicalField],
    80
  ).toLowerCase();
  const matchingConflicts = conflictsForRequirement(conflicts, requirement);
  if (
    matchingConflicts.length ||
    evidence.some((entry) => entry.conflictState === "conflicting")
  ) {
    return {
      state: INFORMATION_STATES.CONFLICTING,
      conflictIds: matchingConflicts.map((entry) => entry.conflictId),
      verificationState: null,
      freshnessState: null,
    };
  }

  const explicitFreshness =
    safeText(freshnessStates?.[requirement.canonicalField], 80).toLowerCase() ||
    evidence.find(
      (entry) => entry.freshnessState && entry.freshnessState !== "unknown"
    )?.freshnessState ||
    null;
  if (explicitFreshness === "stale") {
    return {
      state: INFORMATION_STATES.STALE,
      conflictIds: [],
      verificationState: null,
      freshnessState: "stale",
    };
  }

  const explicitVerification =
    safeText(verificationStates?.[requirement.canonicalField], 80).toLowerCase() ||
    evidence.find(
      (entry) =>
        entry.verificationState && entry.verificationState !== "unknown"
    )
      ?.verificationState ||
    null;
  if (explicitVerification === "unverified") {
    return {
      state: INFORMATION_STATES.UNVERIFIED,
      conflictIds: [],
      verificationState: "unverified",
      freshnessState: null,
    };
  }
  if (
    [
      INFORMATION_STATES.MISSING,
      INFORMATION_STATES.UNKNOWN,
      INFORMATION_STATES.UNAVAILABLE,
      INFORMATION_STATES.NOT_APPLICABLE,
      INFORMATION_STATES.PRESENT,
    ].includes(suppliedInformationState)
  ) {
    return {
      state: suppliedInformationState,
      conflictIds: [],
      verificationState:
        explicitVerification && explicitVerification !== "unknown"
          ? explicitVerification
          : null,
      freshnessState:
        explicitFreshness && explicitFreshness !== "unknown"
          ? explicitFreshness
          : null,
    };
  }
  return {
    state: null,
    conflictIds: [],
    verificationState:
      explicitVerification && explicitVerification !== "unknown"
        ? explicitVerification
        : null,
    freshnessState:
      explicitFreshness && explicitFreshness !== "unknown"
        ? explicitFreshness
        : null,
  };
}

function classificationEvaluation(context) {
  if (context.classificationState === ASSET_CLASSIFICATION_STATES.AMBIGUOUS) {
    return {
      state: INFORMATION_STATES.CONFLICTING,
      label: "Asset Classification Review Required",
      reason: "Conflicting explicit asset values require human review before an asset-specific profile can run.",
    };
  }
  if (context.classificationState === ASSET_CLASSIFICATION_STATES.UNSUPPORTED) {
    return {
      state: INFORMATION_STATES.UNKNOWN,
      label: "Supported Asset Classification Required",
      reason: "The stored asset value does not map to a supported canonical asset type.",
    };
  }
  if (context.classificationState !== ASSET_CLASSIFICATION_STATES.CLASSIFIED) {
    return {
      state: INFORMATION_STATES.MISSING,
      label: "Asset Classification Required",
      reason: "Asset type is not explicitly classified, so no strategy-specific profile is selected.",
    };
  }
  return {
    state: INFORMATION_STATES.PRESENT,
    label: "Asset classification",
    reason: "An explicit or safely mapped canonical asset classification is present.",
  };
}

function itemReason(requirement, state) {
  if (state === INFORMATION_STATES.MISSING) {
    return `${requirement.label} is not represented in the current stored record.`;
  }
  if (state === INFORMATION_STATES.UNKNOWN) {
    return `${requirement.label} is explicitly represented as unknown.`;
  }
  if (state === INFORMATION_STATES.UNVERIFIED) {
    return `${requirement.label} is present but explicitly unverified.`;
  }
  if (state === INFORMATION_STATES.CONFLICTING) {
    return `${requirement.label} has an explicit unresolved conflict.`;
  }
  if (state === INFORMATION_STATES.STALE) {
    return `${requirement.label} is present but explicitly marked stale.`;
  }
  if (state === INFORMATION_STATES.UNAVAILABLE) {
    return `${requirement.label} could not be evaluated from the supplied record.`;
  }
  if (state === INFORMATION_STATES.NOT_APPLICABLE) {
    return `${requirement.label} is not applicable to the selected profile.`;
  }
  return `${requirement.label} is represented in the current stored record.`;
}

function createAvailableActions(requirement, state, itemId) {
  if (!OPEN_STATES.has(state)) return [];
  const actions = [];
  const base = {
    requirementId: requirement.requirementId,
    targetSection: requirement.relatedSection,
    enabled: true,
  };
  if (requirement.requirementId === "asset-classification") {
    actions.push(
      normalizeMissingInformationAction({
        ...base,
        actionId: `${itemId}:classify-asset`,
        actionType:
          state === INFORMATION_STATES.CONFLICTING
            ? MISSING_INFORMATION_ACTION_TYPES.REVIEW_CONFLICT
            : MISSING_INFORMATION_ACTION_TYPES.CLASSIFY_ASSET,
        label:
          state === INFORMATION_STATES.CONFLICTING
            ? "Review asset classification"
            : "Review asset classification source",
        explanation:
          "Open the Decision section to review explicit classification evidence. No local classification is saved here.",
      })
    );
  }
  if (requirement.sellerAnswerable && requirement.sellerQuestion) {
    actions.push(
      normalizeMissingInformationAction({
        ...base,
        actionId: `${itemId}:ask-seller`,
        actionType: MISSING_INFORMATION_ACTION_TYPES.ASK_SELLER,
        label: "Prepare seller question",
        explanation: "Copy an editable question for a future seller conversation.",
        sellerQuestion: requirement.sellerQuestion,
      })
    );
  }
  if (requirement.researchRequired && requirement.researchGuidance) {
    actions.push(
      normalizeMissingInformationAction({
        ...base,
        actionId: `${itemId}:research-property`,
        actionType:
          requirement.relatedSection === "documents"
            ? MISSING_INFORMATION_ACTION_TYPES.REVIEW_DOCUMENTS
            : MISSING_INFORMATION_ACTION_TYPES.RESEARCH_PROPERTY,
        label:
          requirement.relatedSection === "documents"
            ? "Review supporting documents"
            : "Review research guidance",
        explanation: "Copy manual guidance for an approved research process.",
        researchGuidance: requirement.researchGuidance,
      })
    );
  }
  if (!actions.length) {
    actions.push(
      normalizeMissingInformationAction({
        ...base,
        actionId: `${itemId}:open-context`,
        actionType: MISSING_INFORMATION_ACTION_TYPES.OPEN_EXISTING_CONTEXT,
        label: `Open ${requirement.relatedSection}`,
        explanation: "Review the existing Decision Room context for this requirement.",
      })
    );
  }
  return actions.filter(Boolean).slice(0, MISSING_INFORMATION_LIMITS.ACTIONS);
}

function evaluateRequirement({
  assetStrategyContext,
  conflicts,
  deal,
  evaluatedTimestamp,
  evidence,
  freshnessStates,
  informationStates,
  profile,
  requirement,
  tenantContext,
  verificationStates,
}) {
  const dealId = assetStrategyContext.dealId || null;
  const itemId = createItemId(dealId, requirement.requirementId);
  const matchingEvidence = evidenceForRequirement(evidence, requirement);
  const explicitState = explicitStateForRequirement({
    conflicts,
    evidence: matchingEvidence,
    freshnessStates,
    informationStates,
    requirement,
    verificationStates,
  });
  const read = readAliases(deal, requirement.acceptedFieldAliases);
  let presence = evaluateValuePresence(
    requirement.valuePresencePolicy,
    read.value,
    { available: read.available }
  );
  let label = requirement.label;
  let reason = null;
  let conflictIds = explicitState?.conflictIds || [];

  if (requirement.requirementId === "asset-classification") {
    const classification = classificationEvaluation(assetStrategyContext);
    presence = {
      present: classification.state === INFORMATION_STATES.PRESENT,
      state: classification.state,
    };
    label = classification.label;
    reason = classification.reason;
    conflictIds = (Array.isArray(assetStrategyContext.classificationConflicts)
      ? assetStrategyContext.classificationConflicts
      : []
    ).map(
      (entry) => entry.conflictId
    );
  } else if (explicitState?.state) {
    presence = { present: false, state: explicitState.state };
  }

  const evidenceReferenceIds = matchingEvidence.map((entry) => entry.evidenceId);
  const sourceTimestamp =
    matchingEvidence.find((entry) => entry.sourceTimestamp)?.sourceTimestamp || null;
  return normalizeMissingInformationItem({
    itemId,
    requirementId: requirement.requirementId,
    dealId,
    organizationId: tenantContext.organizationId,
    tenantId: tenantContext.tenantId,
    assetType: assetStrategyContext.assetType,
    strategyId: assetStrategyContext.selectedStrategyId,
    profileId: profile.profileId,
    canonicalField: requirement.canonicalField,
    label,
    description: requirement.description,
    category: requirement.category,
    state: presence.state,
    criticality: requirement.criticality,
    blocking: requirement.blockingBehavior,
    currentValueSummary: summarizeValue(read.value),
    matchedSourceField: read.field,
    evidenceReferenceIds,
    conflictIds,
    verificationState: explicitState?.verificationState || null,
    freshnessState: explicitState?.freshnessState || null,
    reason: reason || itemReason(requirement, presence.state),
    sellerQuestion: requirement.sellerQuestion,
    researchGuidance: requirement.researchGuidance,
    relatedSection: requirement.relatedSection,
    availableActions: createAvailableActions(requirement, presence.state, itemId),
    rulesetVersion: requirement.rulesetVersion,
    evaluatedTimestamp,
    sourceTimestamp,
    compatibilityWarning:
      requirement.supersessionWarning ||
      (requirement.compatibilityOnly
        ? "This is a compatibility requirement, not a completed asset strategy."
        : null),
    partialDataWarnings: [
      ...requirement.partialDataWarnings,
      ...read.warnings,
      ...matchingEvidence
        .map((entry) => entry.partialDataWarning)
        .filter(Boolean),
    ],
  });
}

function requirementPriority(item, index) {
  if (["seller.motivation", "seller.timeline"].includes(item.canonicalField)) {
    return 4;
  }
  if (Object.hasOwn(PRIORITY_REQUIREMENTS, item.requirementId)) {
    return PRIORITY_REQUIREMENTS[item.requirementId];
  }
  if (
    item.requirementId.startsWith("residential-") &&
    item.criticality === MISSING_INFORMATION_CRITICALITIES.BLOCKING
  ) {
    return 3;
  }
  if (item.criticality === MISSING_INFORMATION_CRITICALITIES.ADVISORY) return 5;
  if (item.criticality === MISSING_INFORMATION_CRITICALITIES.INFORMATIONAL) return 7;
  return 3 + index / 1000;
}

function sortItems(items) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const priority =
        requirementPriority(left.item, left.index) -
        requirementPriority(right.item, right.index);
      if (priority) return priority;
      const state =
        (STATE_ORDER[left.item.state] ?? 99) -
        (STATE_ORDER[right.item.state] ?? 99);
      if (state) return state;
      const criticality =
        (CRITICALITY_ORDER[left.item.criticality] ?? 99) -
        (CRITICALITY_ORDER[right.item.criticality] ?? 99);
      return criticality || left.index - right.index;
    })
    .map(({ item }) => item);
}

function dedupeRequirements(profiles) {
  const byField = new Map();
  profiles.forEach((profile) => {
    profile.requirements.forEach((requirement) => {
      if (byField.has(requirement.canonicalField)) {
        byField.delete(requirement.canonicalField);
      }
      byField.set(requirement.canonicalField, { profile, requirement });
    });
  });
  return [...byField.values()].slice(0, MISSING_INFORMATION_LIMITS.ITEMS);
}

function highestPriorityAction(openItems) {
  const item = openItems.find((entry) => entry.availableActions.length);
  if (!item) return null;
  return normalizeMissingInformationAction({
    ...item.availableActions[0],
    actionId: `next-information-action:${identitySegment(item.itemId)}`,
    explanation:
      item.availableActions[0].explanation || item.reason,
  });
}

function safeSourceWarnings(values) {
  const source = Array.isArray(values) ? values : values ? [values] : [];
  return uniqueStrings(
    source.map((value) =>
      value instanceof Error
        ? "An optional information source could not be evaluated."
        : safeText(value)
    )
  ).slice(0, MISSING_INFORMATION_LIMITS.WARNINGS);
}

function normalizeProfiles(selectedProfiles, optionalProfiles, warnings) {
  const profiles = [...selectedProfiles];
  (Array.isArray(optionalProfiles) ? optionalProfiles : []).forEach((value) => {
    const normalized = normalizeMissingInformationProfile(value);
    const validation = validateMissingInformationProfile(value);
    if (!normalized || !validation.valid) {
      warnings.push("One supplied requirement profile was malformed and was skipped.");
      return;
    }
    const index = profiles.findIndex(
      (profile) => profile.profileId === normalized.profileId
    );
    if (index >= 0) profiles[index] = normalized;
    else profiles.push(normalized);
  });
  return profiles.slice(0, MISSING_INFORMATION_LIMITS.PROFILES);
}

export function evaluateMissingInformation({
  assetStrategyContext: suppliedContext,
  conflicts = [],
  deal,
  evaluatedTimestamp,
  evidenceReferences = [],
  freshnessStates = {},
  informationStates = {},
  requirementProfiles = [],
  sourceErrors = [],
  verificationStates = {},
} = {}) {
  const safeDeal = safeObject(deal);
  const assetStrategyContext = suppliedContext || buildAssetStrategyContext(safeDeal);
  const tenantContext = getTenantContext(safeDeal, assetStrategyContext);
  const evidence = normalizeEvidence(evidenceReferences, tenantContext);
  const normalizedConflicts = normalizeConflicts(conflicts, tenantContext);
  const selection = selectMissingInformationProfiles(assetStrategyContext);
  const partialDataWarnings = safeSourceWarnings(sourceErrors);
  const profiles = normalizeProfiles(
    selection.profiles,
    requirementProfiles,
    partialDataWarnings
  );
  const normalizedEvaluatedTimestamp = normalizeDecisionTimestamp(evaluatedTimestamp);
  const evaluatedItems = [];

  dedupeRequirements(profiles).forEach(({ profile, requirement }) => {
    try {
      const item = evaluateRequirement({
        assetStrategyContext,
        conflicts: normalizedConflicts,
        deal: safeDeal,
        evaluatedTimestamp: normalizedEvaluatedTimestamp,
        evidence,
        freshnessStates: safeObject(freshnessStates),
        informationStates: safeObject(informationStates),
        profile,
        requirement,
        tenantContext,
        verificationStates: safeObject(verificationStates),
      });
      if (item) evaluatedItems.push(item);
    } catch {
      partialDataWarnings.push(
        `The ${requirement.label} requirement could not be evaluated and was skipped.`
      );
    }
  });

  const allItems = sortItems(evaluatedItems).slice(
    0,
    MISSING_INFORMATION_LIMITS.ITEMS
  );
  const openItems = allItems.filter((item) => OPEN_STATES.has(item.state));
  const byState = (state) => allItems.filter((item) => item.state === state);
  const byCriticality = (criticality) =>
    openItems.filter((item) => item.criticality === criticality);
  const sellerQuestions = uniqueStrings(
    openItems.map((item) => item.sellerQuestion).filter(Boolean)
  ).slice(0, MISSING_INFORMATION_LIMITS.ITEMS);
  const researchActions = uniqueStrings(
    openItems.map((item) => item.researchGuidance).filter(Boolean)
  ).slice(0, MISSING_INFORMATION_LIMITS.ITEMS);
  const warnings = uniqueStrings([
    ...partialDataWarnings,
    ...allItems.flatMap((item) => item.partialDataWarnings),
    ...profiles.flatMap((profile) => profile.partialDataWarnings),
    ...(!assetStrategyContext.dealId
      ? ["The opportunity has no stable record identifier; item IDs use an explicit unidentified-record compatibility key."]
      : []),
  ]).slice(0, MISSING_INFORMATION_LIMITS.WARNINGS);

  return {
    contractVersion: MISSING_INFORMATION_CONTRACT_VERSION,
    status: warnings.length ? "partial" : "ready",
    dealId: assetStrategyContext.dealId || null,
    organizationId: tenantContext.organizationId,
    tenantId: tenantContext.tenantId,
    assetType: assetStrategyContext.assetType,
    strategyId: assetStrategyContext.selectedStrategyId,
    selectedProfile: selection.activeProfile,
    selectedProfiles: profiles,
    allItems,
    openItems,
    missingItems: byState(INFORMATION_STATES.MISSING),
    blockingItems: byCriticality(MISSING_INFORMATION_CRITICALITIES.BLOCKING),
    advisoryItems: byCriticality(MISSING_INFORMATION_CRITICALITIES.ADVISORY),
    informationalItems: byCriticality(
      MISSING_INFORMATION_CRITICALITIES.INFORMATIONAL
    ),
    presentRequirements: byState(INFORMATION_STATES.PRESENT),
    unknownItems: byState(INFORMATION_STATES.UNKNOWN),
    unverifiedItems: byState(INFORMATION_STATES.UNVERIFIED),
    conflictingItems: byState(INFORMATION_STATES.CONFLICTING),
    staleItems: byState(INFORMATION_STATES.STALE),
    unavailableItems: byState(INFORMATION_STATES.UNAVAILABLE),
    notApplicableItems: byState(INFORMATION_STATES.NOT_APPLICABLE),
    limitations: selection.limitations,
    sellerQuestions,
    researchActions,
    highestPriorityAction: highestPriorityAction(openItems),
    sourceWarnings: safeSourceWarnings(sourceErrors),
    partialDataWarnings: warnings,
    evaluatedTimestamp: normalizedEvaluatedTimestamp,
    ruleset: normalizeRulesetDescriptor({
      rulesetId: MISSING_INFORMATION_RULESET_ID,
      rulesetVersion: MISSING_INFORMATION_RULESET_VERSION,
      sourceMode: DECISION_SOURCE_MODES.DETERMINISTIC,
      providerName: null,
      modelName: null,
      deterministic: true,
      compatibility: true,
      generatedTimestamp: normalizedEvaluatedTimestamp,
      description:
        "Deterministic, provider-neutral detection against bounded stored CRM facts.",
    }),
    counts: {
      evaluated: allItems.length,
      open: openItems.length,
      missing: byState(INFORMATION_STATES.MISSING).length,
      blocking: byCriticality(MISSING_INFORMATION_CRITICALITIES.BLOCKING).length,
      advisory: byCriticality(MISSING_INFORMATION_CRITICALITIES.ADVISORY).length,
      informational: byCriticality(
        MISSING_INFORMATION_CRITICALITIES.INFORMATIONAL
      ).length,
      unknown: byState(INFORMATION_STATES.UNKNOWN).length,
      unverified: byState(INFORMATION_STATES.UNVERIFIED).length,
      conflicting: byState(INFORMATION_STATES.CONFLICTING).length,
      stale: byState(INFORMATION_STATES.STALE).length,
    },
  };
}

export function toDecisionIssueReferences(readModel) {
  return (Array.isArray(readModel?.openItems) ? readModel.openItems : [])
    .map((item) =>
      normalizeDecisionIssueReference({
        issueId: item.itemId,
        label: item.label,
        description: item.reason || item.description,
        severity: item.criticality,
        state: item.state,
        relatedCanonicalField: item.canonicalField,
        evidenceReferenceIds: item.evidenceReferenceIds,
        sourceMode: DECISION_SOURCE_MODES.DETERMINISTIC,
        rulesetVersion: item.rulesetVersion,
      })
    )
    .filter(Boolean)
    .slice(0, MISSING_INFORMATION_LIMITS.ITEMS);
}

export function isBlockingInformationState(item) {
  return Boolean(
    item?.blocking &&
      [
        INFORMATION_STATES.MISSING,
        INFORMATION_STATES.UNKNOWN,
        INFORMATION_STATES.UNVERIFIED,
        INFORMATION_STATES.CONFLICTING,
        INFORMATION_STATES.STALE,
        INFORMATION_STATES.UNAVAILABLE,
      ].includes(item.state)
  );
}

export function isResidentialMissingInformation(readModel) {
  return readModel?.assetType === ASSET_TYPES.RESIDENTIAL_HOME;
}
