import { normalizeStrategyTimeline } from "../../asset-strategy/strategyTimeline";
import { toSafeDate } from "../../../utils/dates";
import { uniqueStrings } from "../../../utils/text";
import { ACTION_WINDOW_TYPES, COST_OF_DELAY_LEVELS, PRIORITIZATION_BASIS_TYPES } from "./prioritizationContracts";

const DAY_MS = 86400000;
const DIRECT_REVIEW_BASES = new Set([
  PRIORITIZATION_BASIS_TYPES.CONFLICT_REVIEW,
  PRIORITIZATION_BASIS_TYPES.MISSING_INFORMATION,
  PRIORITIZATION_BASIS_TYPES.READINESS_BLOCKER,
  PRIORITIZATION_BASIS_TYPES.MANUAL_REVIEW,
]);
const STRATEGY_BASES = new Set([
  PRIORITIZATION_BASIS_TYPES.RESIDENTIAL_STRATEGY_GUIDANCE,
  PRIORITIZATION_BASIS_TYPES.VACANT_LAND_STRATEGY_GUIDANCE,
]);

function timestamp(value, label, warnings) {
  if (!value) return null;
  const parsed = toSafeDate(value);
  if (!parsed) warnings.push(`${label} was invalid and was ignored.`);
  return parsed?.toISOString() || null;
}

function calendarDaysUntil(value, evaluatedTimestamp) {
  const target = toSafeDate(value);
  const evaluated = toSafeDate(evaluatedTimestamp);
  if (!target || !evaluated) return null;
  const targetDay = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  const evaluatedDay = Date.UTC(evaluated.getUTCFullYear(), evaluated.getUTCMonth(), evaluated.getUTCDate());
  return Math.round((targetDay - evaluatedDay) / DAY_MS);
}

function exactHoursUntil(value, evaluatedTimestamp) {
  const target = toSafeDate(value);
  const evaluated = toSafeDate(evaluatedTimestamp);
  return target && evaluated ? (target.getTime() - evaluated.getTime()) / 3600000 : null;
}

function timelineDays(value, context, evaluatedTimestamp) {
  if (context?.state === "present" && Number.isFinite(Number(context.days))) return Number(context.days);
  const normalized = normalizeStrategyTimeline(value, evaluatedTimestamp);
  return normalized.state === "present" ? normalized.days : null;
}

function policy(level, windowType, explanation, policyDerived = true) {
  return { level, windowType, explanation, policyDerived };
}

function duePolicy(dueTimestamp, evaluatedTimestamp) {
  const days = calendarDaysUntil(dueTimestamp, evaluatedTimestamp);
  if (days === null) return null;
  if (days < 0) return policy(COST_OF_DELAY_LEVELS.CRITICAL, ACTION_WINDOW_TYPES.OVERDUE, "The real source due date has already passed.", false);
  if (days === 0) return policy(COST_OF_DELAY_LEVELS.HIGH, ACTION_WINDOW_TYPES.TODAY, "The real source action is due today.", false);
  if (days <= 3) return policy(COST_OF_DELAY_LEVELS.MODERATE, ACTION_WINDOW_TYPES.BEFORE_DEADLINE, "The real source action is due within three days.", false);
  return policy(COST_OF_DELAY_LEVELS.LOW, ACTION_WINDOW_TYPES.SCHEDULED, "A real future action date is scheduled more than three days away.", false);
}

function approvalPolicy(expirationTimestamp, dueTimestamp, evaluatedTimestamp) {
  const source = expirationTimestamp || dueTimestamp;
  if (!source) return policy(COST_OF_DELAY_LEVELS.MODERATE, ACTION_WINDOW_TYPES.WITHIN_3_DAYS, "A real pending approval requires review, but no expiration or action-due timestamp is represented.");
  const hours = exactHoursUntil(source, evaluatedTimestamp);
  if (hours === null) return null;
  if (hours < 0) return policy(COST_OF_DELAY_LEVELS.CRITICAL, ACTION_WINDOW_TYPES.OVERDUE, "The real approval expiration or action-due timestamp has passed.", false);
  if (hours <= 24) return policy(COST_OF_DELAY_LEVELS.HIGH, ACTION_WINDOW_TYPES.BEFORE_DEADLINE, "The real approval expiration or action-due timestamp is within 24 hours.", false);
  if (hours <= 72) return policy(COST_OF_DELAY_LEVELS.MODERATE, ACTION_WINDOW_TYPES.BEFORE_DEADLINE, "The real approval expiration or action-due timestamp is within three days.", false);
  return policy(COST_OF_DELAY_LEVELS.LOW, ACTION_WINDOW_TYPES.SCHEDULED, "The real approval expiration or action-due timestamp is more than three days away.", false);
}

