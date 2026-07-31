import { getPermissionsForRole } from "../team/permissionService";
import { getDealAliasText } from "../../utils/dealFields";
import { buildActionInbox } from "../notifications";
import { getPriorityWeight } from "../notifications/notificationPriorityService";

export const APPROVAL_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "deferred",
  "expired",
  "cancelled",
];

export const APPROVAL_TYPES = {
  OFFER_REVIEW: "offer-review",
  COMMUNICATION_DRAFT: "communication-draft",
  WORKFLOW_ACTION: "workflow-action",
  STAGE_CHANGE: "stage-change",
  CRM_UPDATE: "crm-update",
  BUYER_CAMPAIGN: "buyer-campaign",
  RECOMMENDATION_OVERRIDE: "recommendation-override",
  HIGH_RISK_ACTION: "high-risk-action",
};

export const APPROVAL_RESULT_LIMIT = 50;

const MAX_RESULT_LIMIT = 100;
const SOURCE_LIMITS = {
  campaigns: 50,
  deals: 250,
  drafts: 50,
  notifications: 100,
  workflows: 50,
};

const TYPE_PERMISSION = {
  [APPROVAL_TYPES.OFFER_REVIEW]: "canCreateOffers",
  [APPROVAL_TYPES.COMMUNICATION_DRAFT]: "canSendMessages",
  [APPROVAL_TYPES.WORKFLOW_ACTION]: "canEditLeads",
  [APPROVAL_TYPES.STAGE_CHANGE]: "canEditLeads",
  [APPROVAL_TYPES.CRM_UPDATE]: "canEditLeads",
  [APPROVAL_TYPES.BUYER_CAMPAIGN]: "canManageBuyers",
  [APPROVAL_TYPES.RECOMMENDATION_OVERRIDE]: "canEditLeads",
  [APPROVAL_TYPES.HIGH_RISK_ACTION]: "canEditLeads",
};

const FILTER_DEFINITIONS = [
  { id: "offers", label: "Offers", types: [APPROVAL_TYPES.OFFER_REVIEW] },
  {
    id: "communications",
    label: "Communications",
    types: [APPROVAL_TYPES.COMMUNICATION_DRAFT],
  },
  { id: "workflows", label: "Workflows", types: [APPROVAL_TYPES.WORKFLOW_ACTION] },
  {
    id: "crm-changes",
    label: "CRM Changes",
    types: [APPROVAL_TYPES.CRM_UPDATE, APPROVAL_TYPES.STAGE_CHANGE],
  },
  { id: "campaigns", label: "Campaigns", types: [APPROVAL_TYPES.BUYER_CAMPAIGN] },
  {
    id: "overrides",
    label: "Overrides",
    types: [APPROVAL_TYPES.RECOMMENDATION_OVERRIDE, APPROVAL_TYPES.HIGH_RISK_ACTION],
  },
];

const TYPE_ORDER = {
  [APPROVAL_TYPES.COMMUNICATION_DRAFT]: 6,
  [APPROVAL_TYPES.OFFER_REVIEW]: 5,
  [APPROVAL_TYPES.WORKFLOW_ACTION]: 4,
  [APPROVAL_TYPES.CRM_UPDATE]: 3,
  [APPROVAL_TYPES.STAGE_CHANGE]: 3,
  [APPROVAL_TYPES.BUYER_CAMPAIGN]: 2,
  [APPROVAL_TYPES.RECOMMENDATION_OVERRIDE]: 1,
  [APPROVAL_TYPES.HIGH_RISK_ACTION]: 1,
};

function safeArray(value, limit) {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === "object").slice(0, limit)
    : [];
}

function safeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function safeIso(value, fallback) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function normalizeStatus(value, expirationTimestamp, now) {
  const normalized = safeText(value, "pending").toLowerCase().replace(/[ _]+/g, "-");
  const statusMap = {
    approve: "approved",
    approved: "approved",
    cancel: "cancelled",
    canceled: "cancelled",
    cancelled: "cancelled",
    deferred: "deferred",
    dismiss: "cancelled",
    dismissed: "cancelled",
    expire: "expired",
    expired: "expired",
    pending: "pending",
    postpone: "deferred",
    postponed: "deferred",
    reject: "rejected",
    rejected: "rejected",
    snoozed: "deferred",
  };
  const status = statusMap[normalized] || "pending";
  const expiration = expirationTimestamp ? new Date(expirationTimestamp).getTime() : null;

  if (status === "pending" && expiration && expiration <= new Date(now).getTime()) {
    return "expired";
  }

  return status;
}

