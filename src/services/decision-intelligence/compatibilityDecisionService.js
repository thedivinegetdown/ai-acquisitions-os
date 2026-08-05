import { createFailure, createSuccess } from "../api/serviceResult";
import {
  ASSET_CAPABILITY_IDS,
  ASSET_STRATEGY_SUPPORT_STATES,
  buildAssetStrategyContext,
  canRunAssetCapability,
} from "../asset-strategy/assetStrategyContextService";
import { ASSET_CLASSIFICATION_STATES } from "../asset-strategy/assetStrategyContracts";
import {
  OFFER_READINESS_CHECKLIST,
  analyzeOfferReadiness,
} from "../offers/offerReadinessService";
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
  normalizeDecisionIssueReference,
  normalizeDecisionRecord,
  normalizeDecisionTimestamp,
  normalizeEvidenceReference,
  normalizeMetricOutput,
  normalizeRecommendation,
  normalizeRulesetDescriptor,
} from "./decisionContracts";

// Distinct responsibility: adapt existing deterministic deal facts into the
// canonical Decision Intelligence contract without adding new scoring or mutations.
export const COMPATIBILITY_DECISION_RULESET_ID = "deal-decision-compatibility";
export const COMPATIBILITY_DECISION_RULESET_VERSION = "decision-compatibility-v1";
export const OFFER_READINESS_COMPATIBILITY_RULESET_VERSION =
  "offer-readiness-compatibility-v1";

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

const READINESS_CANONICAL_FIELDS = {
  "Asking price": "deal.askingPrice",
  "Property condition": "property.condition",
  "Motivation level": "seller.motivation",
  "Seller timeline": "seller.timeline",
  "Mortgage status": "property.mortgageStatus",
  "Repairs needed": "property.repairs",
  "Occupancy status": "property.occupancy",
  "ARV / comps status": "property.arvOrComps",
};

const READINESS_ACTION_CODES = {
  "Ask about repairs and current property condition.":
    DECISION_ACTION_TAXONOMY.COLLECT_PROPERTY_CONDITION,
  "Ask what is motivating the seller to consider an offer.":
    DECISION_ACTION_TAXONOMY.COLLECT_SELLER_MOTIVATION,
  "Ask about the seller's ideal timeline.":
    DECISION_ACTION_TAXONOMY.COLLECT_SELLER_TIMELINE,
  "Ask for the seller's asking price or target number.":
    DECISION_ACTION_TAXONOMY.COLLECT_ASKING_PRICE,
  "Run comps before preparing an offer.": DECISION_ACTION_TAXONOMY.RUN_COMPS,
  "Prepare an offer range.": DECISION_ACTION_TAXONOMY.PREPARE_OFFER_RANGE,
};

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

function getDealId(deal) {
  return getDealAliasText(deal, "id") || "";
}

