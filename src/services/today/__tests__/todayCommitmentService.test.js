import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateOwnedDeal, updateSellerTask, updateSequenceStep } = vi.hoisted(() => ({
  updateOwnedDeal: vi.fn(),
  updateSellerTask: vi.fn(),
  updateSequenceStep: vi.fn(),
}));

vi.mock("../../repositories", () => ({
  updateOwnedDeal,
  updateSellerTask,
  updateSequenceStep,
}));

import {
  completeTodayCommitment,
  revisitTodayCommitment,
} from "../todayCommitmentService";

const NOW = new Date("2026-08-04T12:00:00.000Z").getTime();

describe("Today commitment commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateOwnedDeal.mockResolvedValue({ success: true, data: {} });
    updateSellerTask.mockResolvedValue({ success: true, data: {} });
    updateSequenceStep.mockResolvedValue({ success: true, data: {} });
  });

  it("durably completes the source record", async () => {
    const result = await completeTodayCommitment(
      { commitment: { sourceType: "seller-task", sourceId: "task-1" } },
      { now: NOW }
    );

    expect(result.success).toBe(true);
    expect(updateSellerTask).toHaveBeenCalledWith("task-1", {
      status: "completed",
      updated_at: "2026-08-04T12:00:00.000Z",
    });
  });

  it("durably reschedules each source to a future date", async () => {
    await revisitTodayCommitment(
      { commitment: { sourceType: "sequence-step", sourceId: "step-1" } },
      "2026-08-10",
      { now: NOW }
    );

    expect(updateSequenceStep).toHaveBeenCalledWith("step-1", {
      due_date: "2026-08-10",
      status: "Pending",
      updated_at: "2026-08-04T12:00:00.000Z",
    });
  });

  it("clears a completed deal-owned obligation so reload cannot requeue it", async () => {
    await completeTodayCommitment(
      { commitment: { sourceType: "deal", sourceId: "deal-1" } },
      { now: NOW }
    );

    expect(updateOwnedDeal).toHaveBeenCalledWith("deal-1", {
      next_action: null,
      next_action_due_date: null,
      due_date: null,
      follow_up_date: null,
      updated_at: "2026-08-04T12:00:00.000Z",
    });
  });

  it("rejects non-future revisit dates without writing", async () => {
    const result = await revisitTodayCommitment(
      { commitment: { sourceType: "seller-task", sourceId: "task-1" } },
      "2026-08-04",
      { now: NOW }
    );

    expect(result.success).toBe(false);
    expect(updateSellerTask).not.toHaveBeenCalled();
  });
});
