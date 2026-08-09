import { createFailure, createSuccess } from "../api/serviceResult";
import {
  ASSET_CAPABILITY_IDS,
  buildAssetStrategyContext,
  canRunAssetCapability,
} from "../asset-strategy/assetStrategyContextService";
import { ASSET_CLASSIFICATION_STATES } from "../asset-strategy/assetStrategyContracts";
import {
  adaptResidentialFacts,
  evaluateResidentialStrategy,
} from "../asset-strategy/residential";
import {
  adaptVacantLandFacts,
  evaluateVacantLandStrategy,
  evaluateVacantLandValuation,
} from "../asset-strategy/vacant-land";
import {
  buildDecisionOutputLineage,
  buildEvidenceCoverage,
  buildEvidenceRegistry,
  evaluateConflictingData,
  evaluateMissingInformation,
  isBlockingInformationState,
  toDecisionIssueReferences,
} from "../research-intelligence";
import {
  conversationNeedsReply,
  getConversationCompatibilityKey,
  getConversationMessageBody,
  getConversationMessageTimestamp,
} from "../conversations/conversationSignals";
import { toSafeDate } from "../../utils/dates";
import {
  DEAL_FIELD_ALIASES,
  getDealAliasText,
} from "../../utils/dealFields";
import { toUserSafeError } from "../../utils/errors";
import { compactText, uniqueStrings } from "../../utils/text";
import {
  DECISION_ACTION_TAXONOMY,
  DECISION_CONTRACT_VERSION,
  DECISION_EVALUATION_STATES,
  DECISION_EVIDENCE_LIMIT,
  DECISION_LIFECYCLE_STATES,
  DECISION_METRIC_REGISTRY,
  DECISION_SOURCE_MODES,
  normalizeConflictReference,
  normalizeDecisionRecord,
  normalizeDecisionTimestamp,
  normalizeEvidenceReference,
  normalizeMetricOutput,
  normalizeRecommendation,
  normalizeRulesetDescriptor,
} from "./decisionContracts";
import {
  normalizePursuitScoreResult,
  toPursuitScoreMetric,
} from "./pursuit-scoring";
import {
  READINESS_STATES,
  RESIDENTIAL_READINESS_POLICY,
  VACANT_LAND_READINESS_POLICY,
  evaluateOfferReadiness,
  toOfferReadinessMetric,
} from "./readiness";
import {
  RECOMMENDATION_BASIS_TYPES,
  evaluateDataReliability,
  evaluateRecommendationConfidence,
  normalizeRecommendationBasis,
  toDataReliabilityMetric,
  toRecommendationConfidenceMetric,
} from "./confidence-reliability";

// Distinct responsibility: adapt existing deterministic deal facts into the
// canonical Decision Intelligence contract without deriving scores from deal fields or mutating data.
export const COMPATIBILITY_DECISION_RULESET_ID = "deal-decision-compatibility";
export const COMPATIBILITY_DECISION_RULESET_VERSION = "decision-compatibility-v1";

const SOURCE_MODE = DECISION_SOURCE_MODES.DETERMINISTIC_COMPATIBILITY;
const TARGET_SECTIONS = Object.freeze([
  "decision",
  "seller",
  "property",
  "numbers",
  "communication",
  "activity",
  "documents",
  "closing",
]);
const SOURCE_LIMIT = 50;
const TERMINAL_OUTCOMES = new Set([
  "closed",
  "closed won",
  "closed lost",
  "won",
  "lost",
  "dead lead",
  "completed",
]);
const COMPLETED_TASK_STATES = new Set(["complete", "completed", "done", "cancelled", "canceled"]);
const CRM_COMPATIBILITY_WARNING =
  "Current CRM fields are compatibility evidence without field-level source timestamps or verification metadata.";

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function safeText(value, maximum = 320) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const text = compactText(String(value));
  if (text.length <= maximum) return text;
  return `${text.slice(0, maximum - 3).trimEnd()}...`;
}

