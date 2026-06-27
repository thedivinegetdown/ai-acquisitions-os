import { getWorkflowTemplate } from "./workflowTemplates";
import { evaluateWorkflowRules } from "./workflowRules";
import { scheduleWorkflowSteps, classifyWorkflowTimeline } from "./workflowScheduler";
import { createApprovalQueue } from "./workflowRunner";
import {
  createWorkflowHistory,
  getRecentlyCompletedWorkflows,
} from "./workflowHistory";

function createWorkflow(rule) {
  const template = getWorkflowTemplate(rule.templateId);

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    priority: rule.priority,
    status: rule.shouldRecommend ? "recommended" : "blocked",
    trigger: template.trigger,
    conditions: rule.conditions,
    actions: template.actions,
    approvalRequired: true,
    generatedAt: new Date().toISOString(),
  };
}

export function evaluateWorkflows(input = {}) {
  const rules = evaluateWorkflowRules(input);
  const workflows = rules
    .filter((rule) => rule.shouldRecommend)
    .map(createWorkflow);
  const fallbackWorkflow =
    workflows.length === 0
      ? [createWorkflow({ templateId: "custom-workflow", priority: "Low", conditions: [], shouldRecommend: true })]
      : [];
  const activeWorkflows = [...workflows, ...fallbackWorkflow];
  const workflowSteps = activeWorkflows.flatMap(scheduleWorkflowSteps);
  const timeline = classifyWorkflowTimeline(workflowSteps);
  const approvalQueue = createApprovalQueue(activeWorkflows);

  return {
    activeWorkflows,
    pendingApprovals: approvalQueue,
    blockedWorkflows: rules.filter((rule) => !rule.shouldRecommend).map(createWorkflow),
    recentlyCompletedWorkflows: getRecentlyCompletedWorkflows(activeWorkflows),
    suggestedNextWorkflows: activeWorkflows.slice(0, 3),
    timeline,
    history: createWorkflowHistory(activeWorkflows),
    generatedAt: new Date().toISOString(),
  };
}
