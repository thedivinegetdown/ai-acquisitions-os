import { daysSince } from "../../utils/dates";
import { normalizeText, safeTrim, uniqueStrings } from "../../utils/text";

export const SEQUENCE_TYPES = [
  "Cold lead follow-up",
  "Warm seller nurture",
  "Offer follow-up",
  "Dead lead reactivation",
  "Closing follow-up",
  "Custom",
];

export const SEQUENCE_STATUSES = ["Draft", "Ready", "Paused", "Completed"];
export const SEQUENCE_CHANNELS = ["SMS", "Call", "Email", "Manual review"];
export const STEP_STATUSES = ["Pending", "Ready", "Completed", "Skipped"];

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);

  return date.toISOString().slice(0, 10);
}

function getLatestActivityDate(messages = []) {
  return messages[messages.length - 1]?.created_at || null;
}

function buildStep(stepNumber, timing, channel, description, status = "Pending") {
  return {
    stepNumber,
    timing,
    channel,
    description,
    status,
  };
}

function getSequenceTemplate(sequenceType) {
  if (sequenceType === "Warm seller nurture") {
    return [
      buildStep(1, "Today", "SMS", "Copy/edit a soft discovery message.", "Ready"),
      buildStep(2, "In 2 days", "Call", "Call to clarify seller timeline and motivation."),
      buildStep(3, "In 5 days", "SMS", "Send a value-first check-in."),
    ];
  }

  if (sequenceType === "Offer follow-up") {
    return [
      buildStep(1, "Today", "Call", "Call to review the offer conversation.", "Ready"),
      buildStep(2, "Tomorrow", "SMS", "Copy/edit a short offer follow-up message."),
      buildStep(3, "In 3 days", "Manual review", "Review objections and update offer strategy."),
    ];
  }

  if (sequenceType === "Dead lead reactivation") {
    return [
      buildStep(1, "Today", "SMS", "Copy/edit a low-pressure reactivation message.", "Ready"),
      buildStep(2, "In 7 days", "Call", "Attempt one final reactivation call."),
      buildStep(3, "In 14 days", "Manual review", "Decide whether to keep or archive lead."),
    ];
  }

  if (sequenceType === "Closing follow-up") {
    return [
      buildStep(1, "Today", "Manual review", "Review closing checklist and blockers.", "Ready"),
      buildStep(2, "Tomorrow", "Call", "Call title/buyer internally if needed."),
      buildStep(3, "In 3 days", "Manual review", "Confirm funding, title, and closing documents."),
    ];
  }

  if (sequenceType === "Custom") {
    return [
      buildStep(1, "Today", "Manual review", "Define the next manual automation step.", "Ready"),
    ];
  }

  return [
    buildStep(1, "Today", "SMS", "Copy/edit an initial follow-up message.", "Ready"),
    buildStep(2, "In 2 days", "Call", "Call if there is no reply."),
    buildStep(3, "In 5 days", "SMS", "Copy/edit a second follow-up message."),
  ];
}

export function recommendSequence({ deal, messages = [], leadPriority, followUpPlan } = {}) {
  const stage = normalizeText(deal?.stage);
  const priorityLabel = leadPriority?.priorityLabel || "";
  const engagement = followUpPlan?.urgency || "";
  const latestActivityDate = getLatestActivityDate(messages);
  const inactiveDays = daysSince(latestActivityDate);

  if (stage.includes("contract")) {
    return {
      sequenceType: "Closing follow-up",
      urgency: "High",
      recommendedChannel: "Manual review",
      reason: "Transaction appears active and should be tracked through closing.",
    };
  }

  if (priorityLabel === "Critical") {
    return {
      sequenceType: "Warm seller nurture",
      urgency: "Critical",
      recommendedChannel: "Call",
      reason: "Critical priority leads should get same-day human follow-up.",
    };
  }

  if (stage.includes("offer")) {
    return {
      sequenceType: "Offer follow-up",
      urgency: "High",
      recommendedChannel: "Call",
      reason: "Offer discussion is active and should be followed up quickly.",
    };
  }

  if (inactiveDays !== null && inactiveDays >= 14) {
    return {
      sequenceType: "Dead lead reactivation",
      urgency: "Medium",
      recommendedChannel: "SMS",
      reason: "No recent activity suggests a reactivation sequence.",
    };
  }

  if (engagement === "Medium" || engagement === "High") {
    return {
      sequenceType: "Warm seller nurture",
      urgency: engagement,
      recommendedChannel: followUpPlan?.channel || "SMS",
      reason: "Seller appears warm but not fully ready.",
    };
  }

  return {
    sequenceType: "Cold lead follow-up",
    urgency: "Medium",
    recommendedChannel: "SMS",
    reason: "Lead needs a structured follow-up cadence.",
  };
}

export function buildSequencePlan({
  deal,
  messages = [],
  leadPriority,
  followUpPlan,
  sequenceDraft = {},
} = {}) {
  const recommendation = recommendSequence({
    deal,
    messages,
    leadPriority,
    followUpPlan,
  });
  const sequenceType = sequenceDraft.sequenceType || recommendation.sequenceType;
  const steps = buildSequenceSteps({
    sequenceType,
    nextStep: sequenceDraft.nextStep,
    preferredChannel: sequenceDraft.preferredChannel || recommendation.recommendedChannel,
  });

  return {
    recommendedSequence: sequenceDraft.sequenceName || sequenceType,
    sequenceType,
    urgency: recommendation.urgency,
    recommendedChannel:
      sequenceDraft.preferredChannel || recommendation.recommendedChannel,
    nextFollowUpDate: sequenceDraft.nextFollowUpDate || addDays(0),
    steps,
    reason: recommendation.reason,
  };
}

export function buildSequenceSteps({
  sequenceType,
  nextStep,
  preferredChannel,
} = {}) {
  const steps = getSequenceTemplate(sequenceType);

  if (nextStep) {
    return [
      {
        ...steps[0],
        channel: preferredChannel || steps[0].channel,
        description: safeTrim(nextStep),
      },
      ...steps.slice(1),
    ];
  }

  return steps.map((step, index) =>
    index === 0 && preferredChannel
      ? {
          ...step,
          channel: preferredChannel,
        }
      : step
  );
}

export function getSequenceRisks({ sequenceDraft = {}, messages = [] } = {}) {
  const risks = [];
  const missingData = [];

  if (!sequenceDraft.sequenceName) {
    missingData.push("Sequence name");
  }

  if (!sequenceDraft.nextStep) {
    missingData.push("Next step");
  }

  if (!sequenceDraft.nextFollowUpDate) {
    missingData.push("Next follow-up date");
  }

  if (messages.length === 0) {
    risks.push("No conversation history is available for sequence timing.");
  }

  if (sequenceDraft.sequenceStatus === "Ready" && missingData.length > 0) {
    risks.push("Sequence is marked ready but still has missing planning fields.");
  }

  return {
    risks: uniqueStrings(risks),
    missingData: uniqueStrings(missingData),
  };
}
