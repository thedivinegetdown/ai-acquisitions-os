import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateOwnedDeal } = vi.hoisted(() => ({ updateOwnedDeal: vi.fn() }));
vi.mock("../../repositories", () => ({ updateOwnedDeal }));

import { transitionPipelineStage } from "../stageTransitionService";
import { getAllowedPipelineStageTransitions } from "../pipelineService";

describe("canonical pipeline stage transitions", () => {
  beforeEach(() => updateOwnedDeal.mockReset());

  it("persists an allowed adjacent transition with optimistic stage ownership", async () => {
    updateOwnedDeal.mockResolvedValue({ success: true, data: { id: "deal-1", stage: "Contacted" } });

    const result = await transitionPipelineStage({
      dealId: "deal-1",
      currentStage: "New Lead",
      targetStage: "Contacted",
    });

    expect(result.success).toBe(true);
    expect(updateOwnedDeal).toHaveBeenCalledWith(
      "deal-1",
      expect.objectContaining({ stage: "Contacted", updated_at: expect.any(String) }),
      { expectedStage: "New Lead" }
    );
  });

  it("rejects invalid jumps without writing", async () => {
    const result = await transitionPipelineStage({
      dealId: "deal-1",
      currentStage: "New Lead",
      targetStage: "Closed",
    });

    expect(result.success).toBe(false);
    expect(result.error.message).toMatch(/invalid pipeline transition/i);
    expect(updateOwnedDeal).not.toHaveBeenCalled();
  });

  it("exposes the existing ordered progression plus Dead Lead", () => {
    expect(getAllowedPipelineStageTransitions("Contacted")).toEqual(["Offer Sent", "Dead Lead"]);
    expect(getAllowedPipelineStageTransitions("Closed")).toEqual([]);
  });
});
