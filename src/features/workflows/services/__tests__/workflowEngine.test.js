import { describe, expect, it } from "vitest";
import { evaluateWorkflows } from "../workflowEngine";
import { updateApproval } from "../workflowRunner";

describe("workflow engine", () => {
  it("returns a fallback workflow when no specific rule recommends one", () => {
    const result = evaluateWorkflows({ deal: {}, messages: [] });

    expect(result.activeWorkflows.length).toBeGreaterThan(0);
    expect(result.pendingApprovals.length).toBeGreaterThan(0);
    expect(result.timeline).toBeTruthy();
  });

  it("ignores invalid approval statuses", () => {
    const queue = [{ id: "a1", status: "Pending" }];

    expect(updateApproval(queue, "a1", "Invalid")).toEqual(queue);
    expect(updateApproval(queue, "a1", "Approve")[0].status).toBe("Approve");
  });
});