function timelinePolicy(days, { ready = false, sourceDueTimestamp = null } = {}) {
  if (days !== null && days <= 30) return policy(COST_OF_DELAY_LEVELS.HIGH, ACTION_WINDOW_TYPES.TODAY, "The explicit seller timeline is 30 days or less, so this review should receive attention today.");
  if (days !== null && days <= 90) return policy(COST_OF_DELAY_LEVELS.MODERATE, ACTION_WINDOW_TYPES.WITHIN_3_DAYS, "The explicit seller timeline is between 31 and 90 days.");
  if (ready) return policy(COST_OF_DELAY_LEVELS.MODERATE, ACTION_WINDOW_TYPES.WITHIN_3_DAYS, "Offer preparation is ready for human review, but no immediate external deadline is represented.");
  if (days !== null && days > 90) return sourceDueTimestamp
    ? policy(COST_OF_DELAY_LEVELS.LOW, ACTION_WINDOW_TYPES.SCHEDULED, "The seller timeline is longer than 90 days and a real future follow-up is scheduled.", false)
    : policy(COST_OF_DELAY_LEVELS.LOW, ACTION_WINDOW_TYPES.NO_IMMEDIATE_ACTION, "The seller timeline is longer than 90 days and no near-term deadline is represented.");
  return policy(COST_OF_DELAY_LEVELS.MODERATE, ACTION_WINDOW_TYPES.WITHIN_3_DAYS, "The seller timeline is unknown, so near-term review is appropriate without inventing a deadline.");
}

