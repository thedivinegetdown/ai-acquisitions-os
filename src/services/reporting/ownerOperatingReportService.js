import { getBusinessDate } from "../../utils/dates";

const AVAILABLE = "available";
const UNAVAILABLE = "unavailable";
const OPEN_WORK_STATUSES = new Set(["open", "pending"]);
const COMPLETED_WORK_STATUSES = new Set(["complete", "completed", "done"]);
const LOST_OFFER_STATUSES = new Set(["rejected", "withdrawn"]);
const ACTIVE_PIPELINE_STAGES = new Set([
  "new lead",
  "contacted",
  "offer sent",
  "under contract",
]);

function available(value, details = {}) {
  return { status: AVAILABLE, value, ...details };
}

function unavailable(reason, details = {}) {
  return { status: UNAVAILABLE, value: null, reason, ...details };
}

function isRecordForOrganization(record, organizationId) {
  return Boolean(
    record &&
      organizationId &&
      String(record.organization_id || "") === String(organizationId)
  );
}

function beforeOrAtEvaluation(record, evaluatedAt) {
  if (!record?.created_at) return true;
  const createdAt = new Date(record.created_at).getTime();
  return Number.isFinite(createdAt) && createdAt <= evaluatedAt.getTime();
}

function ownedRecords(records, organizationId, evaluatedAt) {
  if (!Array.isArray(records)) return null;
  return records.filter(
    (record) =>
      isRecordForOrganization(record, organizationId) &&
      beforeOrAtEvaluation(record, evaluatedAt)
  );
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function dateKey(value) {
  const key = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : "";
}

function workObligationKey(record, index) {
  const action = String(record.action || "").trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ");
  const due = dateKey(record.due);
  return record.dealId && action && due
    ? `${record.dealId}:${action}:${due}`
    : `${record.sourceType}:${record.sourceId || index}`;
}

function buildWorkMetrics({ deals, sellerTasks, sequenceSteps }, evaluationDate, evaluationUtcDate) {
  if (!deals || !sellerTasks || !sequenceSteps) {
    const reason = "Deal, seller task, and sequence sources are required for complete workload counts.";
    return {
      due: unavailable(reason),
      overdue: unavailable(reason),
      completed: unavailable(reason),
      waiting: unavailable(reason),
    };
  }

  const work = [
    ...sellerTasks.map((record) => ({ ...record, sourceType: "seller-task", sourceId: record.id, dealId: record.deal_id, action: record.title, due: record.due_at })),
    ...sequenceSteps.map((record) => ({ ...record, sourceType: "sequence-step", sourceId: record.id, dealId: record.deal_id, action: record.action_type, due: record.due_date })),
    ...deals.filter((deal) =>
      deal.id && String(deal.next_action || "").trim() &&
      normalizeStatus(deal.stage) !== "closed" &&
      !COMPLETED_WORK_STATUSES.has(normalizeStatus(deal.status))
    ).map((deal) => ({ ...deal, sourceType: "deal", sourceId: deal.id, dealId: deal.id,
      action: deal.next_action, due: deal.next_action_due_date || deal.due_date || deal.follow_up_date,
      status: "open" })),
  ];
  const seen = new Set();
  const open = work.filter((record, index) => {
    if (!OPEN_WORK_STATUSES.has(normalizeStatus(record.status))) return false;
    const key = workObligationKey(record, index);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const completed = work.filter((record) =>
    COMPLETED_WORK_STATUSES.has(normalizeStatus(record.status))
  );

  return {
    due: available(
      open.filter((record) => dateKey(record.due) === (
        record.sourceType === "seller-task" ? evaluationUtcDate : evaluationDate
      )).length
    ),
    overdue: available(
      open.filter((record) => {
        const due = dateKey(record.due);
        const comparisonDate = record.sourceType === "seller-task"
          ? evaluationUtcDate
          : evaluationDate;
        return due && due < comparisonDate;
      }).length
    ),
    completed: available(completed.length),
    waiting: available(
      open.filter((record) => {
        const due = dateKey(record.due);
        const comparisonDate = record.sourceType === "seller-task"
          ? evaluationUtcDate
          : evaluationDate;
        return due && due > comparisonDate;
      }).length
    ),
  };
}

function latestByDeal(records = []) {
  const latest = new Map();
  records.forEach((record) => {
    if (!record?.deal_id) return;
    const current = latest.get(String(record.deal_id));
    const revision = Number(record.revision_number || 0);
    const currentRevision = Number(current?.revision_number || 0);
    const createdAt = new Date(record.created_at || 0).getTime() || 0;
    const currentCreatedAt = new Date(current?.created_at || 0).getTime() || 0;
    const shouldReplace =
      !current ||
      revision > currentRevision ||
      (revision === currentRevision && createdAt > currentCreatedAt) ||
      (revision === currentRevision &&
        createdAt === currentCreatedAt &&
        String(record.id || "").localeCompare(String(current.id || "")) > 0);
    if (shouldReplace) latest.set(String(record.deal_id), record);
  });
  return latest;
}

function distinctDealCount(records = [], predicate = () => true) {
  return new Set(
    records.filter(predicate).map((record) => record.deal_id).filter(Boolean).map(String)
  ).size;
}

function buildFunnelMetrics({ deals, offerRevisions, closingRevisions }) {
  const activeOpportunities = deals
    ? deals.filter((deal) => ACTIVE_PIPELINE_STAGES.has(normalizeStatus(deal.stage))).length
    : null;
  const latestOffers = offerRevisions ? latestByDeal(offerRevisions) : null;
  const latestClosings = closingRevisions ? latestByDeal(closingRevisions) : null;

  let cancelledLost = unavailable(
    "Offer and closing histories are both required to classify cancelled or lost outcomes."
  );
  if (latestOffers && latestClosings) {
    const outcomeDeals = new Set();
    latestOffers.forEach((revision, dealId) => {
      if (LOST_OFFER_STATUSES.has(normalizeStatus(revision.status))) outcomeDeals.add(dealId);
    });
    latestClosings.forEach((revision, dealId) => {
      if (normalizeStatus(revision.status) === "cancelled") outcomeDeals.add(dealId);
    });
    cancelledLost = available(outcomeDeals.size);
  }

  return {
    opportunities: deals
      ? available(deals.length)
      : unavailable("Deal source is unavailable."),
    activeOpportunities: deals
      ? available(activeOpportunities)
      : unavailable("Deal source is unavailable."),
    qualifiedOpportunities: unavailable(
      "No durable qualification decision or qualification timestamp is persisted."
    ),
    offersCreated: offerRevisions
      ? available(distinctDealCount(offerRevisions))
      : unavailable("Offer history is unavailable."),
    offersSent: offerRevisions
      ? available(
          distinctDealCount(
            offerRevisions,
            (revision) => normalizeStatus(revision.status) === "sent"
          )
        )
      : unavailable("Offer history is unavailable."),
    acceptedOffers: offerRevisions
      ? available(
          distinctDealCount(
            offerRevisions,
            (revision) => normalizeStatus(revision.status) === "accepted"
          )
        )
      : unavailable("Offer history is unavailable."),
    contracts: closingRevisions
      ? available(distinctDealCount(closingRevisions))
      : unavailable("Closing history is unavailable."),
    closed: latestClosings
      ? available(
          [...latestClosings.values()].filter(
            (revision) => normalizeStatus(revision.status) === "closed"
          ).length
        )
      : unavailable("Closing history is unavailable."),
    cancelledLost,
  };
}

function validMoney(value) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function financialMetric(records, selector, label) {
  if (records.length === 0) return available(0, { applicableCount: 0, knownCount: 0 });
  const values = records.map(selector);
  const knownValues = values.filter((value) => value !== null);
  if (knownValues.length !== records.length) {
    return unavailable(`${label} is missing for one or more applicable closing records.`, {
      applicableCount: records.length,
      knownCount: knownValues.length,
    });
  }
  return available(knownValues.reduce((sum, value) => sum + value, 0), {
    applicableCount: records.length,
    knownCount: knownValues.length,
  });
}

function buildFinancialMetrics(closingRevisions) {
  if (!closingRevisions) {
    const reason = "Closing history is unavailable.";
    return {
      expectedProceeds: unavailable(reason),
      realizedProceeds: unavailable(reason),
      realizedCosts: unavailable(reason),
      realizedNetContribution: unavailable(reason),
    };
  }

  const latestClosings = [...latestByDeal(closingRevisions).values()];
  const active = latestClosings.filter(
    (revision) => normalizeStatus(revision.status) === "under_contract"
  );
  const closed = latestClosings.filter(
    (revision) => normalizeStatus(revision.status) === "closed"
  );

  return {
    expectedProceeds: financialMetric(
      active,
      (revision) =>
        validMoney(revision.expected_proceeds) ?? validMoney(revision.assignment_fee),
      "Expected proceeds or assignment fee"
    ),
    realizedProceeds: financialMetric(
      closed,
      (revision) => validMoney(revision.actual_realized_proceeds),
      "Realized proceeds"
    ),
    realizedCosts: financialMetric(
      closed,
      (revision) => validMoney(revision.actual_costs),
      "Realized costs"
    ),
    realizedNetContribution: financialMetric(
      closed,
      (revision) => {
        const proceeds = validMoney(revision.actual_realized_proceeds);
        const costs = validMoney(revision.actual_costs);
        return proceeds === null || costs === null ? null : proceeds - costs;
      },
      "Realized proceeds or costs"
    ),
  };
}

function messageConversationKey(message) {
  if (message.deal_id) return `deal:${message.deal_id}`;
  const phone = String(message.phone || "").replace(/\D/g, "");
  return phone ? `phone:${phone}` : "";
}

function responseIntervals(messages, waitingDirection, responseDirection) {
  const groups = new Map();
  messages.forEach((message) => {
    const key = messageConversationKey(message);
    const timestamp = new Date(message.created_at || "").getTime();
    if (!key || !Number.isFinite(timestamp)) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...message, timestamp });
  });

  const intervals = [];
  const pending = [];
  groups.forEach((group, key) => {
    group.sort(
      (left, right) =>
        left.timestamp - right.timestamp ||
        String(left.id || "").localeCompare(String(right.id || ""))
    );
    let waitingAt = null;
    group.forEach((message) => {
      if (message.direction === waitingDirection && waitingAt === null) {
        waitingAt = message.timestamp;
      } else if (message.direction === responseDirection && waitingAt !== null) {
        intervals.push(message.timestamp - waitingAt);
        waitingAt = null;
      }
    });
    if (waitingAt !== null) pending.push({ key, waitingAt });
  });
  return { intervals, pending };
}

function averageHoursMetric(intervals, reason) {
  if (!intervals.length) return unavailable(reason, { sampleSize: 0 });
  const total = intervals.reduce((sum, interval) => sum + interval, 0);
  return available(total / intervals.length / (1000 * 60 * 60), {
    sampleSize: intervals.length,
  });
}

function buildResponsivenessMetrics(messages, evaluatedAt) {
  if (!messages) {
    const reason = "Communication history is unavailable.";
    return {
      averageSellerResponseHours: unavailable(reason),
      averageTeamFollowUpHours: unavailable(reason),
      awaitingTeamFollowUp: unavailable(reason),
      oldestAwaitingTeamFollowUpHours: unavailable(reason),
    };
  }

  const durableMessages = messages.filter(
    (message) =>
      ["inbound", "outbound"].includes(message.direction) &&
      Number.isFinite(new Date(message.created_at || "").getTime())
  );
  const seller = responseIntervals(durableMessages, "outbound", "inbound");
  const team = responseIntervals(durableMessages, "inbound", "outbound");
  const oldestWaitingAt = team.pending.reduce(
    (oldest, item) => (oldest === null || item.waitingAt < oldest ? item.waitingAt : oldest),
    null
  );

  return {
    averageSellerResponseHours: averageHoursMetric(
      seller.intervals,
      "No timestamped outbound-to-inbound seller response pair is persisted."
    ),
    averageTeamFollowUpHours: averageHoursMetric(
      team.intervals,
      "No timestamped inbound-to-outbound team follow-up pair is persisted."
    ),
    awaitingTeamFollowUp: available(team.pending.length),
    oldestAwaitingTeamFollowUpHours:
      oldestWaitingAt === null
        ? unavailable("No seller reply is currently awaiting a timestamped team follow-up.")
        : available(Math.max(0, evaluatedAt.getTime() - oldestWaitingAt) / (1000 * 60 * 60)),
  };
}

function validEvaluationTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("A valid evaluation time is required.");
  return date;
}

