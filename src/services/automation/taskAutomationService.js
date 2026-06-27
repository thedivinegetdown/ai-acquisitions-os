export function buildAutomationTaskSuggestions({ sequencePlan } = {}) {
  const steps = sequencePlan?.steps || [];

  return steps.map((step) => ({
    title: `${step.channel}: ${step.description}`,
    dueLabel: step.timing,
    status: step.status,
  }));
}

export function getRecommendedTaskAction({ sequencePlan } = {}) {
  const readyStep = (sequencePlan?.steps || []).find(
    (step) => step.status === "Ready"
  );

  if (readyStep) {
    return `Prepare ${readyStep.channel.toLowerCase()} step: ${readyStep.description}`;
  }

  return "Review sequence steps before creating any tasks.";
}
