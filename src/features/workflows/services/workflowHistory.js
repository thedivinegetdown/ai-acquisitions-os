export function createWorkflowHistory(workflows = []) {
  return workflows.map((workflow) => ({
    workflowId: workflow.id,
    status: workflow.status,
    generatedAt: workflow.generatedAt,
    latestAction: workflow.actions[0] || "Review workflow",
  }));
}

export function getRecentlyCompletedWorkflows(workflows = []) {
  return workflows.filter((workflow) => workflow.status === "completed").slice(0, 5);
}
