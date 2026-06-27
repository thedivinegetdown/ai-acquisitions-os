export type WorkflowPriority = "Low" | "Medium" | "High" | "Critical";
export type WorkflowStatus = "recommended" | "blocked" | "completed" | string;

export type WorkflowCondition = {
  label: string;
  passed: boolean;
  detail?: string;
};

export type WorkflowAction = string;

export type WorkflowDefinition = {
  id: string;
  name: string;
  description: string;
  priority: WorkflowPriority | string;
  status: WorkflowStatus;
  trigger: string;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  approvalRequired: boolean;
  generatedAt: string;
};

export type WorkflowExecution = {
  workflowId: string;
  status: string;
  generatedAt: string;
  latestAction: string;
};

export type WorkflowRecommendation = WorkflowDefinition;

export type WorkflowApproval = {
  id: string;
  workflowId: string;
  workflowName: string;
  action: string;
  status: "Pending" | "Approved" | "Rejected" | "Edited" | "Postponed" | string;
  options: string[];
  approvalRequired: boolean;
  generatedAt: string;
};