function slug(value, fallback = "item") {
  return (
    safeText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || fallback
  );
}

function getDealId(deal = {}) {
  return getDealAliasText(deal, "id");
}

function getDealAddress(deal = {}) {
  return getDealAliasText(deal, "address") || "Unknown property";
}

function getSellerName(deal = {}) {
  return getDealAliasText(deal, "ownerName") || "Unknown seller";
}

function getDealRoute(dealId, section = "") {
  if (!dealId) return "/deals";
  const base = `/deals/${encodeURIComponent(String(dealId))}`;
  return section ? `${base}#${section}` : base;
}

function normalizeEvidence(evidence = []) {
  return (Array.isArray(evidence) ? evidence : [])
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === "string") return { label: "Supporting fact", value: entry };
      const value = safeText(entry.value || entry.detail || entry.summary);
      if (!value) return null;
      return {
        label: safeText(entry.label || entry.type, "Supporting fact"),
        value,
        source: safeText(entry.source),
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}

function coreFreeFirstMetadata() {
  return {
    costCategory: "core-free-first",
    costNotice: "No paid provider is required to review this item.",
    provider: "",
    providerConfigured: null,
    providerRequired: false,
  };
}

function providerMetadata(channel, providerConfigured) {
  const normalizedChannel = safeText(channel).toLowerCase();
  const provider = normalizedChannel.includes("sms")
    ? "MessagingProvider"
    : normalizedChannel.includes("email")
      ? "EmailProvider"
      : "";

  if (!provider) return coreFreeFirstMetadata();

  return {
    costCategory: "optional-usage-based",
    costNotice:
      providerConfigured === true
        ? `${provider} may incur usage costs if a later execution command is approved.`
        : `${provider} is optional and is not required for review. No delivery occurs from this inbox.`,
    provider,
    providerConfigured: providerConfigured === true,
    providerRequired: false,
  };
}

function createRelatedContext(deal = {}, source = {}) {
  const dealId = safeText(source.dealId || source.deal_id || getDealId(deal));
  const propertyId = safeText(source.propertyId || source.property_id || deal.property_id);
  const phone = safeText(source.phone || deal.phone);

  return {
    relatedSeller: {
      id: safeText(source.sellerId || source.seller_id || deal.seller_id) || null,
      name: safeText(source.sellerName || source.relatedSeller || getSellerName(deal), "Unknown seller"),
      phone,
    },
    relatedDeal: {
      id: dealId || null,
      label: safeText(source.dealLabel || source.relatedDeal || getDealAddress(deal), "Unknown deal"),
      stage: safeText(source.stage || getDealAliasText(deal, "stage")),
    },
    relatedProperty: {
      id: propertyId || null,
      address: safeText(source.propertyAddress || source.relatedDeal || getDealAddress(deal), "Unknown property"),
    },
  };
}

/**
 * Normalized Universal Approval Inbox item. This compatibility contract is read-only unless
 * a caller supplies a real command; session-only defer state never becomes business truth.
 */
