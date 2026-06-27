import { daysSince } from "../../../utils/dates";

export function scheduleWorkflowSteps(workflow) {
  return workflow.actions.map((action, index) => {
    const daysOffset = index === 0 ? 0 : index * 2;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysOffset);

    return {
      id: `${workflow.id}-step-${index + 1}`,
      workflowId: workflow.id,
      stepNumber: index + 1,
      action,
      dueDate: dueDate.toISOString().slice(0, 10),
      status: index === 0 ? "current" : "blocked",
      approvalRequired: true,
    };
  });
}

export function classifyWorkflowTimeline(steps = []) {
  const completedSteps = steps.filter((step) => step.status === "completed");
  const currentStep = steps.find((step) => step.status === "current") || null;
  const nextRecommendedStep =
    steps.find((step) => step.status === "blocked") || currentStep;
  const blockedSteps = steps.filter((step) => step.status === "blocked");
  const overdueSteps = steps.filter((step) => {
    const age = daysSince(step.dueDate);
    return age !== null && age > 0 && step.status !== "completed";
  });

  return {
    completedSteps,
    currentStep,
    nextRecommendedStep,
    blockedSteps,
    overdueSteps,
  };
}