function getTenantContext(deal) {
  return {
    organizationId: safeText(deal?.organization_id || deal?.organizationId) || null,
    tenantId: safeText(deal?.tenant_id || deal?.tenantId) || null,
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
    const value = deal?.[key];
    if (value !== null && value !== undefined && value !== "") return { key, value };
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

function buildCurrentDealEvidence(deal, readiness, context, dealId) {
  const descriptors = [
    { canonicalField: "property.address", keys: DEAL_FIELD_ALIASES.address },
    { canonicalField: "seller.name", keys: DEAL_FIELD_ALIASES.ownerName },
    { canonicalField: "deal.stage", keys: DEAL_FIELD_ALIASES.stage },
    { canonicalField: "seller.phone", keys: DEAL_FIELD_ALIASES.phone },
    { canonicalField: "seller.email", keys: ["email", "seller_email", "owner_email"] },
    { canonicalField: "deal.followUpDueAt", keys: ["due_date", "follow_up_date"] },
    { canonicalField: "deal.status", keys: ["status", "negotiation_status"] },
  ];

  const readinessChecklist = Array.isArray(readiness?.checklist)
    ? readiness.checklist
    : [];
  const readinessByLabel = new Map(
    readinessChecklist.map((item) => [item.label, item])
  );
  OFFER_READINESS_CHECKLIST.forEach((item) => {
    if (!readinessByLabel.get(item.label)?.complete) return;
    descriptors.push({
      canonicalField: READINESS_CANONICAL_FIELDS[item.label],
      keys: item.keys,
    });
  });

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

function issueId(dealId, category, label) {
  if (!dealId) return null;
  return `issue:${idSegment(dealId)}:${idSegment(category)}:${idSegment(normalizedKey(label))}`;
}

function createMissingIssue({
  canonicalField,
  category,
  dealId,
  description,
  evidenceReferenceIds = [],
  label,
  severity,
}) {
  const id = issueId(dealId, category, label);
  if (!id) return null;
  return normalizeDecisionIssueReference({
    issueId: id,
    label,
    description,
    severity,
    state: "open",
    relatedCanonicalField: canonicalField,
    evidenceReferenceIds,
    sourceMode: SOURCE_MODE,
    rulesetVersion: COMPATIBILITY_DECISION_RULESET_VERSION,
  });
}

function buildAssetStrategyIssue(assetStrategyContext, dealId) {
  if (!dealId) return null;
  const evidenceReferenceIds = assetStrategyContext.classificationEvidence.map(
    (reference) => reference.evidenceId
  );

  if (
    assetStrategyContext.classificationState ===
    ASSET_CLASSIFICATION_STATES.UNCLASSIFIED
  ) {
    return createMissingIssue({
      canonicalField: "property.assetType",
      category: "asset-classification",
      dealId,
      description:
        "Asset type classification is required before strategy-specific analysis can run.",
      evidenceReferenceIds,
      label: "Asset type classification",
      severity: "blocking",
    });
  }

  if (
    assetStrategyContext.classificationState ===
    ASSET_CLASSIFICATION_STATES.AMBIGUOUS
  ) {
    return createMissingIssue({
      canonicalField: "property.assetType",
      category: "asset-classification",
      dealId,
      description:
        "Conflicting or ambiguous asset classification requires human review before strategy-specific analysis can run.",
      evidenceReferenceIds,
      label: "Asset type classification conflict",
      severity: "blocking",
    });
  }

  if (
    assetStrategyContext.classificationState ===
    ASSET_CLASSIFICATION_STATES.UNSUPPORTED
  ) {
    return createMissingIssue({
      canonicalField: "property.assetType",
      category: "asset-classification",
      dealId,
      description:
        "The stored asset type does not map to a supported Asset Strategy classification.",
      evidenceReferenceIds,
      label: "Supported asset type classification",
      severity: "blocking",
    });
  }

  if (
    assetStrategyContext.strategySupportState ===
      ASSET_STRATEGY_SUPPORT_STATES.CONTRACT_READY ||
    assetStrategyContext.strategySupportState ===
      ASSET_STRATEGY_SUPPORT_STATES.DEFERRED
  ) {
    return createMissingIssue({
      canonicalField: "property.assetType",
      category: "asset-strategy-availability",
      dealId,
      description: `${assetStrategyContext.strategyLabel} is ${
        assetStrategyContext.strategySupportState ===
        ASSET_STRATEGY_SUPPORT_STATES.DEFERRED
          ? "deferred"
          : "not yet implemented"
      }; residential-house analysis is blocked.`,
      evidenceReferenceIds,
      label: `${assetStrategyContext.assetTypeLabel} strategy availability`,
      severity: "blocking",
    });
  }

  return null;
}

function buildMissingInformation(deal, readiness, dealId, assetStrategyContext) {
  const missing = (Array.isArray(readiness?.checklist) ? readiness.checklist : [])
    .filter((item) => !item.complete)
    .map((item) =>
      createMissingIssue({
        canonicalField: READINESS_CANONICAL_FIELDS[item.label],
        category: "offer-readiness",
        dealId,
        description: "Required by the existing offer-readiness compatibility checklist.",
        label: item.label,
        severity: "blocking",
      })
    );
  const assetStrategyIssue = buildAssetStrategyIssue(
    assetStrategyContext,
    dealId
  );
  if (assetStrategyIssue) missing.push(assetStrategyIssue);

  if (!getDealAliasText(deal, "address")) {
    missing.push(
      createMissingIssue({
        canonicalField: "property.address",
        category: "identity",
        dealId,
        description: "Property identity is incomplete in the current deal record.",
        label: "Property address",
        severity: "blocking",
      })
    );
  }
  if (!getDealAliasText(deal, "ownerName")) {
    missing.push(
      createMissingIssue({
        canonicalField: "seller.name",
        category: "identity",
        dealId,
        description: "Seller identity is incomplete in the current deal record.",
        label: "Seller name",
        severity: "blocking",
      })
    );
  }
  if (!getDealAliasText(deal, "stage")) {
    missing.push(
      createMissingIssue({
        canonicalField: "deal.stage",
        category: "decision-context",
        dealId,
        description: "A current pipeline stage is needed for decision context.",
        label: "Current stage",
        severity: "blocking",
      })
    );
  }
  if (!getDealAliasText(deal, "phone") && !safeText(deal?.email)) {
    missing.push(
      createMissingIssue({
        canonicalField: "seller.contact",
        category: "seller-contact",
        dealId,
        description: "The existing next-action rule requires a seller phone or email before outreach.",
        label: "Seller contact information",
        severity: "blocking",
      })
    );
  }

  const byId = new Map();
  missing.filter(Boolean).forEach((issue) => {
    if (!byId.has(issue.issueId)) byId.set(issue.issueId, issue);
  });
  return [...byId.values()];
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
  missingInformation,
  previousLifecycle,
  sellerReply,
  taskDue,
}) {
  const address = getDealAliasText(deal, "address");
  const seller = getDealAliasText(deal, "ownerName");
  const stage = normalizedKey(getDealAliasText(deal, "stage") || deal?.status);
  const stageEvidence = evidenceForCanonicalField(evidence, "deal.stage");
  const dueEvidence = evidenceForCanonicalField(evidence, "deal.followUpDueAt");
  const actionEvidence = evidence.filter((entry) =>
    ["conversation-summary", "task-record"].includes(entry.sourceType)
  );
  const staleOrUnverified = evidence.filter(
    (entry) =>
      entry.provenanceDetails.decisionCritical === true &&
      (entry.freshnessState === "stale" || entry.verificationState === "unverified")
  );

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
      getDealAliasText(deal, "stage") || deal.status
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
  } else if (missingInformation.length || conflicts.length || staleOrUnverified.length) {
    state = DECISION_LIFECYCLE_STATES.VERIFY;
    const reasons = [
      missingInformation.length
        ? `${missingInformation.length} decision-critical item${
            missingInformation.length === 1 ? " is" : "s are"
          } missing`
        : null,
      conflicts.length ? `${conflicts.length} explicit conflict${conflicts.length === 1 ? " is" : "s are"} unresolved` : null,
      staleOrUnverified.length
        ? `${staleOrUnverified.length} critical evidence record${
            staleOrUnverified.length === 1 ? " needs" : "s need"
          } verification`
        : null,
    ].filter(Boolean);
    reason = `${reasons.join(" and ")}.`;
    lifecycleEvidence = evidence.map((entry) => entry.evidenceId);
  } else {
    state = DECISION_LIFECYCLE_STATES.DECIDE;
    reason = "The existing compatibility checklist is complete enough for human decision review.";
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
  deal,
  dealId,
  dueContext,
  evaluatedTimestamp,
  evidence,
  missingInformation,
  conflicts,
  readiness,
  readinessCapability,
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
    return normalizeRecommendation({
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
    });
  }

  let actionCode;
  let label;
  let explanation;
  let supportingEvidence = [];

  if (dueContext.isOverdue) {
    actionCode = DECISION_ACTION_TAXONOMY.FOLLOW_UP_SELLER;
    label = "Follow up with the seller today and update the next action.";
    explanation = "The current deal follow-up date is overdue.";
    const dueEvidence = evidenceForCanonicalField(evidence, "deal.followUpDueAt");
    supportingEvidence = dueEvidence ? [dueEvidence.evidenceId] : [];
  } else if (!getDealAliasText(deal, "phone") && !safeText(deal?.email)) {
    actionCode = DECISION_ACTION_TAXONOMY.ADD_CONTACT_INFORMATION;
    label = "Add seller contact information before outreach.";
    explanation = "Seller phone and email are missing from the current CRM record.";
  } else if (
    assetStrategyContext.classificationState !==
      ASSET_CLASSIFICATION_STATES.CLASSIFIED ||
    assetStrategyContext.manualReviewRequired
  ) {
    actionCode = DECISION_ACTION_TAXONOMY.NEEDS_REVIEW;
    label = assetStrategyContext.statusSummary;
    explanation = `${readinessCapability.explanation} Generic CRM, seller context, and communication remain available.`;
    supportingEvidence = assetStrategyContext.classificationEvidence.map(
      (reference) => reference.evidenceId
    );
  } else if (!readinessCapability.allowed) {
    actionCode = DECISION_ACTION_TAXONOMY.NEEDS_REVIEW;
    label = `${assetStrategyContext.strategyLabel} is ${
      assetStrategyContext.strategySupportState ===
      ASSET_STRATEGY_SUPPORT_STATES.DEFERRED
        ? "deferred"
        : "not yet implemented"
    }.`;
    explanation = `${readinessCapability.explanation} Maintain seller context and communication without residential calculations.`;
    supportingEvidence = assetStrategyContext.classificationEvidence.map(
      (reference) => reference.evidenceId
    );
  } else {
    actionCode =
      READINESS_ACTION_CODES[readiness.recommendedNextStep] || DECISION_ACTION_TAXONOMY.NEEDS_REVIEW;
    label = readiness.recommendedNextStep || "Needs review";
    explanation = readiness.recommendedNextStep
      ? "The existing deterministic offer-readiness checklist selected this next step."
      : "The compatibility checklist did not produce a safe next action.";
    supportingEvidence = evidence
      .filter((entry) => entry.relatedCanonicalField)
      .map((entry) => entry.evidenceId);
  }

  const hasSafeResult = Boolean(label && actionCode !== DECISION_ACTION_TAXONOMY.NEEDS_REVIEW);
  return normalizeRecommendation({
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
  });
}

function buildMetricOutputs({
  assetStrategyContext,
  dealId,
  dueContext,
  evaluatedTimestamp,
  evidence,
  missingInformation,
  readiness,
  readinessCapability,
}) {
  const missingIds = missingInformation
    .filter((issue) => issue.description?.includes("offer-readiness"))
    .map((issue) => issue.issueId);
  const readinessEvidence = evidence
    .filter((entry) =>
      Object.values(READINESS_CANONICAL_FIELDS).includes(entry.relatedCanonicalField)
    )
    .map((entry) => entry.evidenceId);
  const completeCount = Array.isArray(readiness?.checklist)
    ? readiness.checklist.filter((item) => item.complete).length
    : 0;
  const classificationIssueIds = missingInformation
    .filter((issue) => issue.relatedCanonicalField === "property.assetType")
    .map((issue) => issue.issueId);
  const classificationEvidenceIds = assetStrategyContext.classificationEvidence.map(
    (reference) => reference.evidenceId
  );

  return DECISION_METRIC_REGISTRY.map((definition) => {
    if (
      definition.id === "offer-readiness" &&
      dealId &&
      readinessCapability.allowed &&
      readiness
    ) {
      return normalizeMetricOutput({
        metricId: definition.id,
        evaluationState: DECISION_EVALUATION_STATES.COMPATIBILITY_RESULT,
        value: readiness.score,
        displayValue: readiness.status,
        unit: "percent",
        scale: "0-100 existing checklist completion",
        explanation: `${completeCount} of ${readiness.checklist.length} existing offer-readiness checklist items are complete.`,
        inputEvidenceIds: readinessEvidence,
        blockingIssueIds: missingIds,
        advisoryIssueIds: [],
        rulesetVersion: OFFER_READINESS_COMPATIBILITY_RULESET_VERSION,
        evaluatedTimestamp,
        sourceMode: SOURCE_MODE,
        partialDataWarnings: [
          "This is the existing compatibility checklist, not the future strategy-aware readiness model.",
        ],
      });
    }

    if (definition.id === "offer-readiness") {
      return normalizeMetricOutput({
        metricId: definition.id,
        evaluationState: DECISION_EVALUATION_STATES.UNAVAILABLE,
        value: null,
        displayValue: null,
        explanation: readinessCapability.explanation,
        inputEvidenceIds: classificationEvidenceIds,
        blockingIssueIds: classificationIssueIds,
        advisoryIssueIds: [],
        rulesetVersion: OFFER_READINESS_COMPATIBILITY_RULESET_VERSION,
        evaluatedTimestamp,
        sourceMode: SOURCE_MODE,
        partialDataWarnings: [readinessCapability.explanation],
      });
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
      "Deterministic compatibility wrapper around current deal facts and existing offer-readiness behavior.",
  });
}

function buildAvailableActions(deal, dealId, assetStrategyContext) {
  const phone = getDealAliasText(deal, "phone");
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
  conversationSignals,
  deal,
  evidenceReferences,
  now,
  previousLifecycle,
  sourceErrors,
  tasks,
}) {
  const safeDeal = safeObject(deal);
  const dealId = getDealId(safeDeal);
  const context = getTenantContext(safeDeal);
  const evaluatedTimestamp = normalizeDecisionTimestamp(now);
  const assetStrategyContext = buildAssetStrategyContext(safeDeal);
  const readinessCapability = canRunAssetCapability(
    assetStrategyContext,
    ASSET_CAPABILITY_IDS.RESIDENTIAL_OFFER_READINESS
  );
  const readiness = readinessCapability.allowed
    ? analyzeOfferReadiness(safeDeal)
    : null;
  const currentEvidence = buildCurrentDealEvidence(safeDeal, readiness, context, dealId);
  const externalEvidence = normalizeExternalEvidence(evidenceReferences, context);
  const conversationEvidence = adaptConversationEvidence(
    conversationSignals,
    context,
    dealId
  );
  const taskEvidence = adaptTaskEvidence(tasks, context, dealId);
  const evidence = dedupeEvidence([
    ...assetStrategyContext.classificationEvidence,
    ...currentEvidence,
    ...externalEvidence,
    ...conversationEvidence,
    ...taskEvidence,
  ]);
  const missingInformation = buildMissingInformation(
    safeDeal,
    readiness,
    dealId,
    assetStrategyContext
  );
  const providedConflicts = (Array.isArray(conflicts) ? conflicts : [])
    .map(normalizeConflictReference)
    .filter(Boolean)
    .slice(0, SOURCE_LIMIT);
  const conflictById = new Map();
  [
    ...assetStrategyContext.classificationConflicts,
    ...providedConflicts,
  ].forEach((conflict) => {
    if (!conflictById.has(conflict.conflictId)) {
      conflictById.set(conflict.conflictId, conflict);
    }
  });
  const normalizedConflicts = [...conflictById.values()].slice(0, SOURCE_LIMIT);
  const approvalSummary = buildApprovalSummary(approvalItems, context, dealId);
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
  ]).slice(0, 10);
  const ruleset = buildRuleset(evaluatedTimestamp);
  const lifecycle = getLifecycle({
    approvalSummary,
    assetStrategyContext,
    conflicts: normalizedConflicts,
    context,
    deal: safeDeal,
    dealId,
    dueContext,
    evidence,
    evaluatedTimestamp,
    missingInformation,
    previousLifecycle,
    sellerReply,
    taskDue,
  });
  const recommendation = getRecommendation({
    approvalSummary,
    assetStrategyContext,
    conflicts: normalizedConflicts,
    deal: safeDeal,
    dealId,
    dueContext,
    evaluatedTimestamp,
    evidence,
    missingInformation,
    readiness,
    readinessCapability,
  });
  const metricOutputs = buildMetricOutputs({
    assetStrategyContext,
    dealId,
    dueContext,
    evaluatedTimestamp,
    evidence,
    missingInformation,
    readiness,
    readinessCapability,
  });
  const decisionRecord = normalizeDecisionRecord({
    decisionId: dealId ? `decision:deal:${idSegment(dealId)}:compatibility` : null,
    organizationId: context.organizationId,
    tenantId: context.tenantId,
    dealId: dealId || null,
    sellerReference: {
      id: safeText(safeDeal.seller_id || safeDeal.sellerId) || null,
      name: getDealAliasText(safeDeal, "ownerName") || null,
      phone: getDealAliasText(safeDeal, "phone") || null,
    },
    propertyReference: {
      id: safeText(safeDeal.property_id || safeDeal.propertyId) || null,
      address: getDealAliasText(safeDeal, "address") || null,
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
    partialDataWarnings: sourceWarnings,
    decisionStatus: dealId
      ? sourceWarnings.length
        ? "partial-compatibility-result"
        : "compatibility-result"
      : "incomplete",
  });

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
    missingInformationReferences: decisionRecord.missingInformationReferences,
    conflictReferences: decisionRecord.conflictReferences,
    sourceWarnings,
    sourceStatus: sourceWarnings.length ? "partial" : "complete",
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
  conversationSignals = [],
  deal = null,
  evidenceReferences = [],
  now = Date.now(),
  previousLifecycle = null,
  sourceErrors = [],
  tasks = [],
} = {}) {
  try {
    const data = buildReadModel({
      approvalItems,
      conflicts,
      conversationSignals,
      deal,
      evidenceReferences,
      now,
      previousLifecycle,
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