export function normalizeApprovalItem(source = {}, { now = Date.now() } = {}) {
  const generatedAt = new Date(now).toISOString();
  const requestedTimestamp = safeIso(source.requestedTimestamp, generatedAt);
  const expirationTimestamp = source.expirationTimestamp
    ? safeIso(source.expirationTimestamp, "")
    : "";
  const status = normalizeStatus(source.status, expirationTimestamp, now);
  const requiredPermission = source.requiredPermission || TYPE_PERMISSION[source.approvalType] || "";
  const targetRoute = safeText(source.targetRoute);
  const availableActions = [];

  if (targetRoute || source.targetWorkspace) {
    availableActions.push({
      id: "open-context",
      label: "Review in context",
      mode: "navigation",
    });
  }

  if (status === "pending") {
    availableActions.push({
      id: "defer",
      label: "Defer",
      mode: "session-only",
    });
  }

  return {
    id: safeText(source.id, `approval:${slug(source.sourceSystem)}:${slug(source.sourceId)}`),
    organizationId: safeText(source.organizationId) || null,
    tenantId: safeText(source.tenantId) || null,
    approvalType: source.approvalType || APPROVAL_TYPES.WORKFLOW_ACTION,
    title: safeText(source.title, "Approval review required"),
    summary: safeText(source.summary, "Review the source context before taking action."),
    reason: safeText(source.reason, "Human review is required before a consequential action."),
    requestedAction: safeText(source.requestedAction, "Review the proposed action."),
    relatedSeller: source.relatedSeller || null,
    relatedDeal: source.relatedDeal || null,
    relatedProperty: source.relatedProperty || null,
    relatedConversation: source.relatedConversation || null,
    relatedWorkflow: source.relatedWorkflow || null,
    requestedBy: source.requestedBy || {
      id: "system",
      name: "Deterministic system rule",
      type: "system",
    },
    requestedTimestamp,
    urgency: safeText(source.urgency, "Normal"),
    riskLevel: safeText(source.riskLevel, "Medium"),
    status,
    evidence: normalizeEvidence(source.evidence),
    sourceSystem: safeText(source.sourceSystem, "Compatibility approval read model"),
    sourceId: safeText(source.sourceId),
    targetRoute,
    targetWorkspace: safeText(source.targetWorkspace),
    targetSection: safeText(source.targetSection),
    availableActions,
    expirationTimestamp,
    deferredUntil: safeText(source.deferredUntil),
    decisionMetadata: source.decisionMetadata || null,
    freeFirst: source.freeFirst || coreFreeFirstMetadata(),
    executionMode: safeText(source.executionMode, "manual-review"),
    manualCompletionRequired: source.manualCompletionRequired !== false,
    requiredPermission,
    allowedRoles: Array.isArray(source.allowedRoles) ? source.allowedRoles : [],
    actionDueAt: safeIso(source.actionDueAt, ""),
    dedupeKey: safeText(
      source.dedupeKey,
      [
        source.approvalType,
        source.relatedDeal?.id || source.relatedConversation?.id || source.relatedWorkflow?.id,
        source.requestedAction,
      ]
        .map((part) => slug(part, "none"))
        .join(":")
    ),
  };
}

export function isApprovalNotification(notification = {}) {
  const category = safeText(notification.category).toLowerCase();
  return Boolean(
    notification.requiresApproval ||
      category.includes("offers ready for review") ||
      category.includes("drafted communication approval")
  );
}

function approvalFromNotification(notification, now) {
  if (!isApprovalNotification(notification)) return null;

  const deal = notification.deal || {};
  const context = createRelatedContext(deal, notification);
  const category = safeText(notification.category).toLowerCase();
  const isOffer = category.includes("offer");
  const isCommunication = category.includes("communication");
  const approvalType = isOffer
    ? APPROVAL_TYPES.OFFER_REVIEW
    : isCommunication
      ? APPROVAL_TYPES.COMMUNICATION_DRAFT
      : APPROVAL_TYPES.WORKFLOW_ACTION;
  const targetSection = isOffer ? "numbers" : isCommunication ? "communication" : "decision";

  return normalizeApprovalItem(
    {
      id: `approval:notification:${safeText(notification.id, "unknown")}`,
      sourceId: notification.id,
      organizationId: deal.organization_id || deal.organizationId,
      tenantId: deal.tenant_id || deal.tenantId,
      approvalType,
      title: notification.title,
      summary: notification.reason,
      reason: notification.recommendedAction,
      requestedAction: notification.recommendedAction,
      ...context,
      relatedWorkflow:
        approvalType === APPROVAL_TYPES.WORKFLOW_ACTION
          ? { id: null, name: "Next-action workflow checkpoint" }
          : null,
      requestedBy: {
        id: "notification-rules",
        name: "Deterministic notification rules",
        type: "system",
      },
      requestedTimestamp: notification.createdAt,
      urgency: notification.priority || "Medium",
      riskLevel: notification.priority || (isOffer ? "High" : "Medium"),
      status: notification.status,
      evidence: [
        { label: "Rule", value: notification.reason, source: "Notification Rules" },
        { label: "Source category", value: notification.category, source: "Action Inbox" },
      ],
      sourceSystem: "Action Inbox",
      targetRoute: getDealRoute(context.relatedDeal.id, targetSection),
      targetWorkspace: context.relatedDeal.id ? "deal-decision-room" : "deals",
      targetSection,
      actionDueAt: deal.due_date || deal.follow_up_date,
      dedupeKey: `${approvalType}:${context.relatedDeal.id || notification.id}:${slug(notification.reason)}`,
      freeFirst: coreFreeFirstMetadata(),
    },
    { now }
  );
}

