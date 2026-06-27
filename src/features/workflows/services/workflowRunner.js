import { isOneOf } from "../../../utils/validation";

const APPROVAL_STATUSES = ["Pending", "Approve", "Reject", "Edit", "Postpone"];

export function createApprovalQueue(workflows = []) {
  return workflows.flatMap((workflow) =>
    workflow.actions.slice(0, 1).map((action, index) => ({
      id: `${workflow.id}-approval-${index + 1}`,
      workflowId: workflow.id,
      workflowName: workflow.name,
      action,
      status: "Pending",
      options: ["Approve", "Reject", "Edit", "Postpone"],
      approvalRequired: true,
      generatedAt: workflow.generatedAt,
    }))
  );
}

export function updateApproval(queue, approvalId, status) {
  if (!isOneOf(status, APPROVAL_STATUSES)) return queue;

  return queue.map((approval) =>
    approval.id === approvalId
      ? {
          ...approval,
          status,
        }
      : approval
  );
}