function normalizedKey(value) {
  return safeText(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function idSegment(value) {
  const text = safeText(value, 160);
  return text ? encodeURIComponent(text) : "";
}

function readRecordField(record, key) {
  try {
    return record?.[key];
  } catch {
    return undefined;
  }
}

function safeDealAliasText(deal, alias) {
  try {
    return getDealAliasText(deal, alias);
  } catch {
    return "";
  }
}

function getDealId(deal) {
  return safeDealAliasText(deal, "id");
}

function getTenantContext(deal) {
  return {
    organizationId:
      safeText(
        readRecordField(deal, "organization_id") ||
          readRecordField(deal, "organizationId")
      ) || null,
    tenantId:
      safeText(
        readRecordField(deal, "tenant_id") ||
          readRecordField(deal, "tenantId")
      ) || null,
  };
}

function matchesTenantContext(record, context) {
  const organizationId = safeText(record?.organizationId || record?.organization_id);
  const tenantId = safeText(record?.tenantId || record?.tenant_id);
  if (context.organizationId && organizationId && context.organizationId !== organizationId) {
    return false;
  }
  if (context.tenantId && tenantId && context.tenantId !== tenantId) return false;
  return true;
}

function getFieldEntry(deal, keys) {
  for (const key of keys) {
    try {
      const value = deal?.[key];
      if (value !== null && value !== undefined && value !== "") {
        return { key, value };
      }
    } catch {
      // Missing Information detection records the field-level partial warning.
    }
  }
  return null;
}

function valueSummary(value) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return safeText(value, 200) || null;
}

function createCurrentDealEvidence({
  canonicalField,
  context,
  dealId,
  decisionCritical = true,
  field,
  value,
}) {
  if (!dealId || !field) return null;
  return normalizeEvidenceReference({
    sourceType: "crm-current-state",
    sourceSystem: "Deal record",
    sourceRecordId: dealId,
    sourceField: field,
    sourceTimestamp: null,
    observedTimestamp: null,
    extractionMethod: "compatibility-current-state-read",
    trustLevel: "unknown",
    verificationState: "unknown",
    conflictState: "unknown",
    freshnessState: "unknown",
    relatedCanonicalField: canonicalField,
    relationship: "supports",
    valueSummary: valueSummary(value),
    organizationId: context.organizationId,
    tenantId: context.tenantId,
    reliabilityLabel: "Compatibility Record",
    provenanceDetails: {
      compatibilityCurrentState: true,
      decisionCritical,
    },
    partialDataWarning: CRM_COMPATIBILITY_WARNING,
  });
}

function dedupeEvidence(references) {
  const byId = new Map();
  references.filter(Boolean).forEach((reference) => {
    if (!byId.has(reference.evidenceId)) byId.set(reference.evidenceId, reference);
  });
  return [...byId.values()].slice(0, DECISION_EVIDENCE_LIMIT);
}

function buildCurrentDealEvidence(deal, context, dealId) {
  const descriptors = [
    { canonicalField: "property.address", keys: DEAL_FIELD_ALIASES.address },
    { canonicalField: "seller.name", keys: DEAL_FIELD_ALIASES.ownerName },
    { canonicalField: "deal.stage", keys: DEAL_FIELD_ALIASES.stage },
    { canonicalField: "seller.phone", keys: DEAL_FIELD_ALIASES.phone },
    { canonicalField: "seller.email", keys: ["email", "seller_email", "owner_email"] },
    { canonicalField: "deal.followUpDueAt", keys: ["due_date", "follow_up_date"] },
    { canonicalField: "deal.status", keys: ["status", "negotiation_status"] },
  ];

  return dedupeEvidence(
    descriptors.map((descriptor) => {
      const entry = getFieldEntry(deal, descriptor.keys);
      return entry
        ? createCurrentDealEvidence({
            canonicalField: descriptor.canonicalField,
            context,
            dealId,
            field: entry.key,
            value: entry.value,
          })
        : null;
    })
  );
}

function adaptConversationEvidence(signals, context, dealId) {
  return (Array.isArray(signals) ? signals : [])
    .filter((signal) => matchesTenantContext(signal, context))
    .filter(conversationNeedsReply)
    .slice(0, SOURCE_LIMIT)
    .map((signal) => {
      const sourceRecordId = getConversationCompatibilityKey(signal);
      if (!sourceRecordId) return null;
      return normalizeEvidenceReference({
        sourceType: "conversation-summary",
        sourceSystem: "Unified Inbox",
        sourceRecordId,
        sourceField: "lastMessageDirection",
        sourceTimestamp: getConversationMessageTimestamp(signal),
        extractionMethod: "normalized-conversation-signal",
        trustLevel: "unknown",
        verificationState: "unknown",
        conflictState: "unknown",
        freshnessState: "unknown",
        relatedCanonicalField: "communication.lastInboundMessage",
        relationship: "contextual",
        valueSummary: getConversationMessageBody(signal),
        organizationId: context.organizationId,
        tenantId: context.tenantId,
        reliabilityLabel: "Compatibility Record",
        provenanceDetails: { decisionCritical: true, linkedDealId: dealId || "" },
      });
    })
    .filter(Boolean);
}

function adaptTaskEvidence(tasks, context, dealId) {
  return (Array.isArray(tasks) ? tasks : [])
    .filter((task) => matchesTenantContext(task, context))
    .filter((task) => {
      const relatedDealId = safeText(task.dealId || task.deal_id);
      return !relatedDealId || !dealId || relatedDealId === dealId;
    })
    .slice(0, SOURCE_LIMIT)
    .map((task) => {
      const taskId = safeText(task.id || task.task_id);
      const dueAt = task.dueAt || task.due_at || task.due_date;
      if (!taskId || !toSafeDate(dueAt)) return null;
      return normalizeEvidenceReference({
        sourceType: "task-record",
        sourceSystem: "Tasks",
        sourceRecordId: taskId,
        sourceField: task.dueAt ? "dueAt" : task.due_at ? "due_at" : "due_date",
        sourceTimestamp: task.updated_at || task.updatedAt || task.created_at || task.createdAt,
        extractionMethod: "task-record-read",
        trustLevel: "unknown",
        verificationState: "unknown",
        conflictState: "unknown",
        freshnessState: "unknown",
        relatedCanonicalField: "task.dueAt",
        relationship: "contextual",
        valueSummary: safeText(task.title || task.label, 200) || "Task due",
        organizationId: context.organizationId,
        tenantId: context.tenantId,
        reliabilityLabel: "Persisted Record",
        provenanceDetails: { decisionCritical: true },
      });
    })
    .filter(Boolean);
}

function normalizeExternalEvidence(references, context) {
  return (Array.isArray(references) ? references : [])
    .filter((reference) => matchesTenantContext(reference, context))
    .map(normalizeEvidenceReference)
    .filter(Boolean)
    .slice(0, DECISION_EVIDENCE_LIMIT);
}

function dateKey(value) {
  return toSafeDate(value)?.toISOString().slice(0, 10) || "";
}

function getDueContext(deal, now) {
  const source = getFieldEntry(deal, ["due_date", "follow_up_date"]);
  const dueKey = dateKey(source?.value);
  const todayKey = dateKey(now);
  return {
    dueAt: source ? normalizeDecisionTimestamp(source.value) : null,
    dueKey,
    field: source?.key || null,
    isDue: Boolean(dueKey && todayKey && dueKey <= todayKey),
    isOverdue: Boolean(dueKey && todayKey && dueKey < todayKey),
  };
}

function evidenceForCanonicalField(evidence, canonicalField) {
  return evidence.find((entry) => entry.relatedCanonicalField === canonicalField) || null;
}

function buildApprovalSummary(approvalItems, context, dealId) {
  if (!Array.isArray(approvalItems)) {
    return {
      evaluationState: DECISION_EVALUATION_STATES.UNAVAILABLE,
      status: "unavailable",
      required: null,
      count: 0,
      pendingCount: 0,
      approvedActionCount: 0,
      approvalReferenceIds: [],
      reason: "Approval context was not supplied to this compatibility evaluation.",
    };
  }

  const relevant = approvalItems
    .filter((item) => matchesTenantContext(item, context))
    .filter((item) => safeText(item?.relatedDeal?.id || item?.dealId) === dealId)
    .slice(0, SOURCE_LIMIT);
  const pending = relevant.filter((item) => normalizedKey(item.status) === "pending");
  const approvedActions = relevant.filter(
    (item) => normalizedKey(item.status) === "approved" && safeText(item.requestedAction)
  );
  const status = pending.length
    ? "pending"
    : approvedActions.length
      ? "approved-action-available"
      : relevant[0]?.status || "none-represented";

  return {
    evaluationState: DECISION_EVALUATION_STATES.COMPATIBILITY_RESULT,
    status,
    required: pending.length ? true : null,
    count: relevant.length,
    pendingCount: pending.length,
    approvedActionCount: approvedActions.length,
    approvalReferenceIds: relevant.map((item) => safeText(item.id)).filter(Boolean),
    reason: pending.length
      ? "A pending item from the normalized Approval Inbox read model is linked to this deal."
      : approvedActions.length
        ? "A linked approval item contains an approved existing action."
        : "No linked approval item is represented in the supplied approval read model.",
  };
}

function hasDueTask(tasks, context, dealId, now) {
  return (Array.isArray(tasks) ? tasks : []).some((task) => {
    if (!matchesTenantContext(task, context)) return false;
    const relatedDealId = safeText(task.dealId || task.deal_id);
    if (relatedDealId && dealId && relatedDealId !== dealId) return false;
    if (COMPLETED_TASK_STATES.has(normalizedKey(task.status))) return false;
    const due = toSafeDate(task.dueAt || task.due_at || task.due_date);
    const evaluated = toSafeDate(now);
    return Boolean(due && evaluated && due.getTime() <= evaluated.getTime());
  });
}

function hasSellerReply(signals, context, dealId) {
  return (Array.isArray(signals) ? signals : []).some((signal) => {
    if (!matchesTenantContext(signal, context)) return false;
    const linkedDealId = safeText(signal.linkedDealId || signal.dealId);
    if (linkedDealId && dealId && linkedDealId !== dealId) return false;
    return conversationNeedsReply(signal);
  });
}

function getLifecycle({
  approvalSummary,
  assetStrategyContext,
  conflicts,
  context,
  deal,
  dealId,
  dueContext,
  evidence,
  evaluatedTimestamp,
  missingInformationReadModel,
  previousLifecycle,
  readinessResult,
  sellerReply,
  taskDue,
}) {
  const address = safeDealAliasText(deal, "address");
  const seller = safeDealAliasText(deal, "ownerName");
  const stage = normalizedKey(
    safeDealAliasText(deal, "stage") || readRecordField(deal, "status")
  );
  const stageEvidence = evidenceForCanonicalField(evidence, "deal.stage");
  const dueEvidence = evidenceForCanonicalField(evidence, "deal.followUpDueAt");
  const actionEvidence = evidence.filter((entry) =>
    ["conversation-summary", "task-record"].includes(entry.sourceType)
  );
  const blockingInformation = (
    missingInformationReadModel?.blockingItems || []
  ).filter(isBlockingInformationState);

  let state;
  let reason;
  let lifecycleEvidence = [];

  if (!dealId || (!address && !seller)) {
    state = DECISION_LIFECYCLE_STATES.IDENTIFY;
    reason = "A stable opportunity identity is required before decision evaluation can continue.";
  } else if (
    assetStrategyContext.classificationState !==
      ASSET_CLASSIFICATION_STATES.CLASSIFIED ||
    assetStrategyContext.manualReviewRequired
  ) {
    state = DECISION_LIFECYCLE_STATES.VERIFY;
    reason = `${assetStrategyContext.statusSummary}. Strategy-specific analysis cannot run until the stored classification is reviewed.`;
    lifecycleEvidence = assetStrategyContext.classificationEvidence.map(
      (reference) => reference.evidenceId
    );
  } else if (TERMINAL_OUTCOMES.has(stage)) {
    state = DECISION_LIFECYCLE_STATES.LEARN;
    reason = `The current deal record contains the explicit outcome state "${
      safeDealAliasText(deal, "stage") || readRecordField(deal, "status")
    }".`;
    lifecycleEvidence = stageEvidence ? [stageEvidence.evidenceId] : [];
  } else if (
    sellerReply ||
    taskDue ||
    dueContext.isDue ||
    approvalSummary.approvedActionCount > 0
  ) {
    state = DECISION_LIFECYCLE_STATES.ACT;
    const reasons = [
      sellerReply ? "a seller reply needs a response" : null,
      taskDue || dueContext.isDue ? "a current task or follow-up is due" : null,
      approvalSummary.approvedActionCount > 0 ? "an approved existing action is available" : null,
    ].filter(Boolean);
    reason = `Action is required because ${reasons.join(" and ")}.`;
    lifecycleEvidence = [
      ...actionEvidence.map((entry) => entry.evidenceId),
      dueEvidence?.evidenceId,
    ].filter(Boolean);
  } else if (
    blockingInformation.length ||
    conflicts.length ||
    [
      READINESS_STATES.NEEDS_INFORMATION,
      READINESS_STATES.NEEDS_VERIFICATION,
    ].includes(readinessResult?.readinessState)
  ) {
    state = DECISION_LIFECYCLE_STATES.VERIFY;
    const reasons = [
      blockingInformation.length
        ? `${blockingInformation.length} decision-critical item${
            blockingInformation.length === 1 ? " requires" : "s require"
          } information or verification`
        : null,
      conflicts.length ? `${conflicts.length} explicit conflict${conflicts.length === 1 ? " is" : "s are"} unresolved` : null,
      readinessResult?.readinessState === READINESS_STATES.NEEDS_INFORMATION
        ? "Offer Readiness requires decision-critical information"
        : null,
      readinessResult?.readinessState === READINESS_STATES.NEEDS_VERIFICATION
        ? "Offer Readiness requires critical verification"
        : null,
    ].filter(Boolean);
    reason = `${reasons.join(" and ")}.`;
    lifecycleEvidence = uniqueStrings([
      ...blockingInformation.flatMap((item) => item.evidenceReferenceIds),
      ...conflicts.flatMap((conflict) => conflict.evidenceReferenceIds),
    ]);
  } else {
    state = DECISION_LIFECYCLE_STATES.DECIDE;
    reason = "Strategy analysis is available for human decision review; passing readiness does not execute an action.";
    lifecycleEvidence = evidence.map((entry) => entry.evidenceId);
  }

  return {
    state,
    reason,
    evidenceReferenceIds: lifecycleEvidence.slice(0, DECISION_EVIDENCE_LIMIT),
    previousState: Object.values(DECISION_LIFECYCLE_STATES).includes(previousLifecycle)
      ? previousLifecycle
      : null,
    evaluatedTimestamp,
    rulesetVersion: COMPATIBILITY_DECISION_RULESET_VERSION,
    organizationId: context.organizationId,
    tenantId: context.tenantId,
  };
}

function getRecommendation({
  approvalSummary,
  assetStrategyContext,
  dealId,
  dueContext,
  evaluatedTimestamp,
  evidence,
  missingInformation,
  missingInformationReadModel,
  conflicts,
  readinessResult,
  residentialStrategyResult,
  vacantLandStrategyResult,
  sellerReply,
  taskDue,
}) {
  const missingIds = missingInformation.map((issue) => issue.issueId);
  const conflictIds = conflicts.map((conflict) => conflict.conflictId);
  const approvalRequirement = {
    required: approvalSummary.required,
    status: approvalSummary.status,
    reason: approvalSummary.reason,
    approvalReferenceIds: approvalSummary.approvalReferenceIds,
  };

  if (!dealId) {
    return {
      recommendation: normalizeRecommendation({
        actionCode: DECISION_ACTION_TAXONOMY.NEEDS_REVIEW,
        label: "Needs review",
        explanation: "A stable opportunity record is required before a next action can be evaluated safely.",
        status: DECISION_EVALUATION_STATES.NOT_EVALUATED,
        sourceMode: SOURCE_MODE,
        rulesetVersion: COMPATIBILITY_DECISION_RULESET_VERSION,
        missingInformationIds: missingIds,
        conflictIds,
        approvalRequirement,
        evaluatedTimestamp,
      }),
      recommendationBasis: normalizeRecommendationBasis({
        basisType: RECOMMENDATION_BASIS_TYPES.UNAVAILABLE,
        limitations: ["A stable opportunity record is unavailable."],
        explanation: "No deterministic recommendation basis can be identified without a stable opportunity record.",
      }),
    };
  }

  let actionCode;
  let label;
  let explanation;
  let supportingEvidence = [];
  let recommendationBasis = {};

  if (sellerReply) {
    actionCode = DECISION_ACTION_TAXONOMY.FOLLOW_UP_SELLER;
    label = "Respond to the seller reply.";
    explanation = "The latest valid linked seller message is inbound and needs a response.";
    supportingEvidence = evidence
      .filter((entry) => entry.sourceType === "conversation-summary")
      .map((entry) => entry.evidenceId);
    recommendationBasis = {
      basisType: RECOMMENDATION_BASIS_TYPES.SELLER_REPLY,
      triggerId: `seller-reply:deal:${idSegment(dealId)}`,
      triggerLabel: "Inbound seller reply",
      relatedCanonicalFields: ["communication.latestInboundMessage"],
      evidenceIds: supportingEvidence,
      directTrigger: true,
      explanation: "A valid linked inbound seller message directly triggers the response recommendation.",
    };
  } else if (dueContext.isOverdue) {
    actionCode = DECISION_ACTION_TAXONOMY.FOLLOW_UP_SELLER;
    label = "Follow up with the seller today and update the next action.";
    explanation = "The current deal follow-up date is overdue.";
    const dueEvidence = evidenceForCanonicalField(evidence, "deal.followUpDueAt");
    supportingEvidence = dueEvidence ? [dueEvidence.evidenceId] : [];
    recommendationBasis = {
      basisType: RECOMMENDATION_BASIS_TYPES.OVERDUE_ACTION,
      triggerId: `overdue-action:deal:${idSegment(dealId)}`,
      triggerLabel: "Overdue follow-up",
      relatedCanonicalFields: ["deal.followUpDueAt"],
      evidenceIds: supportingEvidence,
      directTrigger: true,
      explanation: "The supplied follow-up date is explicitly overdue.",
    };
  } else if (taskDue || dueContext.isDue) {
    actionCode = DECISION_ACTION_TAXONOMY.FOLLOW_UP_SELLER;
    label = "Complete the due follow-up action.";
    explanation = "A linked task or the current deal follow-up is due.";
    supportingEvidence = evidence
      .filter((entry) => entry.sourceType === "task-record")
      .map((entry) => entry.evidenceId);
    const dueEvidence = evidenceForCanonicalField(evidence, "deal.followUpDueAt");
    if (dueEvidence) supportingEvidence.push(dueEvidence.evidenceId);
    recommendationBasis = {
      basisType: RECOMMENDATION_BASIS_TYPES.DUE_ACTION,
      triggerId: `due-action:deal:${idSegment(dealId)}`,
      triggerLabel: "Due follow-up action",
      relatedCanonicalFields: ["deal.followUpDueAt"],
      evidenceIds: supportingEvidence,
      directTrigger: true,
      explanation: "A linked task or stored follow-up date is currently due.",
    };
  } else if (
    missingInformationReadModel?.highestPriorityAction?.enabled
  ) {
    const informationAction = missingInformationReadModel.highestPriorityAction;
    const informationItem = missingInformationReadModel.openItems.find(
      (item) => item.requirementId === informationAction.requirementId
    );
    const actionCodesByField = {
      "seller.contact": DECISION_ACTION_TAXONOMY.ADD_CONTACT_INFORMATION,
      "property.condition": DECISION_ACTION_TAXONOMY.COLLECT_PROPERTY_CONDITION,
      "property.repairs": DECISION_ACTION_TAXONOMY.COLLECT_PROPERTY_CONDITION,
      "seller.motivation": DECISION_ACTION_TAXONOMY.COLLECT_SELLER_MOTIVATION,
      "seller.timeline": DECISION_ACTION_TAXONOMY.COLLECT_SELLER_TIMELINE,
      "deal.askingPrice": DECISION_ACTION_TAXONOMY.COLLECT_ASKING_PRICE,
      "property.arvOrComps": DECISION_ACTION_TAXONOMY.RUN_COMPS,
      "property.afterRepairValue": DECISION_ACTION_TAXONOMY.RUN_COMPS,
      "property.marketValueSupport": DECISION_ACTION_TAXONOMY.RUN_COMPS,
    };
    actionCode =
      actionCodesByField[informationItem?.canonicalField] ||
      DECISION_ACTION_TAXONOMY.NEEDS_REVIEW;
    if (informationItem?.canonicalField === "seller.contact") {
      label = "Add seller contact information before outreach.";
    } else if (informationAction.sellerQuestion) {
      label = informationAction.sellerQuestion;
    } else {
      label = informationAction.label;
    }
    explanation = `${informationAction.explanation} ${
      informationItem?.reason || "Review the current stored information."
    }`;
    supportingEvidence = informationItem?.evidenceReferenceIds || [];
    const isConflict = informationItem?.state === "conflicting" || informationAction.actionType === "review-conflict";
    recommendationBasis = {
      basisType: isConflict ? RECOMMENDATION_BASIS_TYPES.CONFLICT_REVIEW : RECOMMENDATION_BASIS_TYPES.MISSING_INFORMATION,
      triggerId: informationItem?.itemId || informationAction.actionId,
      triggerLabel: informationItem?.label || informationAction.label,
      relatedCanonicalFields: informationItem?.canonicalField ? [informationItem.canonicalField] : [],
      evidenceIds: supportingEvidence,
      missingInformationIds: informationItem?.itemId ? [informationItem.itemId] : [],
      conflictIds: informationItem?.conflictIds || [],
      directTrigger: true,
      explanation: isConflict ? "A deterministic conflicting-information item requires source review." : "A deterministic Missing Information requirement identifies the next fact to collect.",
    };
  } else if (approvalSummary.pendingCount > 0) {
    actionCode = DECISION_ACTION_TAXONOMY.NEEDS_REVIEW;
    label = "Review the pending approval before continuing.";
    explanation = approvalSummary.reason;
    recommendationBasis = {
      basisType: RECOMMENDATION_BASIS_TYPES.PENDING_APPROVAL,
      triggerId: approvalSummary.approvalReferenceIds[0] || `approval-trigger:deal:${idSegment(dealId)}`,
      triggerLabel: "Pending approval",
      approvalReferenceIds: approvalSummary.approvalReferenceIds,
      directTrigger: true,
      explanation: "A real linked pending approval record requires review.",
    };
  } else if (
    readinessResult &&
    [
      READINESS_STATES.BLOCKED,
      READINESS_STATES.NEEDS_INFORMATION,
      READINESS_STATES.NEEDS_VERIFICATION,
      READINESS_STATES.MANUAL_REVIEW_REQUIRED,
    ].includes(readinessResult.readinessState)
  ) {
    actionCode = DECISION_ACTION_TAXONOMY.NEEDS_REVIEW;
    label = readinessResult.recommendedNextAction.label;
    explanation = readinessResult.recommendedNextAction.explanation || readinessResult.explanation;
    supportingEvidence = readinessResult.evidenceIds;
    recommendationBasis = {
      basisType: readinessResult.readinessState === READINESS_STATES.MANUAL_REVIEW_REQUIRED ? RECOMMENDATION_BASIS_TYPES.MANUAL_REVIEW : RECOMMENDATION_BASIS_TYPES.READINESS_BLOCKER,
      triggerId: readinessResult.readinessId,
      triggerLabel: readinessResult.displayLabel,
      evidenceIds: supportingEvidence,
      missingInformationIds: readinessResult.missingInformationIds,
      conflictIds: readinessResult.conflictIds,
      readinessGateIds: [...(readinessResult.failedGateResults || []), ...(readinessResult.pendingGates || []), ...(readinessResult.manualReviewGates || [])].map((gate) => gate.gateId),
      strategyRuleset: readinessResult.rulesetVersion,
      directTrigger: true,
      explanation: "The canonical Offer Readiness result identifies required review work.",
    };
  } else if (
    residentialStrategyResult?.eligible &&
    residentialStrategyResult?.reviewGuidance?.label
  ) {
    actionCode = DECISION_ACTION_TAXONOMY.NEEDS_REVIEW;
    label = residentialStrategyResult.reviewGuidance.label;
    explanation = residentialStrategyResult.reviewGuidance.explanation;
    supportingEvidence = uniqueStrings([
      ...(residentialStrategyResult.underwriting?.inputEvidenceIds || []),
      ...(residentialStrategyResult.pursuitScoreResult
        ?.evidenceReferenceIds || []),
    ]);
    recommendationBasis = {
      basisType: RECOMMENDATION_BASIS_TYPES.RESIDENTIAL_STRATEGY_GUIDANCE,
      triggerId: `residential-guidance:deal:${idSegment(dealId)}`,
      triggerLabel: residentialStrategyResult.reviewGuidance.label,
      evidenceIds: supportingEvidence,
      strategyRuleset: residentialStrategyResult.scoringRulesetVersion,
      directTrigger: true,
      explanation: "Residential Strategy v1 produced deterministic review guidance.",
    };
  } else if (
    vacantLandStrategyResult?.eligible &&
    vacantLandStrategyResult?.reviewGuidance?.label
  ) {
    actionCode = DECISION_ACTION_TAXONOMY.NEEDS_REVIEW;
    label = vacantLandStrategyResult.reviewGuidance.label;
    explanation = vacantLandStrategyResult.reviewGuidance.explanation;
    supportingEvidence = uniqueStrings([
      ...(vacantLandStrategyResult.valuation?.inputEvidenceIds || []),
      ...(vacantLandStrategyResult.pursuitScoreResult?.evidenceReferenceIds || []),
    ]);
    recommendationBasis = {
      basisType: RECOMMENDATION_BASIS_TYPES.VACANT_LAND_STRATEGY_GUIDANCE,
      triggerId: `vacant-land-guidance:deal:${idSegment(dealId)}`,
      triggerLabel: vacantLandStrategyResult.reviewGuidance.label,
      evidenceIds: supportingEvidence,
      strategyRuleset: vacantLandStrategyResult.scoringRulesetVersion,
      directTrigger: true,
      explanation: "Vacant Land Strategy v1 produced deterministic review guidance.",
    };
  } else if (
    readinessResult?.readinessState ===
    READINESS_STATES.READY_FOR_OFFER_PREPARATION
  ) {
    actionCode = DECISION_ACTION_TAXONOMY.PREPARE_OFFER_RANGE;
    label = readinessResult.recommendedNextAction.label;
    explanation = readinessResult.recommendedNextAction.explanation;
    supportingEvidence = readinessResult.evidenceIds;
    recommendationBasis = {
      basisType: RECOMMENDATION_BASIS_TYPES.READY_FOR_OFFER_PREPARATION,
      triggerId: readinessResult.readinessId,
      triggerLabel: readinessResult.displayLabel,
      evidenceIds: supportingEvidence,
      readinessGateIds: (readinessResult.passedGateResults || []).map((gate) => gate.gateId),
      strategyRuleset: readinessResult.rulesetVersion,
      directTrigger: true,
      explanation: "All blocking Offer Readiness gates passed for human offer preparation.",
    };
  } else {
    actionCode = DECISION_ACTION_TAXONOMY.NEEDS_REVIEW;
    label = missingInformationReadModel?.limitations?.[0]?.label || assetStrategyContext.statusSummary;
    explanation = readinessResult?.explanation || "Offer Readiness is unavailable for the selected Asset Strategy.";
    supportingEvidence = assetStrategyContext.classificationEvidence.map((reference) => reference.evidenceId);
    const classificationReview = assetStrategyContext.classificationState !== ASSET_CLASSIFICATION_STATES.CLASSIFIED;
    recommendationBasis = {
      basisType: classificationReview ? RECOMMENDATION_BASIS_TYPES.ASSET_CLASSIFICATION : RECOMMENDATION_BASIS_TYPES.COMPATIBILITY_FALLBACK,
      triggerId: classificationReview ? `asset-classification:deal:${idSegment(dealId)}` : `compatibility-fallback:deal:${idSegment(dealId)}`,
      triggerLabel: label,
      relatedCanonicalFields: classificationReview ? ["asset.classification"] : [],
      evidenceIds: supportingEvidence,
      conflictIds,
      directTrigger: classificationReview,
      limitations: classificationReview ? [] : ["No more specific deterministic recommendation branch is available."],
      explanation: classificationReview ? "Asset classification must be resolved before strategy-specific decision analysis." : "The current recommendation is a bounded compatibility fallback.",
    };
  }

  const hasSafeResult = Boolean(
    label &&
      (actionCode !== DECISION_ACTION_TAXONOMY.NEEDS_REVIEW ||
        missingInformationReadModel?.highestPriorityAction?.enabled ||
        approvalSummary.pendingCount > 0 ||
        residentialStrategyResult?.eligible ||
        vacantLandStrategyResult?.eligible ||
        readinessResult?.evaluationState === "evaluated")
  );
  return {
    recommendation: normalizeRecommendation({
      recommendationId: `recommendation:deal:${idSegment(dealId)}:compatibility`,
      actionCode,
      label,
      explanation,
      status: hasSafeResult
        ? DECISION_EVALUATION_STATES.COMPATIBILITY_RESULT
        : DECISION_EVALUATION_STATES.NOT_EVALUATED,
      sourceMode: SOURCE_MODE,
      rulesetVersion: COMPATIBILITY_DECISION_RULESET_VERSION,
      evidenceReferenceIds: supportingEvidence,
      missingInformationIds: missingIds,
      conflictIds,
      approvalRequirement,
      evaluatedTimestamp,
      actionWindow: dueContext.dueAt
        ? {
            label: dueContext.isOverdue ? "Overdue" : `Due ${dueContext.dueKey}`,
            dueTimestamp: dueContext.dueAt,
          }
        : null,
      confidenceReference: null,
      overrideReference: null,
    }),
    recommendationBasis: normalizeRecommendationBasis(recommendationBasis),
  };
}

function buildMetricOutputs({
  assetStrategyContext,
  dueContext,
  evaluatedTimestamp,
  evidence,
  pursuitScoreResult,
  readinessResult,
  dataReliabilityResult,
  recommendationConfidenceResult,
}) {
  const pursuitScoreMetric = toPursuitScoreMetric(pursuitScoreResult, {
    assetStrategyContext,
    productionOnly: true,
  });
  const readinessMetric = toOfferReadinessMetric(readinessResult);

  return DECISION_METRIC_REGISTRY.map((definition) => {
    if (definition.id === "pursuit-score") {
      return pursuitScoreMetric;
    }

    if (definition.id === "offer-readiness") {
      return readinessMetric;
    }

    if (definition.id === "data-reliability") {
      return toDataReliabilityMetric(dataReliabilityResult);
    }

    if (definition.id === "recommendation-confidence") {
      return toRecommendationConfidenceMetric(recommendationConfidenceResult);
    }

    if (definition.id === "recommended-action-window") {
      return normalizeMetricOutput({
        metricId: definition.id,
        evaluationState: dueContext.dueAt
          ? DECISION_EVALUATION_STATES.COMPATIBILITY_RESULT
          : DECISION_EVALUATION_STATES.UNAVAILABLE,
        value: dueContext.dueAt,
        displayValue: dueContext.dueAt
          ? dueContext.isOverdue
            ? "Overdue"
            : `Due ${dueContext.dueKey}`
          : null,
        unit: "timestamp",
        explanation: dueContext.dueAt
          ? "Derived only from the existing deal follow-up date."
          : "No existing due date or action window is represented.",
        inputEvidenceIds: evidenceForCanonicalField(evidence, "deal.followUpDueAt")
          ? [evidenceForCanonicalField(evidence, "deal.followUpDueAt").evidenceId]
          : [],
        rulesetVersion: COMPATIBILITY_DECISION_RULESET_VERSION,
        evaluatedTimestamp,
        sourceMode: SOURCE_MODE,
      });
    }

    return normalizeMetricOutput({
      metricId: definition.id,
      evaluationState: DECISION_EVALUATION_STATES.NOT_EVALUATED,
      value: null,
      displayValue: null,
      explanation: `${definition.label} is reserved but not evaluated in EO-DI-01.`,
      rulesetVersion: COMPATIBILITY_DECISION_RULESET_VERSION,
      evaluatedTimestamp,
      sourceMode: SOURCE_MODE,
    });
  });
}

function buildSourceFreshness(evidence) {
  const sourceTimestamps = evidence
    .map((entry) => entry.sourceTimestamp)
    .filter(Boolean)
    .sort();
  const stale = evidence.some((entry) => entry.freshnessState === "stale");
  const current = evidence.some((entry) => ["current", "fresh"].includes(entry.freshnessState));
  return {
    state: stale ? "stale" : current ? "current" : "unknown",
    latestSourceTimestamp: sourceTimestamps[sourceTimestamps.length - 1] || null,
    reason: stale
      ? "At least one supplied evidence record is explicitly stale."
      : current
        ? "At least one supplied evidence record includes an explicit current freshness state."
        : "Current compatibility evidence does not provide enough source metadata to assess freshness.",
  };
}

function buildRuleset(evaluatedTimestamp) {
  return normalizeRulesetDescriptor({
    rulesetId: COMPATIBILITY_DECISION_RULESET_ID,
    rulesetVersion: COMPATIBILITY_DECISION_RULESET_VERSION,
    sourceMode: SOURCE_MODE,
    providerName: null,
    modelName: null,
    deterministic: true,
    compatibility: true,
    generatedTimestamp: evaluatedTimestamp,
    description:
      "Deterministic compatibility wrapper around current deal facts with canonical strategy-aware Offer Readiness.",
  });
}

function buildAvailableActions(deal, dealId, assetStrategyContext) {
  const phone = safeDealAliasText(deal, "phone");
  const offerCapability = canRunAssetCapability(
    assetStrategyContext,
    ASSET_CAPABILITY_IDS.RESIDENTIAL_OFFER_GENERATION
  );
  return [
    {
      id: "prepare-offer",
      label: "Prepare Offer",
      targetSection: "numbers",
      targetWorkspace: "deal-decision-room",
      enabled: Boolean(dealId) && offerCapability.allowed,
      disabledReason: offerCapability.allowed
        ? null
        : offerCapability.explanation,
      mode: "navigation",
    },
    {
      id: "follow-up",
      label: "Follow Up",
      targetSection: "communication",
      targetWorkspace: "deal-decision-room",
      enabled: Boolean(dealId),
      mode: "navigation",
    },
    {
      id: "assign",
      label: "Assign",
      targetSection: "activity",
      targetWorkspace: "deal-decision-room",
      enabled: Boolean(dealId),
      mode: "navigation",
    },
    {
      id: "view-conversation",
      label: "View Conversation",
      targetWorkspace: "inbox",
      enabled: Boolean(phone),
      mode: "navigation",
    },
  ];
}

function buildReadModel({
  approvalItems,
  conflicts,
  conflictResolutions,
  conversationSignals,
  deal,
  evidenceReferences,
  now,
  previousLifecycle,
  pursuitScoreResult,
  sourceErrors,
  tasks,
}) {
  const safeDeal = safeObject(deal);
  const dealId = getDealId(safeDeal);
  const context = getTenantContext(safeDeal);
  const evaluatedTimestamp = normalizeDecisionTimestamp(now);
  const assetStrategyContext = buildAssetStrategyContext(safeDeal);
  const currentEvidence = buildCurrentDealEvidence(safeDeal, context, dealId);
  const externalEvidence = normalizeExternalEvidence(evidenceReferences, context);
  const conversationEvidence = adaptConversationEvidence(
    conversationSignals,
    context,
    dealId
  );
  const taskEvidence = adaptTaskEvidence(tasks, context, dealId);
  const conflictReadModel = evaluateConflictingData({
    assetStrategyContext,
    deal: safeDeal,
    evaluatedTimestamp,
    evidenceReferences: [
      ...assetStrategyContext.classificationEvidence,
      ...externalEvidence,
    ],
    explicitConflictReferences: [
      ...assetStrategyContext.classificationConflicts,
      ...(Array.isArray(conflicts) ? conflicts : []),
    ],
    explicitResolutionReferences: conflictResolutions,
  });
  const normalizedConflicts = conflictReadModel.activeConflicts
    .map(normalizeConflictReference)
    .filter(Boolean)
    .slice(0, SOURCE_LIMIT);
  const residentialFactReadModel = assetStrategyContext.residentialStrategyEligibility
    ? adaptResidentialFacts({
        assetStrategyContext,
        conflicts: normalizedConflicts,
        deal: safeDeal,
        evaluatedTimestamp,
        evidenceReferences: externalEvidence,
      })
    : null;
  const vacantLandFactReadModel = assetStrategyContext.landStrategyEligibility
    ? adaptVacantLandFacts({
        assetStrategyContext,
        conflicts: normalizedConflicts,
        deal: safeDeal,
        evaluatedTimestamp,
        evidenceReferences: externalEvidence,
      })
    : null;
  const vacantLandValuation = vacantLandFactReadModel
    ? evaluateVacantLandValuation({
        evaluatedTimestamp,
        factReadModel: vacantLandFactReadModel,
      })
    : null;
  const collectedEvidence = dedupeEvidence([
    ...assetStrategyContext.classificationEvidence,
    ...conversationEvidence,
    ...taskEvidence,
    ...(residentialFactReadModel?.evidenceReferences || []),
    ...(vacantLandFactReadModel?.evidenceReferences || []),
    ...(vacantLandValuation?.evidenceReferences || []),
    ...currentEvidence,
    ...externalEvidence,
  ]);
  const evidenceRegistry = buildEvidenceRegistry({
    context,
    conflictReadModel,
    evidenceReferences: collectedEvidence,
    evaluatedTimestamp,
  });
  const evidence = evidenceRegistry.evidenceRecords;
  const evidenceCoverage = buildEvidenceCoverage(evidenceRegistry);
  const missingInformationReadModel = evaluateMissingInformation({
    assetStrategyContext,
    conflicts: normalizedConflicts,
    deal: safeDeal,
    evaluatedTimestamp,
    evidenceReferences: evidence,
    evidenceCoverage,
    freshnessStates:
      residentialFactReadModel?.explicitFreshnessStates ||
      vacantLandFactReadModel?.explicitFreshnessStates || {},
    informationStates: {
      ...(residentialFactReadModel?.informationStates || {}),
      ...(vacantLandFactReadModel?.informationStates || {}),
      ...(vacantLandValuation?.indicatedLandValue > 0
        ? { "property.comparableLandValue": "present" }
        : {}),
    },
    sourceErrors,
    verificationStates:
      residentialFactReadModel?.explicitVerificationStates ||
      vacantLandFactReadModel?.explicitVerificationStates || {},
  });
  const residentialStrategyResult = assetStrategyContext.residentialStrategyEligibility
    ? evaluateResidentialStrategy({
        assetStrategyContext,
        conflicts: normalizedConflicts,
        deal: safeDeal,
        evaluatedTimestamp,
        evidenceReferences: evidence,
        factReadModel: residentialFactReadModel,
        missingInformationReadModel,
      })
    : null;
  const vacantLandStrategyResult = assetStrategyContext.landStrategyEligibility
    ? evaluateVacantLandStrategy({
        assetStrategyContext,
        conflicts: normalizedConflicts,
        deal: safeDeal,
        evaluatedTimestamp,
        evidenceReferences: evidence,
        factReadModel: vacantLandFactReadModel,
        missingInformationReadModel,
        valuation: vacantLandValuation,
      })
    : null;
  const resolvedPursuitScoreResult =
    residentialStrategyResult?.pursuitScoreResult ||
    vacantLandStrategyResult?.pursuitScoreResult ||
    pursuitScoreResult;
  const missingInformation = toDecisionIssueReferences(
    missingInformationReadModel
  );
  const approvalSummary = buildApprovalSummary(approvalItems, context, dealId);
  const readinessPolicy = assetStrategyContext.residentialStrategyEligibility
    ? RESIDENTIAL_READINESS_POLICY
    : assetStrategyContext.landStrategyEligibility
      ? VACANT_LAND_READINESS_POLICY
      : null;
  const strategyResult = residentialStrategyResult || vacantLandStrategyResult;
  const readinessResult = evaluateOfferReadiness({
    approvalContext: {
      required: approvalSummary.required,
      status: approvalSummary.status,
      reason: approvalSummary.reason,
      approvalReferenceIds: approvalSummary.approvalReferenceIds,
    },
    assetStrategyContext,
    conflicts: normalizedConflicts,
    evaluatedTimestamp,
    evidenceReferences: evidence,
    missingInformationReadModel,
    policy: readinessPolicy,
    strategyResult,
  });
  const evidenceLineage = buildDecisionOutputLineage({
    readinessResult,
    residentialStrategyResult,
    pursuitScoreResult: resolvedPursuitScoreResult,
    vacantLandStrategyResult,
  });
  const dueContext = getDueContext(safeDeal, now);
  const sellerReply = hasSellerReply(conversationSignals, context, dealId);
  const taskDue = hasDueTask(tasks, context, dealId, now);
  const sourceWarnings = uniqueStrings([
    ...((Array.isArray(sourceErrors) ? sourceErrors : sourceErrors ? [sourceErrors] : [])
      .map((error) => toUserSafeError(error, "A decision source could not be loaded."))),
    currentEvidence.length ? CRM_COMPATIBILITY_WARNING : "",
    dealId ? "" : "The loaded opportunity has no stable compatibility identifier.",
    safeDeal === deal ? "" : "The loaded opportunity record was malformed or unavailable.",
    ...assetStrategyContext.sourceWarnings,
    ...evidenceRegistry.warnings,
    ...conflictReadModel.partialDataWarnings,
    ...readinessResult.warnings,
    ...missingInformationReadModel.partialDataWarnings,
    ...(residentialStrategyResult?.partialDataWarnings || []),
    ...(vacantLandStrategyResult?.partialDataWarnings || []),
  ]).slice(0, 10);
  const ruleset = buildRuleset(evaluatedTimestamp);
  const lifecycle = getLifecycle({
    approvalSummary,
    assetStrategyContext,
    conflicts: conflictReadModel.blockingConflicts,
    context,
    deal: safeDeal,
    dealId,
    dueContext,
    evidence,
    evaluatedTimestamp,
    missingInformationReadModel,
    previousLifecycle,
    readinessResult,
    sellerReply,
    taskDue,
  });
  const recommendationSelection = getRecommendation({
    approvalSummary,
    assetStrategyContext,
    conflicts: normalizedConflicts,
    dealId,
    dueContext,
    evaluatedTimestamp,
    evidence,
    missingInformation,
    missingInformationReadModel,
    readinessResult,
    residentialStrategyResult,
    vacantLandStrategyResult,
    sellerReply,
    taskDue,
  });
  const recommendationBasis = recommendationSelection.recommendationBasis;
  const dataReliabilityResult = evaluateDataReliability({
    assetStrategyContext,
    conflictReadModel,
    evaluatedTimestamp,
    evidenceRegistry,
    missingInformationReadModel,
    recommendationBasis,
  });
  const recommendationConfidenceResult = evaluateRecommendationConfidence({
    approvalContext: approvalSummary,
    conflictReadModel,
    dataReliabilityResult,
    evaluatedTimestamp,
    evidenceRegistry,
    missingInformationReadModel,
    readinessResult,
    recommendation: recommendationSelection.recommendation,
    recommendationBasis,
  });
  const recommendation = normalizeRecommendation({
    ...recommendationSelection.recommendation,
    confidenceReference: recommendationConfidenceResult.evaluationState === "evaluated"
      ? recommendationConfidenceResult.confidenceId
      : null,
  });
  const decisionQualityWarnings = uniqueStrings([
    ...sourceWarnings,
    ...(dataReliabilityResult.warnings || []),
    ...(recommendationConfidenceResult.warnings || []),
  ]).slice(0, 10);
  const metricOutputs = buildMetricOutputs({
    assetStrategyContext,
    dueContext,
    evaluatedTimestamp,
    evidence,
    pursuitScoreResult: resolvedPursuitScoreResult,
    readinessResult,
    dataReliabilityResult,
    recommendationConfidenceResult,
  });
  const decisionRecord = normalizeDecisionRecord({
    decisionId: dealId ? `decision:deal:${idSegment(dealId)}:compatibility` : null,
    organizationId: context.organizationId,
    tenantId: context.tenantId,
    dealId: dealId || null,
    sellerReference: {
      id:
        safeText(
          readRecordField(safeDeal, "seller_id") ||
            readRecordField(safeDeal, "sellerId")
        ) || null,
      name: safeDealAliasText(safeDeal, "ownerName") || null,
      phone: safeDealAliasText(safeDeal, "phone") || null,
    },
    propertyReference: {
      id:
        safeText(
          readRecordField(safeDeal, "property_id") ||
            readRecordField(safeDeal, "propertyId")
        ) || null,
      address: safeDealAliasText(safeDeal, "address") || null,
    },
    assetType: assetStrategyContext.decisionIntegrationFields.assetType,
    assetStrategyIdentifier:
      assetStrategyContext.decisionIntegrationFields.assetStrategyIdentifier,
    lifecycle,
    recommendation,
    metricOutputs,
    evidenceReferences: evidence,
    missingInformationReferences: missingInformation,
    conflictReferences: normalizedConflicts,
    approvalRequirements:
      approvalSummary.required === null
        ? []
        : [
            {
              required: approvalSummary.required,
              status: approvalSummary.status,
              reason: approvalSummary.reason,
              approvalReferenceIds: approvalSummary.approvalReferenceIds,
            },
          ],
    ruleset,
    evaluatedTimestamp,
    expirationTimestamp: null,
    revalidationState: "not-evaluated",
    sourceMode: SOURCE_MODE,
    partialDataWarnings: decisionQualityWarnings,
    decisionStatus: dealId
      ? decisionQualityWarnings.length
        ? "partial-compatibility-result"
        : "compatibility-result"
      : "incomplete",
  });
  const normalizedPursuitScoreResult = normalizePursuitScoreResult(
    resolvedPursuitScoreResult
  );
  const pursuitScoreMetric = decisionRecord.metricOutputs.find(
    (metric) => metric.metricId === "pursuit-score"
  );

  return {
    contractVersion: DECISION_CONTRACT_VERSION,
    decisionRecord,
    lifecycle: decisionRecord.lifecycle,
    recommendation: decisionRecord.recommendation,
    metricOutputs: decisionRecord.metricOutputs,
    metricsById: Object.fromEntries(
      decisionRecord.metricOutputs.map((metric) => [metric.metricId, metric])
    ),
    evidenceReferences: decisionRecord.evidenceReferences,
    evidenceRegistry,
    evidenceCoverage,
    evidenceLineage,
    dataReliabilityResult,
    recommendationConfidenceResult,
    recommendationBasis,
    recommendationTraceability: {
      evidenceIds: recommendationBasis.evidenceIds,
      missingInformationIds: recommendationBasis.missingInformationIds,
      conflictIds: recommendationBasis.conflictIds,
      readinessGateIds: recommendationBasis.readinessGateIds,
      basisType: recommendationBasis.basisType,
      rulesetVersion: decisionRecord.recommendation.rulesetVersion,
      limitationCodes: recommendationBasis.limitations.length
        ? recommendationBasis.limitations
        : recommendationBasis.evidenceIds.length || recommendationBasis.missingInformationIds.length || recommendationBasis.conflictIds.length || recommendationBasis.readinessGateIds.length || recommendationBasis.approvalReferenceIds.length
          ? []
          : ["missing-explicit-value"],
    },
    missingInformationReferences: decisionRecord.missingInformationReferences,
    missingInformationReadModel,
    conflictReadModel,
    residentialStrategyResult,
    vacantLandStrategyResult,
    readinessResult,
    pursuitScoreResult:
      pursuitScoreMetric?.evaluationState ===
        DECISION_EVALUATION_STATES.EVALUATED &&
      Number.isFinite(pursuitScoreMetric.value)
        ? normalizedPursuitScoreResult
        : null,
    conflictReferences: decisionRecord.conflictReferences,
    sourceWarnings: decisionQualityWarnings,
    sourceStatus: decisionQualityWarnings.length ? "partial" : "complete",
    ruleset,
    sourceFreshness: buildSourceFreshness(evidence),
    approvalSummary,
    availableActions: buildAvailableActions(
      safeDeal,
      dealId,
      assetStrategyContext
    ),
    targetSections: TARGET_SECTIONS,
    compatibilityMode: assetStrategyContext.compatibilityAnalysisEligibility,
    assetStrategyContext,
  };
}

export function buildCompatibilityDecisionReadModel({
  approvalItems = null,
  conflicts = [],
  conflictResolutions = [],
  conversationSignals = [],
  deal = null,
  evidenceReferences = [],
  now = Date.now(),
  previousLifecycle = null,
  pursuitScoreResult = null,
  sourceErrors = [],
  tasks = [],
} = {}) {
  try {
    const data = buildReadModel({
      approvalItems,
      conflicts,
      conflictResolutions,
      conversationSignals,
      deal,
      evidenceReferences,
      now,
      previousLifecycle,
      pursuitScoreResult,
      sourceErrors,
      tasks,
    });
    return createSuccess(data, {
      contractVersion: DECISION_CONTRACT_VERSION,
      sourceStatus: data.sourceStatus,
    });
  } catch (error) {
    return createFailure(
      error,
      "Decision information could not be evaluated from the current record.",
      { contractVersion: DECISION_CONTRACT_VERSION, sourceStatus: "failed" }
    );
  }
}