export function evaluatePrioritizationPolicy({
  approvalContext = {},
  conflictReadModel = {},
  evaluatedTimestamp,
  missingInformationReadModel = {},
  recommendationBasis = {},
  sellerReplyContext = {},
  sellerTimelineContext = null,
  sellerTimelineValue = null,
  timingContext = {},
} = {}) {
  const warnings = [];
  const evaluated = timestamp(evaluatedTimestamp, "Evaluation timestamp", warnings);
  const basisType = recommendationBasis.basisType || PRIORITIZATION_BASIS_TYPES.UNAVAILABLE;
  const sourceDueTimestamp = timestamp(timingContext.sourceDueTimestamp || timingContext.dueAt || approvalContext.actionDueAt, "Source due timestamp", warnings);
  const sourceExpirationTimestamp = timestamp(approvalContext.expirationTimestamp, "Approval expiration timestamp", warnings);
  const sourceEventTimestamp = timestamp(sellerReplyContext.eventTimestamp, "Seller reply timestamp", warnings);
  const days = timelineDays(sellerTimelineValue, sellerTimelineContext, evaluated);
  let result = null;

  if (!evaluated || basisType === PRIORITIZATION_BASIS_TYPES.UNAVAILABLE) {
    result = policy(COST_OF_DELAY_LEVELS.UNAVAILABLE, ACTION_WINDOW_TYPES.UNAVAILABLE, "No valid recommendation and supplied evaluation timestamp are available for deterministic timing.", false);
  } else if (basisType === PRIORITIZATION_BASIS_TYPES.OVERDUE_ACTION) {
    result = sourceDueTimestamp
      ? policy(COST_OF_DELAY_LEVELS.CRITICAL, ACTION_WINDOW_TYPES.OVERDUE, "A real recommended action is already overdue.", false)
      : policy(COST_OF_DELAY_LEVELS.UNAVAILABLE, ACTION_WINDOW_TYPES.UNAVAILABLE, "The overdue recommendation has no valid source due timestamp.", false);
  } else if (basisType === PRIORITIZATION_BASIS_TYPES.SELLER_REPLY) {
    result = policy(COST_OF_DELAY_LEVELS.HIGH, ACTION_WINDOW_TYPES.ACT_NOW, "A real linked inbound seller reply requires prompt operator attention without creating a response deadline.");
  } else if (basisType === PRIORITIZATION_BASIS_TYPES.DUE_ACTION) {
    result = duePolicy(sourceDueTimestamp, evaluated) || policy(COST_OF_DELAY_LEVELS.UNAVAILABLE, ACTION_WINDOW_TYPES.UNAVAILABLE, "The due-action recommendation has no valid source due timestamp.", false);
  } else if (basisType === PRIORITIZATION_BASIS_TYPES.SCHEDULED_FOLLOW_UP) {
    const scheduledDays = calendarDaysUntil(sourceDueTimestamp, evaluated);
    result = scheduledDays === null
      ? policy(COST_OF_DELAY_LEVELS.UNAVAILABLE, ACTION_WINDOW_TYPES.UNAVAILABLE, "The scheduled follow-up has no valid source due timestamp.", false)
      : scheduledDays < 0
        ? policy(COST_OF_DELAY_LEVELS.CRITICAL, ACTION_WINDOW_TYPES.OVERDUE, "The real scheduled follow-up date has passed.", false)
        : policy(COST_OF_DELAY_LEVELS.LOW, ACTION_WINDOW_TYPES.SCHEDULED, "A real future follow-up is scheduled and no earlier operational action is represented.", false);
  } else if (basisType === PRIORITIZATION_BASIS_TYPES.PENDING_APPROVAL) {
    result = approvalPolicy(sourceExpirationTimestamp, sourceDueTimestamp, evaluated) || policy(COST_OF_DELAY_LEVELS.UNAVAILABLE, ACTION_WINDOW_TYPES.UNAVAILABLE, "The approval timing context could not be evaluated safely.", false);
  } else if (DIRECT_REVIEW_BASES.has(basisType)) {
    const conflictIsAdvisory = basisType === PRIORITIZATION_BASIS_TYPES.CONFLICT_REVIEW && recommendationBasis.conflictIds?.length && !recommendationBasis.conflictIds.some((id) => (conflictReadModel.blockingConflicts || []).some((entry) => entry.conflictId === id));
    const missingIsAdvisory = basisType === PRIORITIZATION_BASIS_TYPES.MISSING_INFORMATION && recommendationBasis.missingInformationIds?.length && !recommendationBasis.missingInformationIds.some((id) => (missingInformationReadModel.blockingItems || []).some((entry) => entry.itemId === id));
    result = conflictIsAdvisory || missingIsAdvisory
      ? policy(COST_OF_DELAY_LEVELS.LOW, ACTION_WINDOW_TYPES.NO_IMMEDIATE_ACTION, "The selected review item is advisory and has no direct deadline.")
      : days !== null && days <= 30
        ? policy(COST_OF_DELAY_LEVELS.HIGH, ACTION_WINDOW_TYPES.TODAY, "A blocking review condition and explicit seller timeline of 30 days or less require attention today.")
        : policy(COST_OF_DELAY_LEVELS.MODERATE, ACTION_WINDOW_TYPES.WITHIN_3_DAYS, "A blocking review condition creates decision friction but no immediate explicit deadline.");
  } else if (STRATEGY_BASES.has(basisType)) {
    result = timelinePolicy(days, { sourceDueTimestamp });
  } else if (basisType === PRIORITIZATION_BASIS_TYPES.READY_FOR_OFFER_PREPARATION) {
    result = timelinePolicy(days, { ready: true, sourceDueTimestamp });
  } else if (basisType === PRIORITIZATION_BASIS_TYPES.ASSET_CLASSIFICATION) {
    result = policy(COST_OF_DELAY_LEVELS.MODERATE, ACTION_WINDOW_TYPES.WITHIN_3_DAYS, "Asset classification review is required before strategy analysis can continue.");
  } else if (basisType === PRIORITIZATION_BASIS_TYPES.COMPATIBILITY_FALLBACK) {
    const traceable = Boolean(recommendationBasis.triggerId || recommendationBasis.evidenceIds?.length);
    result = traceable
      ? policy(COST_OF_DELAY_LEVELS.LOW, ACTION_WINDOW_TYPES.NO_IMMEDIATE_ACTION, "The traceable fallback recommendation has no direct near-term timing trigger.")
      : policy(COST_OF_DELAY_LEVELS.UNAVAILABLE, ACTION_WINDOW_TYPES.UNAVAILABLE, "The fallback recommendation lacks a traceable timing basis.", false);
  } else {
    result = policy(COST_OF_DELAY_LEVELS.UNAVAILABLE, ACTION_WINDOW_TYPES.UNAVAILABLE, "The recommendation basis has no approved DI-05 timing policy.", false);
  }

  return {
    ...result,
    basisType,
    sourceDueTimestamp,
    sourceExpirationTimestamp,
    sourceEventTimestamp,
    sellerTimelineDays: days,
    directOperationalTrigger: [PRIORITIZATION_BASIS_TYPES.SELLER_REPLY, PRIORITIZATION_BASIS_TYPES.OVERDUE_ACTION, PRIORITIZATION_BASIS_TYPES.DUE_ACTION, PRIORITIZATION_BASIS_TYPES.PENDING_APPROVAL].includes(basisType),
    warnings: uniqueStrings(warnings),
  };
}
