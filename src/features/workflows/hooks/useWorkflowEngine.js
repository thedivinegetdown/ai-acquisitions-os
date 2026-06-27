import { useMemo, useState } from "react";
import { evaluateWorkflows, updateApproval } from "../services";

export function useWorkflowEngine(input = {}) {
  const evaluation = useMemo(
    () =>
      evaluateWorkflows({
        deal: input.deal,
        messages: Array.isArray(input.messages) ? input.messages : [],
        tasks: Array.isArray(input.tasks) ? input.tasks : [],
      }),
    [input.deal, input.messages, input.tasks]
  );
  const [approvalOverrides, setApprovalOverrides] = useState({});
  const pendingApprovals = evaluation.pendingApprovals.map((approval) => ({
    ...approval,
    status: approvalOverrides[approval.id] || approval.status,
  }));

  function setApprovalStatus(approvalId, status) {
    setApprovalOverrides((current) => ({
      ...current,
      [approvalId]: status,
    }));
  }

  return {
    ...evaluation,
    pendingApprovals,
    updateApproval: (approvalId, status) =>
      updateApproval(pendingApprovals, approvalId, status),
    setApprovalStatus,
  };
}
