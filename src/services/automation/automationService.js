import { analyzeConversation } from "../conversationAnalysis";
import { planFollowUp } from "../followUpPlanner";
import { prioritizeLead } from "../leadPriority";
import {
  buildSequencePlan,
  getSequenceRisks,
} from "./sequencePlannerService";
import {
  buildAutomationTaskSuggestions,
  getRecommendedTaskAction,
} from "./taskAutomationService";

export function analyzeAutomationPlan({
  deal,
  messages = [],
  sequenceDraft = {},
} = {}) {
  const conversationAnalysis = analyzeConversation(messages);
  const leadPriority = prioritizeLead({ deal, messages });
  const followUpPlan = planFollowUp({ deal, messages });
  const sequencePlan = buildSequencePlan({
    deal,
    messages,
    leadPriority,
    followUpPlan,
    sequenceDraft,
  });
  const riskAnalysis = getSequenceRisks({ sequenceDraft, messages });
  const taskSuggestions = buildAutomationTaskSuggestions({ sequencePlan });
  const recommendedNextAction =
    riskAnalysis.missingData.length > 0
      ? "Complete missing sequence planning fields before marking ready."
      : getRecommendedTaskAction({ sequencePlan });

  return {
    recommendedSequence: sequencePlan.recommendedSequence,
    sequenceType: sequencePlan.sequenceType,
    urgency: sequencePlan.urgency,
    recommendedChannel: sequencePlan.recommendedChannel,
    nextFollowUpDate: sequencePlan.nextFollowUpDate,
    steps: sequencePlan.steps,
    taskSuggestions,
    risks: riskAnalysis.risks,
    missingData: riskAnalysis.missingData,
    recommendedNextAction,
    summary: `${sequencePlan.reason} Messages are not sent automatically; use this as an internal planning guide.`,
    generatedAt: new Date().toISOString(),
    context: {
      conversationAnalysis,
      leadPriority,
      followUpPlan,
    },
  };
}