function approvalFromWorkflow(workflow, now) {
  if (workflow.approvalRequired === false) return null;
  const deal = workflow.deal || {};
  const context = createRelatedContext(deal, workflow);
  const workflowId = safeText(workflow.workflowId || workflow.id);
  const action = safeText(workflow.action, "Review the proposed workflow action.");

  return normalizeApprovalItem(
    {
      id: `approval:workflow:${slug(workflow.id || workflowId)}`,
      sourceId: workflow.id || workflowId,
      organizationId: workflow.organizationId || workflow.organization_id || deal.organization_id,
      tenantId: workflow.tenantId || workflow.tenant_id || deal.tenant_id,
      approvalType: APPROVAL_TYPES.WORKFLOW_ACTION,
      title: safeText(workflow.workflowName || workflow.name, "Workflow action") + " requires review",
      summary: action,
      reason: "The existing workflow engine marks this action as approval-required.",
      requestedAction: action,
      ...context,
      relatedWorkflow: {
        id: workflowId || null,
        name: safeText(workflow.workflowName || workflow.name, "Workflow"),
      },
      requestedBy: { id: "workflow-engine", name: "Workflow Engine", type: "system" },
      requestedTimestamp: workflow.generatedAt || workflow.requestedAt,
      urgency: workflow.priority || "Medium",
      riskLevel: workflow.riskLevel || workflow.priority || "Medium",
      status: workflow.status,
      evidence: [
        { label: "Workflow", value: workflow.workflowName || workflow.name },
        { label: "Proposed action", value: action },
      ],
      sourceSystem: "Workflow Engine",
      targetRoute: getDealRoute(context.relatedDeal.id, "decision"),
      targetWorkspace: context.relatedDeal.id ? "deal-decision-room" : "deals",
      targetSection: "decision",
      dedupeKey: `${APPROVAL_TYPES.WORKFLOW_ACTION}:${workflowId || context.relatedDeal.id}:${slug(action)}`,
      freeFirst: coreFreeFirstMetadata(),
    },
    { now }
  );
}

function approvalFromDraft(draft, index, now) {
  const body = safeText(draft.body);
  if (!body || ["sent", "cancelled", "canceled"].includes(safeText(draft.status).toLowerCase())) {
    return null;
  }

  const deal = draft.deal || {};
  const context = createRelatedContext(deal, draft);
  const channel = safeText(draft.channel, "message").toLowerCase();
  const draftId = safeText(
    draft.id,
    `${channel}-${context.relatedDeal.id || draft.to || "unknown"}-${draft.updatedAt || index}`
  );

  return normalizeApprovalItem(
    {
      id: `approval:draft:${slug(draftId)}`,
      sourceId: draftId,
      organizationId: draft.organizationId || draft.organization_id || deal.organization_id,
      tenantId: draft.tenantId || draft.tenant_id || deal.tenant_id,
      approvalType: APPROVAL_TYPES.COMMUNICATION_DRAFT,
      title: `Review ${channel.toUpperCase()} draft`,
      summary: body.length > 160 ? `${body.slice(0, 157)}...` : body,
      reason: "Seller communication is still a draft and must be reviewed before delivery.",
      requestedAction: `Review the ${channel} draft before any external delivery.`,
      ...context,
      relatedConversation: {
        id: safeText(draft.conversationId || draft.conversation_id) || null,
        phone: safeText(draft.to || context.relatedSeller.phone),
      },
      requestedBy: draft.requestedBy || {
        id: "message-composer",
        name: "Message Composer",
        type: "system",
      },
      requestedTimestamp: draft.updatedAt || draft.createdAt,
      urgency: draft.urgency || "Medium",
      riskLevel: draft.riskLevel || "Medium",
      status: "pending",
      evidence: [
        { label: "Channel", value: channel.toUpperCase() },
        { label: "Draft preview", value: body.length > 240 ? `${body.slice(0, 237)}...` : body },
      ],
      sourceSystem: "Message Composer",
      targetRoute: "/inbox",
      targetWorkspace: "inbox",
      targetSection: "communication",
      dedupeKey: `${APPROVAL_TYPES.COMMUNICATION_DRAFT}:${draftId}`,
      freeFirst: providerMetadata(channel, draft.providerConfigured),
    },
    { now }
  );
}