export function buildOwnerOperatingReport({
  businessTimeZone,
  organizationId,
  evaluatedAt,
  sources = {},
  sourceErrors = {},
} = {}) {
  if (!organizationId) throw new Error("An organization ID is required for the owner report.");
  const evaluationTime = validEvaluationTime(evaluatedAt);
  const evaluationDate = getBusinessDate(evaluationTime, businessTimeZone);
  const evaluationUtcDate = evaluationTime.toISOString().slice(0, 10);
  const scoped = {
    deals: ownedRecords(sources.deals, organizationId, evaluationTime),
    sellerTasks: ownedRecords(sources.sellerTasks, organizationId, evaluationTime),
    sequenceSteps: ownedRecords(sources.sequenceSteps, organizationId, evaluationTime),
    offerRevisions: ownedRecords(sources.offerRevisions, organizationId, evaluationTime),
    closingRevisions: ownedRecords(sources.closingRevisions, organizationId, evaluationTime),
    messages: ownedRecords(sources.messages, organizationId, evaluationTime),
  };
  const warnings = Object.entries(sourceErrors)
    .filter(([, value]) => Boolean(value))
    .map(([source, message]) => ({ source, message: String(message) }));

  return {
    organizationId,
    evaluatedAt: evaluationTime.toISOString(),
    sourceStatus: warnings.length ? "partial" : "complete",
    sourceWarnings: warnings,
    work: buildWorkMetrics(scoped, evaluationDate, evaluationUtcDate),
    funnel: buildFunnelMetrics(scoped),
    responsiveness: buildResponsivenessMetrics(scoped.messages, evaluationTime),
    financial: buildFinancialMetrics(scoped.closingRevisions),
    unavailableFacts: [
      {
        metric: "Qualified opportunities",
        missingFact: "A durable qualification decision and the time it became effective.",
        futureCapture: "Persist a tenant-owned qualification lifecycle event or immutable status revision.",
      },
    ],
  };
}