function approvalFromCampaign(campaign, now) {
  const status = safeText(campaign.status).toLowerCase().replace(/[ _]+/g, "-");
  const explicitlyRequiresApproval =
    campaign.approvalRequired === true ||
    campaign.requiresApproval === true ||
    ["pending-review", "ready-for-review"].includes(status);
  if (!explicitlyRequiresApproval) return null;

  const deal = campaign.deal || {};
  const context = createRelatedContext(deal, campaign);
  const campaignId = safeText(campaign.id || campaign.campaignId);
  const campaignName = safeText(campaign.campaignName || campaign.name, "Buyer campaign");

  return normalizeApprovalItem(
    {
      id: `approval:campaign:${slug(campaignId || campaignName)}`,
      sourceId: campaignId,
      organizationId: campaign.organizationId || campaign.organization_id || deal.organization_id,
      tenantId: campaign.tenantId || campaign.tenant_id || deal.tenant_id,
      approvalType: APPROVAL_TYPES.BUYER_CAMPAIGN,
      title: `${campaignName} requires review`,
      summary: safeText(campaign.summary || campaign.notes, "Review the buyer campaign before outreach."),
      reason: "The source campaign explicitly requires human approval before outreach.",
      requestedAction: safeText(campaign.requestedAction, "Review campaign audience and message."),
      ...context,
      requestedBy: campaign.requestedBy || {
        id: "campaign-tools",
        name: "Buyer campaign tools",
        type: "system",
      },
      requestedTimestamp: campaign.updatedAt || campaign.createdAt,
      urgency: campaign.urgency || "Medium",
      riskLevel: campaign.riskLevel || "Medium",
      status: "pending",
      evidence: [
        { label: "Channel", value: campaign.channel || "Manual" },
        campaign.audienceCount != null
          ? { label: "Audience", value: `${campaign.audienceCount} recipient(s)` }
          : null,
      ],
      sourceSystem: "Buyer Campaigns",
      targetRoute: "/buyers",
      targetWorkspace: "buyers",
      dedupeKey: `${APPROVAL_TYPES.BUYER_CAMPAIGN}:${campaignId || slug(campaignName)}`,
      freeFirst: providerMetadata(campaign.channel, campaign.providerConfigured),
    },
    { now }
  );
}

export function canRoleViewApproval(item, role = "Owner") {
  if (item.allowedRoles?.length && !item.allowedRoles.includes(role)) return false;
  if (!item.requiredPermission) return true;
  return Boolean(getPermissionsForRole(role)[item.requiredPermission]);
}

function matchesTenantContext(item, tenantId, organizationId) {
  if (tenantId && item.tenantId && item.tenantId !== tenantId) return false;
  if (organizationId && item.organizationId && item.organizationId !== organizationId) return false;
  return true;
}

function applyDecisionState(item, decisionState = {}, now) {
  const decision = decisionState[item.id];
  if (!decision || !APPROVAL_STATUSES.includes(decision.status)) return item;

  return normalizeApprovalItem(
    {
      ...item,
      status: decision.status,
      deferredUntil: decision.deferredUntil || item.deferredUntil,
      decisionMetadata: {
        actor: decision.actor || "Current user",
        decidedAt: decision.decidedAt || new Date(now).toISOString(),
        reason: safeText(decision.reason),
        sessionOnly: decision.sessionOnly !== false,
      },
    },
    { now }
  );
}

function dedupeApprovals(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.dedupeKey)) return false;
    seen.add(item.dedupeKey);
    return true;
  });
}

function isExpiringSoon(item, now) {
  if (!item.expirationTimestamp || item.status !== "pending") return false;
  const remaining = new Date(item.expirationTimestamp).getTime() - new Date(now).getTime();
  return remaining > 0 && remaining <= 48 * 60 * 60 * 1000;
}

function isOverdue(item, now) {
  if (!item.actionDueAt || item.status !== "pending") return false;
  return new Date(item.actionDueAt).getTime() < new Date(now).getTime();
}

function attentionBand(item, now) {
  if (item.status !== "pending") return item.status === "deferred" ? 0 : -1;
  if (["Critical", "High"].includes(item.riskLevel) || isExpiringSoon(item, now)) return 8;
  if (isOverdue(item, now)) return 7;
  return TYPE_ORDER[item.approvalType] || 1;
}

export function compareApprovalItems(left, right, now = Date.now()) {
  const bandDifference = attentionBand(right, now) - attentionBand(left, now);
  if (bandDifference !== 0) return bandDifference;

  const riskDifference = getPriorityWeight(right.riskLevel) - getPriorityWeight(left.riskLevel);
  if (riskDifference !== 0) return riskDifference;

  const leftExpiration = left.expirationTimestamp || "9999-12-31T23:59:59.999Z";
  const rightExpiration = right.expirationTimestamp || "9999-12-31T23:59:59.999Z";
  if (leftExpiration !== rightExpiration) return leftExpiration.localeCompare(rightExpiration);

  return left.requestedTimestamp.localeCompare(right.requestedTimestamp);
}

function buildFilters(items) {
  return [
    { id: "all", label: "All", count: items.length, types: [] },
    ...FILTER_DEFINITIONS.filter((filter) =>
      items.some((item) => filter.types.includes(item.approvalType))
    ).map((filter) => ({
      ...filter,
      count: items.filter((item) => filter.types.includes(item.approvalType)).length,
    })),
  ];
}

function buildCounts(items, now) {
  return {
    pending: items.filter((item) => item.status === "pending").length,
    highRisk: items.filter(
      (item) => item.status === "pending" && ["Critical", "High"].includes(item.riskLevel)
    ).length,
    expiringSoon: items.filter((item) => isExpiringSoon(item, now)).length,
    deferred: items.filter((item) => item.status === "deferred").length,
    completed: items.filter((item) =>
      ["approved", "rejected", "expired", "cancelled"].includes(item.status)
    ).length,
  };
}

function normalizeWarnings(errors = []) {
  return (Array.isArray(errors) ? errors : [errors])
    .filter(Boolean)
    .map((error) => safeText(error?.message || error))
    .filter(Boolean)
    .slice(0, 10);
}

export function buildApprovalReadModel({
  campaigns = [],
  dealNotifications = null,
  deals = [],
  decisionStateById = {},
  errors = [],
  limit = APPROVAL_RESULT_LIMIT,
  messageDrafts = [],
  now = Date.now(),
  organizationId = "",
  role = "Owner",
  tenantId = "",
  workflowApprovals = [],
} = {}) {
  const boundedDeals = safeArray(deals, SOURCE_LIMITS.deals);
  const inbox = dealNotifications === null ? buildActionInbox({ deals: boundedDeals }) : null;
  const notifications = safeArray(
    dealNotifications === null ? inbox?.notifications : dealNotifications,
    SOURCE_LIMITS.notifications
  );
  const boundedWorkflows = safeArray(workflowApprovals, SOURCE_LIMITS.workflows);
  const boundedDrafts = safeArray(messageDrafts, SOURCE_LIMITS.drafts);
  const boundedCampaigns = safeArray(campaigns, SOURCE_LIMITS.campaigns);
  const effectiveRole = safeText(role, "Owner");
  const resultLimit = Math.min(
    MAX_RESULT_LIMIT,
    Math.max(1, Number.isFinite(Number(limit)) ? Number(limit) : APPROVAL_RESULT_LIMIT)
  );

  const candidates = [
    ...notifications.map((notification) => approvalFromNotification(notification, now)),
    ...boundedWorkflows.map((workflow) => approvalFromWorkflow(workflow, now)),
    ...boundedDrafts.map((draft, index) => approvalFromDraft(draft, index, now)),
    ...boundedCampaigns.map((campaign) => approvalFromCampaign(campaign, now)),
  ].filter(Boolean);

  const items = dedupeApprovals(candidates)
    .filter((item) => matchesTenantContext(item, tenantId, organizationId))
    .filter((item) => canRoleViewApproval(item, effectiveRole))
    .map((item) => applyDecisionState(item, decisionStateById, now))
    .sort((left, right) => compareApprovalItems(left, right, now))
    .slice(0, resultLimit);
  const warnings = normalizeWarnings(errors);

  return {
    items,
    filters: buildFilters(items),
    counts: buildCounts(items, now),
    generatedAt: new Date(now).toISOString(),
    limit: resultLimit,
    role: effectiveRole,
    tenantId: tenantId || null,
    organizationId: organizationId || null,
    sourceStatus: warnings.length ? "partial" : "complete",
    sourceWarnings: warnings,
    sources: [
      notifications.length ? "Action Inbox and Notification Rules" : null,
      boundedWorkflows.length ? "Workflow Engine" : null,
      boundedDrafts.length ? "Message Composer" : null,
      boundedCampaigns.length ? "Buyer Campaigns" : null,
    ].filter(Boolean),
    compatibilityMode: true,
    executionNotice:
      "Approval persistence is not available yet. Review and defer state is session-only unless an existing safe command is explicitly connected.",
  };
}

export function getApprovalItemsForFilter(readModel, filterId = "all") {
  const items = Array.isArray(readModel?.items) ? readModel.items : [];
  if (filterId === "all") return items;
  const filter = readModel?.filters?.find((entry) => entry.id === filterId);
  if (!filter) return [];
  return items.filter((item) => filter.types.includes(item.approvalType));
}
